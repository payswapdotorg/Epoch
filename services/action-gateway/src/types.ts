/**
 * @epoch/action-gateway — host-model types (v1).
 *
 * The service owns HOST BEHAVIOR, not contract authorities: every typed
 * document below composes the kernel's published contract types
 * (SealedPolicyDecision, SealedApprovalRecord, ActionPolicyError) and
 * reuses the kernel's error taxonomy verbatim (the W020 agent-runtime
 * precedent: `GatewayResult<T>` EXTENDS the kernel result — the
 * gateway-specific codes are additive, never a competing surface).
 */
import type {
  ActionProposal,
  ActionTypeReference,
  AuthorizerReference,
  ProposalReference,
} from '@epoch/action-protocol';
import type { JsonValue, Sha256Hex, Timestamp } from '@epoch/action-policy';
import type {
  ActionPolicyError,
  ActionPolicySnapshot,
  SealedApprovalRecord,
  SealedExpiryRecord,
  SealedPolicyDecision,
  SealedRejectionRecord,
  ConstraintResolver,
} from '@epoch/action-policy';
import type { TenantId } from '@epoch/tenancy';
import type { SealedActionEvent } from './events';
import type { GATEWAY_RECORD_VERSION } from './version';
import type { ActionStatus, GatewayHealthStatus } from './version';

/** The gateway's total-result wrapper: the kernel taxonomy, extended. */
export type GatewayError =
  | ActionPolicyError
  | {
      readonly code: 'unknown-action';
      readonly message: string;
      readonly tenantId: TenantId;
      readonly actionId: string;
    }
  | {
      readonly code: 'action-conflict';
      readonly message: string;
      readonly actionId: string;
      readonly expectedProposalDigest: Sha256Hex;
      readonly encounteredProposalDigest: Sha256Hex;
    }
  | {
      readonly code: 'action-settled';
      readonly message: string;
      readonly actionId: string;
      readonly status: ActionStatus;
    }
  | {
      readonly code: 'approval-required';
      readonly message: string;
      readonly actionId: string;
      readonly decisionDigest: Sha256Hex;
    }
  | {
      readonly code: 'approval-timeout';
      readonly message: string;
      readonly actionId: string;
      readonly decisionDigest: Sha256Hex;
      readonly deadline: Timestamp;
    }
  | {
      readonly code: 'action-denied';
      readonly message: string;
      readonly actionId: string;
      readonly denialCode: string;
      readonly decisionDigest: Sha256Hex;
    }
  | {
      readonly code: 'action-rejected';
      readonly message: string;
      readonly actionId: string;
      readonly decisionDigest: Sha256Hex;
    }
  | {
      readonly code: 'authorization-rejected';
      readonly message: string;
      /** The W009 denial code (or not-applicable reason) that grounded the rejection. */
      readonly denialCode: string;
      readonly principalId: string;
      readonly actionId?: string | undefined;
    }
  | {
      readonly code: 'execution-unsupported';
      readonly message: string;
      readonly actionTypeId: string;
      readonly actionId: string;
    };

/** Result of a gateway operation: a value or a typed error. */
export type GatewayResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: GatewayError };

/** The W009 authorization gate input (caller-supplied facts, evaluated FIRST). */
export interface AuthorizationGateInput {
  /** The acting principal (`principal:<slug>`, the W009 grammar). */
  readonly principalId: string;
  /** The W009 decision context (principals / memberships / knownTenants). */
  readonly context: unknown;
  /** Mandatory-free audit justification (R17; optional, bounded). */
  readonly justification?: string | undefined;
}

/** The action's tenancy scope beyond the tenant (W009 shapes). */
export interface ActionScope {
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
}

