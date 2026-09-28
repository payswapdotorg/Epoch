/**
 * The security host's typed input/output surface (the W022/W024/W043
 * host-pattern: plain JSON records, total results, zero clock reads —
 * every instant is caller-supplied payload data).
 */
import type { AuthorizationContext } from '@epoch/authorization';
import type {
  AuditFinding,
  IsolationVerdict,
  ObservabilityError,
  ObservabilityMetrics,
  SealedObservation,
  SecurityHealth,
} from '@epoch/observability';
import type { SealedListingVersion } from '@epoch/marketplace';

/** The caller-supplied authorization context (W009 decision facts). */
export type { AuthorizationContext };

/** The caller-supplied authorization input (principal + context + justification). */
export interface AuthorizationInput {
  readonly principalId: string;
  readonly context: AuthorizationContext;
  readonly justification?: string | undefined;
}

/** The typed service-error union: kernel errors + the service-owned codes. */
export type SecurityServiceError =
  | ObservabilityError
  | {
      readonly code: 'authorization-rejected';
      readonly message: string;
      readonly denialCode: string;
      readonly principalId: string;
      readonly operation: string;
    }
  | {
      readonly code: 'tenant-isolation-rejected';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
    }
  | {
      readonly code: 'isolation-authority-conflict';
      readonly message: string;
      readonly subjectId: string;
      readonly detail: string;
    }
  | {
      readonly code: 'listing-verification-rejected';
      readonly message: string;
      readonly listingId: string;
      readonly reason: string;
    }
  | {
      readonly code: 'unknown-listing';
      readonly message: string;
      readonly listingId: string;
    }
  | {
      readonly code: 'listing-conflict';
      readonly message: string;
      readonly listingId: string;
      readonly encounteredDigest: string;
    };

/** Total-result wrapper of every service entry point. */
export type SecurityServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SecurityServiceError };

/** Options of the {@link import('./runtime').SecurityRuntime} constructor. */
export interface SecurityRuntimeOptions {
  /**
   * Tenant this host is scoped to. When provided, ANY operation naming
   * a different tenant is rejected with `tenant-isolation-rejected`
   * (R12 — the single-tenant guard precedent).
   */
  readonly expectedTenantId?: string | undefined;
}

/** Options of security policy registration (policy is data). */
export interface RegisterPolicyOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  /** Raw policy content (sealed + verified by the kernel at admission). */
  readonly policy: unknown;
}

/** Options of marketplace listing registration (W023 provenance). */
export interface RegisterListingOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  /** A sealed W023 listing version (verified through the REAL marketplace verifier). */
  readonly listing: unknown;
}

/** Options of one sandbox admission (the isolation gate). */
export interface AdmitExtensionOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  /** The sandbox subject description (the W008-mirrored kernel shape). */
  readonly subject: unknown;
  /** Caller-supplied admission instant. */
  readonly admittedAt: string;
}

/** The outcome of one sandbox admission. */
export interface SandboxAdmissionOutcome {
  /** The isolation verdict (conforms or the typed violation list). */
  readonly verdict: IsolationVerdict;
  /** The admission observation recorded (allowed or violated). */
  readonly observation: SealedObservation;
  /** Whether the subject was quarantined by this admission (policy-driven). */
  readonly quarantined: boolean;
}

/** Options of one sandbox invocation observation. */
export interface ObserveSandboxInvocationOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly observationId: string;
  readonly extensionId: string;
  /** Permitted or denied at the W008 boundary. */
  readonly outcome: 'allowed' | 'denied';
  /** The W008 denial reason (a bounded neutral string; absent when allowed). */
  readonly denialReason?: string | undefined;
  readonly observedAt: string;
  /** The exact-revision digest of the source invocation record. */
  readonly sourceDigest: string;
  /** The acting principal of the invocation (defaults to the caller). */
  readonly actor?: string | undefined;
}

/** Options of one authorization-decision observation. */
export interface ObserveAuthorizationDecisionOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly observationId: string;
  /** The principal the W009 decision point decided for. */
  readonly decidedPrincipalId: string;
  readonly outcome: 'allow' | 'deny';
  /** The W009 denial code (absent when allowed). */
  readonly denialCode?: string | undefined;
  /** The exact-revision digest of the sealed decision. */
  readonly decisionDigest: string;
  readonly observedAt: string;
  /** The resource the decision concerns (an opaque subject id). */
  readonly subjectId: string;
}

