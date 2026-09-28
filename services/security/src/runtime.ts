/**
 * The reference Security HOST (service layer, W030): the thin typed
 * runtime facade over the @epoch/observability kernel.
 *
 * - **Sandbox admission** (the isolation gate): the W008-mirrored
 *   subject description is validated by the kernel schema, checked
 *   against the tenant's ACTIVE security policy (fail-closed
 *   `unknown-policy` when none), cross-checked against the REAL W008
 *   grant-ceiling authority (`grantExceedsCeiling` — a mirror/real
 *   disagreement is the fail-closed `isolation-authority-conflict`),
 *   denied-by-default when the subject is quarantined, and — when the
 *   profile requires marketplace provenance — resolved against
 *   REGISTERED, REAL-verified W023 listing versions.
 * - **Observation intake** from the execution surfaces: sandbox
 *   invocations (W008), authorization decisions (W009),
 *   tenant-boundary checks (R12), agent sessions (W020), simulation
 *   runs (W021), action dispatches (W022) — recorded as sealed,
 *   content-addressed kernel observations.
 * - **The quarantine lifecycle**: policy-driven imposition on
 *   violations, explicit gated release.
 * - **Audit passes**: the tenant-boundary family (R12 invariant
 *   verification over the observed record) + the W041
 *   projection-invariant family; every finding recorded as a
 *   `security-audit` observation.
 * - **The derived health projection** + tenant-scoped audit reads —
 *   deterministic, sorted, zero wall-clock.
 * - Every host step emits `security:*` events (W010-shaped, one
 *   stream per observed subject `stream:security-<suffix>`, host
 *   steps on `stream:security-host-<tenant-suffix>`).
 *
 * The W009 authorization gate denies unauthorized operations BEFORE
 * any kernel admission (the W022/W024/W043 pattern). Tenant isolation
 * (R12) is the typed `tenant-isolation-rejected` rejection.
 *
 * In-memory reference behavior only: NO persistence, NO network, NO
 * SIEM/monitoring vendor (external security tooling is a future
 * adapter behind the capability fabric).
 */
import {
  AUTHORIZATION_RECORD_VERSION,
  evaluate,
  parseAuthorizationContext,
} from '@epoch/authorization';
import type { AuthorizationDecision } from '@epoch/authorization';
import { grantExceedsCeiling } from '@epoch/extension-runtime';
import { sealListingVersion, verifySealedListingVersion } from '@epoch/marketplace';
import type { SealedListingVersion } from '@epoch/marketplace';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  CanonicalObjectRefSchema,
  ProjectionSummarySchema,
  auditProjectionSummary,
  checkIsolation,
  sealObservation,
  securityHostStreamIdOf,
  securityStreamIdOf,
} from '@epoch/observability';
import {
  ObservabilityStore,
  SandboxSubjectSchema,
  auditTenantBoundary,
} from '@epoch/observability';
import type {
  AuditFinding,
  SealedObservation,
  SealedSecurityEvent,
} from '@epoch/observability';
import { SECURITY_RUNTIME_RECORD_VERSION, SECURITY_RUNTIME_SERVICE_NAME } from './version';
import type {
  AdmitExtensionOptions,
  AuditPassOutcome,
  AuthorizationInput,
  ImposeQuarantineOptions,
  ObserveActionOptions,
  ObserveAgentSessionOptions,
  ObserveAuthorizationDecisionOptions,
  ObserveSandboxInvocationOptions,
  ObserveSimulationRunOptions,
  ObserveTenantBoundaryOptions,
  ReadAuditTrailOptions,
  RecordSandboxViolationOptions,
  RegisterListingOptions,
  RegisterPolicyOptions,
  ReleaseQuarantineOptions,
  RunAuditPassOptions,
  SandboxAdmissionOutcome,
  SecurityRuntimeHealth,
  SecurityRuntimeSnapshot,
  SecurityServiceError,
  SecurityServiceResult,
  SecurityStateProjection,
  StreamReadOptions,
} from './types';


function ok<T>(value: T): SecurityServiceResult<T> {
  return { ok: true, value };
}

function fail<T>(error: SecurityServiceError): SecurityServiceResult<T> {
  return { ok: false, error };
}

/**
 * Map a W009 authorization error onto the service union: `validation`
 * passes through (malformed contexts are typed validation failures);
 * every other authorization failure is the fail-closed
 * `authorization-rejected` service code.
 */
function mapAuthorizationError(error: {
  readonly code: string;
  readonly message: string;
  readonly issues?: readonly { path: string; message: string }[] | undefined;
}): SecurityServiceError {
  if (error.code === 'validation') {
    return {
      code: 'validation',
      message: error.message,
      issues: error.issues ?? [],
    };
  }
  return {
    code: 'authorization-rejected',
    message: `the authorization decision point failed (${error.code}): ${error.message}`,
    denialCode: error.code,
    principalId: 'unknown',
    operation: 'authorization',
  };
}

/** Deterministic composite key: `<tenantId>#<id>`. */
function tenantKey(tenantId: string, id: string): string {
  return `${tenantId}#${id}`;
}