/** Options of `ActionGateway.submitAction` (intake). */
export interface SubmitActionOptions {
  readonly tenantId: TenantId;
  /** Caller-assigned action identity (`action:<slug>`); one action = one event stream. */
  readonly actionId: string;
  /** The W003 action proposal (admitted through the W003 pipeline). */
  readonly proposal: unknown;
  /** The W004 policy documents (validated + canonically ordered by the kernel). */
  readonly policies: readonly unknown[];
  /** The W004 caller-supplied compiled-constraint resolver. */
  readonly resolveConstraint: ConstraintResolver;
  /** The W004 evaluation context `{ inputs: {...} }`. */
  readonly evaluationContext?: unknown;
  /** The action's tenancy scope beyond the tenant. */
  readonly scope?: ActionScope | undefined;
  /** The W009 authorization gate input — evaluated BEFORE policy. */
  readonly authorization: AuthorizationGateInput;
  /** Caller-supplied decision instant. */
  readonly decidedAt: Timestamp;
  /** The approval directive input (REQUIRED iff the outcome demands human approval). */
  readonly approval?: { readonly deadline: Timestamp; readonly maxDelegationDepth: number } | undefined;
}

/** The immutable content of one execution outcome record (pre-seal). */
export interface ActionOutcomeContent {
  readonly schemaVersion: typeof GATEWAY_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly actionId: string;
  /** The exact proposal revision that was executed. */
  readonly proposalRef: ProposalReference;
  /** The decision whose authorization the execution ran under. */
  readonly decisionDigest: Sha256Hex;
  readonly kind: 'succeeded' | 'failed';
  /** Present iff kind === 'failed'. */
  readonly failure?: { readonly code: string; readonly reason: string } | undefined;
  /** Evidence references (opaque; W006 owns evidence semantics). */
  readonly evidenceRefs: readonly string[];
  readonly executedAt: Timestamp;
}

/** The sealed execution outcome record: content plus its SHA-256 content digest. */
export interface SealedActionOutcomeRecord extends ActionOutcomeContent {
  readonly contentDigest: Sha256Hex;
}

/**
 * The EFFECT result an execution adapter produces. The gateway composes
 * and seals the record-shaped outcome; the adapter owns the actual effect
 * (external systems — HTTP, queues, tools — are adapters behind this seam,
 * never core types; lock rule 13).
 */
export type ExecutionEffectResult =
  | {
      readonly kind: 'succeeded';
      readonly evidenceRefs: readonly string[];
      readonly detail?: Readonly<Record<string, JsonValue>> | undefined;
    }
  | {
      readonly kind: 'failed';
      readonly failureCode: string;
      readonly reason: string;
      readonly evidenceRefs?: readonly string[] | undefined;
    };

/** One execution dispatch handed to the adapter seam. */
export interface ActionExecutionRequest {
  readonly tenantId: TenantId;
  readonly actionId: string;
  /** The admitted W003 proposal (the exact revision being executed). */
  readonly proposal: ActionProposal;
  /** The in-force sealed decision authorizing the execution. */
  readonly decision: SealedPolicyDecision;
  readonly executedAt: Timestamp;
}

/** The result of one adapter dispatch. */
export type ActionExecutionResult =
  | { readonly ok: true; readonly effect: ExecutionEffectResult }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: 'execution-unsupported';
        readonly message: string;
        readonly actionTypeId: string;
      };
    };

/**
 * The execution adapter seam: the ONLY way an action's effect reaches the
 * outside world. The in-memory reference adapter ships with this service;
 * real adapters (HTTP, queues, tools) are future Work Orders'.
 */
export interface ActionExecutionPort {
  execute(request: ActionExecutionRequest): ActionExecutionResult;
}

