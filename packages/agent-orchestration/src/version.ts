/**
 * Agent-orchestration contract versions and closed vocabularies.
 *
 * architecture.md (binding): "Agents propose; the Action Gateway authorizes
 * execution." The orchestration layer SCHEDULES — it sequences, retries, and
 * tracks typed action PROPOSAL references (the W003 vocabulary), never
 * authorizes or executes them (architecture lock rule 3: the gateway is a
 * FUTURE Work Order, W022).
 *
 * Versioning policy (v1, mirrors @epoch/event-log / W009 / W007): a
 * serialized orchestration document is admitted only when its
 * `schemaVersion` equals {@link ORCHESTRATION_RECORD_VERSION} exactly; skew
 * surfaces as a typed `version-unsupported` error before any other schema
 * diagnostic. {@link AGENT_ORCHESTRATION_CONTRACT_VERSION} versions the
 * published contract surface (`schemas/` + the typed index export).
 *
 * Neutrality (architecture lock rule 13): plan, session, step, tenant and
 * principal identifiers are opaque, kind-prefixed or plan-local slugs; NO
 * model vendor, framework, runtime or provider vocabulary appears in this
 * contract. Agents are typed descriptors; concrete model providers are
 * future adapters (W028/W029 surfaces), never this kernel.
 */

/** Version of the published agent-orchestration contract surface (schemas/ + types). */
export const AGENT_ORCHESTRATION_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized orchestration record. */
export const ORCHESTRATION_RECORD_VERSION = 1 as const;

/**
 * Orchestration plan identity: `plan:<slug>`. Plans are content-addressed
 * (the compiled plan digest); the caller-assigned id is the stable handle
 * for referencing a plan across documents.
 */
export const ORCHESTRATION_PLAN_ID_PATTERN = /^plan:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Orchestration session identity: `session:<slug>`. A session is the
 * tenant-scoped, replayable execution of one compiled plan.
 */
export const ORCHESTRATION_SESSION_ID_PATTERN = /^session:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Plan-local step identity: a bare lowercase slug (`survey`, `analyze`).
 * Step ids are scoped to their plan; the compiled plan is the authority on
 * their ordering (deterministic topological order, ties broken by stepId).
 */
export const ORCHESTRATION_STEP_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

/**
 * Tenant scope of an orchestration document: `tenant:<slug>` — an OPAQUE
 * tenant id in the exact grammar of @epoch/tenancy (W009). Tenancy is NOT a
 * runtime dependency: the pattern is mirrored here and pinned
 * member-for-member by devDependency parity tests (test/parity.test.ts,
 * src/kernel-parity.ts).
 */
export const ORCHESTRATION_TENANT_ID_PATTERN = /^tenant:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Principal reference (the plan author): `principal:<slug>` — an OPAQUE
 * principal id in the exact grammar of @epoch/identity (W009). Identity is
 * NOT a runtime dependency: mirrored + parity-pinned, same as tenancy.
 */
export const ORCHESTRATION_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Session lifecycle states. The session is the unit of orchestration
 * lifecycle: created `pending`, started into `running`, optionally
 * `suspended`/resumed, and settled `completed` (every step executed),
 * `failed` (a step settled in failure), or `cancelled` by the host.
 */
export const SESSION_STATUSES = [
  'pending',
  'running',
  'suspended',
  'completed',
  'failed',
  'cancelled',
] as const;

/** One orchestration session lifecycle state. */
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/**
 * The legal session lifecycle transition table. `completed`, `failed` and
 * `cancelled` are terminal — there is no revival; a re-run is a NEW session
 * (idempotent re-runs replay the SAME session's event history instead).
 */
export const SESSION_LIFECYCLE_TRANSITIONS: Readonly<
  Record<SessionStatus, readonly SessionStatus[]>
> = {
  pending: ['running', 'cancelled'],
  running: ['suspended', 'completed', 'failed', 'cancelled'],
  suspended: ['running', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

/** Step execution-tracking states (the orchestration-side view; the Action Gateway owns authorization). */
export const STEP_STATUSES = [
  'pending',
  'dispatched',
  'authorized',
  'executed',
  'failed',
  'rejected',
  'skipped',
] as const;

/** One step execution-tracking state. */
export type StepStatus = (typeof STEP_STATUSES)[number];

/**
 * The legal step status transition table. `dispatched`/`authorized` may
 * settle (`executed`/`failed`/`rejected`) OR re-queue to `pending` when a
 * retry policy covers the failing phase (attempts remain). `executed`,
 * `failed`, `rejected` and `skipped` are terminal.
 */
export const STEP_LIFECYCLE_TRANSITIONS: Readonly<Record<StepStatus, readonly StepStatus[]>> = {
  pending: ['dispatched', 'skipped'],
  dispatched: ['authorized', 'executed', 'failed', 'rejected', 'pending'],
  authorized: ['executed', 'failed', 'pending'],
  executed: [],
  failed: [],
  rejected: [],
  skipped: [],
};

/**
 * Action lifecycle phases a retry policy may cover (a typed-data subset of
 * the W010 `ACTION_EVENT_PHASES` vocabulary — `rejected` proposals and
 * `failed` executions are the retryable facts; success phases never are).
 */
export const RETRYABLE_ACTION_PHASES = ['rejected', 'failed'] as const;

/** One retryable action lifecycle phase. */
export type RetryableActionPhase = (typeof RETRYABLE_ACTION_PHASES)[number];

/**
 * Causes recorded on session-status transitions (typed, closed): host
 * commands (`start`/`suspend`/`resume`/`cancel`) and driver-settled
 * completion (`all-steps-executed` / `step-settled-unexecuted`).
 */
export const SESSION_TRANSITION_CAUSES = [
  'start',
  'suspend',
  'resume',
  'cancel',
  'all-steps-executed',
  'step-settled-unexecuted',
] as const;

/** One session-status transition cause. */
export type SessionTransitionCause = (typeof SESSION_TRANSITION_CAUSES)[number];

/**
 * Causes recorded on step-status transitions (typed, closed):
 * `dependency-satisfied` (the driver dispatched a ready step),
 * `event` (a W010 action-lifecycle fact advanced the step),
 * `retry` (a retry policy re-queued a failing step),
 * `cascade` (an upstream terminal failure skipped the step),
 * `cancel` (the host cancelled the session).
 */
export const STEP_TRANSITION_CAUSES = [
  'dependency-satisfied',
  'event',
  'retry',
  'cascade',
  'cancel',
] as const;

/** One step-status transition cause. */
export type StepTransitionCause = (typeof STEP_TRANSITION_CAUSES)[number];

/**
 * Upper bound on retry attempts per step (typed-data bound; the value is a
 * policy shape, the bound keeps serialized policies small and reviewable).
 */
export const MAX_RETRY_ATTEMPTS = 16 as const;
