/**
 * The reference access-projection runtime host (W041): the thin typed
 * HOST FACADE over the @epoch/access-projection kernel.
 *
 * Owns (and only owns): policy registration + versioning, canonical
 * record admission (opaque typed references to the W036 shapes), the
 * TWO-STAGE evaluation pipeline (the W009 authorization gate denies
 * unauthorized operations BEFORE any kernel admission; the sealed
 * decision then enters the kernel's stage 1), projection
 * materialization, audit emission with the evaluation-key replay
 * discipline (a duplicate evaluation returns the SEALED PRIOR records
 * and emits NO events — events are facts), and the derived
 * projection-state projection. Every step emits one
 * `access-projection:*` event on the target's stream (one object = one
 * stream `stream:access-<slug>`, one policy = one stream, one tenant
 * state = one stream; digests sealed by the kernel and pinned by the
 * REAL sealEvent parity tests).
 *
 * Explicitly NOT (later Work Orders / out of scope): durable
 * persistence, identity-provider or external policy-engine
 * integrations, experience-layer delivery of projections (W011
 * consumers bind to the contracts/access-projection surface),
 * cross-tenant federation.
 *
 * Determinism: ZERO wall-clock reads and ZERO randomness — every
 * instant is caller-supplied; every listing/snapshot is sorted (no
 * insertion-order leaks); two runtimes fed the same operations hold
 * byte-identical state.
 *
 * Tenant isolation (R12): all state is tenant-scoped; cross-tenant
 * operations are typed `tenant-isolation-rejected`. The host may be
 * pinned to one tenant (`expectedTenantId`, the single-tenant guard
 * precedent).
 */
import {
  AUTHORIZATION_RECORD_VERSION,
  evaluate,
  parseAuthorizationContext,
  sealAuthorizationDecision,
} from '@epoch/authorization';
import type { AuthorizationDecision } from '@epoch/authorization';
import {
  ACCESS_PROJECTION_EVENT_DISCRIMINATORS,
  accessStateStreamIdOf,
  accessStreamIdOf,
  admitCanonicalRecord,
  admitProjection,
  admitProjectionPolicy,
  appendAuditRecord,
  canonicalObjectIdentity,
  canonicalTenantId,
  evaluateProjection,
  findCanonicalRecord,
  findPolicyRevision,
  isObjectClass,
  openAccessProjectionStore,
  projectAccessState,
  sealAccessProjectionEvent,
  sealProjectionPolicy,
  verifyCanonicalRecord,
  OBJECT_CLASS_SCHEMA_NAMES,
  type AccessProjectionStore,
  type CanonicalRecord,
  type ProjectionEvaluation,
  type SealedAccessProjectionEvent,
} from '@epoch/access-projection';
import { RUNTIME_RECORD_VERSION } from './version';
import type {
  AccessProjectionRuntimeOptions,
  AccessServiceError,
  AccessServiceResult,
  AdmitRecordOptions,
  AuthorizationInput,
  ProjectOptions,
  ProjectStateOptions,
  ProjectionOutcome,
  ReadOptions,
  RegisterPolicyOptions,
  RuntimeHealth,
  RuntimeSnapshot,
  StoreEntry,
} from './types';

/** Event payload data (the JSON value space the kernel payload accepts). */
type EventData = Record<string, string | number | boolean | null>;

/** Deterministic composite key: `<tenantId>`. */
function tenantKey(tenantId: string): string {
  return tenantId;
}

/** Sniff the object class of one loose sealed W036 record (by schema). */
function sniffObjectClass(record: unknown): string | null {
  if (typeof record !== 'object' || record === null) return null;
  const schema = (record as { schema?: unknown }).schema;
  if (typeof schema !== 'string') return null;
  for (const [objectClass, schemaName] of Object.entries(OBJECT_CLASS_SCHEMA_NAMES)) {
    if (schema === schemaName) return objectClass;
  }
  return null;
}

