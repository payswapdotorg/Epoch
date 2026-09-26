/**
 * @epoch/simulation-runner — public API (service layer, Work Order W021).
 *
 * The thin, typed SERVICE FACADE over the @epoch/simulation-fabric kernel
 * (the W020 division of ownership, mirroring services/agent-runtime over
 * @epoch/agent-orchestration). The runner:
 *
 * - takes JOB INTAKE through the kernel's REAL W005 admission pipelines,
 *   pre-resolving every capability binding against the REAL W007
 *   capability registry (retired capabilities never bind — typed
 *   `lifecycle-conflict`; unknown or revision-mismatched pins are typed
 *   `unknown-capability-binding`; deprecation is advisory);
 * - supervises runs: execution planning, pull-style execution through the
 *   SimulationExecutionPort adapter seam (external grids/clouds are
 *   adapters, NEVER core types), push-style start + result publication,
 *   and cancellation — every lifecycle fact a sealed, content-addressed
 *   state record and a `simulation:*` event over the W010 shapes;
 * - replays idempotently: re-executing a completed invocation returns the
 *   sealed prior result (the typed `replayed-result` disposition);
 * - gates tenant isolation (R12): tenant-scoped runs; cross-tenant access
 *   is the typed `tenant-isolation-rejected`;
 * - exposes health/liveness as typed data (deterministic derivation, no
 *   clocks) and deterministic snapshot/restore.
 *
 * In-memory reference behavior: NO persistence, NO network servers, NO
 * real processes; the service is a typed library surface with a driver,
 * not an HTTP server. Core logic stays pure (zero wall-clock, zero
 * randomness — instants are caller-supplied). The typed fabric contract
 * and error taxonomy are @epoch/simulation-fabric's — this service reuses
 * them verbatim, it never forks authorities.
 *
 * Runtime dependency policy (W021): @epoch/simulation-fabric (the
 * kernel), @epoch/simulation-protocol + @epoch/agent-protocol (the
 * executed contracts and timestamps), @epoch/capability-registry (the
 * real registry the intake pre-resolution uses), @epoch/tenancy (the
 * tenant grammar), and zod. Compatibility with @epoch/event-log,
 * @epoch/authorization (and the W006/W007 vocabularies beyond the
 * registry) is exercised via devDependency parity tests — never runtime
 * deps.
 */

// Version + vocabularies.
export {
  SIMULATION_RUNNER_CONTRACT_VERSION,
  SIMULATION_RUNNER_HEALTH_STATUSES,
  SIMULATION_RUNNER_RECORD_VERSION,
} from './version';
export type { SimulationRunnerHealthStatus } from './version';

// Host-model types (the kernel contract types are re-exported below).
export type {
  RunnerCancelRunOptions,
  RunnerExecuteRunOptions,
  RunnerListRunsOptions,
  RunnerPlanRunOptions,
  RunnerPublishResultOptions,
  RunnerResult,
  RunnerRunReadOptions,
  RunnerStartRunOptions,
  RunnerSubmitJobOptions,
  RunnerSubmitJobOptions as SubmitJobOptions,
  SimulationRunnerHealth,
  SimulationRunnerOptions,
  SimulationRunnerSnapshot,
} from './types';
export type {
  AdmittedCapabilityBinding,
  CapabilityBindingRef,
  ExecutionOutcome,
  SealedSimulationEvent,
  SimulationExecutionPort,
  SimulationRun,
} from './types';

// The pure one-shot driver + the W007 registry adapter seam.
export {
  admittedCapabilitiesFromRegistry,
  driveSimulationJob,
} from './driver';
export type { DriveSimulationJobOptions, DrivenSimulationJob } from './driver';

// The reference host.
export { SimulationRunner } from './runtime';

// Kernel vocabularies re-exported for one-stop typed consumption.
export {
  ReferenceSimulationExecutionPort,
  SIMULATION_FABRIC_CONTRACT_VERSION,
  SIMULATION_FABRIC_RECORD_VERSION,
  SIMULATION_RUN_STATUSES,
  isTerminalRunStatus,
  simulationStreamIdOf,
} from '@epoch/simulation-fabric';
export type {
  FabricError,
  FabricErrorCode,
  FabricIssue,
  FabricResult,
  PortExecution,
  RunTransition,
  SealedSimulationResult,
  SimulationEventContent,
  SimulationRunId,
  SimulationRunState,
  SimulationRunStatus,
} from '@epoch/simulation-fabric';
