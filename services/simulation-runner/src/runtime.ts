/**
 * The reference simulation runner host (W021): the thin, typed SERVICE
 * FACADE over the @epoch/simulation-fabric kernel.
 *
 * Owns (and only owns): job intake with REAL W007 registry pre-resolution
 * (a binding that pins no registry record is `unknown-capability-binding`;
 * a binding to a RETIRED record is `lifecycle-conflict`, mirroring the
 * W020 binder semantics — deprecation is advisory and binds); run
 * supervision (planning, pull-style execution through the
 * SimulationExecutionPort seam, push-style start + result publication,
 * cancellation); the tenant pin (a runner scoped to one tenant rejects
 * foreign tenants with the typed `tenant-isolation-rejected`); and
 * health/liveness as typed data (deterministic derivation, no clocks).
 *
 * Explicitly NOT (later Work Orders / out of scope): durable persistence,
 * event distribution, work scheduling beyond the typed lifecycle, real
 * solver backends (adapters behind the fabric's port seam), network
 * servers — the service is a typed library surface with a driver, not an
 * HTTP server.
 *
 * Determinism: ZERO wall-clock reads and ZERO randomness — every instant
 * is caller-supplied; every listing/snapshot is sorted (no
 * insertion-order leaks); two runners fed the same submissions hold
 * byte-identical fabric snapshots.
 */
import type { TenantId } from '@epoch/tenancy';
import type { CapabilityRegistry } from '@epoch/capability-registry';
import { SimulationFabric } from '@epoch/simulation-fabric';
import type {
  CapabilityBindingRef,
  ExecutionOutcome,
  FabricError,
  SealedSimulationEvent,
  SimulationRun,
  SimulationRunStatus,
} from '@epoch/simulation-fabric';
import { SIMULATION_RUNNER_RECORD_VERSION } from './version';
import { admittedCapabilitiesFromRegistry } from './driver';
import type {
  RunnerCancelRunOptions,
  RunnerExecuteRunOptions,
  RunnerListRunsOptions,
  RunnerPlanRunOptions,
  RunnerPublishResultOptions,
  RunnerRunReadOptions,
  RunnerResult,
  RunnerStartRunOptions,
  RunnerSubmitJobOptions,
  SimulationRunnerHealth,
  SimulationRunnerOptions,
  SimulationRunnerSnapshot,
} from './types';

/** The reference simulation runner. Construct directly or restore from a snapshot. */
export class SimulationRunner {
  private readonly fabric: SimulationFabric;
  private readonly registry: CapabilityRegistry | undefined;
  private readonly expectedTenantId: TenantId | undefined;

  constructor(options: SimulationRunnerOptions = {}) {
    this.fabric = options.fabric ?? new SimulationFabric();
    this.registry = options.registry;
    this.expectedTenantId = options.expectedTenantId;
  }

  /** The underlying fabric host (kernel reference machinery). */
  get host(): SimulationFabric {
    return this.fabric;
  }

