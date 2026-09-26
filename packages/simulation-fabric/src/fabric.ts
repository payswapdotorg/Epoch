/**
 * The reference in-memory Simulation Fabric host (W021): job submission,
 * execution planning, run supervision, and result publication over the
 * pure kernel machinery (src/state.ts).
 *
 * Owns (and only owns): tenant-scoped run hosting with the typed
 * `tenant-isolation-rejected` isolation gate (R12 — a run may never be
 * read or referenced across the tenant boundary, and a host may itself be
 * pinned to one tenant); submission idempotency bookkeeping (a replayed
 * submission returns the SAME run identity through the typed
 * `duplicate-run` admission — never a silent dedup; DIFFERENT content
 * under a consumed key is the typed `idempotency-conflict`); the
 * append-only run state chain; the per-run `simulation:*` event stream
 * (one run = one stream, `stream:simulation-<suffix>`); execution through
 * the SimulationExecutionPort seam with idempotent replay (re-executing a
 * completed invocation returns the sealed prior result — the typed
 * `replayed-result` disposition, no port call); and deterministic
 * snapshot/restore (tampered snapshots are typed rejections).
 *
 * Explicitly NOT (later Work Orders / out of scope): durable persistence
 * (PostgreSQL/object-storage adapters), event distribution, work
 * scheduling beyond the typed lifecycle, marketplace entitlement. The
 * kernel layer is reference machinery: in-memory only, no clocks (every
 * instant is caller-supplied), no network, no processes.
 *
 * Determinism: maps iterate in insertion order but every read path sorts
 * before exposing anything (no insertion-order leaks); identical
 * submissions derive identical run identities and identical event
 * digests, regardless of arrival order.
 */
import type { Timestamp } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import {
  checkInvocationConformance,
  parseSimulationInvocationRequest,
  parseSimulatorRegistration,
  registrationDigest,
} from '@epoch/simulation-protocol';
import type { SimulationFailure } from '@epoch/simulation-protocol';
import { deriveRunIdempotencyKey } from './identity';
import {
  admitSimulationJob,
  checkResultAgainstRun,
  runFailureDetail,
  sealSimulationResult,
  transitionRunStatus,
  verifyRunStateChain,
} from './state';
import {
  FabricIdempotencyKeySchema,
  FabricRunEntrySchema,
  SimulationFabricSnapshotSchema,
} from './schema';
import { rePathError } from './issues';
import type { FabricError, FabricResult } from './errors';
import type {
  AdmittedCapabilityBinding,
  CapabilityBindingRef,
  ExecutionOutcome,
  FabricIdempotencyKey,
  FabricPrincipalId,
  FabricRunEntry,
  IdempotencyRecord,
  PortExecution,
  SealedSimulationEvent,
  SealedSimulationResult,
  SimulationExecutionPort,
  SimulationFabricSnapshot,
  SimulationRun,
} from './types';
import { parseSimulationEventData, sealSimulationEvent, verifySealedSimulationEvent } from './events';
import { SIMULATION_FABRIC_RECORD_VERSION, simulationStreamIdOf } from './version';
import type { SimulationEventDiscriminator } from './version';

/** Options of the {@link SimulationFabric} constructor. */
export interface SimulationFabricOptions {
  /**
   * Tenant this fabric is scoped to. When provided, ANY operation naming a
   * different tenant is rejected with `tenant-isolation-rejected` (R12 —
   * the event-log single-tenant guard precedent).
   */
  readonly expectedTenantId?: TenantId;
}

/** Options of `SimulationFabric.submitJob` (job intake). */
export interface SubmitJobOptions {
  readonly tenantId: TenantId;
  /** The W005 simulator registration document (raw JSON; admitted through the REAL W005 pipeline). */
  readonly registration: unknown;
  /** The W05 invocation request document (raw JSON; admitted through the REAL W005 pipeline). */
  readonly request: unknown;
  /** Capability registrations to bind, by opaque typed reference (never structural copies). */
  readonly capabilityBindings: readonly CapabilityBindingRef[];
  /** Caller-supplied idempotency key; defaults to the derived content key. */
  readonly idempotencyKey?: string | undefined;
  readonly actor: FabricPrincipalId;
  readonly at: Timestamp;
}

/** Options of `SimulationFabric.planExecution` (execution planning). */
export interface PlanExecutionOptions {
  readonly tenantId: TenantId;
  readonly runId: string;
  /**
   * The admitted capability registrations the run's bindings resolve
   * against (the service layer adapts the real W007 registry to this
   * opaque seam). When omitted, planning proceeds on the references alone
   * (reference-only mode).
   */
  readonly admittedCapabilities?: readonly AdmittedCapabilityBinding[] | undefined;
  readonly actor: FabricPrincipalId;
  readonly at: Timestamp;
}

/** Options of `SimulationFabric.startRun` (push-style dispatch). */
export interface StartRunOptions {
  readonly tenantId: TenantId;
  readonly runId: string;
  readonly actor: FabricPrincipalId;
  readonly at: Timestamp;
}

