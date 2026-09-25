/**
 * @epoch/agent-runtime — public API (service layer, Work Order W020).
 *
 * The long-running HOST MODEL over the @epoch/agent-orchestration kernel
 * (architecture.md, binding: "Agents propose; the Action Gateway
 * authorizes execution."). The runtime:
 *
 * - hosts tenant-scoped orchestration sessions (create / start / suspend
 *   / resume / cancel) with typed lifecycle conflicts — cross-tenant
 *   session access is the typed `cross-tenant-denied` rejection (R12);
 * - manages tenant-scoped capability-bound agents (the kernel binder over
 *   the REAL W007 capability registry);
 * - compiles plans through the kernel compiler (deterministic,
 *   content-addressed);
 * - ingests W010 events with IDEMPOTENT duplicate suppression
 *   (content-addressed idempotency keys; re-ingesting an event is the
 *   typed `duplicate-suppressed` negative with the state unchanged);
 * - drives advance-on-event execution: ready steps dispatch typed
 *   PROPOSAL HANDOFFS toward the Action Gateway boundary (W022, future),
 *   lifecycle facts advance step states (authorized/executed/failed/
 *   rejected), retry policies re-queue covered failures, terminal
 *   failures cascade skips, and settled sessions settle
 *   (`completed` / `failed`) — never authorizing or executing anything;
 * - exposes health/liveness as typed data (deterministic derivation).
 *
 * In-memory reference behavior: NO persistence, NO network, NO real
 * processes; core logic stays pure (zero wall-clock, zero randomness —
 * every instant is caller-supplied). The typed orchestration contract and
 * error taxonomy are @epoch/agent-orchestration's — this service reuses
 * them verbatim, it never forks authorities.
 *
 * Runtime dependency policy (W020): @epoch/agent-orchestration (the
 * kernel), @epoch/agent-protocol (timestamps/ids),
 * @epoch/capability-registry (the real registry the binder resolves
 * against), and @epoch/event-log (the W010 event record contract the
 * driver consumes) are the @epoch runtime dependencies. Compatibility
 * with @epoch/action-protocol (proposal fixtures), @epoch/world-model,
 * @epoch/tenancy, @epoch/identity, @epoch/authorization and
 * @epoch/policy-contracts is exercised via devDependency parity tests —
 * never runtime deps.
 */

// Version + vocabularies.
export {
  AGENT_RUNTIME_CONTRACT_VERSION,
  RUNTIME_HEALTH_STATUSES,
  RUNTIME_RECORD_VERSION,
} from './version';
export type { RuntimeHealthStatus } from './version';

// Host-model types (the kernel contract types are re-exported below).
export type {
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

// The pure advance-on-event driver (exported for direct, hostless use).
export {
  advanceSession,
  applyLifecycleEvent,
  dispatchReadySteps,
  type ApplyEventOutcome,
  type DispatchOutcome,
} from './driver';

// The reference host.
export { AgentRuntime, type AgentRuntimeOptions } from './runtime';

// Kernel contract types re-exported for one-stop typed consumption.
export type {
  AgentBinding,
  CompiledPlan,
  IdempotencyKey,
  OrchestrationError,
  OrchestrationIssue,
  OrchestrationPlan,
  OrchestrationResult,
  OrchestrationSession,
  OrchestratedAgent,
  PlanId,
  ProposalHandoff,
  RetryPolicy,
  SessionId,
  SessionStatus,
  StepState,
  StepStatus,
  StepTransition,
} from '@epoch/agent-orchestration';
