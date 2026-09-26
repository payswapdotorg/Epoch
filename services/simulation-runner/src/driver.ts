/**
 * The one-shot simulation job driver (W021): the PURE composition core of
 * the runner service. `driveSimulationJob` folds a complete submission ->
 * planning -> execution pass over a fabric host in a fixed order with
 * typed short-circuits (never throws, never holds state of its own — the
 * fabric host owns the stores, exactly as the kernel binder receives the
 * W007 registry as a parameter). `admittedCapabilitiesFromRegistry`
 * adapts the REAL W007 capability registry to the fabric's opaque
 * resolution seam (the W020 binder precedent: retired capabilities never
 * resolve; deprecation is advisory).
 *
 * The runner SCHEDULES AND SUPERVISES, it never becomes compute: the
 * actual execution is behind the SimulationExecutionPort seam the caller
 * supplies, and every admission/conformance decision belongs to the
 * fabric kernel over the REAL W005 pipelines.
 *
 * Determinism: identical inputs produce identical host states and return
 * values — ZERO wall-clock reads and ZERO randomness (instants are
 * caller-supplied).
 */
import type { Timestamp } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import type { CapabilityRegistry } from '@epoch/capability-registry';
import { SimulationFabric } from '@epoch/simulation-fabric';
import type {
  AdmittedCapabilityBinding,
  CapabilityBindingRef,
  ExecutionOutcome,
  FabricResult,
  SimulationExecutionPort,
} from '@epoch/simulation-fabric';

/** Options of {@link driveSimulationJob} (the one-shot driver). */
export interface DriveSimulationJobOptions {
  /** The fabric host the driver folds over (the stores belong to the host). */
  readonly fabric: SimulationFabric;
  readonly tenantId: TenantId;
  /** The W005 simulator registration document (raw JSON; kernel-admitted). */
  readonly registration: unknown;
  /** The W005 invocation request document (raw JSON; kernel-admitted). */
  readonly request: unknown;
  /** Capability registrations to bind, by opaque typed reference. */
  readonly capabilityBindings: readonly CapabilityBindingRef[];
  /** Caller-supplied idempotency key; defaults to the kernel-derived content key. */
  readonly idempotencyKey?: string | undefined;
  /** The execution adapter (ALL concrete compute lives behind this seam). */
  readonly port: SimulationExecutionPort;
  /**
   * The admitted capability registrations the bindings resolve against
   * (derive with {@link admittedCapabilitiesFromRegistry}); when omitted,
   * planning proceeds on the opaque references alone.
   */
  readonly admittedCapabilities?: readonly AdmittedCapabilityBinding[] | undefined;
  readonly actor: string;
  /** Instants for submission, planning and execution (caller-supplied). */
  readonly submittedAt: Timestamp;
  readonly scheduledAt: Timestamp;
  readonly executedAt: Timestamp;
}

/** The result of the one-shot driver: the terminal run and its outcome. */
export interface DrivenSimulationJob {
  readonly run: import('@epoch/simulation-fabric').SimulationRun;
  readonly outcome: ExecutionOutcome;
}

/**
 * Drive one simulation job to a terminal outcome in a single pass:
 * submission (deterministic identity + idempotency gates), execution
 * planning (capability-binding resolution), and pull-style execution
 * through the port (result admission + conformance + sealing). Total,
 * never throws: every typed rejection of the underlying gates
 * short-circuits the drive and is returned verbatim. A replayed
 * submission surfaces as the kernel's `duplicate-run` admission (the
 * existing run identity); a completed invocation replays as the typed
 * `replayed-result` disposition.
 */
export function driveSimulationJob(
  options: DriveSimulationJobOptions,
): FabricResult<DrivenSimulationJob> {
  const submitted = options.fabric.submitJob({
    tenantId: options.tenantId,
    registration: options.registration,
    request: options.request,
    capabilityBindings: options.capabilityBindings,
    idempotencyKey: options.idempotencyKey,
    actor: options.actor,
    at: options.submittedAt,
  });
  if (!submitted.ok) {
    return submitted;
  }
  const planned = options.fabric.planExecution({
    tenantId: options.tenantId,
    runId: submitted.value.runId,
    admittedCapabilities: options.admittedCapabilities,
    actor: options.actor,
    at: options.scheduledAt,
  });
  if (!planned.ok) {
    return planned;
  }
  const executed = options.fabric.executeRun({
    tenantId: options.tenantId,
    runId: planned.value.runId,
    port: options.port,
    actor: options.actor,
    at: options.executedAt,
  });
  if (!executed.ok) {
    return executed;
  }
  return { ok: true, value: { run: executed.value.run, outcome: executed.value } };
}

/**
 * Adapt the REAL W007 capability registry to the fabric's opaque
 * resolution seam: every non-retired record becomes an admitted
 * capability binding (capability id, semver version, manifest digest —
 * the registration's content address). Retired records are EXCLUDED
 * (binding semantics: retirement is terminal; deprecation is advisory
 * and still binds — the W020 binder precedent, the registry's own
 * resolution semantics). Sorted by (capabilityId, version) — no
 * insertion-order leaks.
 */
export function admittedCapabilitiesFromRegistry(
  registry: CapabilityRegistry,
): AdmittedCapabilityBinding[] {
  return registry
    .list()
    .filter((record) => record.lifecycle !== 'retired')
    .map((record) => ({
      capabilityId: record.manifest.capabilityId,
      version: record.manifest.version,
      registrationDigest: record.manifestDigest,
    }))
    .sort((a, b) =>
      a.capabilityId === b.capabilityId
        ? a.version < b.version
          ? -1
          : 1
        : a.capabilityId < b.capabilityId
          ? -1
          : 1,
    );
}