/** The reference access-projection runtime host. */
export class AccessProjectionRuntime {
  private readonly expectedTenantId: string | undefined;
  private readonly stores = new Map<string, StoreEntry>();
  private readonly streams = new Map<string, SealedAccessProjectionEvent[]>();

  constructor(options: AccessProjectionRuntimeOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
  }

  // --------------------------------------------------------------------------------
  // Guards (the W009 gate denies BEFORE any kernel admission).
  // --------------------------------------------------------------------------------

  private tenantGuard(tenantId: string): AccessServiceError | null {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        code: 'tenant-isolation-rejected',
        message:
          `this access-projection host is scoped to tenant "${this.expectedTenantId}" — operations for tenant "${tenantId}" are rejected (R12 tenant isolation)`,
        expectedTenantId: this.expectedTenantId,
        encounteredTenantId: tenantId,
        subject: tenantId,
      };
    }
    return null;
  }

  private authorizationGate(
    operation: string,
    tenantId: string,
    authorization: AuthorizationInput,
    resourceId: string,
    resourceType: string,
  ): AccessServiceResult<{ principalId: string }> {
    const context = parseAuthorizationContext(authorization.context);
    if (!context.ok) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `the authorization context failed validation: ${context.error.message}`,
          issues:
            context.error.code === 'validation'
              ? context.error.issues.map((issue) => ({
                  path: issue.path,
                  message: issue.message,
                }))
              : [{ path: 'context', message: context.error.message }],
        },
      };
    }
    const request = {
      schemaVersion: AUTHORIZATION_RECORD_VERSION,
      principalId: authorization.principalId,
      actionKind: `access-projection.${operation}`,
      resource: { resourceType, resourceId, tenantId },
      ...(authorization.justification !== undefined
        ? { justification: authorization.justification }
        : {}),
    };
    const decision = evaluate(request, context.value);
    if (!decision.ok) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `the W009 evaluation failed: ${decision.error.message}`,
          issues: [{ path: 'request', message: decision.error.message }],
        },
      };
    }
    const value: AuthorizationDecision = decision.value;
    if (value.outcome === 'deny') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message:
            `principal "${authorization.principalId}" is not authorized for access-projection.${operation} ` +
            `(${value.denial.code}): ${value.denial.message}`,
          denialCode: value.denial.code,
          principalId: authorization.principalId,
          operation,
        },
      };
    }
    if (value.outcome === 'not-applicable') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message:
            `the authorization decision point is not applicable to this request (${value.reason}) — ` +
            'access-projection resources are tenant-scoped, so this is a fail-closed rejection',
          denialCode: value.reason,
          principalId: authorization.principalId,
          operation,
        },
      };
    }
    return { ok: true, value: { principalId: authorization.principalId } };
  }

  private storeOf(tenantId: string): AccessServiceResult<StoreEntry> {
    const entry = this.stores.get(tenantKey(tenantId));
    if (entry === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-store',
          message: `no access-projection state exists for tenant "${tenantId}"`,
          tenantId,
        },
      };
    }
    return { ok: true, value: entry };
  }

  private replaceStore(entry: StoreEntry, store: AccessProjectionStore): void {
    this.stores.set(tenantKey(entry.tenantId), { tenantId: entry.tenantId, store });
  }

  // --------------------------------------------------------------------------------
  // Event emission (facts; replays emit NOTHING).
  // --------------------------------------------------------------------------------

  private emitEvent(
    tenantId: string,
    streamId: string,
    actor: string,
    occurredAt: string,
    payload: { discriminator: (typeof ACCESS_PROJECTION_EVENT_DISCRIMINATORS)[number]; data: EventData },
  ): AccessServiceResult<SealedAccessProjectionEvent> {
    const stream = this.streams.get(streamId) ?? [];
    const sequence = stream.length + 1;
    const causalParent =
      stream.length === 0
        ? null
        : { streamId, sequence: stream[stream.length - 1]!.sequence };
    const sealed = sealAccessProjectionEvent({
      schemaVersion: RUNTIME_RECORD_VERSION,
      streamId,
      sequence,
      tenantId,
      actor,
      causalParent,
      payload: { discriminator: payload.discriminator, data: payload.data },
      occurredAt,
    });
    if (!sealed.ok) return { ok: false, error: sealed.error };
    this.streams.set(streamId, [...stream, sealed.value]);
    return { ok: true, value: sealed.value };
  }

  // --------------------------------------------------------------------------------
  // Policy registration + versioning.
  // --------------------------------------------------------------------------------

  /** Register one projection policy revision (idempotent by exact revision). */
  registerPolicy(
    options: RegisterPolicyOptions,
  ): AccessServiceResult<{
    kind: 'policy-admitted' | 'duplicate-policy-returned';
    policyId: string;
    revision: number;
    policyDigest: string;
  }> {
    // Sniff the tenant from the (loose or sealed) policy content.
    const tenantId = (options.policy as { tenantId?: unknown } | null)?.tenantId;
    if (typeof tenantId !== 'string') {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'the policy content does not declare a tenant scope',
          issues: [{ path: 'tenantId', message: 'missing tenant scope' }],
        },
      };
    }
    const guard = this.tenantGuard(tenantId);
    if (guard !== null) return { ok: false, error: guard };
    const policyId = (options.policy as { policyId?: unknown }).policyId;
    const gate = this.authorizationGate(
      'register-policy',
      tenantId,
      options.authorization,
      typeof policyId === 'string' ? policyId : '<unknown>',
      'access-projection-policy',
    );
    if (!gate.ok) return gate;

    // Loose content seals here; an already-sealed revision is admitted
    // as-is (the kernel verifies its digest either way).
    const alreadySealed =
      typeof (options.policy as { contentDigest?: unknown } | null)?.contentDigest === 'string';
    const sealedPolicy = alreadySealed
      ? ({ ok: true as const, value: options.policy } as const)
      : sealProjectionPolicy(options.policy);
    if (!sealedPolicy.ok) return { ok: false, error: sealedPolicy.error };

    const existing = this.stores.get(tenantKey(tenantId));
    const entry: StoreEntry =
      existing ?? { tenantId, store: unwrapStore(openAccessProjectionStore({ tenantId })) };
    const admission = admitProjectionPolicy(entry.store, sealedPolicy.value);
    if (!admission.ok) return { ok: false, error: admission.error };
    this.replaceStore(entry, admission.value.store);

    const emitted = this.emitEvent(
      tenantId,
      accessStreamIdOf(admission.value.outcome.policy.policyId),
      gate.value.principalId,
      options.registeredAt,
      {
        discriminator: 'access-projection:policy-registered',
        data: {
          policyId: admission.value.outcome.policy.policyId,
          revision: admission.value.outcome.policy.revision,
          policyDigest: admission.value.outcome.policy.contentDigest,
          status: admission.value.outcome.policy.status,
          bindingCount: admission.value.outcome.policy.bindings.length,
        },
      },
    );
    if (!emitted.ok) return { ok: false, error: emitted.error };

    return {
      ok: true,
      value: {
        kind: admission.value.outcome.kind,
        policyId: admission.value.outcome.policy.policyId,
        revision: admission.value.outcome.policy.revision,
        policyDigest: admission.value.outcome.policy.contentDigest,
      },
    };
  }

  // --------------------------------------------------------------------------------
  // Canonical record admission (opaque typed references to W036 shapes).
  // --------------------------------------------------------------------------------

  /** Admit one canonical sealed W036 record (idempotent by exact revision). */
  admitRecord(
    options: AdmitRecordOptions,
  ): AccessServiceResult<{
    kind: 'record-admitted' | 'duplicate-record-returned';
    objectClass: string;
    objectId: string;
    objectDigest: string;
  }> {
    const objectClass = sniffObjectClass(options.record);
    if (objectClass === null || !isObjectClass(objectClass)) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message:
            'the record does not carry a canonical W036 schema discriminator (expected one of the four object-class schemas)',
          issues: [{ path: 'schema', message: 'unknown canonical record schema' }],
        },
      };
    }
    const canonical = { objectClass, record: options.record } as CanonicalRecord;
    const tenantId = canonicalTenantId(canonical);
    const guard = this.tenantGuard(tenantId);
    if (guard !== null) return { ok: false, error: guard };
    const identity = canonicalObjectIdentity(canonical);
    const gate = this.authorizationGate(
      'admit-record',
      tenantId,
      options.authorization,
      identity.objectId,
      identity.objectClass,
    );
    if (!gate.ok) return gate;

    const existing = this.stores.get(tenantKey(tenantId));
    const entry: StoreEntry =
      existing ?? { tenantId, store: unwrapStore(openAccessProjectionStore({ tenantId })) };
    const admission = admitCanonicalRecord(entry.store, canonical);
    if (!admission.ok) return { ok: false, error: admission.error };
    this.replaceStore(entry, admission.value.store);

    const emitted = this.emitEvent(
      tenantId,
      accessStreamIdOf(identity.objectId),
      gate.value.principalId,
      options.admittedAt,
      {
        discriminator: 'access-projection:record-admitted',
        data: {
          objectClass: identity.objectClass,
          objectId: identity.objectId,
          objectDigest: identity.objectDigest,
        },
      },
    );
    if (!emitted.ok) return { ok: false, error: emitted.error };

    return {
      ok: true,
      value: {
        kind: admission.value.outcome.kind,
        objectClass: identity.objectClass,
        objectId: identity.objectId,
        objectDigest: identity.objectDigest,
      },
    };
  }

  // --------------------------------------------------------------------------------
  // The two-stage evaluation pipeline.
  // --------------------------------------------------------------------------------

  /**
   * Project one canonical object for one subject under one policy
   * revision. The W009 gate runs FIRST (the sealed decision the kernel
   * then consumes); released and denied outcomes both carry the sealed
   * audit record; a duplicate evaluation returns the SEALED PRIOR
   * records and emits NO events.
   */
  project(options: ProjectOptions): AccessServiceResult<ProjectionOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) return { ok: false, error: guard };

    const gate = this.authorizationGate(
      options.action,
      options.tenantId,
      options.authorization,
      options.recordRef.objectId,
      options.recordRef.objectClass,
    );
    if (!gate.ok) return gate;

    const storeEntry = this.storeOf(options.tenantId);
    if (!storeEntry.ok) return storeEntry;
    const entry = storeEntry.value;

    const canonical = findCanonicalRecord(
      entry.store,
      options.recordRef.objectClass,
      options.recordRef.objectId,
      options.recordRef.objectDigest,
    );
    if (canonical === null) {
      return {
        ok: false,
        error: {
          code: 'unknown-record',
          message:
            `canonical record ("${options.recordRef.objectClass}", "${options.recordRef.objectId}") is not admitted ` +
            'at the referenced digest',
          objectClass: options.recordRef.objectClass,
          objectId: options.recordRef.objectId,
        },
      };
    }
    const policy = findPolicyRevision(
      entry.store,
      options.policyRef.policyId,
      options.policyRef.revision,
    );
    if (policy === null) {
      return {
        ok: false,
        error: {
          code: 'unknown-policy',
          message:
            `policy "${options.policyRef.policyId}" revision ${options.policyRef.revision} is not registered`,
          policyId: options.policyRef.policyId,
          revision: options.policyRef.revision,
        },
      };
    }

    // Stage 1 lives in the W009 decision point: evaluate + seal here,
    // then the kernel consumes the sealed decision (its own stage-1
    // checks re-verify the request-digest binding — defense in depth).
    const request = {
      schemaVersion: AUTHORIZATION_RECORD_VERSION,
      principalId: options.authorization.principalId,
      actionKind: `access-projection.${options.action}`,
      resource: {
        resourceType: options.recordRef.objectClass,
        resourceId: options.recordRef.objectId,
        tenantId: options.tenantId,
      },
      ...(options.authorization.justification !== undefined
        ? { justification: options.authorization.justification }
        : {}),
    };
    const decision = evaluate(request, options.authorization.context);
    if (!decision.ok) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `the W009 evaluation failed: ${decision.error.message}`,
          issues: [{ path: 'request', message: decision.error.message }],
        },
      };
    }
    const sealedDecision = sealAuthorizationDecision(decision.value);
    if (!sealedDecision.ok) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `the W009 decision failed to seal: ${sealedDecision.error.message}`,
          issues: [{ path: 'decision', message: sealedDecision.error.message }],
        },
      };
    }

    const evaluation = evaluateProjection({
      request,
      decision: sealedDecision.value,
      policy,
      record: canonical,
      subject: options.subject,
      ...(options.taskContext !== undefined ? { taskContext: options.taskContext } : {}),
      projectedAt: options.projectedAt,
      projectedBy: gate.value.principalId,
    });
    if (!evaluation.ok) return { ok: false, error: evaluation.error };
    const result: ProjectionEvaluation = evaluation.value;

    // Audit emission (the evaluation-key replay discipline: a duplicate
    // returns the SEALED PRIOR audit record and emits NO events).
    const auditAdmission = appendAuditRecord(entry.store, result.audit);
    if (!auditAdmission.ok) return { ok: false, error: auditAdmission.error };
    this.replaceStore(entry, auditAdmission.value.store);
    const replayed = auditAdmission.value.outcome.kind === 'duplicate-audit-returned';

    if (result.outcome === 'released' && !replayed) {
      // Chain off the AUDIT-UPDATED store (the admission pipeline is a
      // fold: every step builds on the previous store).
      const projectionAdmission = admitProjection(auditAdmission.value.store, result.projection);
      if (!projectionAdmission.ok) return { ok: false, error: projectionAdmission.error };
      this.replaceStore(entry, projectionAdmission.value.store);
    }

    if (!replayed) {
      const identity = canonicalObjectIdentity(canonical);
      const releaseEvent =
        result.outcome === 'released'
          ? this.emitEvent(
              options.tenantId,
              accessStreamIdOf(identity.objectId),
              gate.value.principalId,
              options.projectedAt,
              {
                discriminator: 'access-projection:projection-released',
                data: {
                  objectClass: identity.objectClass,
                  objectId: identity.objectId,
                  objectDigest: identity.objectDigest,
                  principalId: options.authorization.principalId,
                  action: options.action,
                  policyDigest: policy.contentDigest,
                  projectionDigest: result.projection.contentDigest,
                  auditDigest: result.audit.contentDigest,
                  releasedFieldCount: result.audit.fieldsReleased.length,
                  redactedFieldCount: result.audit.fieldsRedacted.length,
                },
              },
            )
          : this.emitEvent(
              options.tenantId,
              accessStreamIdOf(identity.objectId),
              gate.value.principalId,
              options.projectedAt,
              {
                discriminator: 'access-projection:projection-denied',
                data: {
                  objectClass: identity.objectClass,
                  objectId: identity.objectId,
                  objectDigest: identity.objectDigest,
                  principalId: options.authorization.principalId,
                  action: options.action,
                  policyDigest: policy.contentDigest,
                  auditDigest: result.audit.contentDigest,
                  denialCode: result.denial.code,
                },
              },
            );
      if (!releaseEvent.ok) return { ok: false, error: releaseEvent.error };

      const auditEvent = this.emitEvent(
        options.tenantId,
        accessStreamIdOf(identity.objectId),
        gate.value.principalId,
        options.projectedAt,
        {
          discriminator: 'access-projection:audit-recorded',
          data: {
            auditId: result.audit.auditId,
            evaluationKey: result.audit.evaluationKey,
            auditDigest: result.audit.contentDigest,
            outcome: result.audit.outcome,
          },
        },
      );
      if (!auditEvent.ok) return { ok: false, error: auditEvent.error };
    }

    return { ok: true, value: { evaluation: result, replayed } };
  }

  // --------------------------------------------------------------------------------
  // The derived projection-state projection.
  // --------------------------------------------------------------------------------

  /** Project the derived access-projection state of one tenant. */
  projectState(
    options: ProjectStateOptions,
  ): AccessServiceResult<ReturnType<typeof projectAccessState>> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) return { ok: false, error: guard };
    const gate = this.authorizationGate(
      'project-state',
      options.tenantId,
      options.authorization,
      options.tenantId,
      'access-projection-store',
    );
    if (!gate.ok) return gate;

    const storeEntry = this.storeOf(options.tenantId);
    if (!storeEntry.ok) return storeEntry;

    const state = projectAccessState(storeEntry.value.store);
    const emitted = this.emitEvent(
      options.tenantId,
      accessStateStreamIdOf(options.tenantId),
      gate.value.principalId,
      options.projectedAt,
      {
        discriminator: 'access-projection:state-projected',
        data: {
          policyCount: state.policyCount,
          recordCount: state.recordCount,
          projectionCount: state.projectionCount,
          auditCount: state.auditCount,
        },
      },
    );
    if (!emitted.ok) return { ok: false, error: emitted.error };
    return { ok: true, value: state };
  }

  // --------------------------------------------------------------------------------
  // Reads (no admission, no events).
  // --------------------------------------------------------------------------------

  /** The append-only audit trail of one tenant (append order). */
  auditTrail(options: ReadOptions): AccessServiceResult<readonly unknown[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) return { ok: false, error: guard };
    const storeEntry = this.storeOf(options.tenantId);
    if (!storeEntry.ok) return storeEntry;
    return { ok: true, value: storeEntry.value.store.audits };
  }

  /** One event stream (sorted by sequence — the kernel seal order). */
  eventStream(streamId: string): readonly SealedAccessProjectionEvent[] {
    return [...(this.streams.get(streamId) ?? [])];
  }

  /** Every event, sorted by (streamId, sequence). */
  events(): readonly SealedAccessProjectionEvent[] {
    return [...this.streams.entries()]
      .flatMap(([streamId, events]) => events.map((event) => ({ streamId, event })))
      .sort((a, b) =>
        a.streamId < b.streamId ? -1 : a.streamId > b.streamId ? 1 : a.event.sequence - b.event.sequence,
      )
      .map((entry) => entry.event);
  }

  /** The typed health of the host. */
  health(): RuntimeHealth {
    let policyRevisionCount = 0;
    let recordCount = 0;
    let projectionCount = 0;
    let auditCount = 0;
    for (const entry of this.stores.values()) {
      policyRevisionCount += entry.store.policies.length;
      recordCount += entry.store.records.length;
      projectionCount += entry.store.projections.length;
      auditCount += entry.store.audits.length;
    }
    return {
      tenantCount: this.stores.size,
      policyRevisionCount,
      recordCount,
      projectionCount,
      auditCount,
      eventCount: this.events().length,
    };
  }

  /** The deterministic snapshot of the host state (sorted). */
  snapshot(): RuntimeSnapshot {
    const stores = [...this.stores.values()]
      .map((entry) => ({
        tenantId: entry.tenantId,
        policyCount: entry.store.policies.length,
        recordCount: entry.store.records.length,
        projectionCount: entry.store.projections.length,
        auditCount: entry.store.audits.length,
      }))
      .sort((a, b) => (a.tenantId < b.tenantId ? -1 : 1));
    return {
      tenants: stores.map((store) => store.tenantId),
      stores,
      eventCount: this.events().length,
      streamCount: this.streams.size,
    };
  }
}

/** Unwrap the store-opening result (the typed guard already validated). */
function unwrapStore(
  result: AccessServiceResult<AccessProjectionStore>,
): AccessProjectionStore {
  if (!result.ok) throw new Error(`internal error: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** Verify one canonical record (exported for hostless use). */
export { verifyCanonicalRecord };
