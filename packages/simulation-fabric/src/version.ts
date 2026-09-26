/**
 * Simulation Execution Fabric contract versions and closed vocabularies
 * (W021).
 *
 * The fabric EXECUTES W005 simulations: `@epoch/simulation-protocol` is the
 * ONLY upstream authority for simulation semantics (registration,
 * invocation, result, conformance) — every vocabulary below is fabric-side
 * EXECUTION vocabulary, never a re-declaration of protocol semantics.
 *
 * - The run lifecycle (`submitted -> scheduled -> running -> completed |
 *   failed | cancelled`) is a CLOSED typed vocabulary with a legal-
 *   transition table (the W020 session-lifecycle precedent); terminal
 *   statuses admit no further transitions.
 * - The `simulation:*` event discriminators form the OPEN-namespace payload
 *   family over the W010 event shapes (the W036 `delivery:*` precedent):
 *   one run = one stream (`stream:simulation-<suffix>`), events are
 *   append-only FACTS.
 * - Every grammar is provider-neutral (architecture lock rule 13): no
 *   field, id, or vocabulary names a simulation vendor, grid, cloud, or
 *   engine. Concrete compute providers are adapters behind the
 *   SimulationExecutionPort seam, never core vocabulary.
 *
 * Versioning policy (mirrors the W009/W010/W020 kernels): a serialized
 * fabric record is admitted only when its `schemaVersion` equals
 * {@link SIMULATION_FABRIC_RECORD_VERSION} exactly; skew surfaces as the
 * typed `version-unsupported` error before any schema validation.
 */

/** Version of the published simulation-fabric contract surface. */
export const SIMULATION_FABRIC_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized fabric record. */
export const SIMULATION_FABRIC_RECORD_VERSION = 1 as const;

/**
 * The run lifecycle statuses (the W021 pin): `submitted` (job admitted,
 * identity sealed), `scheduled` (execution planned, capability bindings
 * admitted), `running` (dispatched to the execution port), and the three
 * terminal statuses `completed` (an admitted W005 result was ingested),
 * `failed` (the execution itself failed), `cancelled` (supervision
 * cancelled a non-terminal run).
 */
export const SIMULATION_RUN_STATUSES = [
  'submitted',
  'scheduled',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;

/** One run lifecycle status. */
export type SimulationRunStatus = (typeof SIMULATION_RUN_STATUSES)[number];

/**
 * The legal run-status transitions (closed table; the W020
 * SESSION_LIFECYCLE_TRANSITIONS precedent). Terminal statuses
 * (`completed`, `failed`, `cancelled`) admit NOTHING — a settled run is
 * history; corrections are new runs.
 */
export const RUN_LIFECYCLE_TRANSITIONS: Readonly<
  Record<SimulationRunStatus, readonly SimulationRunStatus[]>
> = {
  submitted: ['scheduled', 'cancelled'],
  scheduled: ['running', 'cancelled'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

/** Whether a run status is terminal (admits no further transitions). */
export function isTerminalRunStatus(status: SimulationRunStatus): boolean {
  return RUN_LIFECYCLE_TRANSITIONS[status].length === 0;
}

/**
 * The typed causes of run-state transitions. Every transition record
 * carries exactly one; `submission` is the genesis cause (from `null` to
 * `submitted`).
 */
export const RUN_TRANSITION_CAUSES = [
  'submission',
  'planning',
  'dispatch',
  'result-ingested',
  'execution-failed',
  'result-rejected',
  'cancellation',
] as const;

/** One run-transition cause. */
export type RunTransitionCause = (typeof RUN_TRANSITION_CAUSES)[number];

/**
 * The simulation lifecycle event vocabulary: discriminators in the
 * `simulation` payload namespace (the W010 open-namespace family owned by
 * this package, the `delivery:*` precedent). Every fabric lifecycle fact
 * projects onto one of these event kinds over the W010 event shapes
 * (src/events.ts); one run's events form ONE stream.
 */
export const SIMULATION_EVENT_DISCRIMINATORS = [
  'simulation:run-submitted',
  'simulation:run-scheduled',
  'simulation:run-started',
  'simulation:run-completed',
  'simulation:run-failed',
  'simulation:run-cancelled',
  'simulation:result-published',
] as const;

/** One simulation event payload discriminator. */
export type SimulationEventDiscriminator = (typeof SIMULATION_EVENT_DISCRIMINATORS)[number];

// --------------------------------------------------------------------------------
// Opaque, kind-prefixed identity grammars (the W002/W009/W010/W023 house
// pattern). The segment before `:` is the record kind; the slug is a
// lowercase kebab of length <= 63.
// --------------------------------------------------------------------------------

/** Simulation run identity: `simrun:<slug>` (derived, content-addressed). */
export const SIMULATION_RUN_ID_PATTERN = /^simrun:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Simulation-job identity: `simjob:<slug>`. A job is the caller-side
 * submission unit; the fabric derives the run identity from content, so
 * job ids are caller-supplied opaque handles (never identity).
 */
export const SIMULATION_JOB_ID_PATTERN = /^simjob:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Opaque job idempotency-key grammar (the agent-protocol MessageId
 * charset, mirrored): a caller-supplied or derived submission key. Derived
 * keys are lowercase hex SHA-256 (64 chars) which this grammar admits.
 */
export const SIMULATION_IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/**
 * Acting principal grammar — MIRRORED from @epoch/event-log's
 * EVENT_ACTOR_PATTERN (the W009 identity grammar; the runtime parity test
 * pins the constants pattern-identical). Identity is NOT a runtime
 * dependency of this package.
 */
export const SIMULATION_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Simulation event stream identity — MIRRORED from @epoch/event-log's
 * EVENT_STREAM_ID_PATTERN (W010 grammar): `stream:<slug>`. One run's
 * lifecycle events form one stream; pinned by the runtime parity test.
 */
export const SIMULATION_STREAM_ID_PATTERN = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Version discriminator carried by every serialized simulation event —
 * MIRRORED from @epoch/event-log's EVENT_LOG_RECORD_VERSION (simulation
 * events are append-only typed events over the W010 event shapes). The
 * runtime parity test asserts the constants are equal; a future W010 bump
 * intentionally breaks that parity and surfaces here as a review gate.
 */
export const SIMULATION_EVENT_RECORD_VERSION = 1 as const;

/**
 * Capability-binding reference grammars — the W007 vocabulary, referenced
 * opaquely. `capabilityId` mirrors the agent-protocol QUALIFIED_NAME
 * grammar (dot-namespaced, e.g. `engineering.stress-analysis`); `version`
 * is the W007 semver core; `registrationDigest` is the W007 manifest
 * digest (the registration's content address) carried as an opaque
 * exact-revision pin.
 */
export const CAPABILITY_BINDING_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/;

/** Semver core (mirrors the W007 semver grammar). */
export const SEMVER_CORE_PATTERN = /^\d+\.\d+\.\d+$/;

/** The kind prefix of a fabric opaque id (the segment before `:`). */
export function kindPrefixOf(id: string): string {
  const separator = id.indexOf(':');
  return separator === -1 ? '' : id.slice(0, separator);
}

/**
 * Derive the simulation event stream id of one run (deterministic): one
 * run = one stream, `stream:simulation-<run-suffix>` (the W036
 * `deliveryStreamIdOf` precedent).
 */
export function simulationStreamIdOf(runId: string): string {
  const suffix = runId.slice('simrun:'.length);
  return `stream:simulation-${suffix}`;
}