/** One hosted action's bookkeeping (the host model over the kernel records). */
export interface ActionEntry {
  readonly schemaVersion: typeof GATEWAY_RECORD_VERSION;
  readonly actionId: string;
  readonly tenantId: TenantId;
  readonly actionType: ActionTypeReference;
  /** The admitted W003 proposal — the exact revision this action grounds. */
  readonly proposal: ActionProposal;
  readonly proposalRef: ProposalReference;
  /** The in-force decision digest (the chain head for this proposal). */
  readonly decisionDigest: Sha256Hex;
  readonly status: ActionStatus;
  readonly streamId: string;
  /** The sealed outcome record (iff dispatched). */
  readonly outcome?: SealedActionOutcomeRecord | undefined;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

/** The outcome of `submitAction`. */
export interface IntakeOutcome {
  readonly action: ActionEntry;
  readonly decision: SealedPolicyDecision;
  /** The events this intake emitted (in sequence order). */
  readonly events: readonly SealedActionEvent[];
}

/** The outcome of `approveAction`. */
export interface ApprovalOutcome {
  readonly action: ActionEntry;
  readonly approval: SealedApprovalRecord;
  readonly events: readonly SealedActionEvent[];
}

/** The outcome of `rejectAction`. */
export interface RejectionOutcome {
  readonly action: ActionEntry;
  readonly rejection: SealedRejectionRecord;
  readonly events: readonly SealedActionEvent[];
}

/** One expired approval as observed by the host sweep. */
export interface ExpiredApproval {
  readonly action: ActionEntry;
  readonly expiry: SealedExpiryRecord;
  readonly event: SealedActionEvent;
}

/** The outcome of `executeAction`. */
export interface ExecutionOutcome {
  readonly action: ActionEntry;
  readonly outcome: SealedActionOutcomeRecord;
  readonly events: readonly SealedActionEvent[];
}

/** Options of `approveAction` / `rejectAction` (the human-approval flow). */
export interface ApprovalFlowOptions {
  readonly tenantId: TenantId;
  readonly actionId: string;
  /** The acting human approver (W003 AuthorizerReference; role must be human-approver). */
  readonly decidedBy: AuthorizerReference;
  /** The quorum role the approver acts in. */
  readonly asRole: string;
  /** Delegation path (originally designated approver first, acting approver last). */
  readonly delegationPath?: readonly string[] | undefined;
  /** Approval note / rejection reason. */
  readonly note?: string | undefined;
  /** Caller-supplied instant. */
  readonly at: Timestamp;
}

/** Options of `executeAction`. */
export interface ExecuteActionOptions {
  readonly tenantId: TenantId;
  readonly actionId: string;
  /**
   * The proposal revision the caller believes it is executing; any drift
   * from the in-force revision is the typed `proposal-drift-rejected`.
   */
  readonly expectedProposalDigest?: Sha256Hex | undefined;
  /** The W009 authorization context rides EVERY execution. */
  readonly authorization: AuthorizationGateInput;
  /** Evidence references the executor attaches to the outcome record. */
  readonly evidenceRefs?: readonly string[] | undefined;
  readonly at: Timestamp;
}

/** Options of the read operations (`getAction`, `actionStream`). */
export interface ActionReadOptions {
  readonly tenantId: TenantId;
  readonly actionId: string;
}

/** Options of `listActions`. */
export interface ListActionsOptions {
  readonly tenantId: TenantId;
}

/** Health/liveness as typed data (deterministic derivation, no clocks). */
export interface GatewayHealth {
  readonly schemaVersion: typeof GATEWAY_RECORD_VERSION;
  readonly status: GatewayHealthStatus;
  readonly actionCount: number;
  readonly actionsByStatus: Readonly<Record<ActionStatus, number>>;
  /** Actions not yet dispatched (awaiting-approval / authorized), across tenants. */
  readonly undispatchedActionCount: number;
  /** Failed action ids (tenant-scoped composite keys, sorted). */
  readonly degradedActions: readonly string[];
}

/** A deterministic whole-host snapshot (the kernel registry + host state). */
export interface GatewaySnapshot {
  readonly schemaVersion: typeof GATEWAY_RECORD_VERSION;
  /** The action-policy registry snapshot (sealed records + request states). */
  readonly registry: ActionPolicySnapshot;
  /** Hosted actions sorted by (tenantId, actionId). */
  readonly actions: readonly ActionEntry[];
  /** Sealed events sorted by (streamId, sequence). */
  readonly events: readonly SealedActionEvent[];
}

/** Options of the {@link ActionGateway} constructor. */
export interface ActionGatewayOptions {
  /**
   * Tenant this host is scoped to. When provided, ANY operation naming a
   * different tenant is rejected with `tenant-isolation-rejected` (R12).
   */
  readonly expectedTenantId?: TenantId | undefined;
  /** The execution adapter seam (defaults to the in-memory reference port). */
  readonly executionPort?: ActionExecutionPort | undefined;
}
