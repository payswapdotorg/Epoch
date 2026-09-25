/**
 * @epoch/agent-runtime — host-model types (v1).
 *
 * The service owns HOST BEHAVIOR, not contract authorities: every typed
 * document below composes the kernel's published contract types
 * (OrchestrationSession, ProposalHandoff, IdempotencyKey) and reuses the
 * kernel's error taxonomy verbatim (`RuntimeResult<T>` IS the kernel's
 * `OrchestrationResult<T>` — no competing error surface).
 */
import type { Timestamp } from '@epoch/agent-protocol';
import type {
  AgentBinding,
  CompiledPlan,
  IdempotencyKey,
  OrchestrationResult,
  OrchestrationSession,
  ProposalHandoff,
  SessionStatus,
} from '@epoch/agent-orchestration';
import type { RUNTIME_RECORD_VERSION } from './version';
import type { RuntimeHealthStatus } from './version';

/** The runtime's total-result wrapper: the kernel taxonomy, reused verbatim. */
export type RuntimeResult<T> = OrchestrationResult<T>;

/**
 * Health/liveness as typed data (deterministic derivation, no clocks):
 * `degraded` exactly when at least one hosted session has settled in
 * `failed`; counts are over the hosted sessions; `degradedSessions` lists
 * the failed session ids (tenant-scoped composite ids, sorted).
 */
export interface RuntimeHealth {
  readonly schemaVersion: typeof RUNTIME_RECORD_VERSION;
  readonly status: RuntimeHealthStatus;
  readonly sessionCount: number;
  readonly sessionsByStatus: Readonly<Record<SessionStatus, number>>;
  /** Steps not yet settled (pending/dispatched/authorized), across sessions. */
  readonly unsettledStepCount: number;
  readonly degradedSessions: readonly string[];
}

/** One hosted session's bookkeeping: the session document plus its handoff log and consumed idempotency keys. */
export interface SessionEntry {
  readonly session: OrchestrationSession;
  /** Proposal handoffs emitted toward the Action Gateway boundary, in emission order. */
  readonly handoffs: readonly ProposalHandoff[];
  /** Idempotency keys of every admitted event intake (duplicate suppression). */
  readonly processedEventKeys: readonly IdempotencyKey[];
}

/** A whole-host snapshot: bindings and session entries, deterministically ordered. */
export interface RuntimeSnapshot {
  readonly schemaVersion: typeof RUNTIME_RECORD_VERSION;
  /** Boundings grouped by tenant: sorted by (tenantId, agentId). */
  readonly bindings: readonly TenantBindingRecord[];
  /** Session entries sorted by (tenantId, sessionId). */
  readonly sessions: readonly SessionEntry[];
}

/** One tenant-scoped agent binding inside a runtime snapshot. */
export interface TenantBindingRecord {
  readonly tenantId: string;
  readonly binding: AgentBinding;
}

/** The outcome of `startSession` / `resumeSession`: the session plus the handoffs the transition emitted. */
export interface TransitionOutcome {
  readonly session: OrchestrationSession;
  readonly handoffs: readonly ProposalHandoff[];
}

/** The outcome of `ingestEvent`: the session, the NEW handoffs this advance emitted, and whether the event mutated step state. */
export interface AdvanceOutcome {
  readonly session: OrchestrationSession;
  readonly handoffs: readonly ProposalHandoff[];
  /** false when the event was a recorded no-op (e.g. a `proposed` fact on a dispatched step). */
  readonly applied: boolean;
}

/** Options of `AgentRuntime.ingestEvent`. */
export interface IngestEventOptions {
  readonly tenantId: string;
  readonly sessionId: string;
  /** The W010 event record (shape-validated on intake). */
  readonly event: unknown;
  /** Caller-supplied instant for transition records (zero wall-clock in src). */
  readonly at: Timestamp;
}

/** Options of `AgentRuntime.createSession`. */
export interface CreateSessionOptions {
  readonly tenantId: string;
  readonly sessionId: string;
  /** The compiled plan (kernel-validated + digest-verified on intake). */
  readonly plan: unknown;
  /** Defaults to the tenant's bound agents. */
  readonly agents?: readonly unknown[];
  readonly createdAt: Timestamp;
}

/** Options of the single-transition session operations. */
export interface SessionOperationOptions {
  readonly tenantId: string;
  readonly sessionId: string;
  readonly at: Timestamp;
}

/** Options of `AgentRuntime.bindAgent`. */
export interface RuntimeBindAgentOptions {
  readonly tenantId: string;
  /** The orchestrated agent descriptor (kernel-validated). */
  readonly agent: unknown;
  /** The reference capability registry (W007) the pins resolve against. */
  readonly registry: import('@epoch/capability-registry').CapabilityRegistry;
}

/** Options of `AgentRuntime.compilePlan`. */
export interface RuntimeCompilePlanOptions {
  readonly tenantId: string;
  /** The authored plan (kernel-validated). */
  readonly plan: unknown;
  /** The admitted proposal set (parsed through the W003 pipeline by the kernel). */
  readonly proposals: readonly unknown[];
}

/** Options of the read operations (`getSession`, `handoffLog`). */
export interface SessionReadOptions {
  readonly tenantId: string;
  readonly sessionId: string;
}

/** Options of `AgentRuntime.listSessions`. */
export interface ListSessionsOptions {
  readonly tenantId: string;
}

/** Options of `AgentRuntime.bindingsForTenant`. */
export interface ListBindingsOptions {
  readonly tenantId: string;
}

/** The plan type re-exported for runtime consumers (typed convenience). */
export type { CompiledPlan };
