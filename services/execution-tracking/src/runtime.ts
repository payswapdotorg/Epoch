/**
 * The reference execution-tracking runtime host (W038): the thin typed
 * HOST FACADE over the @epoch/execution-tracking kernel.
 *
 * Owns (and only owns): tenant-scoped program registration (the opaque
 * work-package/activity/milestone index over the REAL W036 ProgramOfWork
 * — the schedule authority stays in the program), delivery-record
 * registration (idempotent by digest), the LOW-FRICTION field-capture
 * intake — direct or through the FieldCapturePort adapter seam (ONE
 * in-memory reference adapter; the core never names a vendor) — with
 * IDEMPOTENT replay (same capture content -> the typed
 * `duplicate-observation` admission returning the prior digest, state
 * unchanged), tracking-state transitions (append-only chains, the
 * schedule authority STAYS in ProgramOfWork), issue raising/resolution
 * (changes/delays/rework/defects/blockers), reconciliation proposals and
 * their application EXCLUSIVELY through the W036 DeliveryRecord authority
 * path (recordObservation -> acceptObservation -> actualizeObservation —
 * never a direct actual write), and the derived execution-state
 * projection. Every step emits `execution:*` events on the affected work
 * packages' streams (`stream:execution-<suffix>`, one stream per work
 * package, digests sealed by the kernel and pinned by the REAL sealEvent
 * parity tests).
 *
 * Explicitly NOT (later Work Orders / out of scope): durable persistence,
 * real field-system integrations (adapters of FieldCapturePort), the
 * supervision/alerting layer (W043), the external event bridge (W042).
 *
 * Determinism: ZERO wall-clock reads and ZERO randomness — every instant
 * is caller-supplied; every listing/snapshot is sorted (no
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
} from '@epoch/authorization';
import type { AuthorizationDecision } from '@epoch/authorization';
import {
  admitIssue,
  admitIssueResolution,
  admitReconciliationProposal,
  admitTrackingState,
  applyReconciliationProposal,
  buildProgramIndex,
  executionStreamIdOf,
  intakeFieldObservation,
  linkedWorkPackageOfObservation,
  mapDeliveryError,
  openExecutionTrackingStore,
  projectExecutionState,
  sealExecutionEvent,
  verifySealedDeliveryRecord,
  verifySealedProgramOfWork,
  verifySealedReconciliationProposal,
  type ExecutionStateProjection,
  type ExecutionTrackingStore,
  type SealedExecutionEvent,
} from '@epoch/execution-tracking';
import { InMemoryFieldCaptureAdapter } from './field-port';
import { RUNTIME_RECORD_VERSION } from './version';
import type {
  ApplyReconciliationOptions,
  AuthorizationInput,
  DeliveryEntry,
  ExecutionServiceResult,
  ExecutionTrackingRuntimeOptions,
  FieldCapturePort,
  FieldIntakeServiceOutcome,
  IntakeFieldCaptureOptions,
  PollFieldCapturesOptions,
  ProjectStateOptions,
  ProposalEntry,
  RaiseIssueOptions,
  RecordTrackingStateOptions,
  RegisterDeliveryOptions,
  RegisterProgramOptions,
  ResolveIssueOptions,
  RuntimeHealth,
  RuntimeSnapshot,
  StoreEntry,
  StreamReadOptions,
  ProposeReconciliationOptions,
} from './types';

/** Event payload data (the JSON value space the kernel payload accepts). */
type EventData = Record<string, string | number | boolean | null | readonly string[]>;

/** Deterministic composite key: `<tenantId>#<solutionId>`. */
function tenantKey(tenantId: string, solutionId: string): string {
  return `${tenantId}#${solutionId}`;
}

/**
 * The reference execution-tracking runtime host. Construct directly (the
 * in-memory FieldCapturePort reference adapter is the default).
 * In-memory only: no persistence, no network, no clocks.
 */
export class ExecutionTrackingRuntime {
  /** tenantId#solutionId -> store entry. Maps iterate in insertion order; every read path sorts. */
  private readonly stores = new Map<string, StoreEntry>();

  /** tenantId#deliveryId -> delivery entry. */
  private readonly deliveries = new Map<string, DeliveryEntry>();

  /** tenantId#proposalId -> proposal entry (the proposal + its application). */
  private readonly proposals = new Map<string, ProposalEntry>();

