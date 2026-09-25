/**
 * The reference agent runtime host (W020): the long-running HOST MODEL
 * over the @epoch/agent-orchestration kernel.
 *
 * Owns (and only owns): tenant-scoped session lifecycle management
 * (create/start/suspend/resume/cancel, with typed lifecycle conflicts),
 * agent-binding management per tenant, plan compilation through the
 * kernel, W010 event intake with IDEMPOTENT duplicate suppression
 * (content-addressed idempotency keys — re-ingesting an event is the
 * typed `duplicate-suppressed` negative with the state unchanged), the
 * advance-on-event driver, and health/liveness as typed data.
 *
 * Explicitly NOT (later Work Orders / out of scope): durable persistence,
 * event distribution, the Action Gateway itself (W022 — this host emits
 * typed proposal HANDOFF records toward that boundary and tracks
 * lifecycle facts recorded by W010 events; it never authorizes or
 * executes), model providers (W028/W029 adapters), real processes.
 *
 * Determinism: ZERO wall-clock reads and ZERO randomness — every instant
 * is caller-supplied; every listing/snapshot is sorted (no insertion-order
 * leaks); two runtimes fed the same session + event history hold
 * byte-identical state (session state digests pin this).
 *
 * Tenant isolation (R12): sessions are tenant-scoped; cross-tenant
 * session access AND cross-tenant event intake are typed
 * `cross-tenant-denied` rejections. The host may itself be pinned to one
 * tenant (`expectedTenantId`, the event-log single-tenant guard
 * precedent).
 */
import type { EventRecord } from '@epoch/event-log';
import {
  bindOrchestratedAgent,
  compilePlan,
  createSessionRecord,
  deriveEventIdempotencyKey,
  deriveSessionIdempotencyKey,
  parseAgentBinding,
  parseCompiledPlan,
  parseOrchestrationSession,
  parseProposalHandoff,
  transitionSessionStatus,
} from '@epoch/agent-orchestration';
import type {
  AgentBinding,
  CompiledPlan,
  IdempotencyKey,
  OrchestrationError,
  OrchestrationSession,
  ProposalHandoff,
  SessionStatus,
} from '@epoch/agent-orchestration';
import { advanceSession, dispatchReadySteps } from './driver';
import type {
  AdvanceOutcome,
  CreateSessionOptions,
  IngestEventOptions,
  ListBindingsOptions,
  ListSessionsOptions,
  RuntimeBindAgentOptions,
  RuntimeCompilePlanOptions,
  RuntimeHealth,
  RuntimeResult,
  RuntimeSnapshot,
  SessionEntry,
  SessionOperationOptions,
  SessionReadOptions,
  TenantBindingRecord,
  TransitionOutcome,
} from './types';
import { RUNTIME_RECORD_VERSION } from './version';

/** Options of the {@link AgentRuntime} constructor. */
export interface AgentRuntimeOptions {
  /**
   * Tenant this host is scoped to. When provided, ANY operation naming a
   * different tenant is rejected with `cross-tenant-denied` (R12 — the
   * event-log single-tenant guard precedent).
   */
  readonly expectedTenantId?: string;
}

/** Deterministic composite key: `<tenantId>#<localId>` (both grammars exclude `#`). */
function tenantKey(tenantId: string, localId: string): string {
  return `${tenantId}#${localId}`;
}

/** Re-path a validation error under a snapshot prefix. */
function rePathError(error: OrchestrationError, prefix: string): OrchestrationError {
  if (error.code !== 'validation') {
    return { ...error, message: `${prefix}: ${error.message}` };
  }
  return {
    code: 'validation',
    message: `${prefix}: ${error.message}`,
    issues: error.issues.map((issue) => ({
      path: issue.path === '' ? prefix : `${prefix}.${issue.path}`,
      message: issue.message,
    })),
  };
}

