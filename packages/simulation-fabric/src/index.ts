/**
 * @epoch/simulation-fabric — public API (kernel layer, Work Order W021).
 *
 * The Simulation Execution Fabric over @epoch/simulation-protocol (W005 —
 * the ONLY upstream authority for simulation semantics). The fabric:
 *
 * - admits simulation JOBS through the REAL W005 pipelines (registration,
 *   invocation request, cross-document conformance) and seals
 *   DETERMINISTIC, CONTENT-ADDRESSED run identities (digest over the
 *   canonical invocation payload + tenant + simulator pin + capability
 *   bindings — the W006-evidence exact-revision convention);
 * - enforces typed SUBMISSION IDEMPOTENCY: a replayed submission returns
 *   the SAME run identity through the typed `duplicate-run` admission
 *   (never a silent dedup); DIFFERENT content under a consumed key is the
 *   typed `idempotency-conflict`;
 * - supervises runs through a sealed, append-only STATE MACHINE (W023
 *   version-chain style: `previousRunDigest` chaining, content-addressed
 *   states, no in-place mutation):
 *   submitted -> scheduled -> running -> completed | failed | cancelled;
 *   every transition is a typed record with provenance + timestamp;
 * - binds capability registrations (W007 shapes) by opaque TYPED
 *   REFERENCE — never structural copies of foreign records;
 * - gates TENANT ISOLATION (R12): runs are tenant-scoped; cross-tenant
 *   access is the typed `tenant-isolation-rejected`;
 * - executes through the `SimulationExecutionPort` ADAPTER SEAM (external
 *   grids/clouds are adapters, NEVER core types; ONE in-memory reference
 *   adapter ships inside this package);
 * - ingests RESULTS through the REAL W005 admission + conformance
 *   pipelines and seals them (exact-revision addressable evidence);
 * - replays idempotently: re-executing a completed invocation returns the
 *   sealed prior result (the typed `replayed-result` disposition, no port
 *   call);
 * - emits the `simulation:*` lifecycle event vocabulary over the W010
 *   event shapes (one run = one stream, `stream:simulation-<suffix>`;
 *   digests mirror `computeEventDigest` and are admitted by the real
 *   `sealEvent` — pinned by the runtime parity tests).
 *
 * In-memory reference machinery only: NO persistence, NO network, NO
 * processes, NO clocks (every instant is caller-supplied; zero
 * randomness).
 *
 * Runtime dependency policy (W021, frozen): @epoch/simulation-protocol
 * (the executed contracts), @epoch/agent-protocol (timestamps/digests),
 * @epoch/tenancy (the tenant grammar), and zod — NOTHING else.
 * Compatibility with @epoch/capability-registry, @epoch/event-log,
 * @epoch/verification, @epoch/evidence and @epoch/authorization is
 * exercised via devDependency parity (src/kernel-parity.ts + the runtime
 * parity tests) — never runtime deps.
 */

// Version + vocabularies.
export {
  CAPABILITY_BINDING_ID_PATTERN,
  RUN_LIFECYCLE_TRANSITIONS,
  RUN_TRANSITION_CAUSES,
  SEMVER_CORE_PATTERN,
  SIMULATION_EVENT_DISCRIMINATORS,
  SIMULATION_EVENT_RECORD_VERSION,
  SIMULATION_FABRIC_CONTRACT_VERSION,
  SIMULATION_FABRIC_RECORD_VERSION,
  SIMULATION_IDEMPOTENCY_KEY_PATTERN,
  SIMULATION_JOB_ID_PATTERN,
  SIMULATION_PRINCIPAL_ID_PATTERN,
  SIMULATION_RUN_ID_PATTERN,
  SIMULATION_RUN_STATUSES,
  SIMULATION_STREAM_ID_PATTERN,
  isTerminalRunStatus,
  kindPrefixOf,
  simulationStreamIdOf,
} from './version';
export type {
  RunTransitionCause,
  SimulationEventDiscriminator,
  SimulationRunStatus,
} from './version';