  /** stream:execution-<suffix> -> events (append-only). */
  private readonly streams = new Map<string, SealedExecutionEvent[]>();

  private readonly fieldCapturePort: FieldCapturePort;

  private readonly expectedTenantId: string | undefined;

  constructor(options: ExecutionTrackingRuntimeOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
    this.fieldCapturePort = options.fieldCapturePort ?? new InMemoryFieldCaptureAdapter();
  }

  // --------------------------------------------------------------------------------
  // The authorization gate (W009 — the W022/W037 pattern).
  // --------------------------------------------------------------------------------

  private authorizationGate(
    operation: string,
    tenantId: string,
    authorization: AuthorizationInput,
    resourceId: string,
    resourceType: string,
  ): ExecutionServiceResult<{ principalId: string }> {
    const context = parseAuthorizationContext(authorization.context);
    if (!context.ok) {
      return { ok: false, error: context.error };
    }
    const request = {
      schemaVersion: AUTHORIZATION_RECORD_VERSION,
      principalId: authorization.principalId,
      actionKind: `execution.${operation}`,
      resource: { resourceType, resourceId, tenantId },
      ...(authorization.justification !== undefined
        ? { justification: authorization.justification }
        : {}),
    };
    const decision = evaluate(request, context.value);
    if (!decision.ok) {
      return { ok: false, error: decision.error };
    }
    const value: AuthorizationDecision = decision.value;
    if (value.outcome === 'deny') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `principal "${authorization.principalId}" is not authorized for execution.${operation} (${value.denial.code}): ${value.denial.message}`,
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
          message: `the authorization decision point is not applicable to this request (${value.reason}) — intake is tenant-scoped, so this is a fail-closed rejection`,
          denialCode: value.reason,
          principalId: authorization.principalId,
          operation,
        },
      };
    }
    return { ok: true, value: { principalId: authorization.principalId } };
  }

  private tenantGuard(tenantId: string): ExecutionServiceResult<null> {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `this execution-tracking host is scoped to tenant "${this.expectedTenantId}" — operations for tenant "${tenantId}" are rejected (R12 tenant isolation)`,
          expectedTenantId: this.expectedTenantId,
          encounteredTenantId: tenantId,
          subject: tenantId,
        },
      };
    }
    return { ok: true, value: null };
  }

  // --------------------------------------------------------------------------------
  // Registration (the schedule authority input; idempotent by digest).
  // --------------------------------------------------------------------------------

  /**
   * Register the sealed W036 ProgramOfWork: verifies the program (digest
   * recomputation), extracts the opaque identity index, and opens (or
   * extends) the tenant's tracking store. The schedule authority STAYS in
   * the program — the store keeps only the linkage index.
   */
  registerProgram(options: RegisterProgramOptions): ExecutionServiceResult<StoreEntry> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'register',
      options.tenantId,
      options.authorization,
      options.program.programId,
      'execution-program',
    );
    if (!gate.ok) return gate;
    const verified = verifySealedProgramOfWork(options.program);
    if (!verified.ok) {
      return { ok: false, error: mapDeliveryError(verified.error, options.program.programId) };
    }
    const program = verified.value;
    if (program.tenantId !== options.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `program "${program.programId}" belongs to tenant "${program.tenantId}" — it cannot ground the tracking store of tenant "${options.tenantId}" (R12 tenant isolation)`,
          expectedTenantId: options.tenantId,
          encounteredTenantId: program.tenantId,
          subject: program.programId,
        },
      };
    }
    const index = buildProgramIndex(program);
    if (!index.ok) {
      return { ok: false, error: index.error };
    }
    const key = tenantKey(options.tenantId, program.solutionId);
    const existing = this.stores.get(key);
    if (existing !== undefined) {
      // Idempotent re-registration: the index is content-equal when the
      // underlying program digest is unchanged; different content under
      // the same (tenant, solution) is a typed conflict.
      const sameShape =
        JSON.stringify(existing.store.programIndex) === JSON.stringify(index.value);
      if (sameShape) {
        return { ok: true, value: existing };
      }
      return {
        ok: false,
        error: {
          code: 'version-conflict',
          message: `the tracking store for solution "${program.solutionId}" of tenant "${options.tenantId}" is already registered with a different program shape — a new program version ships as a new store lifecycle decision`,
          subject: 'execution-program',
          subjectId: program.programId,
        },
      };
    }
    const opened = openExecutionTrackingStore({
      tenantId: options.tenantId,
      solutionId: program.solutionId,
      programIndex: index.value,
    });
    if (!opened.ok) {
      return { ok: false, error: opened.error };
    }
    const entry: StoreEntry = { store: opened.value };
    this.stores.set(key, entry);
    return { ok: true, value: entry };
  }

  /** Register the sealed W036 DeliveryRecord (the authority state; idempotent by digest). */
  registerDeliveryRecord(options: RegisterDeliveryOptions): ExecutionServiceResult<DeliveryEntry> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'register',
      options.tenantId,
      options.authorization,
      options.delivery.deliveryId,
      'execution-delivery',
    );
    if (!gate.ok) return gate;
    const verified = verifySealedDeliveryRecord(options.delivery);
    if (!verified.ok) {
      return { ok: false, error: mapDeliveryError(verified.error, options.delivery.deliveryId) };
    }
    const delivery = verified.value;
    if (delivery.tenantId !== options.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `delivery "${delivery.deliveryId}" belongs to tenant "${delivery.tenantId}" — it cannot be hosted for tenant "${options.tenantId}" (R12 tenant isolation)`,
          expectedTenantId: options.tenantId,
          encounteredTenantId: delivery.tenantId,
          subject: delivery.deliveryId,
        },
      };
    }
    const key = tenantKey(options.tenantId, delivery.deliveryId);
    const existing = this.deliveries.get(key);
    if (existing !== undefined) {
      if (existing.delivery.contentDigest === delivery.contentDigest) {
        return { ok: true, value: existing };
      }
      return {
        ok: false,
        error: {
          code: 'version-conflict',
          message: `delivery "${delivery.deliveryId}" is already hosted with different state — deliveries advance through the W036 authority path only`,
          subject: 'delivery-record',
          subjectId: delivery.deliveryId,
          publishedDigest: existing.delivery.contentDigest,
          encounteredDigest: delivery.contentDigest,
        },
      };
    }
    const entry: DeliveryEntry = { delivery };
    this.deliveries.set(key, entry);
    return { ok: true, value: entry };
  }

  // --------------------------------------------------------------------------------
  // The low-friction field-capture intake (direct + through the port).
  // --------------------------------------------------------------------------------

  /** Poll the FieldCapturePort and run the single-call intake over every submission. */
  pollFieldCaptures(
    options: PollFieldCapturesOptions,
  ): ExecutionServiceResult<readonly FieldIntakeServiceOutcome[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'intake',
      options.tenantId,
      options.authorization,
      options.workPackageId ?? 'field-capture',
      'execution-capture',
    );
    if (!gate.ok) return gate;
    const submissions = this.fieldCapturePort.pollCaptures({
      tenantId: options.tenantId,
      solutionId: '',
      ...(options.workPackageId !== undefined ? { workPackageId: options.workPackageId } : {}),
      requestedAt: options.requestedAt,
      requestedBy: gate.value.principalId,
    });
    if (!submissions.ok) {
      return { ok: false, error: submissions.error };
    }
    const outcomes: FieldIntakeServiceOutcome[] = [];
    for (const submission of submissions.value) {
      const intake = this.intakeFieldCapture({
        tenantId: options.tenantId,
        authorization: options.authorization,
        capture: submission,
      });
      if (!intake.ok) {
        return intake;
      }
      outcomes.push(intake.value);
    }
    return { ok: true, value: outcomes };
  }

  /**
   * The DIRECT single-call low-friction intake: infer the work-package
   * linkage, seal the W036 observation record + resource observations +
   * evidence links with derived deterministic ids, admit everything
   * idempotently, and emit the execution events on the linked work
   * package's stream. Replays return the typed duplicate admissions with
   * the state unchanged.
   */
  intakeFieldCapture(
    options: IntakeFieldCaptureOptions,
  ): ExecutionServiceResult<FieldIntakeServiceOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    if (options.capture.tenantId !== options.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `the field capture is scoped to tenant "${options.capture.tenantId}" but the intake is for tenant "${options.tenantId}" (R12)`,
          expectedTenantId: options.tenantId,
          encounteredTenantId: options.capture.tenantId,
          subject: options.capture.captureKey,
        },
      };
    }
    const gate = this.authorizationGate(
      'intake',
      options.tenantId,
      options.authorization,
      options.capture.captureKey,
      'execution-capture',
    );
    if (!gate.ok) return gate;
    const entry = this.storeEntry(options.tenantId, options.capture.solutionId);
    if (!entry.ok) return entry;
    const intake = intakeFieldObservation(entry.value.store, options.capture);
    if (!intake.ok) {
      return { ok: false, error: intake.error };
    }
    const outcome = intake.value;
    this.stores.set(tenantKey(options.tenantId, options.capture.solutionId), {
      store: outcome.store,
    });

    // Events are FACTS: a replay (every admission a duplicate) is not a
    // new lifecycle fact — the state is unchanged and no events emit
    // (the W037 duplicate-intake precedent).
    const isReplay = outcome.observation.kind === 'duplicate-observation';
    if (!isReplay) {
      // observation-recorded
      const event = this.emitEvent(
        options.tenantId,
        outcome.linkedWorkPackageId,
        gate.value.principalId,
        options.capture.observedAt,
        {
          discriminator: 'execution:observation-recorded',
          data: {
            workPackageId: outcome.linkedWorkPackageId,
            deliveryId: options.capture.deliveryId,
            observationId: outcome.observation.record.recordId,
            subjectKind: options.capture.subjectRef.kind,
            measureKind: options.capture.measure.kind,
            observedAt: options.capture.observedAt,
          },
        },
      );
      if (!event.ok) return event;

      // resource-observation-recorded (per usage, deterministic order)
      for (const resource of outcome.resourceObservations) {
        if (resource.duplicate) continue;
        const resourceEvent = this.emitEvent(
          options.tenantId,
          outcome.linkedWorkPackageId,
          gate.value.principalId,
          resource.record.usageAt,
          {
            discriminator: 'execution:resource-observation-recorded',
            data: {
              workPackageId: outcome.linkedWorkPackageId,
              resourceObservationId: resource.record.recordId,
              resourceKind: resource.record.resourceKind,
              unit: resource.record.unit,
              quantity: resource.record.quantity,
              usageAt: resource.record.usageAt,
            },
          },
        );
        if (!resourceEvent.ok) return resourceEvent;
      }

      // evidence-linked (per link, digest-sorted)
      for (const link of outcome.evidenceLinks) {
        if (link.duplicate) continue;
        const linkEvent = this.emitEvent(
          options.tenantId,
          outcome.linkedWorkPackageId,
          gate.value.principalId,
          link.record.capturedAt,
          {
            discriminator: 'execution:evidence-linked',
            data: {
              workPackageId: outcome.linkedWorkPackageId,
              evidenceLinkId: link.record.recordId,
              evidenceDigest: link.record.digest,
              evidenceKind: link.record.evidenceKind,
              capturedAt: link.record.capturedAt,
            },
          },
        );
        if (!linkEvent.ok) return linkEvent;
      }
    }

    return {
      ok: true,
      value: {
        linkedWorkPackageId: outcome.linkedWorkPackageId,
        observation: outcome.observation,
        resourceObservationCount: outcome.resourceObservations.length,
        evidenceLinkCount: outcome.evidenceLinks.length,
      },
    };
  }

  // --------------------------------------------------------------------------------
  // Tracking-state transitions (append-only chains).
  // --------------------------------------------------------------------------------

  /** Record one tracking-state transition (the kernel chain gates run inside). */
  recordTrackingState(
    options: RecordTrackingStateOptions,
  ): ExecutionServiceResult<{ recordId: string; toState: string; duplicate: boolean }> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'track',
      options.tenantId,
      options.authorization,
      'tracking-state',
      'execution-tracking-state',
    );
    if (!gate.ok) return gate;
    const parsed = parseTrackingSubject(options.record);
    if (parsed === null) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'the tracking record must carry a subject (workPackageId) to resolve its store',
          issues: [{ path: 'subject', message: 'subject.workPackageId is required' }],
        },
      };
    }
    const entry = this.storeEntry(options.tenantId, parsed.solutionId);
    if (!entry.ok) return entry;
    const admitted = admitTrackingState(entry.value.store, options.record);
    if (!admitted.ok) {
      return { ok: false, error: admitted.error };
    }
    this.stores.set(tenantKey(options.tenantId, parsed.solutionId), {
      store: admitted.value.store,
    });
    const event = this.emitEvent(
      options.tenantId,
      admitted.value.record.subject.workPackageId,
      gate.value.principalId,
      admitted.value.record.observedAt,
      {
        discriminator: 'execution:tracking-recorded',
        data: {
          workPackageId: admitted.value.record.subject.workPackageId,
          ...(admitted.value.record.subject.activityId !== undefined
            ? { activityId: admitted.value.record.subject.activityId }
            : {}),
          trackingRecordId: admitted.value.record.recordId,
          fromState: admitted.value.record.fromState,
          toState: admitted.value.record.toState,
          observedAt: admitted.value.record.observedAt,
        },
      },
    );
    if (!event.ok) return event;
    return {
      ok: true,
      value: {
        recordId: admitted.value.record.recordId,
        toState: admitted.value.record.toState,
        duplicate: admitted.value.duplicate,
      },
    };
  }

  // --------------------------------------------------------------------------------
  // Issues: changes, delays, rework, defects and blockers.
  // --------------------------------------------------------------------------------

  /** Raise one execution issue (change/delay/rework/defect/blocker). */
  raiseIssue(options: RaiseIssueOptions): ExecutionServiceResult<{ issueRecordId: string; issueKind: string }> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'issue',
      options.tenantId,
      options.authorization,
      'execution-issue',
      'execution-issue',
    );
    if (!gate.ok) return gate;
    const parsed = parseIssueScope(options.record);
    if (parsed === null) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'the issue record must carry a solutionId and at least one impacted work package to resolve its store',
          issues: [{ path: 'solutionId', message: 'solutionId + impact.workPackageIds are required' }],
        },
      };
    }
    const entry = this.storeEntry(options.tenantId, parsed.solutionId);
    if (!entry.ok) return entry;
    const admitted = admitIssue(entry.value.store, options.record);
    if (!admitted.ok) {
      return { ok: false, error: admitted.error };
    }
    this.stores.set(tenantKey(options.tenantId, parsed.solutionId), { store: admitted.value.store });
    // issue-raised on every impacted work package's stream (sorted).
    for (const workPackageId of admitted.value.record.impact.workPackageIds) {
      const event = this.emitEvent(
        options.tenantId,
        workPackageId,
        gate.value.principalId,
        admitted.value.record.raisedAt,
        {
          discriminator: 'execution:issue-raised',
          data: {
            issueRecordId: admitted.value.record.recordId,
            issueKind: admitted.value.record.issueKind,
            severity: admitted.value.record.severity,
            workPackageId,
            raisedAt: admitted.value.record.raisedAt,
          },
        },
      );
      if (!event.ok) return event;
    }
    return {
      ok: true,
      value: {
        issueRecordId: admitted.value.record.recordId,
        issueKind: admitted.value.record.issueKind,
      },
    };
  }

  /** Resolve (or dismiss) one execution issue (exactly one resolution). */
  resolveIssue(
    options: ResolveIssueOptions,
  ): ExecutionServiceResult<{ resolutionRecordId: string; resolution: string }> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'issue',
      options.tenantId,
      options.authorization,
      'execution-issue',
      'execution-issue',
    );
    if (!gate.ok) return gate;
    const parsed = parseIssueResolutionScope(options.resolution);
    if (parsed === null) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'the issue resolution must carry a solutionId to resolve its store',
          issues: [{ path: 'solutionId', message: 'solutionId is required' }],
        },
      };
    }
    const entry = this.storeEntry(options.tenantId, parsed.solutionId);
    if (!entry.ok) return entry;
    const admitted = admitIssueResolution(entry.value.store, options.resolution);
    if (!admitted.ok) {
      return { ok: false, error: admitted.error };
    }
    this.stores.set(tenantKey(options.tenantId, parsed.solutionId), { store: admitted.value.store });
    const issue = admitted.value.store.issues.find(
      (candidate) => candidate.recordId === admitted.value.record.issueRecordId,
    )!;
    for (const workPackageId of issue.impact.workPackageIds) {
      const event = this.emitEvent(
        options.tenantId,
        workPackageId,
        gate.value.principalId,
        admitted.value.record.resolvedAt,
        {
          discriminator: 'execution:issue-resolved',
          data: {
            issueRecordId: admitted.value.record.issueRecordId,
            issueKind: issue.issueKind,
            resolution: admitted.value.record.resolution,
            resolvedAt: admitted.value.record.resolvedAt,
          },
        },
      );
      if (!event.ok) return event;
    }
    return {
      ok: true,
      value: {
        resolutionRecordId: admitted.value.record.recordId,
        resolution: admitted.value.record.resolution,
      },
    };
  }

  // --------------------------------------------------------------------------------
  // Reconciliation: proposals and the W036 authority application.
  // --------------------------------------------------------------------------------

  /**
   * Record one reconciliation proposal (typed data — acceptance and
   * actualization are the W036 DeliveryRecord authority's acts).
   */
  proposeReconciliation(
    options: ProposeReconciliationOptions,
  ): ExecutionServiceResult<{ proposalId: string; observationCount: number }> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const verified = verifySealedReconciliationProposal(options.proposal);
    if (!verified.ok) {
      return { ok: false, error: verified.error };
    }
    const gate = this.authorizationGate(
      'reconcile',
      options.tenantId,
      options.authorization,
      verified.value.recordId,
      'execution-reconciliation',
    );
    if (!gate.ok) return gate;
    const entry = this.storeEntry(options.tenantId, verified.value.solutionId);
    if (!entry.ok) return entry;
    const admitted = admitReconciliationProposal(entry.value.store, options.proposal);
    if (!admitted.ok) {
      return { ok: false, error: admitted.error };
    }
    this.stores.set(tenantKey(options.tenantId, verified.value.solutionId), {
      store: admitted.value.store,
    });
    this.proposals.set(tenantKey(options.tenantId, admitted.value.record.recordId), {
      proposal: admitted.value.record,
      application: null,
    });
    // reconciliation-proposed on every affected observation's linked work
    // package stream (deterministic order).
    for (const workPackageId of this.proposalWorkPackages(admitted.value.store, admitted.value.record)) {
      const event = this.emitEvent(
        options.tenantId,
        workPackageId,
        gate.value.principalId,
        admitted.value.record.proposedAt,
        {
          discriminator: 'execution:reconciliation-proposed',
          data: {
            proposalId: admitted.value.record.recordId,
            deliveryId: admitted.value.record.deliveryId,
            observationCount: admitted.value.record.entries.length,
            proposedAt: admitted.value.record.proposedAt,
          },
        },
      );
      if (!event.ok) return event;
    }
    return {
      ok: true,
      value: {
        proposalId: admitted.value.record.recordId,
        observationCount: admitted.value.record.entries.length,
      },
    };
  }

  /**
   * Apply one reconciliation proposal: the observations are recorded into
   * the delivery (append-only, idempotent), accepted (the verification
   * boundary), and actualized — EXCLUSIVELY through the W036
   * recordObservation -> acceptObservation -> actualizeObservation
   * authority path. The hosted delivery state advances to the returned
   * sealed state.
   */
  applyReconciliation(
    options: ApplyReconciliationOptions,
  ): ExecutionServiceResult<{
    actualizedCount: number;
    alreadyActualizedCount: number;
    deliveryDigest: string;
  }> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'reconcile',
      options.tenantId,
      options.authorization,
      options.proposalId,
      'execution-reconciliation',
    );
    if (!gate.ok) return gate;
    const key = tenantKey(options.tenantId, options.proposalId);
    const proposalEntry = this.proposals.get(key);
    if (proposalEntry === undefined) {
      return {
        ok: false,
        error: {
          code: 'proposal-not-applied',
          message: `no reconciliation proposal "${options.proposalId}" hosted for tenant "${options.tenantId}" — propose it first`,
          proposalId: options.proposalId,
        },
      };
    }
    const proposal = proposalEntry.proposal;
    const store = this.storeEntry(options.tenantId, proposal.solutionId);
    if (!store.ok) return store;
    const deliveryKey = tenantKey(options.tenantId, proposal.deliveryId);
    const deliveryEntry = this.deliveries.get(deliveryKey);
    if (deliveryEntry === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-delivery',
          message: `no delivery record "${proposal.deliveryId}" hosted for tenant "${options.tenantId}" — register the delivery first`,
          deliveryId: proposal.deliveryId,
        },
      };
    }
    const observations = store.value.store.observations.filter((observation) =>
      proposal.entries.some((entry) => entry.observationId === observation.recordId),
    );
    const applied = applyReconciliationProposal(
      deliveryEntry.delivery,
      proposal,
      observations,
      options.application,
    );
    if (!applied.ok) {
      return { ok: false, error: applied.error };
    }
    this.deliveries.set(deliveryKey, { delivery: applied.value.delivery });
    this.proposals.set(key, {
      proposal,
      application: applied.value,
    });
    const actualized = applied.value.applications.filter(
      (application) => application.outcome === 'actualized',
    ).length;
    const alreadyActualized = applied.value.applications.length - actualized;
    for (const workPackageId of this.proposalWorkPackages(store.value.store, proposal)) {
      const event = this.emitEvent(
        options.tenantId,
        workPackageId,
        gate.value.principalId,
        options.application.actualizedAt,
        {
          discriminator: 'execution:reconciliation-applied',
          data: {
            proposalId: proposal.recordId,
            deliveryId: proposal.deliveryId,
            actualizedCount: actualized,
            alreadyActualizedCount: alreadyActualized,
            actualizedAt: options.application.actualizedAt,
          },
        },
      );
      if (!event.ok) return event;
    }
    return {
      ok: true,
      value: {
        actualizedCount: actualized,
        alreadyActualizedCount: alreadyActualized,
        deliveryDigest: applied.value.delivery.contentDigest,
      },
    };
  }

  // --------------------------------------------------------------------------------
  // The state projection + reads.
  // --------------------------------------------------------------------------------

  /** Project the deterministic execution state of the tenant's store (asOf is caller-supplied). */
  projectState(
    options: ProjectStateOptions,
  ): ExecutionServiceResult<ExecutionStateProjection> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'status',
      options.tenantId,
      options.authorization,
      options.solutionId,
      'execution-store',
    );
    if (!gate.ok) return gate;
    const entry = this.storeEntry(options.tenantId, options.solutionId);
    if (!entry.ok) return entry;
    const projection = projectExecutionState(entry.value.store, {
      ...(options.asOf !== undefined ? { asOf: options.asOf } : {}),
    });
    for (const workPackage of projection.workPackages) {
      const event = this.emitEvent(
        options.tenantId,
        workPackage.workPackageId,
        gate.value.principalId,
        options.asOf,
        {
          discriminator: 'execution:state-projected',
          data: {
            workPackageId: workPackage.workPackageId,
            state: workPackage.workPackageState,
            asOf: options.asOf,
          },
        },
      );
      if (!event.ok) return event;
    }
    return { ok: true, value: projection };
  }

  /** One work package's full execution event stream (tenant-scoped read). */
  eventStream(options: StreamReadOptions): ExecutionServiceResult<readonly SealedExecutionEvent[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'status',
      options.tenantId,
      options.authorization,
      options.workPackageId,
      'execution-work-package',
    );
    if (!gate.ok) return gate;
    const streamId = executionStreamIdOf(options.workPackageId);
    return { ok: true, value: this.streams.get(streamId) ?? [] };
  }

  /** Health/liveness as typed data (deterministic derivation, no clocks). */
  health(): RuntimeHealth {
    const events = [...this.streams.values()].reduce((sum, stream) => sum + stream.length, 0);
    const stores = [...this.stores.values()];
    return {
      schemaVersion: RUNTIME_RECORD_VERSION,
      status: 'healthy',
      storeCount: stores.length,
      observationCount: stores.reduce((sum, entry) => sum + entry.store.observations.length, 0),
      trackingRecordCount: stores.reduce((sum, entry) => sum + entry.store.tracking.length, 0),
      resourceObservationCount: stores.reduce(
        (sum, entry) => sum + entry.store.resourceObservations.length,
        0,
      ),
      evidenceLinkCount: stores.reduce((sum, entry) => sum + entry.store.evidenceLinks.length, 0),
      issueCount: stores.reduce((sum, entry) => sum + entry.store.issues.length, 0),
      proposalCount: this.proposals.size,
      deliveryCount: this.deliveries.size,
      eventStreamCount: this.streams.size,
      eventCount: events,
    };
  }

  /** A deterministic whole-host snapshot (sorted; no insertion-order leaks). */
  snapshot(): RuntimeSnapshot {
    const stores = [...this.stores.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([, entry]) => entry);
    const deliveries = [...this.deliveries.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([, entry]) => entry);
    const proposals = [...this.proposals.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([, entry]) => entry);
    const events = [...this.streams.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .flatMap(([, stream]) => stream);
    const tracking = stores.flatMap((entry) => entry.store.tracking);
    const issues = stores.flatMap((entry) => entry.store.issues);
    const resolutions = stores.flatMap((entry) => entry.store.resolutions);
    return {
      schemaVersion: RUNTIME_RECORD_VERSION,
      stores,
      deliveries,
      proposals,
      events,
      tracking,
      issues,
      resolutions,
    };
  }

  // --------------------------------------------------------------------------------
  // Internals.
  // --------------------------------------------------------------------------------

  private storeEntry(
    tenantId: string,
    solutionId: string,
  ): ExecutionServiceResult<StoreEntry> {
    const key = tenantKey(tenantId, solutionId);
    const entry = this.stores.get(key);
    if (entry !== undefined) {
      return { ok: true, value: entry };
    }
    // Cross-tenant denial when the store exists under ANOTHER tenant.
    const foreign = [...this.stores.values()].find(
      (candidate) => candidate.store.solutionId === solutionId,
    );
    if (foreign !== undefined) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `the tracking store for solution "${solutionId}" belongs to another tenant — tenant "${tenantId}" cannot access it (R12 tenant isolation)`,
          expectedTenantId: tenantId,
          encounteredTenantId: foreign.store.tenantId,
          subject: solutionId,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'unknown-store',
        message: `no tracking store for solution "${solutionId}" hosted for tenant "${tenantId}" — register the program first`,
        solutionId,
      },
    };
  }

  /** The distinct work packages linked by a proposal's observations (sorted). */
  private proposalWorkPackages(
    store: ExecutionTrackingStore,
    proposal: { readonly entries: readonly { readonly observationId: string }[] },
  ): readonly string[] {
    const parents = new Set<string>();
    for (const entry of proposal.entries) {
      const observation = store.observations.find(
        (candidate) => candidate.recordId === entry.observationId,
      );
      if (observation === undefined) continue;
      const linked = linkedWorkPackageOfObservation(store.programIndex, observation);
      if (linked !== null) {
        parents.add(linked);
      }
    }
    return [...parents].sort();
  }

  /** Emit one sealed event onto the work package stream (sequence + causal link derived). */
  private emitEvent(
    tenantId: string,
    workPackageId: string,
    actor: string,
    occurredAt: string,
    payload: { readonly discriminator: string; readonly data: EventData },
  ): ExecutionServiceResult<SealedExecutionEvent> {
    const streamId = executionStreamIdOf(workPackageId);
    const stream = this.streams.get(streamId) ?? [];
    const sequence = stream.length + 1;
    const causalParent =
      stream.length === 0 ? null : { streamId, sequence: stream[stream.length - 1]!.sequence };
    const sealed = sealExecutionEvent({
      schemaVersion: 1,
      streamId,
      sequence,
      tenantId,
      actor,
      causalParent,
      payload: { discriminator: payload.discriminator, data: payload.data },
      occurredAt,
    });
    if (!sealed.ok) {
      return { ok: false, error: sealed.error };
    }
    this.streams.set(streamId, [...stream, sealed.value]);
    return { ok: true, value: sealed.value };
  }
}