/**
 * The reference agent runtime host. Construct directly (`new AgentRuntime()`
 * or `new AgentRuntime({ expectedTenantId })`), or restore deterministically
 * from a snapshot (`AgentRuntime.fromSnapshot`). In-memory only: no
 * persistence, no network, no processes, no clocks.
 */
export class AgentRuntime {
  /** tenantId#agentId -> binding. Maps iterate in insertion order; every read path sorts. */
  private readonly bindings = new Map<string, AgentBinding>();

  /** tenantId#sessionId -> entry. */
  private readonly sessions = new Map<string, SessionEntry>();

  /** tenantId#sessionId -> consumed idempotency keys (fast duplicate lookup). */
  private readonly processedKeys = new Map<string, Set<IdempotencyKey>>();

  private readonly expectedTenantId: string | undefined;

  constructor(options: AgentRuntimeOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
  }

  /**
   * Bind an orchestrated agent for a tenant (the kernel binder over the
   * REAL W007 registry). Idempotent: re-binding the same agent id with an
   * identical binding is the typed `duplicate-suppressed` negative echoing
   * the existing binding; a DIFFERENT binding for the same agent id is
   * `lifecycle-conflict` (never a silent overwrite).
   */
  bindAgent(options: RuntimeBindAgentOptions): RuntimeResult<AgentBinding> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    const bound = bindOrchestratedAgent({ agent: options.agent, registry: options.registry });
    if (!bound.ok) {
      return bound;
    }
    const key = tenantKey(options.tenantId, bound.value.agent.agentId);
    const existing = this.bindings.get(key);
    if (existing !== undefined) {
      if (existing.bindingDigest === bound.value.bindingDigest) {
        return {
          ok: false,
          error: {
            code: 'duplicate-suppressed',
            message: `agent "${bound.value.agent.agentId}" is already bound for tenant "${options.tenantId}" with identical content — the existing binding stands`,
            idempotencyKey: existing.bindingDigest,
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'lifecycle-conflict',
          message: `agent "${bound.value.agent.agentId}" is already bound for tenant "${options.tenantId}" with a different binding — rebind through a new agent id or explicit host policy`,
          from: 'bound',
          to: 'bound',
        },
      };
    }
    this.bindings.set(key, bound.value);
    return bound;
  }

  /** The tenant's bound agents, sorted by agentId (deterministic). */
  bindingsForTenant(options: ListBindingsOptions): RuntimeResult<readonly AgentBinding[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    return {
      ok: true,
      value: [...this.bindings.entries()]
        .filter(([key]) => key.startsWith(`${options.tenantId}#`))
        .map(([, binding]) => binding)
        .sort((a, b) =>
          a.agent.agentId === b.agent.agentId ? 0 : a.agent.agentId < b.agent.agentId ? -1 : 1,
        ),
    };
  }

