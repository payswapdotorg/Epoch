/**
 * @epoch/deploy-model — versions and closed vocabularies (Work Order W033).
 *
 * The DEPLOYMENT DISCIPLINE (Tech Lead design pin, frozen): everything in
 * this tree is DETERMINISTIC, provider-NEUTRAL and IN-REPO. The platform is
 * a typed TOPOLOGY model — components, environments, placement and wiring
 * as data — plus typed DEPLOY PLANS produced by a deterministic planner and
 * executed by an in-memory REFERENCE EXECUTOR against fixture environment
 * models. There are NO real cloud provider calls, NO real infrastructure
 * provisioning and NO credentials anywhere in this tree: these are
 * proof-of-correctness artifacts, not live deploys. Any real provider is a
 * future adapter behind the topology model (the W029 adapter pattern
 * applied to deployment; see docs/operations/provider-neutrality-contract.md).
 *
 * Determinism discipline (the W031 E2E philosophy, carried forward): zero
 * wall-clock, zero randomness, zero network. Every instant is
 * caller-supplied data; every id/digest is derived from content through
 * the @epoch/agent-protocol canonical-JSON SHA-256 machinery (the same
 * content addressing every Epoch kernel uses).
 *
 * Vocabulary policy: every list below is a CLOSED vocabulary. Records
 * carrying values outside them are rejected at admission with a typed
 * `validation` issue — provider semantics never enter through an enum
 * door (lock rule 13).
 */

/** Version of the deploy-model contract surface (types + this file). */
export const DEPLOY_MODEL_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized deploy record. */
export const DEPLOY_MODEL_RECORD_VERSION = 1 as const;

/**
 * The deployable component kinds — the workspace surface shapes a component
 * record may reference (`workspacePath`). Provider-neutral by construction:
 * these name REPOSITORY roles, never runtime vendors.
 */
export const COMPONENT_KINDS = [
  'package',
  'service',
  'app',
  'adapter',
  'pack',
] as const;
export type ComponentKind = (typeof COMPONENT_KINDS)[number];

/** The environment tiers (typed records; `prod` is not special in code). */
export const ENVIRONMENT_TIERS = ['dev', 'staging', 'prod'] as const;
export type EnvironmentTier = (typeof ENVIRONMENT_TIERS)[number];

/**
 * The closed plan-step vocabulary (Work Order pin): build, verify, promote,
 * health-check, rollback-point. Rollback EXECUTION is a run-level effect of
 * the reference executor (recorded in the typed rollback receipt), never a
 * plan step — the plan is immutable intent; the run is effects.
 */
export const STEP_KINDS = ['build', 'verify', 'promote', 'health-check', 'rollback-point'] as const;
export type StepKind = (typeof STEP_KINDS)[number];

/** Step outcome statuses (typed; errors are values, never exceptions). */
export const OUTCOME_STATUSES = ['succeeded', 'failed'] as const;
export type OutcomeStatus = (typeof OUTCOME_STATUSES)[number];

/** Terminal statuses of a deploy run. */
export const RUN_STATUSES = ['deployed', 'rolled-back', 'failed'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** Health probe results the fixture executor consumes (declarations, not calls). */
export const HEALTH_PROBE_RESULTS = ['healthy', 'degraded', 'failed'] as const;
export type HealthProbeResultKind = (typeof HEALTH_PROBE_RESULTS)[number];

/** Health check kinds a component may declare (neutral vocabulary). */
export const HEALTH_CHECK_KINDS = ['readiness', 'liveness', 'startup'] as const;
export type HealthCheckKind = (typeof HEALTH_CHECK_KINDS)[number];

/**
 * The typed deploy-model error vocabulary. Every admission/execution
 * failure is one of these CODES carried as a value — the negative paths
 * are part of the contract, not exceptions.
 */
export const DEPLOY_ERROR_CODES = [
  'validation',
  'digest-mismatch',
  'unknown-component',
  'unknown-environment',
  'unknown-gate',
  'duplicate-record',
  'dependency-cycle',
  'dependency-not-deployable',
  'wiring-environment-mismatch',
  'cross-tenant-placement-rejected',
  'cross-tenant-wiring-rejected',
  'cross-tenant-plan-rejected',
  'provider-vocabulary-rejected',
  'gate-skip-rejected',
  'gate-failed-rejected',
  'plan-gate-skew',
  'fixture-state-skew',
  'topology-skew',
  'health-check-failed',
  'rollback-mismatch',
] as const;
export type DeployErrorCode = (typeof DEPLOY_ERROR_CODES)[number];