// --------------------------------------------------------------------------------
// Loose-record scope sniffers (deterministic store resolution).
// --------------------------------------------------------------------------------

/** Sniff a tracking record's subject scope (tenantId + solutionId + workPackageId). */
function parseTrackingSubject(record: unknown): {
  solutionId: string;
  workPackageId: string;
} | null {
  if (typeof record !== 'object' || record === null) return null;
  const candidate = record as { solutionId?: unknown; subject?: { workPackageId?: unknown } };
  if (typeof candidate.solutionId !== 'string') return null;
  if (
    typeof candidate.subject !== 'object' ||
    candidate.subject === null ||
    typeof candidate.subject.workPackageId !== 'string'
  ) {
    return null;
  }
  return { solutionId: candidate.solutionId, workPackageId: candidate.subject.workPackageId };
}

/** Sniff an issue record's scope (solutionId + first impact work package). */
function parseIssueScope(record: unknown): { solutionId: string } | null {
  if (typeof record !== 'object' || record === null) return null;
  const candidate = record as { solutionId?: unknown };
  if (typeof candidate.solutionId !== 'string') return null;
  return { solutionId: candidate.solutionId };
}

/** Sniff an issue resolution's scope (solutionId). */
function parseIssueResolutionScope(record: unknown): { solutionId: string } | null {
  return parseIssueScope(record);
}
