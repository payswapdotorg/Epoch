/**
 * @epoch/agent-orchestration — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators
 * in `src/schema.ts` infer exactly these types; `test/contract-drift.test.ts`
 * proves the committed JSON Schema files under `schemas/` are byte-identical
 * to the deterministic emission of those validators.
 *
 * Neutrality (architecture lock rule 13): every identifier is opaque and
 * kind-prefixed (or a plan-local slug); no field encodes a model vendor,
 * framework, or provider surface. The kernel owns the ORCHESTRATION MODEL
 * only — proposals are @epoch/action-protocol's vocabulary (referenced,
 * never re-declared), capabilities are @epoch/capability-registry's
 * (resolved at binding, never re-registered here), events are
 * @epoch/event-log's (consumed by the runtime service, W010), and
 * authorization is @epoch/authorization's / the future Action Gateway's
 * (W022) — this package schedules, it never authorizes.
 */
import type { Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type { AgentId } from '@epoch/agent-protocol';
import type { ProposalReference } from '@epoch/action-protocol';
import type { CapabilityCategory } from '@epoch/capability-registry';
import type { ActionEventPhase } from '@epoch/event-log';
import type { ORCHESTRATION_RECORD_VERSION } from './version';
import type {
  RetryableActionPhase,
  SessionStatus,
  SessionTransitionCause,
  StepStatus,
  StepTransitionCause,
} from './version';

/** Tenant scope of an orchestration document (`tenant:<slug>`, the W009 grammar). */
export type OrchestrationTenantId = string;

/** Principal reference (`principal:<slug>`, the W009 grammar). */
export type OrchestrationPrincipalId = string;

/** Orchestration plan identity (`plan:<slug>`). */
export type PlanId = string;

/** Orchestration session identity (`session:<slug>`). */
export type SessionId = string;

/** Plan-local step identity (a bare lowercase slug). */
export type StepId = string;

/** Deterministic idempotency key (lowercase hex SHA-256, 64 characters). */
export type IdempotencyKey = string;

/**
 * Retry policy as TYPED DATA: how many total dispatch attempts a step may
 * consume (1 = never retry) and which action lifecycle phases re-queue the
 * step when they settle against it. The orchestration kernel defines the
 * shape; the runtime service interprets it; timing/backoff is a host
 * concern outside this contract (zero wall-clock in kernel src).
 */
export interface RetryPolicy {
  /** Total dispatch attempts allowed for the step (1..16; 1 = no retries). */
  readonly maxAttempts: number;
  /** Action lifecycle phases that re-queue the step (subset of the W010 vocabulary). */
  readonly retryOn: readonly RetryableActionPhase[];
}

/**
 * One authored plan step: a TYPED REFERENCE to an exact-revision action
 * proposal (the W003 `ProposalReference` vocabulary) plus the scheduling
 * facts — the agent assigned to the step, the steps it depends on, and its
 * retry policy. Steps never embed action semantics (target, parameters,
 * effects…): those live in the referenced proposal.
 */
export interface PlanStep {
  readonly stepId: StepId;
  /** The registered agent assigned to dispatch this step's proposal. */
  readonly agentId: AgentId;
  /** Exact-revision reference to the action proposal this step schedules. */
  readonly proposal: ProposalReference;
  /** Step ids that must reach `executed` before this step dispatches. */
  readonly dependsOn: readonly StepId[];
  /** Retry policy; omitted means `{ maxAttempts: 1, retryOn: [] }`. */
  readonly retryPolicy?: RetryPolicy | undefined;
}

/**
 * An authored orchestration plan / runbook: a tenant-scoped, caller-authored
 * document of steps as typed action-proposal references. Identical semantic
 * content compiles to identical compiled plans (deterministic compilation);
 * the authored form is advisory input, the compiled form is the authority.
 */
export interface OrchestrationPlan {
  readonly schemaVersion: typeof ORCHESTRATION_RECORD_VERSION;
  readonly tenantId: OrchestrationTenantId;
  readonly planId: PlanId;
  readonly displayName?: string | undefined;
  /** The principal authoring the plan (opaque, W009 grammar). */
  readonly createdBy?: OrchestrationPrincipalId | undefined;
  /** At least one step; order of authoring is irrelevant (compilation is deterministic). */
  readonly steps: readonly PlanStep[];
}

/**
 * A compiled plan step: the authored step with `dependsOn` canonically
 * sorted (ascending, de-duplicated) and the retry policy defaulted.
 */
export interface CompiledPlanStep extends PlanStep {
  readonly dependsOn: readonly StepId[];
  readonly retryPolicy: RetryPolicy;
}

/**
 * The compiled plan: the authored plan validated, normalized and
 * content-addressed. Steps appear in deterministic topological order
 * (ready steps admitted in ascending `stepId` order — identical inputs
 * produce identical orderings, regardless of authoring order).
 */
export interface CompiledPlan {
  readonly schemaVersion: typeof ORCHESTRATION_RECORD_VERSION;
  readonly tenantId: OrchestrationTenantId;
  readonly planId: PlanId;
  readonly displayName?: string | undefined;
  readonly createdBy?: OrchestrationPrincipalId | undefined;
  /** SHA-256 of the canonical JSON of the normalized plan content. */
  readonly planDigest: Sha256Hex;
  /** Deterministic topological order (Kahn, ready queue sorted by stepId). */
  readonly steps: readonly CompiledPlanStep[];
  readonly stepCount: number;
}

/**
 * An exact capability version pin inside an orchestrated agent descriptor:
 * the W007 registry vocabulary (`capabilityId` at a semver core `version`),
 * referenced opaquely, never re-declared.
 */
export interface CapabilityVersionPin {
  readonly capabilityId: string;
  readonly version: string;
}

/**
 * A provider-neutral orchestrated agent descriptor: a registered agent id
 * (the W003 `agent:` grammar) plus the capability versions it binds to for
 * orchestration. This is NOT an @epoch/agent-protocol registration (that
 * message declares executors, tools, authority, cost/latency and evidence
 * requirements); it is the lean orchestration-side binding descriptor.
 * Vendor/model/provider fields are structurally rejected.
 */
export interface OrchestratedAgent {
  readonly schemaVersion: typeof ORCHESTRATION_RECORD_VERSION;
  readonly agentId: AgentId;
  readonly displayName?: string | undefined;
  /** At least one exact capability pin; unique within the descriptor. */
  readonly capabilities: readonly CapabilityVersionPin[];
}

/**
 * A capability resolved and pinned at binding time: the registry record's
 * identity, category and lifecycle AT THE MOMENT OF BINDING. Retired
 * capabilities never bind (`lifecycle-conflict`); deprecated ones do
 * (advisory, mirroring the registry's own resolution semantics).
 */
export interface CapabilityPin {
  readonly capabilityId: string;
  readonly version: string;
  readonly category: CapabilityCategory;
  /** Lifecycle state observed at binding (`registered` or `deprecated`). */
  readonly lifecycleAtBinding: 'registered' | 'deprecated';
}

/**
 * An agent binding: the orchestrated agent descriptor plus its resolved
 * capability pins (sorted by capabilityId, then version) and the
 * content-addressed binding digest.
 */
export interface AgentBinding {
  readonly schemaVersion: typeof ORCHESTRATION_RECORD_VERSION;
  readonly agent: OrchestratedAgent;
  readonly capabilities: readonly CapabilityPin[];
  /** SHA-256 of the canonical JSON of the binding content. */
  readonly bindingDigest: Sha256Hex;
}

/**
 * One step's execution-tracking record (the orchestration side of the
 * propose -> authorize -> execute handoff; authorization decisions are the
 * Action Gateway's, never inferred here).
 */
export interface StepState {
  readonly stepId: StepId;
  readonly status: StepStatus;
  /** Dispatch attempts consumed so far (0 before the first dispatch). */
  readonly attempt: number;
  /** The last action lifecycle phase recorded against this step. */
  readonly lastPhase?: ActionEventPhase | undefined;
  /** Content digest of the last event applied to this step. */
  readonly lastEventDigest?: Sha256Hex | undefined;
  /** Instant of the latest dispatch (caller-supplied; zero wall-clock in src). */
  readonly dispatchedAt?: Timestamp | undefined;
  /** Instant the step reached a terminal status. */
  readonly settledAt?: Timestamp | undefined;
}

/** One session-status transition, as replayable typed data. */
export interface SessionStatusTransition {
  readonly from: SessionStatus;
  readonly to: SessionStatus;
  readonly cause: SessionTransitionCause;
  readonly at: Timestamp;
}

/** One step-status transition, as replayable typed data. */
export interface StepTransition {
  readonly stepId: StepId;
  readonly from: StepStatus;
  readonly to: StepStatus;
  readonly cause: StepTransitionCause;
  /** The action lifecycle phase that drove an `event`/`retry` transition. */
  readonly phase?: ActionEventPhase | undefined;
  /** Content digest of the event that drove an `event`/`retry` transition. */
  readonly eventDigest?: Sha256Hex | undefined;
  /** The attempt counter AFTER the transition. */
  readonly attempt: number;
  readonly at: Timestamp;
}

/**
 * An orchestration session: the tenant-scoped, replayable execution of one
 * compiled plan by a set of bound agents. Plain JSON, serialization
 * friendly by construction; `sessionStateDigest` (src/digest.ts) addresses
 * the exact state.
 */
export interface OrchestrationSession {
  readonly schemaVersion: typeof ORCHESTRATION_RECORD_VERSION;
  readonly sessionId: SessionId;
  readonly tenantId: OrchestrationTenantId;
  readonly plan: CompiledPlan;
  /** Bound agents, sorted by agentId (deterministic; no insertion-order leaks). */
  readonly agents: readonly AgentBinding[];
  readonly status: SessionStatus;
  /** Step states in compiled-plan order. */
  readonly steps: readonly StepState[];
  readonly sessionTransitions: readonly SessionStatusTransition[];
  readonly stepTransitions: readonly StepTransition[];
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/**
 * A proposal handoff record: the typed boundary artifact the runtime emits
 * when a step's proposal is handed TOWARD the Action Gateway (W022,
 * future). The orchestration layer tracks handoffs as data; it never
 * executes, authorizes, or transports them (external gateways/transports
 * are adapters).
 */
export interface ProposalHandoff {
  readonly schemaVersion: typeof ORCHESTRATION_RECORD_VERSION;
  readonly sessionId: SessionId;
  readonly tenantId: OrchestrationTenantId;
  readonly stepId: StepId;
  readonly agentId: AgentId;
  readonly proposal: ProposalReference;
  /** The dispatch attempt this handoff belongs to (1-based). */
  readonly attempt: number;
  readonly handedOffAt: Timestamp;
  /** SHA-256 of the canonical JSON of the handoff content. */
  readonly handoffDigest: Sha256Hex;
}

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface OrchestrationIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * The typed orchestration error taxonomy (W020 Tech Lead pin). Every entry
 * point is total — errors are values, never exceptions:
 *
 * - `version-unsupported` — schemaVersion skew (expected/encountered);
 * - `validation` — malformed documents (strict objects reject unknown
 *   vendor/provider fields) with precise dotted paths;
 * - `invalid-plan` — semantically invalid plans (duplicate step ids,
 *   unknown/self/cyclic dependencies, unassigned agents, duplicate
 *   proposal references) with precise dotted paths;
 * - `unknown-action-reference` — a step references a proposal that is not
 *   in the provided admitted proposal set (or an event does not correlate
 *   to any step of the session);
 * - `digest-mismatch` — a claimed digest (proposal revision pin, plan
 *   digest) does not match the recomputed canonical SHA-256;
 * - `unknown-capability` — a capability pin resolves to no registry record;
 * - `lifecycle-conflict` — an illegal lifecycle transition (session status
 *   transition, step status transition, or a retired capability binding);
 * - `cross-tenant-denied` — a tenant scope violation (R12);
 * - `duplicate-suppressed` — an idempotent duplicate (event intake,
 *   session creation, agent binding) was suppressed; state is unchanged;
 * - `unknown-session` — a session lookup that does not exist.
 */
export type OrchestrationError =
  | {
      readonly code: 'version-unsupported';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly OrchestrationIssue[];
    }
  | {
      readonly code: 'invalid-plan';
      readonly message: string;
      readonly issues: readonly OrchestrationIssue[];
    }
  | {
      readonly code: 'unknown-action-reference';
      readonly message: string;
      readonly proposalId: string;
      readonly stepId?: string | undefined;
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'unknown-capability';
      readonly message: string;
      readonly capabilityId: string;
      readonly version?: string | undefined;
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly code: 'cross-tenant-denied';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
      readonly sessionId?: string | undefined;
    }
  | {
      readonly code: 'duplicate-suppressed';
      readonly message: string;
      readonly idempotencyKey: IdempotencyKey;
      readonly sessionId?: string | undefined;
    }
  | {
      readonly code: 'unknown-session';
      readonly message: string;
      readonly sessionId: string;
    };

/** Total-result wrapper of every orchestration entry point. */
export type OrchestrationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: OrchestrationError };