// Published contract types.
export type {
  AdmittedCapabilityBinding,
  AdmittedInvocation,
  CapabilityBindingRef,
  ExecutionOutcome,
  FabricIdempotencyKey,
  FabricPrincipalId,
  FabricRunEntry,
  FabricTenantId,
  IdempotencyRecord,
  PortExecution,
  RunTransition,
  SealedSimulationResult,
  SealedSimulationEvent,
  SimulationCausalParent,
  SimulationEventContent,
  SimulationEventPayload,
  SimulationEventSequence,
  SimulationExecutionPort,
  SimulationFabricSnapshot,
  SimulationJobId,
  SimulationRun,
  SimulationRunId,
  SimulationRunState,
} from './types';

// Typed error taxonomy + result.
export type { FabricError, FabricErrorCode, FabricIssue, FabricResult } from './errors';

// Runtime validators (the zod surface).
export {
  CapabilityBindingRefSchema,
  FabricIdempotencyKeySchema,
  FabricPrincipalIdSchema,
  FabricRunEntrySchema,
  IdempotencyRecordSchema,
  RunTransitionCauseSchema,
  RunTransitionSchema,
  SealedSimulationResultSchema,
  SimulationEventDiscriminatorSchema,
  SimulationFabricRecordVersionSchema,
  SimulationFabricSnapshotSchema,
  SimulationJobIdSchema,
  SimulationRunIdSchema,
  SimulationRunSchema,
  SimulationRunStateSchema,
  SimulationRunStatusSchema,
} from './schema';

// Deterministic identity + idempotency (the pure derivations).
export {
  canonicalCapabilityBindings,
  computeRunIdentityDigest,
  computeRunStateDigest,
  currentStateDigest,
  deriveRunIdempotencyKey,
  runIdOf,
} from './identity';
export type { RunIdentityScope } from './identity';

// The pure state machine (job admission, transitions, chain verification, result sealing).
export {
  admitSimulationJob,
  checkResultAgainstRun,
  runFailureDetail,
  sealSimulationResult,
  transitionRunStatus,
  verifyRunStateChain,
} from './state';
export type { AdmitSimulationJobOptions, AdmittedSimulationJob, TransitionRunOptions } from './state';

// The simulation:* event vocabulary over the W010 event shapes.
export {
  computeSimulationEventDigest,
  parseSimulationEventData,
  sealSimulationEvent,
  verifySealedSimulationEvent,
  RunCancelledDataSchema,
  RunCompletedDataSchema,
  RunFailedDataSchema,
  RunScheduledDataSchema,
  RunStartedDataSchema,
  RunSubmittedDataSchema,
  ResultPublishedDataSchema,
  SHA256_HEX_PATTERN,
  SealedSimulationEventSchema,
  SIMULATION_EVENT_DATA_SCHEMAS,
  SimulationCausalParentSchema,
  SimulationEventContentSchema,
  SimulationEventPayloadSchema,
  SimulationEventSequenceSchema,
} from './events';
export type {
  RunCancelledData,
  RunCompletedData,
  RunFailedData,
  RunScheduledData,
  RunStartedData,
  RunSubmittedData,
  ResultPublishedData,
} from './events';

// The execution-port seam + the ONE in-memory reference adapter.
export {
  ReferenceSimulationExecutionPort,
} from './port';

// The reference in-memory host.
export {
  SimulationFabric,
} from './fabric';
export type {
  CancelRunOptions,
  ExecuteRunOptions,
  IngestResultOptions,
  ListRunsOptions,
  PlanExecutionOptions,
  RunReadOptions,
  SimulationFabricOptions,
  StartRunOptions,
  SubmitJobOptions,
} from './fabric';

// Published schema surface + contract emission.
export { SIMULATION_FABRIC_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  SIMULATION_FABRIC_CONTRACT_DIR,
  renderSimulationFabricContractFiles,
  typeToKebabCase,
} from './contract-emission';

// Compile-time contract parity (type-only).
export type { SimulationFabricSchemaSync, SimulationEventSchemaSync } from './parity';