/**
 * Derive a pattern-safe observation id from digest input: the slug
 * prefix plus the first 16 hex chars of the canonical SHA-256 (ids are
 * opaque and kind-prefixed; timestamps never leak into ids).
 */
function derivedObservationId(prefix: string, input: Record<string, unknown>): string {
  return `observation:${prefix}-${canonicalDigest(input as unknown as JsonValue).slice(0, 16)}`;
}

/** The reference in-memory security host. Construct with `new SecurityRuntime(options)`. */
export class SecurityRuntime {
  /** The observability kernel store (the ONLY durable-model authority). */
  private readonly store: ObservabilityStore;

  /** tenantId#listingId -> the REAL-verified sealed W023 listing version. */
  private readonly listings = new Map<string, SealedListingVersion>();

  /** tenantId -> listing registry (for deterministic snapshots). */
  private readonly listingsByTenant = new Map<string, Map<string, SealedListingVersion>>();

  private readonly expectedTenantId: string | undefined;

  /** Tenants the host has served (liveness derivation bookkeeping). */
  private readonly servedTenants = new Set<string>();

  constructor(options: import('./types').SecurityRuntimeOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
    this.store = new ObservabilityStore({ expectedTenantId: options.expectedTenantId });
  }

  // --------------------------------------------------------------------------------
  // The authorization gate (W009 — the W022/W024/W043 pattern).
  // --------------------------------------------------------------------------------