/** Options of `SimulationFabric.executeRun` (pull-style one-shot execution). */
export interface ExecuteRunOptions {
  readonly tenantId: TenantId;
  readonly runId: string;
  /** The execution adapter (ALL concrete compute lives behind this seam). */
  readonly port: SimulationExecutionPort;
  readonly actor: FabricPrincipalId;
  readonly at: Timestamp;
}

/** Options of `SimulationFabric.ingestResult` (push-style result publication). */
export interface IngestResultOptions {
  readonly tenantId: TenantId;
  readonly runId: string;
  /** A W005 `simulation.result` document (raw JSON; admitted + conformance-checked). */
  readonly result: unknown;
  readonly actor: FabricPrincipalId;
  readonly at: Timestamp;
}

/** Options of `SimulationFabric.cancelRun`. */
export interface CancelRunOptions {
  readonly tenantId: TenantId;
  readonly runId: string;
  readonly actor: FabricPrincipalId;
  readonly at: Timestamp;
}

/** Options of the run-scoped read operations (`getRun`, `runEvents`). */
export interface RunReadOptions {
  readonly tenantId: TenantId;
  readonly runId: string;
}

/** Options of `SimulationFabric.listRuns`. */
export interface ListRunsOptions {
  readonly tenantId: TenantId;
}

/** Deterministic composite key: `<tenantId>#<localId>` (both grammars exclude `#`). */
function tenantKey(tenantId: string, localId: string): string {
  return `${tenantId}#${localId}`;
}

/**
 * The reference simulation fabric. Construct directly (`new SimulationFabric()`
 * or `new SimulationFabric({ expectedTenantId })`), or restore
 * deterministically from a snapshot (`SimulationFabric.fromSnapshot`).
 * In-memory only: no persistence, no network, no processes, no clocks.
 */
export class SimulationFabric {
  /** tenantId#runId -> entry. Maps iterate in insertion order; every read path sorts. */
  private readonly runs = new Map<string, FabricRunEntry>();

  /** tenantId#idempotencyKey -> consumed key record. */
  private readonly keys = new Map<string, IdempotencyRecord>();

  private readonly expectedTenantId: string | undefined;

  constructor(options: SimulationFabricOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
  }

  /** Number of hosted runs (all tenants). */
  get runCount(): number {
    return this.runs.size;
  }

  /** Number of consumed idempotency keys (all tenants). */
  get idempotencyKeyCount(): number {
    return this.keys.size;
  }

