/**
 * @epoch/simulation-runner — host-model types (v1).
 *
 * The service owns HOST BEHAVIOR, not contract authorities: every typed
 * document below composes the kernel's published contract types
 * (SimulationRun, ExecutionOutcome, CapabilityBindingRef) and reuses the
 * kernel's error taxonomy verbatim (`RunnerResult<T>` IS the fabric's
 * `FabricResult<T>` — no competing error surface, the W020 precedent).
 */
import type { Timestamp } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import type { CapabilityRegistry } from '@epoch/capability-registry';
import type {
  AdmittedCapabilityBinding,
  CapabilityBindingRef,
  ExecutionOutcome,
  FabricResult,
  SealedSimulationEvent,
  SimulationExecutionPort,
  SimulationFabric,
  SimulationFabricSnapshot,
  SimulationRun,
  SimulationRunStatus,
} from '@epoch/simulation-fabric';
import type { SIMULATION_RUNNER_RECORD_VERSION } from './version';
import type { SimulationRunnerHealthStatus } from './version';

/** The runner's total-result wrapper: the kernel taxonomy, reused verbatim. */
export type RunnerResult<T> = FabricResult<T>;

/**
 * Health/liveness as typed data (deterministic derivation, no clocks):
 * `degraded` exactly when at least one hosted run has settled `failed`;
 * counts cover the hosted runs; `degradedRuns` lists the failed
 * tenant-scoped run ids, sorted.
 */
export interface SimulationRunnerHealth {
  readonly schemaVersion: typeof SIMULATION_RUNNER_RECORD_VERSION;
  readonly status: SimulationRunnerHealthStatus;
  readonly runCount: number;
  readonly runsByStatus: Readonly<Record<SimulationRunStatus, number>>;
  readonly degradedRuns: readonly string[];
}

/** Options of the `SimulationRunner` constructor. */
export interface SimulationRunnerOptions {
  /**
   * Tenant this runner is scoped to. When provided, ANY operation naming
   * a different tenant is rejected with `tenant-isolation-rejected`
   * (R12 — the event-log single-tenant guard precedent).
   */
  readonly expectedTenantId?: TenantId;
  /**
   * The capability registry (W007) run bindings pre-resolve against at
   * intake and planning (retired capabilities never resolve —
   * `lifecycle-conflict`, mirroring the W020 binder; deprecation is
   * advisory). When omitted, the runner plans on opaque references alone.
   */
  readonly registry?: CapabilityRegistry;
  /** The fabric host to supervise (defaults to a fresh in-memory fabric). */
  readonly fabric?: SimulationFabric;
}

/** Options of `SimulationRunner.submitJob` (job intake). */
export interface RunnerSubmitJobOptions {
  readonly tenantId: TenantId;
  /** The W005 simulator registration document (raw JSON; kernel-admitted). */
  readonly registration: unknown;
  /** The W005 invocation request document (raw JSON; kernel-admitted). */
  readonly request: unknown;
  /** Capability registrations to bind, by opaque typed reference. */
  readonly capabilityBindings: readonly CapabilityBindingRef[];
  /** Caller-supplied idempotency key; defaults to the kernel-derived content key. */
  readonly idempotencyKey?: string | undefined;
  readonly actor: string;
  readonly at: Timestamp;
}

/** Options of `SimulationRunner.planRun` (supervision: execution planning). */
export interface RunnerPlanRunOptions {
  readonly tenantId: TenantId;
  readonly runId: string;
  readonly actor: string;
  readonly at: Timestamp;
}

/** Options of `SimulationRunner.executeRun` (supervision: pull-style execution). */
export interface RunnerExecuteRunOptions {
  readonly tenantId: TenantId;
  readonly runId: string;
  /** The execution adapter (ALL concrete compute lives behind this seam). */
  readonly port: SimulationExecutionPort;
  readonly actor: string;
  readonly at: Timestamp;
}

/** Options of `SimulationRunner.startRun` (supervision: push-style dispatch). */
export interface RunnerStartRunOptions {
  readonly tenantId: TenantId;
  readonly runId: string;
  readonly actor: string;
  readonly at: Timestamp;
}

/** Options of `SimulationRunner.publishResult` (result publication). */
export interface RunnerPublishResultOptions {
  readonly tenantId: TenantId;
  readonly runId: string;
  /** A W005 `simulation.result` document (raw JSON; kernel-admitted + conformance-checked). */
  readonly result: unknown;
  readonly actor: string;
  readonly at: Timestamp;
}

/** Options of `SimulationRunner.cancelRun`. */
export interface RunnerCancelRunOptions {
  readonly tenantId: TenantId;
  readonly runId: string;
  readonly actor: string;
  readonly at: Timestamp;
}

/** Options of the run-scoped read operations (`getRun`, `runEvents`). */
export interface RunnerRunReadOptions {
  readonly tenantId: TenantId;
  readonly runId: string;
}

/** Options of `SimulationRunner.listRuns`. */
export interface RunnerListRunsOptions {
  readonly tenantId: TenantId;
}

/** The runner's whole-host snapshot: the kernel fabric snapshot (deterministic). */
export type SimulationRunnerSnapshot = SimulationFabricSnapshot;

/** The kernel contract types re-exported for one-stop typed consumption. */
export type {
  AdmittedCapabilityBinding,
  CapabilityBindingRef,
  ExecutionOutcome,
  SealedSimulationEvent,
  SimulationExecutionPort,
  SimulationRun,
};
