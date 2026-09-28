/**
 * @epoch/security-runtime — public API (service layer, Work Order W030).
 *
 * The thin typed HOST FACADE over the `@epoch/observability` kernel:
 *
 * - security-policy registration (policy as data; idempotent by
 *   digest, replay-conflict on skew);
 * - marketplace listing registration (W023 provenance — sealed
 *   listing versions verified through the REAL marketplace
 *   verifier);
 * - the SANDBOX ADMISSION GATE: kernel schema validation, the
 *   tenant's active isolation profile (fail-closed without one),
 *   deny-by-default quarantine, listing provenance resolution, the
 *   kernel isolation check, and the REAL W008 ceiling differential
 *   (a mirror/authority disagreement is a fail-closed
 *   `isolation-authority-conflict`);
 * - the observation intake from the execution surfaces (W008
 *   invocations, W009 decisions, R12 tenant boundaries, W020
 *   sessions, W021 runs, W022 actions) — recorded as sealed,
 *   content-addressed kernel observations;
 * - the quarantine lifecycle (policy-driven imposition + explicit
 *   gated release);
 * - audit passes (the tenant-boundary R12 family + the W041
 *   projection-invariant family; every finding recorded);
 * - the derived security-health projection + tenant-scoped audit
 *   reads + stream reads — deterministic, sorted, zero wall-clock.
 *
 * Every operation runs behind the W009 authorization gate; tenant
 * isolation (R12) is the typed `tenant-isolation-rejected` rejection.
 *
 * In-memory reference behavior only: NO persistence, NO network, NO
 * SIEM/monitoring vendor.
 */
export { SecurityRuntime } from './runtime';

// Version constants.
export {
  SECURITY_RUNTIME_CONTRACT_VERSION,
  SECURITY_RUNTIME_RECORD_VERSION,
  SECURITY_RUNTIME_SERVICE_NAME,
} from './version';

// Host input/output surface.
export type {
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
  ProjectionAuditInput,
  ReadAuditTrailOptions,
  RecordSandboxViolationOptions,
  RegisterListingOptions,
  RegisterPolicyOptions,
  ReleaseQuarantineOptions,
  RunAuditPassOptions,
  SandboxAdmissionOutcome,
  SecurityRuntimeHealth,
  SecurityRuntimeOptions,
  SecurityRuntimeSnapshot,
  SecurityServiceError,
  SecurityServiceResult,
  SecurityStateProjection,
  StreamReadOptions,
} from './types';
export type { AuthorizationContext } from './types';

// Kernel contract types re-exported for one-stop typed consumption.
export type {
  AuditFinding,
  IsolationVerdict,
  IsolationViolation,
  ObservabilityError,
  ObservabilityMetrics,
  SandboxSubject,
  SealedObservation,
  SealedSecurityEvent,
  SecurityHealth,
  SealedSecurityPolicy,
} from '@epoch/observability';