  /**
   * Submit one simulation job (intake). The W005 documents and the
   * idempotency gates belong to the kernel; the runner adds the REAL W007
   * pre-resolution: every capability binding must pin a registry record
   * (`unknown-capability-binding` when it does not; `lifecycle-conflict`
   * when the pinned record is retired — deprecation is advisory).
   */
  submitJob(options: RunnerSubmitJobOptions): RunnerResult<SimulationRun> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    if (this.registry !== undefined) {
      for (const binding of options.capabilityBindings) {
        const resolved = this.resolveBinding(this.registry, binding);
        if (resolved !== null) {
          return { ok: false, error: resolved };
        }
      }
    }
    return this.fabric.submitJob({
      tenantId: options.tenantId,
      registration: options.registration,
      request: options.request,
      capabilityBindings: options.capabilityBindings,
      idempotencyKey: options.idempotencyKey,
      actor: options.actor,
      at: options.at,
    });
  }

  /**
   * Plan a run's execution (supervision): `submitted -> scheduled`,
   * resolving the run's bindings against the registry-derived admitted
   * set when a registry is attached.
   */
  planRun(options: RunnerPlanRunOptions): RunnerResult<SimulationRun> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    return this.fabric.planExecution({
      tenantId: options.tenantId,
      runId: options.runId,
      admittedCapabilities:
        this.registry === undefined ? undefined : admittedCapabilitiesFromRegistry(this.registry),
      actor: options.actor,
      at: options.at,
    });
  }

  /**
   * Execute a scheduled run through the port (pull-style supervision).
   * Replaying a completed invocation returns the sealed prior result (the
   * typed `replayed-result` disposition, no port call).
   */
  executeRun(options: RunnerExecuteRunOptions): RunnerResult<ExecutionOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    return this.fabric.executeRun({
      tenantId: options.tenantId,
      runId: options.runId,
      port: options.port,
      actor: options.actor,
      at: options.at,
    });
  }

  /** Start a scheduled run (push-style dispatch toward an external adapter). */
  startRun(options: RunnerStartRunOptions): RunnerResult<SimulationRun> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    return this.fabric.startRun({
      tenantId: options.tenantId,
      runId: options.runId,
      actor: options.actor,
      at: options.at,
    });
  }

  /**
   * Publish a result against a running run (result publication): the
   * document is kernel-admitted through the REAL W005 pipeline,
   * conformance-checked, and sealed.
   */
  publishResult(options: RunnerPublishResultOptions): RunnerResult<ExecutionOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    return this.fabric.ingestResult({
      tenantId: options.tenantId,
      runId: options.runId,
      result: options.result,
      actor: options.actor,
      at: options.at,
    });
  }

  /** Cancel a non-terminal run (supervision). */
  cancelRun(options: RunnerCancelRunOptions): RunnerResult<SimulationRun> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    return this.fabric.cancelRun({
      tenantId: options.tenantId,
      runId: options.runId,
      actor: options.actor,
      at: options.at,
    });
  }

  /** One hosted run (tenant-scoped read; cross-tenant access is rejected). */
  getRun(options: RunnerRunReadOptions): RunnerResult<SimulationRun> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    return this.fabric.getRun({ tenantId: options.tenantId, runId: options.runId });
  }

  /** The run's sealed `simulation:*` event stream, in sequence order. */
  runEvents(options: RunnerRunReadOptions): RunnerResult<readonly SealedSimulationEvent[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    return this.fabric.runEvents({ tenantId: options.tenantId, runId: options.runId });
  }

  /** The tenant's runs, sorted by runId (deterministic). */
  listRuns(options: RunnerListRunsOptions): RunnerResult<readonly SimulationRun[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    return this.fabric.listRuns({ tenantId: options.tenantId });
  }

  /**
   * Health/liveness as typed data (deterministic derivation, no clocks):
   * `degraded` exactly when at least one hosted run has settled `failed`;
   * counts cover the hosted runs; `degradedRuns` lists the failed
   * tenant-scoped run ids, sorted.
   */
  health(): SimulationRunnerHealth {
    const byStatus: Record<SimulationRunStatus, number> = {
      submitted: 0,
      scheduled: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    const degraded: string[] = [];
    const runs = this.listAllRunsInternal();
    for (const run of runs) {
      byStatus[run.status] += 1;
      if (run.status === 'failed') {
        degraded.push(`${run.tenantId}#${run.runId}`);
      }
    }
    degraded.sort();
    return {
      schemaVersion: SIMULATION_RUNNER_RECORD_VERSION,
      status: degraded.length === 0 ? 'healthy' : 'degraded',
      runCount: runs.length,
      runsByStatus: byStatus,
      degradedRuns: degraded,
    };
  }

  /** A deterministic whole-host snapshot (the kernel fabric projection). */
  snapshot(): SimulationRunnerSnapshot {
    return this.fabric.snapshot();
  }

  /**
   * Deterministically restore a runner from a snapshot: the fabric's FULL
   * admission pipeline re-validates every record (tampered snapshots are
   * typed rejections, never silent corruption).
   */
  static fromSnapshot(
    input: unknown,
    options: SimulationRunnerOptions = {},
  ): RunnerResult<SimulationRunner> {
    const restored = SimulationFabric.fromSnapshot(input, {
      expectedTenantId: options.expectedTenantId,
    });
    if (!restored.ok) {
      return restored;
    }
    return {
      ok: true,
      value: new SimulationRunner({ ...options, fabric: restored.value }),
    };
  }

  // --------------------------------------------------------------------------------
  // Internals.
  // --------------------------------------------------------------------------------

  /** The tenant pin (R12): rejects foreign tenants on a pinned runner. */
  private tenantGuard(tenantId: TenantId): FabricError | null {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        code: 'tenant-isolation-rejected',
        message: `this simulation runner is scoped to tenant "${this.expectedTenantId}" — operations for tenant "${tenantId}" are rejected (R12 tenant isolation)`,
        expectedTenantId: this.expectedTenantId,
        encounteredTenantId: tenantId,
      };
    }
    return null;
  }

  /**
   * Resolve one capability binding against the REAL W007 registry (the
   * W020 binder semantics): an unknown pin is `unknown-capability-binding`;
   * a retired record is `lifecycle-conflict`; a digest that disagrees with
   * the registry record at that pin is `unknown-capability-binding` (the
   * binding pins a stale/foreign registration revision). Deprecated and
   * registered records bind (deprecation is advisory).
   */
  private resolveBinding(
    registry: CapabilityRegistry,
    binding: CapabilityBindingRef,
  ): FabricError | null {
    const resolved = registry.get({
      capabilityId: binding.capabilityId,
      version: binding.version,
    });
    if (!resolved.ok) {
      return {
        code: 'unknown-capability-binding',
        message: `capability "${binding.capabilityId}" at version "${binding.version}" is not registered — simulation runs bind registered capabilities only`,
        capabilityId: binding.capabilityId,
        version: binding.version,
      };
    }
    if (resolved.value.manifestDigest !== binding.registrationDigest) {
      return {
        code: 'unknown-capability-binding',
        message: `capability "${binding.capabilityId}" at version "${binding.version}" is registered at content address ${resolved.value.manifestDigest} but the binding pins ${binding.registrationDigest} — runs bind exact registration revisions`,
        capabilityId: binding.capabilityId,
        version: binding.version,
      };
    }
    if (resolved.value.lifecycle === 'retired') {
      return {
        code: 'lifecycle-conflict',
        message: `capability "${binding.capabilityId}" at version "${binding.version}" is retired — retired capabilities never bind (deprecation is advisory and still binds)`,
        from: 'retired',
        to: 'retired',
      };
    }
    return null;
  }

  /** All hosted runs across tenants (health only; sorted by tenant, runId). */
  private listAllRunsInternal(): readonly SimulationRun[] {
    const snapshot = this.fabric.snapshot();
    return snapshot.entries.map((entry) => entry.run);
  }
}