  /**
   * Compile a plan for a tenant through the kernel compiler, resolving
   * steps against the tenant's bound agents and the admitted proposal set.
   */
  compilePlan(options: RuntimeCompilePlanOptions): RuntimeResult<CompiledPlan> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    const bindings = this.bindingsForTenant({ tenantId: options.tenantId });
    if (!bindings.ok) {
      return bindings;
    }
    return compilePlan({
      plan: options.plan,
      proposals: options.proposals,
      agents: [...bindings.value],
    });
  }

  /**
   * Create a session for a tenant from a compiled plan. The plan's tenant
   * must equal the session's tenant (`cross-tenant-denied` — a plan never
   * crosses tenants). Idempotent: re-creating a session id with the SAME
   * plan digest is the typed `duplicate-suppressed` negative echoing the
   * existing session; a DIFFERENT plan for the same session id is
   * `lifecycle-conflict` (never a silent rewrite).
   */
  createSession(options: CreateSessionOptions): RuntimeResult<OrchestrationSession> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    const parsedPlan = parseCompiledPlan(options.plan);
    if (!parsedPlan.ok) {
      return parsedPlan;
    }
    if (parsedPlan.value.tenantId !== options.tenantId) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message: `plan "${parsedPlan.value.planId}" belongs to tenant "${parsedPlan.value.tenantId}" — it cannot ground a session of tenant "${options.tenantId}" (R12 tenant isolation)`,
          expectedTenantId: options.tenantId,
          encounteredTenantId: parsedPlan.value.tenantId,
        },
      };
    }
    let agents: readonly unknown[];
    if (options.agents === undefined) {
      const bindings = this.bindingsForTenant({ tenantId: options.tenantId });
      if (!bindings.ok) {
        return bindings;
      }
      agents = bindings.value;
    } else {
      agents = options.agents;
    }
    const key = tenantKey(options.tenantId, options.sessionId);
    const existing = this.sessions.get(key);
    if (existing !== undefined) {
      const idempotencyKey = deriveSessionIdempotencyKey({
        sessionId: options.sessionId,
        planDigest: parsedPlan.value.planDigest,
      });
      if (existing.session.plan.planDigest === parsedPlan.value.planDigest) {
        return {
          ok: false,
          error: {
            code: 'duplicate-suppressed',
            message: `session "${options.sessionId}" already exists for tenant "${options.tenantId}" with the same plan — the existing session stands (idempotent creation)`,
            idempotencyKey,
            sessionId: options.sessionId,
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'lifecycle-conflict',
          message: `session "${options.sessionId}" already exists for tenant "${options.tenantId}" with a DIFFERENT plan — a session id grounds exactly one plan (create a new session id)`,
          from: existing.session.status,
          to: 'pending',
        },
      };
    }
    const created = createSessionRecord({
      sessionId: options.sessionId,
      plan: parsedPlan.value,
      agents,
      createdAt: options.createdAt,
    });
    if (!created.ok) {
      return created;
    }
    this.sessions.set(key, {
      session: created.value,
      handoffs: [],
      processedEventKeys: [],
    });
    this.processedKeys.set(key, new Set());
    return { ok: true, value: created.value };
  }

  /**
   * Start a pending session: `pending -> running`, then dispatch every
   * ready (root) step — emitting its typed proposal handoffs.
   */
  startSession(options: SessionOperationOptions): RuntimeResult<TransitionOutcome> {
    return this.transitionAndDispatch(options, 'running', 'start');
  }

  /** Suspend a running session (typed; events into a suspended session are lifecycle conflicts). */
  suspendSession(options: SessionOperationOptions): RuntimeResult<TransitionOutcome> {
    return this.transitionAndDispatch(options, 'suspended', 'suspend', false);
  }

  /** Resume a suspended session: `suspended -> running`, then dispatch ready steps. */
  resumeSession(options: SessionOperationOptions): RuntimeResult<TransitionOutcome> {
    return this.transitionAndDispatch(options, 'running', 'resume');
  }

  /** Cancel a non-terminal session: `pending|running|suspended -> cancelled`. */
  cancelSession(options: SessionOperationOptions): RuntimeResult<TransitionOutcome> {
    return this.transitionAndDispatch(options, 'cancelled', 'cancel', false);
  }

  /**
   * Ingest one W010 event against a running session (the advance-on-event
   * driver). Fixed precedence: shape gate -> tenant gate -> duplicate
   * suppression -> the driver's correlation/phase/application gates. A
   * duplicate event (same session scope, same content address) is the
   * typed `duplicate-suppressed` negative and leaves the state UNCHANGED
   * (idempotent replay).
   */
  ingestEvent(options: IngestEventOptions): RuntimeResult<AdvanceOutcome> {
    const entry = this.sessionEntry(options);
    if (!entry.ok) {
      return entry;
    }
    const current = entry.value.session;

    // Duplicate suppression keys on the event's content address and runs
    // BEFORE any lifecycle gating: re-feeding an already-consumed event is
    // the idempotent `duplicate-suppressed` negative regardless of the
    // session's current status (the event is recorded history). The shape
    // is sniffed structurally (full validation is the driver's first
    // gate); a malformed event never derives a key and therefore never
    // suppresses anything.
    const idempotencyKey = sniffEventKey(options.event, current.sessionId);
    if (idempotencyKey !== null) {
      const key = tenantKey(options.tenantId, options.sessionId);
      if (this.processedKeys.get(key)?.has(idempotencyKey) === true) {
        return {
          ok: false,
          error: {
            code: 'duplicate-suppressed',
            message: `event already ingested by session "${options.sessionId}" — the intake is idempotent and the state is unchanged`,
            idempotencyKey,
            sessionId: options.sessionId,
          },
        };
      }
    }

    if (current.status !== 'running') {
      return {
        ok: false,
        error: {
          code: 'lifecycle-conflict',
          message: `session "${options.sessionId}" is ${current.status} — only a running session ingests events (resume it first)`,
          from: current.status,
          to: 'running',
        },
      };
    }

    const advanced = advanceSession(current, options.event, options.at);
    if (!advanced.ok) {
      return advanced;
    }
    const key = tenantKey(options.tenantId, options.sessionId);
    const entryRecord = this.sessions.get(key)!;
    this.sessions.set(key, {
      session: advanced.value.session,
      handoffs: [...entryRecord.handoffs, ...advanced.value.handoffs],
      processedEventKeys:
        idempotencyKey === null
          ? entryRecord.processedEventKeys
          : [...entryRecord.processedEventKeys, idempotencyKey],
    });
    if (idempotencyKey !== null) {
      this.processedKeys.get(key)?.add(idempotencyKey);
    }
    return advanced;
  }

  /** One hosted session (tenant-scoped read; cross-tenant access is denied). */
  getSession(options: SessionReadOptions): RuntimeResult<OrchestrationSession> {
    const entry = this.sessionEntry(options);
    if (!entry.ok) {
      return entry;
    }
    return { ok: true, value: entry.value.session };
  }

  /** The session's full ordered proposal-handoff log (the Action Gateway boundary feed). */
  handoffLog(options: SessionReadOptions): RuntimeResult<readonly ProposalHandoff[]> {
    const entry = this.sessionEntry(options);
    if (!entry.ok) {
      return entry;
    }
    return { ok: true, value: entry.value.handoffs };
  }

  /** The tenant's sessions, sorted by sessionId (deterministic). */
  listSessions(options: ListSessionsOptions): RuntimeResult<readonly OrchestrationSession[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    return {
      ok: true,
      value: [...this.sessions.entries()]
        .filter(([key]) => key.startsWith(`${options.tenantId}#`))
        .map(([, entry]) => entry.session)
        .sort((a, b) => (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0)),
    };
  }

  /**
   * Health/liveness as typed data (deterministic derivation, no clocks):
   * `degraded` exactly when at least one hosted session has settled
   * `failed`; counts cover the hosted sessions; `degradedSessions` lists
   * the failed tenant-scoped session keys, sorted.
   */
  health(): RuntimeHealth {
    const byStatus: Record<SessionStatus, number> = {
      pending: 0,
      running: 0,
      suspended: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    let unsettled = 0;
    const degraded: string[] = [];
    for (const [key, entry] of this.sessions.entries()) {
      byStatus[entry.session.status] += 1;
      unsettled += entry.session.steps.filter(
        (step) =>
          step.status === 'pending' || step.status === 'dispatched' || step.status === 'authorized',
      ).length;
      if (entry.session.status === 'failed') {
        degraded.push(key);
      }
    }
    degraded.sort();
    return {
      schemaVersion: RUNTIME_RECORD_VERSION,
      status: degraded.length === 0 ? 'healthy' : 'degraded',
      sessionCount: this.sessions.size,
      sessionsByStatus: byStatus,
      unsettledStepCount: unsettled,
      degradedSessions: degraded,
    };
  }

  /** A deterministic whole-host snapshot (bindings + session entries, sorted). */
  snapshot(): RuntimeSnapshot {
    const bindings: TenantBindingRecord[] = [...this.bindings.entries()]
      .map(([key, binding]) => ({ tenantId: key.slice(0, key.indexOf('#')), binding }))
      .sort((a, b) =>
        a.tenantId === b.tenantId
          ? a.binding.agent.agentId < b.binding.agent.agentId
            ? -1
            : 1
          : a.tenantId < b.tenantId
            ? -1
            : 1,
      );
    const sessions = [...this.sessions.entries()]
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map(({ entry }) => entry);
    return { schemaVersion: RUNTIME_RECORD_VERSION, bindings, sessions };
  }

  /**
   * Restore a runtime from a snapshot. Total; the snapshot's session
   * documents, bindings and handoffs re-validate through the kernel
   * parsers (tampered snapshots are typed rejections, never silent
   * corruption). Bindings restore WITHOUT registry re-resolution: the
   * capability pins were resolved and content-addressed at binding time.
   */
  static fromSnapshot(
    input: unknown,
    options: AgentRuntimeOptions = {},
  ): RuntimeResult<AgentRuntime> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'runtime snapshot root must be a JSON object',
          issues: [{ path: '$', message: 'expected a JSON object at the snapshot root' }],
        },
      };
    }
    const snapshot = input as RuntimeSnapshot;
    if (snapshot.schemaVersion !== RUNTIME_RECORD_VERSION) {
      return {
        ok: false,
        error: {
          code: 'version-unsupported',
          message: `runtime snapshot version mismatch: expected ${RUNTIME_RECORD_VERSION}, encountered ${String(snapshot.schemaVersion)}`,
          expected: String(RUNTIME_RECORD_VERSION),
          encountered: String(snapshot.schemaVersion),
        },
      };
    }
    const runtime = new AgentRuntime(options);
    for (const [index, record] of (snapshot.bindings ?? []).entries()) {
      if (typeof record !== 'object' || record === null) {
        return {
          ok: false,
          error: {
            code: 'validation',
            message: 'snapshot binding record must be a JSON object',
            issues: [{ path: `bindings[${index}]`, message: 'expected a JSON object' }],
          },
        };
      }
      const { tenantId } = record as TenantBindingRecord;
      const binding = parseAgentBinding((record as TenantBindingRecord).binding);
      if (!binding.ok) {
        return { ok: false, error: rePathError(binding.error, `bindings[${index}].binding`) };
      }
      runtime.bindings.set(tenantKey(tenantId, binding.value.agent.agentId), binding.value);
    }
    for (const [index, entry] of (snapshot.sessions ?? []).entries()) {
      if (typeof entry !== 'object' || entry === null) {
        return {
          ok: false,
          error: {
            code: 'validation',
            message: 'snapshot session entry must be a JSON object',
            issues: [{ path: `sessions[${index}]`, message: 'expected a JSON object' }],
          },
        };
      }
      const session = parseOrchestrationSession((entry as SessionEntry).session);
      if (!session.ok) {
        return { ok: false, error: rePathError(session.error, `sessions[${index}].session`) };
      }
      const handoffs: ProposalHandoff[] = [];
      for (const [handoffIndex, handoff] of ((entry as SessionEntry).handoffs ?? []).entries()) {
        const parsed = parseProposalHandoff(handoff);
        if (!parsed.ok) {
          return {
            ok: false,
            error: rePathError(parsed.error, `sessions[${index}].handoffs[${handoffIndex}]`),
          };
        }
        handoffs.push(parsed.value);
      }
      const restored: SessionEntry = {
        session: session.value,
        handoffs,
        processedEventKeys: (entry as SessionEntry).processedEventKeys ?? [],
      };
      const key = tenantKey(session.value.tenantId, session.value.sessionId);
      runtime.sessions.set(key, restored);
      runtime.processedKeys.set(key, new Set(restored.processedEventKeys));
    }
    return { ok: true, value: runtime };
  }

  /** The tenant guard (R12): rejects foreign tenants on a tenant-scoped host. */
  private tenantGuard(tenantId: string): OrchestrationError | null {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        code: 'cross-tenant-denied',
        message: `this agent-runtime host is scoped to tenant "${this.expectedTenantId}" — operations for tenant "${tenantId}" are rejected (R12 tenant isolation)`,
        expectedTenantId: this.expectedTenantId,
        encounteredTenantId: tenantId,
      };
    }
    return null;
  }

  /** Fetch a session entry with the tenant + existence gates. */
  private sessionEntry(options: {
    tenantId: string;
    sessionId: string;
  }): RuntimeResult<SessionEntry> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) {
      return { ok: false, error: guard };
    }
    const key = tenantKey(options.tenantId, options.sessionId);
    const entry = this.sessions.get(key);
    if (entry === undefined) {
      // Cross-tenant denial when the session id exists under ANOTHER
      // tenant: the caller can see the id is taken but never its state
      // (R12 — the typed rejection the W020 pin requires).
      const foreign = [...this.sessions.values()].find(
        (candidate) => candidate.session.sessionId === options.sessionId,
      );
      if (foreign !== undefined) {
        return {
          ok: false,
          error: {
            code: 'cross-tenant-denied',
            message: `session "${options.sessionId}" belongs to tenant "${foreign.session.tenantId}" — tenant "${options.tenantId}" cannot access it (R12 tenant isolation)`,
            expectedTenantId: options.tenantId,
            encounteredTenantId: foreign.session.tenantId,
            sessionId: options.sessionId,
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'unknown-session',
          message: `no session "${options.sessionId}" hosted for tenant "${options.tenantId}"`,
          sessionId: options.sessionId,
        },
      };
    }
    return { ok: true, value: entry };
  }

  /** Apply one session transition, optionally dispatching ready steps after it. */
  private transitionAndDispatch(
    options: SessionOperationOptions,
    to: SessionStatus,
    cause: 'start' | 'suspend' | 'resume' | 'cancel',
    dispatch: boolean = true,
  ): RuntimeResult<TransitionOutcome> {
    const entry = this.sessionEntry(options);
    if (!entry.ok) {
      return entry;
    }
    const transitioned = transitionSessionStatus(entry.value.session, to, cause, options.at);
    if (!transitioned.ok) {
      return transitioned;
    }
    if (!dispatch) {
      this.storeSession(options, transitioned.value, []);
      return { ok: true, value: { session: transitioned.value, handoffs: [] } };
    }
    const dispatched = dispatchReadySteps(transitioned.value, options.at);
    this.storeSession(options, dispatched.session, dispatched.handoffs);
    return { ok: true, value: dispatched };
  }

  /** Store an updated session (and append its new handoffs). */
  private storeSession(
    options: { tenantId: string; sessionId: string },
    session: OrchestrationSession,
    newHandoffs: readonly ProposalHandoff[],
  ): void {
    const key = tenantKey(options.tenantId, options.sessionId);
    const entry = this.sessions.get(key)!;
    this.sessions.set(key, {
      session,
      handoffs: [...entry.handoffs, ...newHandoffs],
      processedEventKeys: entry.processedEventKeys,
    });
  }
}

/** Structurally sniff an event record for idempotency key derivation. */
function sniffEventKey(event: unknown, sessionId: string): IdempotencyKey | null {
  if (typeof event !== 'object' || event === null) {
    return null;
  }
  const record = event as EventRecord;
  if (
    typeof record.contentDigest !== 'string' ||
    typeof record.event?.streamId !== 'string' ||
    typeof record.event?.sequence !== 'number'
  ) {
    return null;
  }
  return deriveEventIdempotencyKey({ sessionId, event: record });
}