  /**
   * Submit one simulation job (intake). Fixed precedence:
   *
   * 1. tenant pin gate — a host scoped to one tenant rejects foreign
   *      tenants (`tenant-isolation-rejected`);
   * 2. admission (the pure kernel pipeline — W005 registration/request
   *      admission, cross-document conformance, binding grammar,
   *      canonical identity derivation);
   * 3. idempotency gate — the consumed-key bookkeeping: identical content
   *      under a consumed key is the typed `duplicate-run` admission
   *      echoing the EXISTING run identity (state unchanged — never a
   *      silent dedup); different content under a consumed key is the
   *      typed `idempotency-conflict`;
   * 4. the run is hosted and its `simulation:run-submitted` event is
   *      sealed into the run's stream (sequence 1).
   */
  submitJob(options: SubmitJobOptions): FabricResult<SimulationRun> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }

    let idempotencyKey: FabricIdempotencyKey;
    if (options.idempotencyKey === undefined) {
      // The derived key is a pure function of the identity scope, so the
      // digest must be known first — admit, then derive below.
      idempotencyKey = '';
    } else {
      const key = FabricIdempotencyKeySchema.safeParse(options.idempotencyKey);
      if (!key.success) {
        return {
          ok: false,
          error: {
            code: 'validation',
            message: 'the caller-supplied idempotency key does not satisfy the key grammar',
            issues: [
              {
                path: 'idempotencyKey',
                message: 'must be an opaque token of 1..128 characters from [A-Za-z0-9._-]',
              },
            ],
          },
        };
      }
      idempotencyKey = key.data;
    }

    const admitted = admitSimulationJob({
      tenantId: options.tenantId,
      registration: options.registration,
      request: options.request,
      capabilityBindings: options.capabilityBindings,
      idempotencyKey: 'pending-derivation',
      actor: options.actor,
      at: options.at,
    });
    if (!admitted.ok) {
      return admitted;
    }

    if (options.idempotencyKey === undefined) {
      idempotencyKey = deriveRunIdempotencyKey({
        tenantId: options.tenantId,
        runDigest: admitted.value.run.runDigest,
      });
    }

    // Idempotency gate: a consumed key admits only identical content.
    const keyId = tenantKey(options.tenantId, idempotencyKey);
    const existingKey = this.keys.get(keyId);
    if (existingKey !== undefined) {
      if (existingKey.runDigest === admitted.value.run.runDigest) {
        return {
          ok: false,
          error: {
            code: 'duplicate-run',
            message: `idempotency key "${idempotencyKey}" already admitted this exact content as run "${existingKey.runId}" — the existing run identity stands (idempotent submission; state unchanged)`,
            runId: existingKey.runId,
            runDigest: existingKey.runDigest,
            idempotencyKey,
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'idempotency-conflict',
          message: `idempotency key "${idempotencyKey}" is already consumed by run "${existingKey.runId}" (different content) — a key grounds exactly one invocation content`,
          idempotencyKey,
          existingRunId: existingKey.runId,
          existingRunDigest: existingKey.runDigest,
          encounteredRunDigest: admitted.value.run.runDigest,
        },
      };
    }

    // Content-addressed run identity: identical content under a different
    // key aliases the SAME run (record the alias; echo the identity).
    const runKeyId = tenantKey(options.tenantId, admitted.value.run.runId);
    const existingRun = this.runs.get(runKeyId);
    if (existingRun !== undefined) {
      if (existingRun.run.runDigest === admitted.value.run.runDigest) {
        this.keys.set(keyId, {
          tenantId: options.tenantId,
          idempotencyKey,
          runId: existingRun.run.runId,
          runDigest: existingRun.run.runDigest,
        });
        return {
          ok: false,
          error: {
            code: 'duplicate-run',
            message: `this exact content is already hosted as run "${existingRun.run.runId}" (admitted under key "${existingRun.run.idempotencyKey}") — the existing run identity stands; the additional key is bound to it`,
            runId: existingRun.run.runId,
            runDigest: existingRun.run.runDigest,
            idempotencyKey,
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `derived run identity prefix collides with a different hosted run ("${existingRun.run.runId}") — resubmit with a distinct request id`,
          issues: [{ path: 'runId', message: 'run identity prefix collision' }],
        },
      };
    }

    const run: SimulationRun = { ...admitted.value.run, idempotencyKey };
    const entry: FabricRunEntry = {
      run,
      request: admitted.value.request,
      registration: admitted.value.registration,
      events: [],
    };
    this.runs.set(runKeyId, entry);
    this.keys.set(keyId, {
      tenantId: options.tenantId,
      idempotencyKey,
      runId: run.runId,
      runDigest: run.runDigest,
    });

    const emitted = this.emit(entry, 'simulation:run-submitted', options.actor, options.at, {
      runId: run.runId,
      runDigest: run.runDigest,
      requestId: run.invocation.requestId,
      requestDigest: run.invocation.requestDigest,
      simulatorId: run.simulator.simulatorId,
      registrationDigest: run.simulator.registrationDigest,
      idempotencyKey: run.idempotencyKey,
      submittedAt: options.at,
    });
    if (!emitted.ok) {
      return emitted;
    }
    return { ok: true, value: run };
  }

  /**
   * Plan a run's execution: `submitted -> scheduled`, resolving the run's
   * capability bindings against the admitted registration set (every
   * binding must resolve — an unresolvable reference is the typed
   * `unknown-capability-binding`; the service layer adapts the real W007
   * registry, with its retire/deprecate semantics, to that seam).
   * Emits `simulation:run-scheduled`.
   */
  planExecution(options: PlanExecutionOptions): FabricResult<SimulationRun> {
    const entry = this.runEntry(options);
    if (!entry.ok) {
      return entry;
    }
    const run = entry.value.run;
    if (run.status !== 'submitted') {
      return {
        ok: false,
        error: {
          code: 'lifecycle-conflict',
          message: `run "${run.runId}" is ${run.status} — only a submitted run plans execution`,
          from: run.status,
          to: 'scheduled',
        },
      };
    }
    if (options.admittedCapabilities !== undefined) {
      for (const binding of run.capabilityBindings) {
        const resolved = options.admittedCapabilities.some(
          (admitted) =>
            admitted.capabilityId === binding.capabilityId &&
            admitted.version === binding.version &&
            admitted.registrationDigest === binding.registrationDigest,
        );
        if (!resolved) {
          return {
            ok: false,
            error: {
              code: 'unknown-capability-binding',
              message: `capability "${binding.capabilityId}" at version "${binding.version}" (registration ${binding.registrationDigest}) does not resolve against the admitted capability set — runs bind registered capabilities only`,
              capabilityId: binding.capabilityId,
              version: binding.version,
            },
          };
        }
      }
    }
    const transitioned = transitionRunStatus(run, {
      to: 'scheduled',
      cause: 'planning',
      actor: options.actor,
      at: options.at,
    });
    if (!transitioned.ok) {
      return transitioned;
    }
    const updated = this.store(entry.value, transitioned.value);
    const emitted = this.emit(updated, 'simulation:run-scheduled', options.actor, options.at, {
      runId: run.runId,
      runDigest: run.runDigest,
      scheduledAt: options.at,
    });
    if (!emitted.ok) {
      return emitted;
    }
    return { ok: true, value: transitioned.value };
  }

  /**
   * Start a scheduled run (`scheduled -> running`) for PUSH-style
   * adapters: the port executes asynchronously and later publishes the
   * result through `ingestResult`. Emits `simulation:run-started`.
   */
  startRun(options: StartRunOptions): FabricResult<SimulationRun> {
    const entry = this.runEntry(options);
    if (!entry.ok) {
      return entry;
    }
    const run = entry.value.run;
    if (run.status !== 'scheduled') {
      return {
        ok: false,
        error: {
          code: 'lifecycle-conflict',
          message: `run "${run.runId}" is ${run.status} — only a scheduled run starts`,
          from: run.status,
          to: 'running',
        },
      };
    }
    const transitioned = transitionRunStatus(run, {
      to: 'running',
      cause: 'dispatch',
      actor: options.actor,
      at: options.at,
    });
    if (!transitioned.ok) {
      return transitioned;
    }
    const updated = this.store(entry.value, transitioned.value);
    const emitted = this.emit(updated, 'simulation:run-started', options.actor, options.at, {
      runId: run.runId,
      runDigest: run.runDigest,
      startedAt: options.at,
    });
    if (!emitted.ok) {
      return emitted;
    }
    return { ok: true, value: transitioned.value };
  }

  /**
   * Execute a scheduled run through the port (the PULL-style one-shot):
   * `scheduled -> running -> terminal`. The port's outcome is INGESTED —
   * the result document is admitted through the REAL W005 pipeline and
   * conformance-checked against the run's admitted chain before sealing;
   * a result that fails admission settles the run `failed` (cause
   * `result-rejected`) and returns the typed rejection.
   *
   * Idempotent replay: re-executing a COMPLETED invocation returns the
   * sealed prior result as the typed `replayed-result` disposition — the
   * state is unchanged and the port is NEVER called. Re-executing a
   * failed/cancelled run is a `lifecycle-conflict` (terminal statuses
   * admit nothing); re-executing a running run is a `lifecycle-conflict`
   * (use `ingestResult` for push-style completion).
   */
  executeRun(options: ExecuteRunOptions): FabricResult<ExecutionOutcome> {
    const entry = this.runEntry(options);
    if (!entry.ok) {
      return entry;
    }
    const run = entry.value.run;

    if (run.status === 'completed') {
      return {
        ok: true,
        value: { disposition: 'replayed-result', run, result: run.result },
      };
    }
    if (run.status === 'running') {
      return {
        ok: false,
        error: {
          code: 'lifecycle-conflict',
          message: `run "${run.runId}" is already running — complete it through ingestResult (push-style) instead of re-executing`,
          from: 'running',
          to: 'running',
        },
      };
    }
    if (run.status !== 'scheduled') {
      return {
        ok: false,
        error: {
          code: 'lifecycle-conflict',
          message: `run "${run.runId}" is ${run.status} (terminal) — a settled run never re-executes; corrections are new runs`,
          from: run.status,
          to: 'running',
        },
      };
    }

    const started = this.startRun(options);
    if (!started.ok) {
      return started;
    }
    const currentEntry = this.runs.get(tenantKey(options.tenantId, options.runId))!;

    const execution = options.port.execute({
      request: currentEntry.request,
      registration: currentEntry.registration,
      capabilityBindings: currentEntry.run.capabilityBindings,
    });
    return this.settleExecution(currentEntry, execution, options.actor, options.at);
  }

  /**
   * Publish a result against a RUNNING run (the PUSH-style ingestion
   * path): the result document is admitted through the REAL W005
   * pipeline, conformance-checked against the run's admitted chain, and
   * sealed (`running -> completed`, cause `result-ingested`; emits
   * `simulation:run-completed` + `simulation:result-published`). A result
   * that fails admission settles the run `failed` (cause
   * `result-rejected`) and returns the typed rejection.
   */
  ingestResult(options: IngestResultOptions): FabricResult<ExecutionOutcome> {
    const entry = this.runEntry(options);
    if (!entry.ok) {
      return entry;
    }
    const run = entry.value.run;
    if (run.status !== 'running') {
      return {
        ok: false,
        error: {
          code: 'lifecycle-conflict',
          message: `run "${run.runId}" is ${run.status} — only a running run ingests results`,
          from: run.status,
          to: 'completed',
        },
      };
    }
    const sealed = sealSimulationResult(options.result);
    if (!sealed.ok) {
      return this.settleRejected(entry.value, sealed.error, options.actor, options.at);
    }
    return this.completeRun(entry.value, sealed.value, options.actor, options.at);
  }

  /**
   * Cancel a non-terminal run (`submitted|scheduled|running -> cancelled`).
   * Emits `simulation:run-cancelled`. Terminal statuses admit nothing.
   */
  cancelRun(options: CancelRunOptions): FabricResult<SimulationRun> {
    const entry = this.runEntry(options);
    if (!entry.ok) {
      return entry;
    }
    const run = entry.value.run;
    const transitioned = transitionRunStatus(run, {
      to: 'cancelled',
      cause: 'cancellation',
      actor: options.actor,
      at: options.at,
    });
    if (!transitioned.ok) {
      return transitioned;
    }
    const updated = this.store(entry.value, transitioned.value);
    const emitted = this.emit(updated, 'simulation:run-cancelled', options.actor, options.at, {
      runId: run.runId,
      runDigest: run.runDigest,
      cancelledAt: options.at,
    });
    if (!emitted.ok) {
      return emitted;
    }
    return { ok: true, value: transitioned.value };
  }

  /** One hosted run (tenant-scoped read; cross-tenant access is rejected). */
  getRun(options: RunReadOptions): FabricResult<SimulationRun> {
    const entry = this.runEntry(options);
    if (!entry.ok) {
      return entry;
    }
    return { ok: true, value: entry.value.run };
  }

  /** The run's sealed `simulation:*` event stream, in sequence order. */
  runEvents(options: RunReadOptions): FabricResult<readonly SealedSimulationEvent[]> {
    const entry = this.runEntry(options);
    if (!entry.ok) {
      return entry;
    }
    return { ok: true, value: entry.value.events };
  }

  /** The tenant's runs, sorted by runId (deterministic). */
  listRuns(options: ListRunsOptions): FabricResult<readonly SimulationRun[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    return {
      ok: true,
      value: [...this.runs.entries()]
        .filter(([key]) => key.startsWith(`${options.tenantId}#`))
        .map(([, entry]) => entry.run)
        .sort((a, b) => (a.runId < b.runId ? -1 : a.runId > b.runId ? 1 : 0)),
    };
  }

  /**
   * A deterministic, serialization-friendly whole-fabric projection:
   * entries sorted by (tenantId, runId), idempotency records sorted by
   * (tenantId, idempotencyKey). Two fabrics fed the same submissions emit
   * byte-identical snapshots regardless of arrival order.
   */
  snapshot(): SimulationFabricSnapshot {
    const entries = [...this.runs.values()].sort((a, b) =>
      a.run.tenantId === b.run.tenantId
        ? a.run.runId < b.run.runId
          ? -1
          : 1
        : a.run.tenantId < b.run.tenantId
          ? -1
          : 1,
    );
    const idempotency = [...this.keys.values()].sort((a, b) =>
      a.tenantId === b.tenantId
        ? a.idempotencyKey < b.idempotencyKey
          ? -1
          : 1
        : a.tenantId < b.tenantId
          ? -1
          : 1,
    );
    return {
      schemaVersion: SIMULATION_FABRIC_RECORD_VERSION,
      entries,
      idempotency,
    };
  }

  /**
   * Deterministically restore a fabric from a snapshot. Total; every
   * record passes the FULL admission pipeline (zod structure, W005
   * re-admission of the request/registration chain with digest agreement,
   * state-chain verification, sealed-result digest verification, event
   * stream verification: digests, stream ids, tenant scopes, contiguous
   * sequences, causal order, payload contracts) — a tampered snapshot is
   * a typed rejection, never silent corruption. Idempotency records must
   * reference hosted runs with matching digests.
   */
  static fromSnapshot(
    input: unknown,
    options: SimulationFabricOptions = {},
  ): FabricResult<SimulationFabric> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'fabric snapshot root must be a JSON object',
          issues: [{ path: '$', message: 'expected a JSON object at the snapshot root' }],
        },
      };
    }
    const encountered = (input as Record<string, unknown>).schemaVersion;
    if (typeof encountered === 'number' && encountered !== SIMULATION_FABRIC_RECORD_VERSION) {
      return {
        ok: false,
        error: {
          code: 'version-unsupported',
          message: `fabric snapshot version mismatch: expected ${SIMULATION_FABRIC_RECORD_VERSION}, encountered ${encountered}`,
          expected: String(SIMULATION_FABRIC_RECORD_VERSION),
          encountered: String(encountered),
        },
      };
    }
    const parsed = SimulationFabricSnapshotSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: rePathError(
          {
            code: 'validation',
            message: 'fabric snapshot failed schema validation',
            issues: parsed.error.issues.map((issue) => ({
              path: issue.path.map(String).join('.'),
              message: issue.message,
            })),
          },
          '',
        ),
      };
    }

    const fabric = new SimulationFabric(options);
    for (const [index, entry] of parsed.data.entries.entries()) {
      const restored = fabric.restoreEntry(entry, index);
      if (!restored.ok) {
        return restored;
      }
    }
    for (const [index, record] of parsed.data.idempotency.entries()) {
      const key = tenantKey(record.tenantId, record.idempotencyKey);
      if (fabric.keys.has(key)) {
        return {
          ok: false,
          error: {
            code: 'validation',
            message: `snapshot idempotency record ${index} duplicates a consumed key`,
            issues: [
              {
                path: `idempotency[${index}].idempotencyKey`,
                message: `key "${record.idempotencyKey}" is consumed twice`,
              },
            ],
          },
        };
      }
      const entryKey = tenantKey(record.tenantId, record.runId);
      const entry = fabric.runs.get(entryKey);
      if (entry === undefined || entry.run.runDigest !== record.runDigest) {
        return {
          ok: false,
          error: {
            code: 'validation',
            message: `snapshot idempotency record ${index} does not reference a hosted run identity`,
            issues: [
              {
                path: `idempotency[${index}].runId`,
                message: `run "${record.runId}" (${record.runDigest}) is not hosted with that digest`,
              },
            ],
          },
        };
      }
      fabric.keys.set(key, record);
    }
    return { ok: true, value: fabric };
  }

  // --------------------------------------------------------------------------------
  // Internals.
  // --------------------------------------------------------------------------------

  /** The tenant pin (R12): rejects foreign tenants on a pinned host. */
  private tenantGuard(tenantId: string): FabricError | null {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        code: 'tenant-isolation-rejected',
        message: `this simulation fabric is scoped to tenant "${this.expectedTenantId}" — operations for tenant "${tenantId}" are rejected (R12 tenant isolation)`,
        expectedTenantId: this.expectedTenantId,
        encounteredTenantId: tenantId,
      };
    }
    return null;
  }

  /** Fetch a run entry with the tenant + existence gates. */
  private runEntry(options: { tenantId: string; runId: string }): FabricResult<FabricRunEntry> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    const key = tenantKey(options.tenantId, options.runId);
    const entry = this.runs.get(key);
    if (entry === undefined) {
      // Cross-tenant denial when the run id exists under ANOTHER tenant:
      // the caller can see the id is taken but never its state (R12 — the
      // typed rejection the W021 pin requires).
      const foreign = [...this.runs.values()].find(
        (candidate) => candidate.run.runId === options.runId,
      );
      if (foreign !== undefined) {
        return {
          ok: false,
          error: {
            code: 'tenant-isolation-rejected',
            message: `run "${options.runId}" belongs to tenant "${foreign.run.tenantId}" — tenant "${options.tenantId}" cannot access it (R12 tenant isolation)`,
            expectedTenantId: options.tenantId,
            encounteredTenantId: foreign.run.tenantId,
            runId: options.runId,
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'unknown-run',
          message: `no run "${options.runId}" hosted for tenant "${options.tenantId}"`,
          runId: options.runId,
        },
      };
    }
    return { ok: true, value: entry };
  }

  /** Store an updated run document into its entry. */
  private store(entry: FabricRunEntry, run: SimulationRun): FabricRunEntry {
    const key = tenantKey(run.tenantId, run.runId);
    const updated: FabricRunEntry = { ...entry, run };
    this.runs.set(key, updated);
    return updated;
  }

  /** Seal one lifecycle event into the run's stream (append-only). */
  private emit(
    entry: FabricRunEntry,
    discriminator: SimulationEventDiscriminator,
    actor: FabricPrincipalId,
    at: Timestamp,
    data: Record<string, unknown>,
  ): FabricResult<SealedSimulationEvent> {
    const streamId = simulationStreamIdOf(entry.run.runId);
    const sequence = entry.events.length + 1;
    const causalParent =
      entry.events.length === 0
        ? null
        : { streamId, sequence: (entry.events[entry.events.length - 1] as SealedSimulationEvent).sequence };
    const sealed = sealSimulationEvent({
      schemaVersion: SIMULATION_FABRIC_RECORD_VERSION,
      streamId,
      sequence,
      tenantId: entry.run.tenantId,
      actor,
      causalParent,
      payload: { discriminator, data: data as SealedSimulationEvent['payload']['data'] },
      occurredAt: at,
    });
    if (!sealed.ok) {
      return sealed;
    }
    const key = tenantKey(entry.run.tenantId, entry.run.runId);
    const current = this.runs.get(key)!;
    this.runs.set(key, { ...current, events: [...current.events, sealed.value] });
    return sealed;
  }

  /** Fold a port execution into a terminal run state (the ingestion core). */
  private settleExecution(
    entry: FabricRunEntry,
    execution: PortExecution,
    actor: FabricPrincipalId,
    at: Timestamp,
  ): FabricResult<ExecutionOutcome> {
    if (!execution.ok) {
      return this.settleFailed(entry, execution.failure, 'execution-failed', actor, at);
    }
    const sealed = sealSimulationResult(execution.result);
    if (!sealed.ok) {
      return this.settleRejected(entry, sealed.error, actor, at);
    }
    return this.completeRun(entry, sealed.value, actor, at);
  }

  /** Settle a run as failed on a port-reported execution failure. */
  private settleFailed(
    entry: FabricRunEntry,
    failure: SimulationFailure,
    cause: 'execution-failed' | 'result-rejected',
    actor: FabricPrincipalId,
    at: Timestamp,
  ): FabricResult<ExecutionOutcome> {
    const transitioned = transitionRunStatus(entry.run, {
      to: 'failed',
      cause,
      actor,
      at,
    });
    if (!transitioned.ok) {
      return transitioned;
    }
    const failedRun: SimulationRun = { ...transitioned.value, failure };
    const updated = this.store(entry, failedRun);
    const emitted = this.emit(updated, 'simulation:run-failed', actor, at, {
      runId: failedRun.runId,
      runDigest: failedRun.runDigest,
      failureCode: failure.code,
      failedAt: at,
    });
    if (!emitted.ok) {
      return emitted;
    }
    return { ok: true, value: { disposition: 'executed', run: failedRun, failure } };
  }

  /** Settle a run as failed on a result that failed admission (typed rejection). */
  private settleRejected(
    entry: FabricRunEntry,
    error: FabricError,
    actor: FabricPrincipalId,
    at: Timestamp,
  ): FabricResult<ExecutionOutcome> {
    const detail =
      error.code === 'nonconforming-result'
        ? `the execution port produced a result that does not conform to the run's admitted chain (${error.violations.map((violation) => `${violation.path}: ${violation.message}`).join('; ')})`
        : `the execution port produced a result document that failed W005 admission (${error.message})`;
    const rejection: FabricError =
      error.code === 'nonconforming-result'
        ? error
        : {
            code: 'result-rejected',
            message: detail,
            issues:
              error.code === 'validation' || error.code === 'vendor-fields-rejected'
                ? error.issues
                : [{ path: 'result', message: error.message }],
          };
    const settled = this.settleFailed(
      entry,
      runFailureDetail('result-rejected', detail),
      'result-rejected',
      actor,
      at,
    );
    if (!settled.ok) {
      return settled;
    }
    return { ok: false, error: rejection };
  }

  /** Seal an admitted result into a completed run (the publication core). */
  private completeRun(
    entry: FabricRunEntry,
    sealed: SealedSimulationResult,
    actor: FabricPrincipalId,
    at: Timestamp,
  ): FabricResult<ExecutionOutcome> {
    const violations = checkResultAgainstRun(
      entry.run,
      entry.request,
      entry.registration,
      sealed.result,
    );
    if (violations.length > 0) {
      return this.settleRejected(
        entry,
        {
          code: 'nonconforming-result',
          message:
            'the result does not conform to the admitted W005 chain of this run (cross-document conformance)',
          violations,
        },
        actor,
        at,
      );
    }
    const transitioned = transitionRunStatus(entry.run, {
      to: 'completed',
      cause: 'result-ingested',
      actor,
      at,
    });
    if (!transitioned.ok) {
      return transitioned;
    }
    const completedRun: SimulationRun = { ...transitioned.value, result: sealed };
    const updated = this.store(entry, completedRun);
    const completed = this.emit(updated, 'simulation:run-completed', actor, at, {
      runId: completedRun.runId,
      runDigest: completedRun.runDigest,
      resultDigest: sealed.resultDigest,
      outcomeStatus: sealed.result.outcome.status,
      completedAt: at,
    });
    if (!completed.ok) {
      return completed;
    }
    const published = this.emit(
      this.runs.get(tenantKey(completedRun.tenantId, completedRun.runId))!,
      'simulation:result-published',
      actor,
      at,
      {
        runId: completedRun.runId,
        runDigest: completedRun.runDigest,
        resultId: sealed.result.resultId,
        resultDigest: sealed.resultDigest,
        requestId: completedRun.invocation.requestId,
        requestDigest: completedRun.invocation.requestDigest,
        publishedAt: at,
      },
    );
    if (!published.ok) {
      return published;
    }
    return {
      ok: true,
      value: { disposition: 'executed', run: completedRun, result: sealed },
    };
  }

  /** Restore one snapshot entry through the full admission pipeline. */
  private restoreEntry(entry: unknown, index: number): FabricResult<null> {
    const parsed = FabricRunEntrySchema.safeParse(entry);
    if (!parsed.success) {
      return {
        ok: false,
        error: rePathError(
          {
            code: 'validation',
            message: `snapshot entry ${index} failed schema validation`,
            issues: parsed.error.issues.map((issue) => ({
              path: issue.path.map(String).join('.'),
              message: issue.message,
            })),
          },
          '',
        ),
      };
    }
    const restored = parsed.data;
    const { run } = restored;

    // State chain integrity (tamper detection).
    const chain = verifyRunStateChain(run);
    if (!chain.ok) {
      return { ok: false, error: rePathError(chain.error, `entries[${index}].run`) };
    }

    // Sealed result digest verification.
    if (run.result !== undefined) {
      if (run.status !== 'completed') {
        return {
          ok: false,
          error: {
            code: 'validation',
            message: `snapshot entry ${index}: a run carries a sealed result only in status "completed"`,
            issues: [{ path: `entries[${index}].run.result`, message: 'status must be "completed"' }],
          },
        };
      }
      const resealed = sealSimulationResult(run.result.result);
      if (!resealed.ok || resealed.value.resultDigest !== run.result.resultDigest) {
        return {
          ok: false,
          error: {
            code: 'digest-mismatch',
            message: `snapshot entry ${index}: the sealed result digest does not match the recomputed canonical digest`,
            expected: resealed.ok ? resealed.value.resultDigest : 'unadmittable result document',
            encountered: run.result.resultDigest,
          },
        };
      }
    }
    if (run.failure !== undefined && run.status !== 'failed') {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `snapshot entry ${index}: a run carries a failure detail only in status "failed"`,
          issues: [{ path: `entries[${index}].run.failure`, message: 'status must be "failed"' }],
        },
      };
    }

    // W005 re-admission of the executed chain, with digest agreement.
    const parsedRegistration = parseSimulatorRegistration(restored.registration);
    if (!parsedRegistration.ok) {
      return {
        ok: false,
        error: rePathError(
          {
            code: 'validation',
            message: `snapshot entry ${index}: the registration failed W005 re-admission`,
            issues: [{ path: `entries[${index}].registration`, message: parsedRegistration.error.message }],
          },
          '',
        ),
      };
    }
    const parsedRequest = parseSimulationInvocationRequest(restored.request);
    if (!parsedRequest.ok) {
      return {
        ok: false,
        error: rePathError(
          {
            code: 'validation',
            message: `snapshot entry ${index}: the invocation request failed W005 re-admission`,
            issues: [{ path: `entries[${index}].request`, message: parsedRequest.error.message }],
          },
          '',
        ),
      };
    }
    if (
      parsedRequest.value.requestId !== run.invocation.requestId ||
      parsedRequest.digest !== run.invocation.requestDigest
    ) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: `snapshot entry ${index}: the run's invocation reference does not match the re-admitted request`,
          expected: `${parsedRequest.value.requestId}/${parsedRequest.digest}`,
          encountered: `${run.invocation.requestId}/${run.invocation.requestDigest}`,
        },
      };
    }
    if (
      parsedRegistration.value.simulatorId !== run.simulator.simulatorId ||
      registrationDigest(parsedRegistration.value) !== run.simulator.registrationDigest
    ) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: `snapshot entry ${index}: the run's simulator reference does not match the re-admitted registration`,
          expected: `${parsedRegistration.value.simulatorId}/${registrationDigest(parsedRegistration.value)}`,
          encountered: `${run.simulator.simulatorId}/${run.simulator.registrationDigest}`,
        },
      };
    }
    const violations = checkInvocationConformance(parsedRegistration.value, parsedRequest.value);
    if (violations.length > 0) {
      return {
        ok: false,
        error: rePathError(
          {
            code: 'validation',
            message: `snapshot entry ${index}: the admitted chain is nonconforming on restore`,
            issues: violations.map((violation) => ({
              path: `entries[${index}].${violation.path}`,
              message: violation.message,
            })),
          },
          '',
        ),
      };
    }

    // Event stream verification: digests, stream, tenant, sequences, causal order, payload contracts.
    const streamId = simulationStreamIdOf(run.runId);
    for (const [eventIndex, event] of restored.events.entries()) {
      const verified = verifySealedSimulationEvent(event);
      if (!verified.ok) {
        return {
          ok: false,
          error: rePathError(verified.error, `entries[${index}].events[${eventIndex}]`),
        };
      }
      if (verified.value.streamId !== streamId) {
        return {
          ok: false,
          error: {
            code: 'validation',
            message: `snapshot entry ${index}: event ${eventIndex + 1} does not belong to the run's stream`,
            issues: [
              {
                path: `entries[${index}].events[${eventIndex}].streamId`,
                message: `expected "${streamId}"`,
              },
            ],
          },
        };
      }
      if (verified.value.tenantId !== run.tenantId) {
        return {
          ok: false,
          error: {
            code: 'tenant-isolation-rejected',
            message: `snapshot entry ${index}: event ${eventIndex + 1} carries tenant "${verified.value.tenantId}" but the run belongs to tenant "${run.tenantId}" (R12 tenant isolation)`,
            expectedTenantId: run.tenantId,
            encounteredTenantId: verified.value.tenantId,
            runId: run.runId,
          },
        };
      }
      if (verified.value.sequence !== eventIndex + 1) {
        return {
          ok: false,
          error: {
            code: 'validation',
            message: `snapshot entry ${index}: event sequences must be contiguous from 1`,
            issues: [
              {
                path: `entries[${index}].events[${eventIndex}].sequence`,
                message: `expected ${eventIndex + 1}`,
              },
            ],
          },
        };
      }
      const causal = verified.value.causalParent;
      if (
        (eventIndex === 0 && causal !== null) ||
        (eventIndex > 0 &&
          (causal === null || causal.streamId !== streamId || causal.sequence !== eventIndex))
      ) {
        return {
          ok: false,
          error: {
            code: 'validation',
            message: `snapshot entry ${index}: event ${eventIndex + 1} has an inconsistent causal parent`,
            issues: [
              {
                path: `entries[${index}].events[${eventIndex}].causalParent`,
                message: 'expected the previous event of the same stream (null on the first)',
              },
            ],
          },
        };
      }
      const payload = parseSimulationEventData(verified.value.payload);
      if (!payload.ok) {
        return {
          ok: false,
          error: rePathError(payload.error, `entries[${index}].events[${eventIndex}].payload`),
        };
      }
    }

    const key = tenantKey(run.tenantId, run.runId);
    if (this.runs.has(key)) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `snapshot entry ${index}: run "${run.runId}" of tenant "${run.tenantId}" is restored twice`,
          issues: [{ path: `entries[${index}].run.runId`, message: 'duplicate run identity' }],
        },
      };
    }
    this.runs.set(key, {
      run,
      request: parsedRequest.value,
      registration: parsedRegistration.value,
      events: restored.events,
    });
    return { ok: true, value: null };
  }
}

/** Re-exported digest helper for consumers verifying run identities. */
export { computeRunIdentityDigest, runIdOf, deriveRunIdempotencyKey } from './identity';
export type { RunIdentityScope } from './identity';