/** Options of one tenant-boundary observation. */
export interface ObserveTenantBoundaryOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly observationId: string;
  /** The subject of the boundary check (an opaque subject id). */
  readonly subjectId: string;
  readonly subjectTenantId: string;
  readonly actorTenantId: string;
  readonly outcome: 'allowed' | 'denied';
  readonly observedAt: string;
  readonly sourceDigest: string;
}

/** Options of one agent-session observation (the W020 intake). */
export interface ObserveAgentSessionOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly observationId: string;
  /** The W020 session id (`session:<slug>`). */
  readonly sessionId: string;
  /** The W020 session status token (a bounded neutral string). */
  readonly sessionStatus: string;
  readonly observedAt: string;
  /** The exact-revision digest of the source session snapshot/record. */
  readonly sourceDigest: string;
}

/** Options of one simulation-run observation (the W021 intake). */
export interface ObserveSimulationRunOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly observationId: string;
  /** The W021 run id (`simrun:<slug>`). */
  readonly runId: string;
  /** The W021 run status token (a bounded neutral string). */
  readonly runStatus: string;
  readonly observedAt: string;
  /** The exact-revision digest of the source run record. */
  readonly sourceDigest: string;
}

/** Options of one action observation (the W022 intake). */
export interface ObserveActionOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly observationId: string;
  /** The W022 action id (`action:<slug>`). */
  readonly actionId: string;
  /** The W022 action status token (a bounded neutral string). */
  readonly actionStatus: string;
  readonly observedAt: string;
  /** The exact-revision digest of the source action record. */
  readonly sourceDigest: string;
}

/** Options of one sandbox violation recording (with optional policy-driven quarantine). */
export interface RecordSandboxViolationOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly observationId: string;
  readonly extensionId: string;
  /** The neutral violation code (e.g. a W008 violation-detail code). */
  readonly violationCode: string;
  readonly observedAt: string;
  readonly sourceDigest: string;
  /** Override the policy's quarantineOnViolation (default: follow the active policy). */
  readonly quarantine?: boolean | undefined;
}

/** Options of one quarantine imposition. */
export interface ImposeQuarantineOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly quarantineId: string;
  readonly subjectKind: 'extension' | 'agent-session' | 'simulation-run' | 'action' | 'principal';
  readonly subjectId: string;
  readonly reason: string;
  readonly actedAt: string;
}

/** Options of one quarantine release. */
export interface ReleaseQuarantineOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly quarantineId: string;
  readonly subjectId: string;
  readonly reason: string;
  readonly actedAt: string;
}

/** One projection audit input: the mirrored W041 summary + its canonical record reference. */
export interface ProjectionAuditInput {
  readonly summary: unknown;
  readonly canonical: unknown;
}

/** Options of one audit pass. */
export interface RunAuditPassOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly auditPassId: string;
  readonly auditedAt: string;
  /** W041 projection summaries to audit (optional; the tenant-boundary family always runs). */
  readonly projections?: readonly ProjectionAuditInput[] | undefined;
}

/** The outcome of one audit pass. */
export interface AuditPassOutcome {
  /** The tenant-boundary findings (the R12 invariant verification). */
  readonly tenantBoundaryFindings: readonly AuditFinding[];
  /** The W041 projection-invariant findings. */
  readonly projectionFindings: readonly AuditFinding[];
  /** The audit observations recorded (one per finding; class security-audit). */
  readonly observations: readonly SealedObservation[];
}

/** The derived security state projection (metrics + health + audit + quarantine). */
export interface SecurityStateProjection {
  readonly metrics: ObservabilityMetrics;
  readonly health: SecurityHealth | null;
  readonly auditFindings: readonly AuditFinding[];
  readonly quarantinedSubjects: readonly string[];
  /** Every admitted observation, sorted (the audit trail). */
  readonly observations: readonly SealedObservation[];
}

/** Options of tenant-scoped reads. */
export interface ReadAuditTrailOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  /** Filter to one subject's observations. */
  readonly subjectId?: string | undefined;
}

/** The host's typed health/liveness projection (deterministic derivation). */
export interface SecurityRuntimeHealth {
  readonly schemaVersion: number;
  readonly service: string;
  readonly status: 'healthy' | 'degraded';
  readonly tenantCount: number;
  readonly observationCount: number;
  readonly quarantinedSubjectCount: number;
  readonly admittedListingCount: number;
}

/** The deterministic host snapshot (serialization-friendly). */
export interface SecurityRuntimeSnapshot {
  readonly schemaVersion: number;
  readonly tenants: readonly string[];
  readonly admittedListings: readonly {
    readonly tenantId: string;
    readonly listing: SealedListingVersion;
  }[];
}

/** Options of stream reads (the `security:*` event streams). */
export interface StreamReadOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly streamId: string;
}