  private authorizationGate(
    operation: string,
    tenantId: string,
    authorization: AuthorizationInput,
    resourceId: string,
    resourceType: string,
  ): SecurityServiceResult<{ principalId: string }> {
    const context = parseAuthorizationContext(authorization.context);
    if (!context.ok) {
      return { ok: false, error: mapAuthorizationError(context.error) };
    }
    const request = {
      schemaVersion: AUTHORIZATION_RECORD_VERSION,
      principalId: authorization.principalId,
      actionKind: `security.${operation}`,
      resource: { resourceType, resourceId, tenantId },
      ...(authorization.justification !== undefined
        ? { justification: authorization.justification }
        : {}),
    };
    const decision = evaluate(request, context.value);
    if (!decision.ok) {
      return { ok: false, error: mapAuthorizationError(decision.error) };
    }
    const value: AuthorizationDecision = decision.value;
    if (value.outcome === 'deny') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `principal "${authorization.principalId}" is not authorized for security.${operation} (${value.denial.code}): ${value.denial.message}`,
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
          message: `the authorization decision point is not applicable to this request (${value.reason}) — security is tenant-scoped, so this is a fail-closed rejection`,
          denialCode: value.reason,
          principalId: authorization.principalId,
          operation,
        },
      };
    }
    return { ok: true, value: { principalId: authorization.principalId } };
  }

  private tenantGuard(tenantId: string): SecurityServiceResult<null> {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `this security host is scoped to tenant "${this.expectedTenantId}" — operations for tenant "${tenantId}" are rejected (R12 tenant isolation)`,
          expectedTenantId: this.expectedTenantId,
          encounteredTenantId: tenantId,
        },
      };
    }
    this.servedTenants.add(tenantId);
    return { ok: true, value: null };
  }

  // --------------------------------------------------------------------------------
  // Event emission (sealed by the kernel; contiguous sequences; causal chaining).
  // --------------------------------------------------------------------------------

  private emit(
    streamId: string,
    tenantId: string,
    actor: string,
    discriminator: string,
    data: Record<string, unknown>,
    occurredAt: string,
  ): void {
    // The KERNEL store is the single stream authority (sequences,
    // causal chaining, admission discipline); the host derives the
    // next sequence from the store's read.
    const events = this.store.readStream(streamId);
    const previous = events.length > 0 ? events[events.length - 1]! : null;
    const admitted = this.store.appendEvent({
      schemaVersion: 1,
      streamId,
      sequence: events.length + 1,
      tenantId,
      actor,
      causalParent: previous === null ? null : { streamId, sequence: previous.sequence },
      payload: { discriminator, data: data as Record<string, JsonValue> },
      occurredAt,
    });
    void admitted;
  }

  // --------------------------------------------------------------------------------
  // Policy registration (policy as data).
  // --------------------------------------------------------------------------------

  /** Register a security policy revision (idempotent by digest; replay-conflict on skew). */
  registerPolicy(options: RegisterPolicyOptions): SecurityServiceResult<{
    policyId: string;
    registered: boolean;
  }> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'register-policy',
      options.tenantId,
      options.authorization,
      typeof (options.policy as { policyId?: unknown })?.policyId === 'string'
        ? (options.policy as { policyId: string }).policyId
        : 'security-policy:unknown',
      'security-policy',
    );
    if (!gate.ok) return gate;
    const admitted = this.store.admitPolicyContent(options.policy);
    if (!admitted.ok) return admitted;
    if (admitted.value.admitted) {
      this.emit(
        securityHostStreamIdOf(options.tenantId),
        options.tenantId,
        gate.value.principalId,
        'security:policy-registered',
        {
          policyId: admitted.value.policy.policyId,
          policyDigest: admitted.value.policy.contentDigest,
          revision: admitted.value.policy.revision,
          status: admitted.value.policy.status,
          registeredAt: admitted.value.policy.activatedAt,
        },
        admitted.value.policy.activatedAt,
      );
    }
    return ok({ policyId: admitted.value.policy.policyId, registered: admitted.value.admitted });
  }

  // --------------------------------------------------------------------------------
  // Marketplace listing registration (W023 provenance; the REAL verifier).
  // --------------------------------------------------------------------------------

  /** Register a sealed W023 listing version (verified through the REAL marketplace verifier). */
  registerListing(options: RegisterListingOptions): SecurityServiceResult<{
    listingId: string;
    registered: boolean;
  }> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const listingId =
      typeof (options.listing as { listingId?: unknown })?.listingId === 'string'
        ? (options.listing as { listingId: string }).listingId
        : 'listing:unknown';
    const gate = this.authorizationGate(
      'register-listing',
      options.tenantId,
      options.authorization,
      listingId,
      'marketplace-listing',
    );
    if (!gate.ok) return gate;
    // Verify-or-seal: a SEALED listing (contentDigest present) is
    // verified through the REAL marketplace verifier (tamper
    // detection); RAW content is sealed by the marketplace authority
    // first. A claimed digest that does not match the content never
    // enters.
    const sealedInput =
      typeof options.listing === 'object' &&
      options.listing !== null &&
      'contentDigest' in options.listing &&
      typeof (options.listing as { contentDigest?: unknown }).contentDigest === 'string';
    const marketOutcome = sealedInput
      ? verifySealedListingVersion(options.listing)
      : sealListingVersion(options.listing);
    if (!marketOutcome.ok) {
      return fail({
        code: 'listing-verification-rejected',
        message: `the marketplace authority rejected the listing version (${marketOutcome.error.code}): ${marketOutcome.error.message}`,
        listingId,
        reason: marketOutcome.error.code,
      });
    }
    const listing = marketOutcome.value;
    const key = tenantKey(options.tenantId, listing.listingId);
    const existing = this.listings.get(key);
    if (existing !== undefined) {
      if (existing.contentDigest === listing.contentDigest) {
        return ok({ listingId: listing.listingId, registered: false });
      }
      return fail({
        code: 'listing-conflict',
        message: `listing "${listing.listingId}" version "${listing.version}" is already registered with different content (replay-conflict)`,
        listingId: listing.listingId,
        encounteredDigest: listing.contentDigest,
      });
    }
    if (listing.developerTenantId !== options.tenantId) {
      return fail({
        code: 'tenant-isolation-rejected',
        message: `the listing's developer tenant "${listing.developerTenantId}" does not match the registering tenant "${options.tenantId}" (R12)`,
        expectedTenantId: options.tenantId,
        encounteredTenantId: listing.developerTenantId,
      });
    }
    this.listings.set(key, listing);
    const byTenant = this.listingsByTenant.get(options.tenantId) ?? new Map();
    byTenant.set(listing.listingId, listing);
    this.listingsByTenant.set(options.tenantId, byTenant);
    return ok({ listingId: listing.listingId, registered: true });
  }

  private findListing(tenantId: string, listingId: string): SealedListingVersion | null {
    return this.listings.get(tenantKey(tenantId, listingId)) ?? null;
  }

  // --------------------------------------------------------------------------------
  // Sandbox admission (the isolation gate).
  // --------------------------------------------------------------------------------

  /**
   * Admit one sandbox subject against the tenant's ACTIVE policy:
   * quarantine (deny-by-default) -> policy (fail-closed) -> listing
   * provenance -> the kernel isolation check -> the REAL W008
   * ceiling differential (fail-closed on authority disagreement).
   */
  admitExtension(options: AdmitExtensionOptions): SecurityServiceResult<SandboxAdmissionOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const subjectParsed = SandboxSubjectSchema.safeParse(options.subject);
    if (!subjectParsed.success) {
      return fail({
        code: 'validation',
        message: 'the sandbox subject does not satisfy the observability contract (the W008-mirrored shape)',
        issues: subjectParsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.') || '$',
          message: issue.message,
        })),
      });
    }
    const subject = subjectParsed.data;
    const gate = this.authorizationGate(
      'admit-extension',
      options.tenantId,
      options.authorization,
      subject.extensionId,
      'sandbox-extension',
    );
    if (!gate.ok) return gate;

    // Deny-by-default: quarantined subjects never re-admit through this gate.
    if (this.store.isQuarantined(options.tenantId, subject.extensionId)) {
      const denial = this.recordObservation({
        tenantId: options.tenantId,
        observationId: derivedObservationId('denied-admission', {
          extensionId: subject.extensionId,
          admittedAt: options.admittedAt,
        }),
        subjectKind: 'extension',
        subjectId: subject.extensionId,
        observationClass: 'sandbox-admission',
        outcome: 'denied',
        severity: 'warning',
        actor: gate.value.principalId,
        sourceDigest: subject.extensionManifestDigest,
        observedAt: options.admittedAt,
        detail: { reason: 'quarantined' },
      });
      if (denial.ok) {
        this.emitObservationEvent(denial.value, options.admittedAt);
      }
      return fail({
        code: 'quarantined-subject-rejected',
        message: `extension "${subject.extensionId}" is quarantined (deny-by-default) — admission is rejected until an explicit release`,
        subjectId: subject.extensionId,
        factKind: 'quarantine-imposed',
      });
    }

    // Fail-closed: no ACTIVE policy, no admission.
    const policy = this.store.findActivePolicy(options.tenantId);
    if (policy === null) {
      return fail({
        code: 'unknown-policy',
        message: `tenant "${options.tenantId}" has no ACTIVE security policy — sandbox admission is fail-closed until one is registered`,
        policyId: 'security-policy:none',
      });
    }

    // Listing provenance (the W023 composition): a profile requiring
    // marketplace listings resolves against REGISTERED, verified
    // listing versions.
    if (policy.isolation.requireMarketplaceListing) {
      if (subject.listingId === undefined) {
        // The kernel check will flag `listing-required` below.
      } else {
        const listing = this.findListing(options.tenantId, subject.listingId);
        if (listing === null) {
          return fail({
            code: 'unknown-listing',
            message: `the isolation profile requires marketplace provenance and listing "${subject.listingId}" is not registered for tenant "${options.tenantId}"`,
            listingId: subject.listingId,
          });
        }
      }
    }

    // The kernel isolation check (deterministic, typed violations).
    const verdict = checkIsolation(subject, policy.isolation);

    // The REAL W008 ceiling differential: a mirror/authority
    // disagreement is a fail-closed conflict (the security-control
    // discipline — never admit on authority drift).
    for (const grant of subject.grants) {
      // The kernel grant tokens are strings; the REAL W008 authority
      // types them as its closed vocabulary (the differential below is
      // exactly the check that the two agree at runtime).
      const real = grantExceedsCeiling(
        {
          hostFunctions: [...grant.hostFunctions],
          resourceScopes: [...grant.resourceScopes] as never,
        },
        subject.trustClass,
      );
      const mirrored = verdict.violations.some(
        (violation) =>
          violation.code === 'grant-exceeds-trust-ceiling' ||
          violation.code === 'host-function-not-legal' ||
          violation.code === 'resource-scope-not-legal',
      );
      if ((real.hostFunction !== undefined || real.resourceScope !== undefined) !== mirrored) {
        return fail({
          code: 'isolation-authority-conflict',
          message: `the mirrored isolation check and the REAL W008 ceiling authority disagree on a grant of "${subject.extensionId}" — admission is fail-closed (authority drift)`,
          subjectId: subject.extensionId,
          detail: JSON.stringify({ real, mirrored }),
        });
      }
    }

    const conforming = verdict.verdict === 'conforms';
    const observation = this.recordObservation({
      tenantId: options.tenantId,
      observationId: derivedObservationId('admission', {
        extensionId: subject.extensionId,
        admittedAt: options.admittedAt,
        verdict: verdict.verdict,
      }),
      subjectKind: 'extension',
      subjectId: subject.extensionId,
      observationClass: conforming ? 'sandbox-admission' : 'sandbox-violation',
      outcome: conforming ? 'allowed' : 'violated',
      severity: conforming ? 'notice' : 'critical',
      actor: gate.value.principalId,
      sourceDigest: subject.extensionManifestDigest,
      observedAt: options.admittedAt,
      detail: conforming
        ? { violationCount: 0 }
        : { violationCount: verdict.violations.length, violationCodes: verdict.violations.map((v) => v.code) },
    });
    if (!observation.ok) return observation;
    this.emitObservationEvent(observation.value, options.admittedAt);

    // Policy-driven quarantine on violation.
    let quarantined = false;
    if (!conforming && policy.isolation.quarantineOnViolation) {
      const imposed = this.store.imposeQuarantine({
        schema: 'epoch.observability.quarantine',
        schemaVersion: 1,
        quarantineId: `quarantine:${subject.extensionId.slice('extension:'.length)}`,
        tenantId: options.tenantId,
        factKind: 'quarantine-imposed',
        subjectId: subject.extensionId,
        reason: `isolation violations: ${verdict.violations.map((v) => v.code).join(', ')}`,
        actedAt: options.admittedAt,
        actedBy: gate.value.principalId,
      });
      if (imposed.ok) {
        quarantined = true;
        this.emit(
          securityStreamIdOf(subject.extensionId),
          options.tenantId,
          gate.value.principalId,
          'security:quarantine-imposed',
          {
            quarantineId: imposed.value.quarantineId,
            subjectId: subject.extensionId,
            reason: imposed.value.reason,
            imposedAt: options.admittedAt,
          },
          options.admittedAt,
        );
        this.emit(
          securityStreamIdOf(subject.extensionId),
          options.tenantId,
          gate.value.principalId,
          'security:violation-detected',
          {
            observationId: observation.value.observationId,
            observationDigest: observation.value.contentDigest,
            violationCode: verdict.violations[0]?.code ?? 'unknown',
            subjectId: subject.extensionId,
            detectedAt: options.admittedAt,
          },
          options.admittedAt,
        );
      }
    }

    if (!conforming) {
      return fail({
        code: 'isolation-violation',
        message: `sandbox subject "${subject.extensionId}" failed the isolation check (${verdict.violations.length} violations)`,
        violations: verdict.violations,
      });
    }
    return ok({ verdict, observation: observation.value, quarantined });
  }

  // --------------------------------------------------------------------------------
  // Observation intake (the execution surfaces).
  // --------------------------------------------------------------------------------

  /** Observe one sandbox invocation outcome (the W008 boundary). */
  observeSandboxInvocation(
    options: ObserveSandboxInvocationOptions,
  ): SecurityServiceResult<SealedObservation> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'observe-invocation',
      options.tenantId,
      options.authorization,
      options.extensionId,
      'sandbox-extension',
    );
    if (!gate.ok) return gate;
    const observation = this.recordObservation({
      tenantId: options.tenantId,
      observationId: options.observationId,
      subjectKind: 'extension',
      subjectId: options.extensionId,
      observationClass: 'sandbox-invocation',
      outcome: options.outcome,
      severity: options.outcome === 'allowed' ? 'notice' : 'warning',
      actor: options.actor ?? gate.value.principalId,
      sourceDigest: options.sourceDigest,
      observedAt: options.observedAt,
      detail:
        options.outcome === 'denied' && options.denialReason !== undefined
          ? { denialReason: options.denialReason }
          : undefined,
    });
    if (!observation.ok) return observation;
    this.emitObservationEvent(observation.value, options.observedAt);
    return observation;
  }

  /** Observe one W009 authorization-decision outcome. */
  observeAuthorizationDecision(
    options: ObserveAuthorizationDecisionOptions,
  ): SecurityServiceResult<SealedObservation> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'observe-decision',
      options.tenantId,
      options.authorization,
      options.subjectId,
      'authorization-decision',
    );
    if (!gate.ok) return gate;
    const observation = this.recordObservation({
      tenantId: options.tenantId,
      observationId: options.observationId,
      subjectKind: 'principal',
      subjectId: options.decidedPrincipalId,
      observationClass: 'authorization-decision',
      outcome: options.outcome === 'allow' ? 'allowed' : 'denied',
      severity: options.outcome === 'allow' ? 'notice' : 'warning',
      actor: gate.value.principalId,
      sourceDigest: options.decisionDigest,
      observedAt: options.observedAt,
      detail: {
        resourceSubjectId: options.subjectId,
        ...(options.denialCode !== undefined ? { denialCode: options.denialCode } : {}),
      },
    });
    if (!observation.ok) return observation;
    this.emitObservationEvent(observation.value, options.observedAt);
    return observation;
  }

  /** Observe one tenant-boundary check outcome (the R12 audit family's input). */
  observeTenantBoundary(
    options: ObserveTenantBoundaryOptions,
  ): SecurityServiceResult<SealedObservation> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'observe-boundary',
      options.tenantId,
      options.authorization,
      options.subjectId,
      'tenant-boundary',
    );
    if (!gate.ok) return gate;
    const observation = this.recordObservation({
      tenantId: options.tenantId,
      observationId: options.observationId,
      subjectKind: 'tenant',
      subjectId: options.subjectTenantId,
      observationClass: 'tenant-boundary-check',
      outcome: options.outcome,
      severity: options.outcome === 'allowed' ? 'notice' : 'warning',
      actor: gate.value.principalId,
      sourceDigest: options.sourceDigest,
      observedAt: options.observedAt,
      detail: { subjectTenantId: options.subjectTenantId, actorTenantId: options.actorTenantId },
    });
    if (!observation.ok) return observation;
    this.emitObservationEvent(observation.value, options.observedAt);
    return observation;
  }

  /** Observe one W020 agent-session lifecycle fact. */
  observeAgentSession(
    options: ObserveAgentSessionOptions,
  ): SecurityServiceResult<SealedObservation> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'observe-session',
      options.tenantId,
      options.authorization,
      options.sessionId,
      'agent-session',
    );
    if (!gate.ok) return gate;
    const observation = this.recordObservation({
      tenantId: options.tenantId,
      observationId: options.observationId,
      subjectKind: 'agent-session',
      subjectId: options.sessionId,
      observationClass: 'agent-session',
      outcome: 'observed',
      severity: 'info',
      actor: gate.value.principalId,
      sourceDigest: options.sourceDigest,
      observedAt: options.observedAt,
      detail: { sessionStatus: options.sessionStatus },
    });
    if (!observation.ok) return observation;
    this.emitObservationEvent(observation.value, options.observedAt);
    return observation;
  }

  /** Observe one W021 simulation-run lifecycle fact. */
  observeSimulationRun(
    options: ObserveSimulationRunOptions,
  ): SecurityServiceResult<SealedObservation> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'observe-run',
      options.tenantId,
      options.authorization,
      options.runId,
      'simulation-run',
    );
    if (!gate.ok) return gate;
    const observation = this.recordObservation({
      tenantId: options.tenantId,
      observationId: options.observationId,
      subjectKind: 'simulation-run',
      subjectId: options.runId,
      observationClass: 'simulation-run',
      outcome: 'observed',
      severity: options.runStatus === 'failed' ? 'warning' : 'info',
      actor: gate.value.principalId,
      sourceDigest: options.sourceDigest,
      observedAt: options.observedAt,
      detail: { runStatus: options.runStatus },
    });
    if (!observation.ok) return observation;
    this.emitObservationEvent(observation.value, options.observedAt);
    return observation;
  }

  /** Observe one W022 action-dispatch fact. */
  observeAction(options: ObserveActionOptions): SecurityServiceResult<SealedObservation> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'observe-action',
      options.tenantId,
      options.authorization,
      options.actionId,
      'gateway-action',
    );
    if (!gate.ok) return gate;
    const observation = this.recordObservation({
      tenantId: options.tenantId,
      observationId: options.observationId,
      subjectKind: 'action',
      subjectId: options.actionId,
      observationClass: 'action-dispatch',
      outcome: 'observed',
      severity: 'info',
      actor: gate.value.principalId,
      sourceDigest: options.sourceDigest,
      observedAt: options.observedAt,
      detail: { actionStatus: options.actionStatus },
    });
    if (!observation.ok) return observation;
    this.emitObservationEvent(observation.value, options.observedAt);
    return observation;
  }

  /** Record one sandbox violation (with optional policy-driven quarantine). */
  recordSandboxViolation(
    options: RecordSandboxViolationOptions,
  ): SecurityServiceResult<{ observation: SealedObservation; quarantined: boolean }> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'record-violation',
      options.tenantId,
      options.authorization,
      options.extensionId,
      'sandbox-extension',
    );
    if (!gate.ok) return gate;
    const observation = this.recordObservation({
      tenantId: options.tenantId,
      observationId: options.observationId,
      subjectKind: 'extension',
      subjectId: options.extensionId,
      observationClass: 'sandbox-violation',
      outcome: 'violated',
      severity: 'critical',
      actor: gate.value.principalId,
      sourceDigest: options.sourceDigest,
      observedAt: options.observedAt,
      detail: { violationCode: options.violationCode },
    });
    if (!observation.ok) return observation;
    this.emitObservationEvent(observation.value, options.observedAt);
    this.emit(
      securityStreamIdOf(options.extensionId),
      options.tenantId,
      gate.value.principalId,
      'security:violation-detected',
      {
        observationId: observation.value.observationId,
        observationDigest: observation.value.contentDigest,
        violationCode: options.violationCode,
        subjectId: options.extensionId,
        detectedAt: options.observedAt,
      },
      options.observedAt,
    );

    const policy = this.store.findActivePolicy(options.tenantId);
    const shouldQuarantine = options.quarantine ?? policy?.isolation.quarantineOnViolation ?? false;
    let quarantined = false;
    if (shouldQuarantine && !this.store.isQuarantined(options.tenantId, options.extensionId)) {
      const imposed = this.store.imposeQuarantine({
        schema: 'epoch.observability.quarantine',
        schemaVersion: 1,
        quarantineId: `quarantine:${options.extensionId.slice('extension:'.length)}`,
        tenantId: options.tenantId,
        factKind: 'quarantine-imposed',
        subjectId: options.extensionId,
        reason: `sandbox violation: ${options.violationCode}`,
        actedAt: options.observedAt,
        actedBy: gate.value.principalId,
      });
      if (imposed.ok) {
        quarantined = true;
        this.emit(
          securityStreamIdOf(options.extensionId),
          options.tenantId,
          gate.value.principalId,
          'security:quarantine-imposed',
          {
            quarantineId: imposed.value.quarantineId,
            subjectId: options.extensionId,
            reason: imposed.value.reason,
            imposedAt: options.observedAt,
          },
          options.observedAt,
        );
      }
    }
    return ok({ observation: observation.value, quarantined });
  }

  // --------------------------------------------------------------------------------
  // The quarantine lifecycle.
  // --------------------------------------------------------------------------------

  /** Impose quarantine on a subject (deny-by-default from this instant on). */
  imposeQuarantine(
    options: ImposeQuarantineOptions,
  ): SecurityServiceResult<{ subjectId: string }> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'quarantine',
      options.tenantId,
      options.authorization,
      options.subjectId,
      'security-subject',
    );
    if (!gate.ok) return gate;
    const imposed = this.store.imposeQuarantine({
      schema: 'epoch.observability.quarantine',
      schemaVersion: 1,
      quarantineId: options.quarantineId,
      tenantId: options.tenantId,
      factKind: 'quarantine-imposed',
      subjectId: options.subjectId,
      reason: options.reason,
      actedAt: options.actedAt,
      actedBy: gate.value.principalId,
    });
    if (!imposed.ok) return imposed;
    this.emit(
      securityStreamIdOf(options.subjectId),
      options.tenantId,
      gate.value.principalId,
      'security:quarantine-imposed',
      {
        quarantineId: imposed.value.quarantineId,
        subjectId: options.subjectId,
        reason: imposed.value.reason,
        imposedAt: options.actedAt,
      },
      options.actedAt,
    );
    return ok({ subjectId: options.subjectId });
  }

  /** Release a quarantined subject (explicit, gated; never a silent no-op). */
  releaseQuarantine(
    options: ReleaseQuarantineOptions,
  ): SecurityServiceResult<{ subjectId: string }> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'release-quarantine',
      options.tenantId,
      options.authorization,
      options.subjectId,
      'security-subject',
    );
    if (!gate.ok) return gate;
    const released = this.store.releaseQuarantine({
      schema: 'epoch.observability.quarantine',
      schemaVersion: 1,
      quarantineId: options.quarantineId,
      tenantId: options.tenantId,
      factKind: 'quarantine-released',
      subjectId: options.subjectId,
      reason: options.reason,
      actedAt: options.actedAt,
      actedBy: gate.value.principalId,
    });
    if (!released.ok) return released;
    this.emit(
      securityStreamIdOf(options.subjectId),
      options.tenantId,
      gate.value.principalId,
      'security:quarantine-released',
      {
        quarantineId: released.value.quarantineId,
        subjectId: options.subjectId,
        reason: released.value.reason,
        releasedAt: options.actedAt,
      },
      options.actedAt,
    );
    return ok({ subjectId: options.subjectId });
  }

  // --------------------------------------------------------------------------------
  // Audit passes (the tenant-boundary + W041 projection families).
  // --------------------------------------------------------------------------------

  /** Run one audit pass: both families over the admitted + supplied records. */
  runAuditPass(options: RunAuditPassOptions): SecurityServiceResult<AuditPassOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'audit',
      options.tenantId,
      options.authorization,
      options.auditPassId,
      'security-audit',
    );
    if (!gate.ok) return gate;

    // Family 1: the tenant boundary (R12) over the admitted observations.
    const tenantBoundaryFindings = auditTenantBoundary(
      this.store.listObservations(options.tenantId),
    );

    // Family 2: the W041 projection invariants over the supplied summaries.
    const projectionFindings: AuditFinding[] = [];
    for (const input of options.projections ?? []) {
      const summary = ProjectionSummarySchema.safeParse(input.summary);
      if (!summary.success) {
        return fail({
          code: 'validation',
          message: 'a projection audit input does not satisfy the mirrored W041 summary contract',
          issues: summary.error.issues.map((issue) => ({
            path: issue.path.map(String).join('.') || '$',
            message: issue.message,
          })),
        });
      }
      const canonical = CanonicalObjectRefSchema.safeParse(input.canonical);
      if (!canonical.success) {
        return fail({
          code: 'validation',
          message: 'a projection audit input does not satisfy the canonical-object reference contract',
          issues: canonical.error.issues.map((issue) => ({
            path: issue.path.map(String).join('.') || '$',
            message: issue.message,
          })),
        });
      }
      projectionFindings.push(...auditProjectionSummary(summary.data, canonical.data));
    }

    // Every finding becomes a security-audit observation (severity
    // critical: violated invariants are breaches).
    const observations: SealedObservation[] = [];
    let index = 0;
    for (const finding of [...tenantBoundaryFindings, ...projectionFindings]) {
      index += 1;
      const recorded = this.recordObservation({
        tenantId: options.tenantId,
        observationId: derivedObservationId(`audit-${index}`, {
          auditPassId: options.auditPassId,
          findingCode: finding.code,
          findingSubject: finding.subject,
        }),
        subjectKind: 'tenant',
        subjectId: options.tenantId,
        observationClass: 'security-audit',
        outcome: 'violated',
        severity: 'critical',
        actor: gate.value.principalId,
        sourceDigest: finding.sourceDigest ?? '0'.repeat(64),
        observedAt: options.auditedAt,
        detail: { findingCode: finding.code, findingSubject: finding.subject },
      });
      if (!recorded.ok) return recorded;
      observations.push(recorded.value);
    }

    this.emit(
      securityHostStreamIdOf(options.tenantId),
      options.tenantId,
      gate.value.principalId,
      'security:audit-recorded',
      {
        findingCode: 'audit-pass',
        findingSubject: options.auditPassId,
        findingCount: tenantBoundaryFindings.length + projectionFindings.length,
        auditedAt: options.auditedAt,
      },
      options.auditedAt,
    );
    for (const observation of observations) {
      this.emitObservationEvent(observation, options.auditedAt);
    }
    return ok({ tenantBoundaryFindings, projectionFindings, observations });
  }

  // --------------------------------------------------------------------------------
  // Projections + reads (deterministic, tenant-scoped).
  // --------------------------------------------------------------------------------

  /** Project the tenant's security state (metrics + health + audit findings + quarantine). */
  projectHealth(options: {
    tenantId: string;
    authorization: AuthorizationInput;
    projectedAt: string;
  }): SecurityServiceResult<SecurityStateProjection> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'project-health',
      options.tenantId,
      options.authorization,
      options.tenantId,
      'security-state',
    );
    if (!gate.ok) return gate;
    const projection = this.store.projectState({ tenantId: options.tenantId });
    if (!projection.ok) return projection;
    this.emit(
      securityHostStreamIdOf(options.tenantId),
      options.tenantId,
      gate.value.principalId,
      'security:health-projected',
      {
        status: projection.value.health?.status ?? 'critical',
        criticalViolations: projection.value.metrics.criticalViolations,
        violationsTotal: projection.value.metrics.violationsTotal,
        quarantinedSubjects: projection.value.quarantinedSubjects.length,
        projectedAt: options.projectedAt,
      },
      options.projectedAt,
    );
    return ok({
      metrics: projection.value.metrics,
      health: projection.value.health,
      auditFindings: projection.value.auditFindings,
      quarantinedSubjects: projection.value.quarantinedSubjects,
      observations: this.store.listObservations(options.tenantId),
    });
  }

  /** Read the tenant's audit trail (optionally filtered to one subject). */
  readAuditTrail(options: ReadAuditTrailOptions): SecurityServiceResult<readonly SealedObservation[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'read-audit',
      options.tenantId,
      options.authorization,
      options.subjectId ?? options.tenantId,
      'security-observation',
    );
    if (!gate.ok) return gate;
    return ok(
      options.subjectId === undefined
        ? this.store.listObservations(options.tenantId)
        : this.store.listObservationsOfSubject(options.tenantId, options.subjectId),
    );
  }

  /** Read one `security:*` event stream (the subject/host lifecycle history). */
  readStream(options: StreamReadOptions): SecurityServiceResult<readonly SealedSecurityEvent[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'read-stream',
      options.tenantId,
      options.authorization,
      options.streamId,
      'security-stream',
    );
    if (!gate.ok) return gate;
    const events = this.store.readStream(options.streamId);
    for (const event of events) {
      if (event.tenantId !== options.tenantId) {
        return fail({
          code: 'cross-tenant-denied',
          message: `stream "${options.streamId}" is scoped to tenant "${event.tenantId}" — reading it for tenant "${options.tenantId}" is denied (R12)`,
          expectedTenantId: options.tenantId,
          encounteredTenantId: event.tenantId,
          subject: options.streamId,
        });
      }
    }
    return ok(events);
  }

  /** The host's typed health/liveness projection (deterministic derivation). */
  health(): SecurityRuntimeHealth {
    // The host tracks the tenants it has served (the store is the
    // kernel's authority; the host keeps its own tenant set for
    // liveness derivation — deterministic, zero wall-clock).
    const tenants = new Set<string>(this.servedTenants);
    let observationCount = 0;
    let quarantinedSubjectCount = 0;
    for (const tenantId of tenants) {
      const state = this.store.projectState({ tenantId });
      if (state.ok) {
        observationCount += state.value.metrics.observationsTotal;
        quarantinedSubjectCount += state.value.quarantinedSubjects.length;
      }
    }
    const status: 'healthy' | 'degraded' = quarantinedSubjectCount > 0 ? 'degraded' : 'healthy';
    return {
      schemaVersion: SECURITY_RUNTIME_RECORD_VERSION,
      service: SECURITY_RUNTIME_SERVICE_NAME,
      status,
      tenantCount: tenants.size,
      observationCount,
      quarantinedSubjectCount,
      admittedListingCount: this.listings.size,
    };
  }

  /** The deterministic host snapshot (sorted; serialization-friendly). */
  snapshot(): SecurityRuntimeSnapshot {
    const tenants = new Set<string>();
    const admittedListings: Array<{ tenantId: string; listing: SealedListingVersion }> = [];
    for (const [key, listing] of [...this.listings.entries()].sort((a, b) =>
      a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
    )) {
      const tenantId = key.slice(0, key.indexOf('#'));
      tenants.add(tenantId);
      admittedListings.push({ tenantId, listing });
    }
    return {
      schemaVersion: SECURITY_RUNTIME_RECORD_VERSION,
      tenants: [...tenants].sort(),
      admittedListings,
    };
  }

  // --------------------------------------------------------------------------------
  // Internal helpers.
  // --------------------------------------------------------------------------------

  /** Record one observation through the kernel (idempotent by id + digest). */
  private recordObservation(input: {
    tenantId: string;
    observationId: string;
    subjectKind: 'extension' | 'agent-session' | 'simulation-run' | 'action' | 'principal' | 'tenant';
    subjectId: string;
    observationClass: string;
    outcome: 'observed' | 'allowed' | 'denied' | 'violated';
    severity: 'info' | 'notice' | 'warning' | 'critical';
    actor: string;
    sourceDigest: string;
    observedAt: string;
    detail?: Record<string, unknown> | undefined;
  }): SecurityServiceResult<SealedObservation> {
    const sealed = sealObservation({
      schema: 'epoch.observability.observation',
      schemaVersion: 1,
      observationId: input.observationId,
      tenantId: input.tenantId,
      subjectKind: input.subjectKind,
      subjectId: input.subjectId,
      observationClass: input.observationClass,
      outcome: input.outcome,
      severity: input.severity,
      actor: input.actor,
      provenance: { sourceDigest: input.sourceDigest },
      observedAt: input.observedAt,
      ...(input.detail !== undefined ? { detail: input.detail } : {}),
    });
    if (!sealed.ok) return sealed;
    const admitted = this.store.admitObservation(sealed.value);
    if (!admitted.ok) return admitted;
    return ok(admitted.value.observation);
  }

  /** Emit the `security:observation-recorded` event for one admitted observation. */
  private emitObservationEvent(observation: SealedObservation, occurredAt: string): void {
    this.emit(
      securityStreamIdOf(observation.subjectId),
      observation.tenantId,
      observation.actor,
      'security:observation-recorded',
      {
        observationId: observation.observationId,
        observationDigest: observation.contentDigest,
        observationClass: observation.observationClass,
        subjectId: observation.subjectId,
        outcome: observation.outcome,
        observedAt: observation.observedAt,
      },
      occurredAt,
    );
  }
}
