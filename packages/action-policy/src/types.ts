/**
 * @epoch/action-policy — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators
 * in `src/schema.ts` infer exactly these types.
 *
 * Authority split (architecture lock rules 2/3/12/16): this kernel owns
 * the policy EVALUATION records over action proposals — it never executes
 * (the Action Gateway service's authority), never re-declares action
 * vocabulary (W003's), never re-implements precedence/scope semantics
 * (W004's, consumed verbatim through @epoch/policy-contracts), and never
 * interprets principal identities (W009 grammars, mirrored/pinned).
 *
 * Neutrality (lock rule 13): every identifier is opaque and kind-prefixed
 * or owned by a sibling kernel; strict objects reject unknown fields, so
 * provider/vendor semantics cannot enter through this door.
 */
import type { Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type {
  ActionTypeReference,
  ApprovalQuorum,
  AuthorizerReference,
  ProposalReference,
} from '@epoch/action-protocol';
import type {
  ApplicablePolicyResolution,
  CompositeDecision,
  ConstraintResolver,
} from '@epoch/policy-contracts';
import type { ProjectId, TenantId, WorkspaceId } from '@epoch/tenancy';
import type {
  ACTION_POLICY_RECORD_VERSION,
  ApprovalRequestStatus,
  PolicyDecisionOutcome,
  PolicyDenialCode,
} from './version';

/** One flattened validation issue (dotted path + message; "" = root). */
export interface ActionPolicyIssue {
  readonly path: string;
  readonly message: string;
}

/** One policy-set contributor named on a decision's provenance. */
export interface PolicySetEntry {
  /** The W004 policy document id (lowercase kebab-case grammar). */
  readonly policyId: string;
  /** The policy document's semver version. */
  readonly version: string;
}

/**
 * FULL provenance of one decision: which policies matched, the precedence
 * applied, and the scope evaluated — the W004 resolution and composite
 * results REUSED VERBATIM (never re-derived, never re-interpreted here).
 */
export interface PolicyProvenance {
  /**
   * The W004 applicable-policy resolution: matched policies with their
   * precedence and composition, the effective bindings, and the
   * deterministic resolution trace.
   */
  readonly resolution: ApplicablePolicyResolution;
  /** The W004 composite decision composed over the effective bindings. */
  readonly composite: CompositeDecision;
  /** The contributing policy documents (policyId + version), sorted by policyId. */
  readonly policies: readonly PolicySetEntry[];
}

/** The typed denial carried by a deny decision (exactly one code + reason). */
export interface PolicyDenial {
  readonly code: PolicyDenialCode;
  readonly reason: string;
}

/**
 * The approver scope of an approval directive — W009-shaped tenancy
 * references (the @epoch/tenancy grammars, composed as runtime
 * dependencies): the request's approvers must be principals of this scope.
 * Role semantics beyond the tenancy scope are the
 * identity/authorization domain's (W009); the quorum's opaque role names
 * are the W003 `ApprovalQuorum` vocabulary.
 */
export interface ApproverScope {
  readonly tenantId: TenantId;
  readonly workspaceId?: WorkspaceId | undefined;
  readonly projectId?: ProjectId | undefined;
}

/**
 * The approval directive a `requires-approval` decision carries (the W022
 * dispatch pin: "approver role/scope per W009 authorization shapes,
 * deadline, delegation depth"). The quorum comes verbatim from the
 * proposal's authority requirements (W003); the deadline and delegation
 * bound are caller-supplied evaluation input (zero wall-clock in kernel
 * src — every instant is caller-supplied).
 */
export interface ApprovalDirective {
  /** The human-approval quorum (from the proposal's authority requirements). */
  readonly quorum: ApprovalQuorum;
  /** The tenancy scope approvers must belong to (W009 shapes). */
  readonly approverScope: ApproverScope;
  /** The last instant at which an approval is admissible (inclusive). */
  readonly deadline: Timestamp;
  /** Maximum approval delegation depth for this request (0 = no delegation). */
  readonly maxDelegationDepth: number;
}

/**
 * The immutable content of one policy decision (the sealed record minus
 * its content digest). A decision is a pure function of its inputs: the
 * exact proposal revision, the exact policy-set revision (carried by
 * digest on every record), the resolved constraints, and the evaluation
 * instant — all caller-supplied, never wall-clock.
 */
export interface PolicyDecisionContent {
  readonly schemaVersion: typeof ACTION_POLICY_RECORD_VERSION;
  readonly tenantId: TenantId;
  /** The exact-revision proposal reference this decision concerns (W003 grammar). */
  readonly proposalRef: ProposalReference;
  /** The action type of the evaluated proposal (W003 grammar). */
  readonly actionType: ActionTypeReference;
  /** SHA-256 of the canonical JSON of the validated, canonically ordered policy set. */
  readonly policySetDigest: Sha256Hex;
  readonly outcome: PolicyDecisionOutcome;
  /** Present if and only if outcome === 'deny'. */
  readonly denial?: PolicyDenial | undefined;
  /** Present if and only if outcome === 'requires-approval'. */
  readonly approval?: ApprovalDirective | undefined;
  /** Full provenance: the W004 resolution + composite, reused verbatim. */
  readonly provenance: PolicyProvenance;
  /** Caller-supplied decision instant. */
  readonly decidedAt: Timestamp;
}

/**
 * The SEALED policy decision record: immutable content plus its SHA-256
 * content digest (the exact-revision content address) and its per-proposal
 * version-chain link (`previousDecisionDigest`, W023 style: null on the
 * first decision for a proposal, otherwise the content digest of the
 * immediately preceding recorded decision for the same proposal id in the
 * same tenant). The digest covers content AND chain link, so the chain is
 * tamper-evident by construction.
 */
export interface SealedPolicyDecision {
  readonly schemaVersion: typeof ACTION_POLICY_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly proposalRef: ProposalReference;
  readonly actionType: ActionTypeReference;
  readonly policySetDigest: Sha256Hex;
  readonly outcome: PolicyDecisionOutcome;
  readonly denial?: PolicyDenial | undefined;
  readonly approval?: ApprovalDirective | undefined;
  readonly provenance: PolicyProvenance;
  readonly decidedAt: Timestamp;
  /** Chain link: the prior recorded decision for this proposal (null on the first). */
  readonly previousDecisionDigest: Sha256Hex | null;
  /** SHA-256 of the canonical JSON of the content INCLUDING the chain link. */
  readonly contentDigest: Sha256Hex;
}

/** The delegation facts carried by an approval record. */
export interface ApprovalDelegation {
  /** Delegation depth: path length - 1 (0 = the approver approves directly). */
  readonly depth: number;
  /**
   * The delegation path: the originally designated approver first, each
   * delegating approver next, the acting approver last. All ids distinct
   * (`delegation-cycle` otherwise); length = depth + 1.
   */
  readonly path: readonly string[];
}

/**
 * The immutable content of one human approval: a sealed record referencing
 * the ORIGINAL decision digest and authorizing execution of EXACTLY the
 * referenced proposal revision. Approval NEVER re-evaluates policy — any
 * drift from the original decision's proposal revision is the typed
 * `proposal-drift-rejected` rejection.
 */
export interface ApprovalRecordContent {
  readonly schemaVersion: typeof ACTION_POLICY_RECORD_VERSION;
  readonly tenantId: TenantId;
  /** The ORIGINAL requires-approval decision this approval answers. */
  readonly decisionDigest: Sha256Hex;
  /** The proposal revision this approval authorizes (must equal the decision's). */
  readonly proposalRef: ProposalReference;
  /** The acting human approver (W003 AuthorizerReference; role must be human-approver). */
  readonly decidedBy: AuthorizerReference;
  /** The quorum role the approver acts in (must be one of the directive's quorum roles). */
  readonly asRole: string;
  /** Delegation facts (depth + path; defaults to the direct path). */
  readonly delegation: ApprovalDelegation;
  /** Optional bounded audit note. */
  readonly note?: string | undefined;
  /** Caller-supplied approval instant (must not exceed the deadline). */
  readonly decidedAt: Timestamp;
}

/** The sealed approval record: content plus its SHA-256 content digest. */
export interface SealedApprovalRecord {
  readonly schemaVersion: typeof ACTION_POLICY_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly decisionDigest: Sha256Hex;
  readonly proposalRef: ProposalReference;
  readonly decidedBy: AuthorizerReference;
  readonly asRole: string;
  readonly delegation: ApprovalDelegation;
  readonly note?: string | undefined;
  readonly decidedAt: Timestamp;
  readonly contentDigest: Sha256Hex;
}

/**
 * The immutable content of one human rejection: a fail-closed veto that
 * settles the request as `rejected` immediately.
 */
export interface RejectionRecordContent {
  readonly schemaVersion: typeof ACTION_POLICY_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly decisionDigest: Sha256Hex;
  /** The proposal revision this rejection concerns (must equal the decision's). */
  readonly proposalRef: ProposalReference;
  readonly decidedBy: AuthorizerReference;
  /** The quorum role the rejecting approver acts in. */
  readonly asRole: string;
  /** Mandatory human-auditable rejection reason. */
  readonly reason: string;
  readonly decidedAt: Timestamp;
}

/** The sealed rejection record: content plus its SHA-256 content digest. */
export interface SealedRejectionRecord {
  readonly schemaVersion: typeof ACTION_POLICY_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly decisionDigest: Sha256Hex;
  readonly proposalRef: ProposalReference;
  readonly decidedBy: AuthorizerReference;
  readonly asRole: string;
  readonly reason: string;
  readonly decidedAt: Timestamp;
  readonly contentDigest: Sha256Hex;
}

/**
 * The immutable content of one approval expiry: the typed
 * approval-timeout record produced by a deadline sweep against a
 * caller-supplied instant (zero wall-clock in kernel src).
 */
export interface ExpiryRecordContent {
  readonly schemaVersion: typeof ACTION_POLICY_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly decisionDigest: Sha256Hex;
  readonly proposalRef: ProposalReference;
  /** The directive deadline that passed. */
  readonly deadline: Timestamp;
  /** Caller-supplied sweep instant. */
  readonly expiredAt: Timestamp;
}

/** The sealed expiry record: content plus its SHA-256 content digest. */
export interface SealedExpiryRecord {
  readonly schemaVersion: typeof ACTION_POLICY_RECORD_VERSION;
  readonly tenantId: TenantId;
  readonly decisionDigest: Sha256Hex;
  readonly proposalRef: ProposalReference;
  readonly deadline: Timestamp;
  readonly expiredAt: Timestamp;
  readonly contentDigest: Sha256Hex;
}

/**
 * The live state of one approval request (a projection over the sealed
 * decision + its approval/rejection/expiry records; rebuilt on snapshot
 * restore, never a second source of truth).
 */
export interface ApprovalRequestState {
  readonly decisionDigest: Sha256Hex;
  readonly tenantId: TenantId;
  readonly proposalRef: ProposalReference;
  /** The directive carried by the requires-approval decision. */
  readonly directive: ApprovalDirective;
  readonly status: ApprovalRequestStatus;
  /** Sealed approvals in admission order (idempotency keys: approver id). */
  readonly approvals: readonly SealedApprovalRecord[];
  readonly rejection?: SealedRejectionRecord | undefined;
  readonly expiry?: SealedExpiryRecord | undefined;
  /** The decision digest that superseded this request (iff status === 'superseded'). */
  readonly supersededBy?: Sha256Hex | undefined;
}

/** Options of the pure policy evaluation (all instants caller-supplied). */
export interface PolicyEvaluationInput {
  readonly tenantId: TenantId;
  /** The action's tenancy scope beyond the tenant (W009 shapes; feeds the W004 policy target and the approver scope). */
  readonly scope?: PolicyEvaluationScope | undefined;
  /** The W003 action proposal (admitted through the W003 pipeline here). */
  readonly proposal: unknown;
  /** The W004 policy documents (validated + canonically ordered here). */
  readonly policies: readonly unknown[];
  /** The W004 caller-supplied compiled-constraint resolver. */
  readonly resolveConstraint: ConstraintResolver;
  /** The W004 evaluation context `{ inputs: {...} }` shared by every effective binding. */
  readonly evaluationContext?: unknown;
  /** Caller-supplied decision instant. */
  readonly decidedAt: Timestamp;
  /**
   * The approval directive input (deadline + delegation bound), REQUIRED
   * iff the evaluation would produce `requires-approval` (the proposal's
   * authority requirements demand human approval); ignored otherwise.
   */
  readonly approval?: {
    readonly deadline: Timestamp;
    readonly maxDelegationDepth: number;
  } | undefined;
}

/** The action's tenancy scope beyond the tenant (the W009 workspace/project grammars). */
export interface PolicyEvaluationScope {
  readonly workspaceId?: WorkspaceId | undefined;
  readonly projectId?: ProjectId | undefined;
}

/** One approval submission (the human-approval flow input). */
export interface ApprovalSubmission {
  readonly tenantId: TenantId;
  /** The ORIGINAL requires-approval decision digest being answered. */
  readonly decisionDigest: Sha256Hex;
  /** The proposal revision the approval authorizes (drift is typed). */
  readonly proposalRef: ProposalReference;
  readonly decidedBy: AuthorizerReference;
  readonly asRole: string;
  /** Delegation path (originally designated approver first, acting approver last). */
  readonly delegationPath?: readonly string[] | undefined;
  readonly note?: string | undefined;
  /** Caller-supplied approval instant (must not exceed the deadline). */
  readonly at: Timestamp;
}

/** One rejection submission (the human-approval flow input). */
export interface RejectionSubmission {
  readonly tenantId: TenantId;
  readonly decisionDigest: Sha256Hex;
  readonly proposalRef: ProposalReference;
  readonly decidedBy: AuthorizerReference;
  readonly asRole: string;
  readonly reason: string;
  readonly at: Timestamp;
}

/**
 * A deterministic, serialization-friendly projection of a whole registry:
 * sealed decisions sorted by (tenantId, proposalId, contentDigest), plus
 * the approval-request states sorted by decisionDigest. The request states
 * are host state rebuilt and validated against the sealed records on
 * restore (the agent-runtime session-entry precedent): the sealed records
 * are the source of truth, the request projections carry the live
 * approval-flow state. Two registries fed the same admission history emit
 * byte-identical snapshots (no insertion-order leaks).
 */
export interface ActionPolicySnapshot {
  readonly schemaVersion: typeof ACTION_POLICY_RECORD_VERSION;
  readonly decisions: readonly SealedPolicyDecision[];
  readonly requests: readonly ApprovalRequestState[];
}

/** Options of the {@link ActionPolicyRegistry} constructor. */
export interface ActionPolicyRegistryOptions {
  /**
   * Tenant this registry is scoped to. When provided, ANY operation naming
   * a different tenant is rejected with `tenant-isolation-rejected` (R12 —
   * the event-log single-tenant guard precedent).
   */
  readonly expectedTenantId?: TenantId | undefined;
}

/**
 * The typed action-policy error taxonomy (values, never thrown — see
 * src/version.ts for the complete code documentation).
 */
export type ActionPolicyError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly ActionPolicyIssue[];
    }
  | {
      readonly code: 'version-unsupported';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: Sha256Hex;
      readonly encountered: Sha256Hex;
    }
  | {
      readonly code: 'chain-broken';
      readonly message: string;
      readonly tenantId: TenantId;
      readonly proposalId: string;
      readonly expected: Sha256Hex | null;
      readonly encountered: Sha256Hex | null;
    }
  | {
      readonly code: 'tenant-isolation-rejected';
      readonly message: string;
      readonly proposalDigest?: Sha256Hex | undefined;
      readonly expectedTenantId?: TenantId | undefined;
      readonly encounteredTenantId?: TenantId | undefined;
    }
  | {
      readonly code: 'duplicate-decision';
      readonly message: string;
      readonly existingDecisionDigest: Sha256Hex;
      /** The existing sealed decision, echoed (the SAME decision identity). */
      readonly existingDecision: SealedPolicyDecision;
    }
  | {
      readonly code: 'duplicate-approval';
      readonly message: string;
      readonly approverId: string;
      /** The existing sealed approval, echoed (the idempotent replay result). */
      readonly existingApproval: SealedApprovalRecord;
    }
  | {
      readonly code: 'proposal-drift-rejected';
      readonly message: string;
      readonly decisionDigest: Sha256Hex;
      readonly expectedProposalDigest: Sha256Hex;
      readonly encounteredProposalDigest: Sha256Hex;
    }
  | {
      readonly code: 'approval-deadline-expired';
      readonly message: string;
      readonly decisionDigest: Sha256Hex;
      readonly deadline: Timestamp;
      readonly encounteredAt: Timestamp;
    }
  | {
      readonly code: 'delegation-depth-exceeded';
      readonly message: string;
      readonly decisionDigest: Sha256Hex;
      readonly maxDelegationDepth: number;
      readonly encounteredDepth: number;
    }
  | {
      readonly code: 'delegation-cycle';
      readonly message: string;
      readonly decisionDigest: Sha256Hex;
      readonly path: readonly string[];
    }
  | {
      readonly code: 'approver-role-rejected';
      readonly message: string;
      readonly decisionDigest: Sha256Hex;
      readonly encounteredRole: string;
    }
  | {
      readonly code: 'unknown-decision';
      readonly message: string;
      readonly decisionDigest: Sha256Hex;
    }
  | {
      readonly code: 'decision-not-awaiting-approval';
      readonly message: string;
      readonly decisionDigest: Sha256Hex;
      readonly outcome: PolicyDecisionOutcome;
    }
  | {
      readonly code: 'approval-request-settled';
      readonly message: string;
      readonly decisionDigest: Sha256Hex;
      readonly status: ApprovalRequestStatus;
    };

/** Result of an action-policy operation: a value or a typed error. */
export type ActionPolicyResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ActionPolicyError };
