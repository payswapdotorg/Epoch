/**
 * Action-policy contract versions and closed vocabularies (W022).
 *
 * architecture.md (binding): "Actions execute only through the Action
 * Gateway" (lock rule 3) and "Agents propose; the Action Gateway authorizes
 * execution." This kernel owns the typed policy EVALUATION layer between
 * those two sentences: it consumes W003 action proposals and W004 policy
 * sets and produces sealed, content-addressed DECISIONS (allow / deny /
 * requires-approval) with full provenance, plus the human-approval surface
 * (approval directives, sealed approval/rejection records, deadlines,
 * delegation depth). It never executes anything and never re-implements
 * W004 precedence/scope semantics — those are consumed verbatim through
 * @epoch/policy-contracts.
 *
 * Versioning policy (v1, mirrors @epoch/action-protocol /
 * @epoch/policy-contracts): a serialized decision/approval record is
 * admitted only when its `schemaVersion` equals
 * {@link ACTION_POLICY_RECORD_VERSION} exactly; skew surfaces as a typed
 * `version-unsupported` error before any other schema diagnostic.
 * {@link ACTION_POLICY_CONTRACT_VERSION} versions the published contract
 * surface (the typed index export of this package).
 *
 * Neutrality (architecture lock rule 13): no field, id, code or vocabulary
 * names a vendor, provider, broker or deployment surface. Approver roles
 * are opaque strings owned by the tenancy/identity/authorization domain
 * (W009); constraint semantics are W004's; execution adapters are the
 * service's (W022 service layer), never this kernel's.
 */

/** Version of the published action-policy contract surface. */
export const ACTION_POLICY_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized action-policy record. */
export const ACTION_POLICY_RECORD_VERSION = 1 as const;

/**
 * The policy-decision outcome vocabulary (the W022 dispatch pin): a
 * proposed action may execute (`allow`), may never execute (`deny`), or
 * may execute only after the human-approval flow completes
 * (`requires-approval`).
 */
export const POLICY_DECISION_OUTCOMES = ['allow', 'deny', 'requires-approval'] as const;

/** One policy-decision outcome. */
export type PolicyDecisionOutcome = (typeof POLICY_DECISION_OUTCOMES)[number];

/**
 * Machine-readable denial codes carried by deny decisions. Every code is
 * fail-closed: a deny is always the absence of a positive allow.
 *
 * - `constraint-blocked` — the W004 composite decision over the effective
 *   bindings composed to `block` (a hard/safety/authority constraint was
 *   violated, or an evaluation was rejected);
 * - `unresolved-constraint` — an effective policy binding's compiled
 *   constraint could not be resolved (W004 fail-closed: unresolvable
 *   policies must never silently allow);
 * - `no-applicable-policy` — no enabled policy matched the target; the
 *   Action Gateway executes only what an applicable policy set explicitly
 *   allows (an out-of-policy action is denied, never fail-open);
 * - `proposal-expired` — the proposal's `expiresAt` instant is strictly
 *   before the evaluation instant (the expiry instant is the LAST VALID
 *   instant — the same inclusive-boundary convention as the approval
 *   deadline);
 */
export const POLICY_DENIAL_CODES = [
  'constraint-blocked',
  'unresolved-constraint',
  'no-applicable-policy',
  'proposal-expired',
] as const;

/** One typed denial code. */
export type PolicyDenialCode = (typeof POLICY_DENIAL_CODES)[number];

/**
 * The approval-request status vocabulary (the lifecycle of one
 * `requires-approval` decision's human-approval flow):
 *
 * - `pending` — opened, quorum not yet met, deadline not yet passed;
 * - `approved` — the quorum was met before the deadline;
 * - `rejected` — a quorum-role human rejection arrived (fail-closed veto);
 * - `expired` — the deadline passed with the quorum unmet (the typed
 *   approval-timeout outcome);
 * - `superseded` — a NEW decision was recorded for the same proposal
 *   (changed policy set / changed situation); pending approvals of the
 *   superseded decision never transfer (approval authorizes EXACTLY the
 *   referenced decision + proposal digest).
 */
export const APPROVAL_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'expired',
  'superseded',
] as const;

/** One approval-request status. */
export type ApprovalRequestStatus = (typeof APPROVAL_REQUEST_STATUSES)[number];

/**
 * The hard cap on approval delegation depth. A directive may pin a lower
 * per-request maximum; nothing may exceed this cap (delegation abuse is
 * structurally bounded, not just policy-bounded).
 */
export const MAX_DELEGATION_DEPTH = 8 as const;

/**
 * The complete action-policy error-code vocabulary (values, never thrown;
 * the W009/W010/W023 typed-error style):
 *
 * - `validation` — malformed inputs (strict objects reject unknown
 *   vendor/provider fields; flattened dotted-path issues);
 * - `version-unsupported` — schemaVersion skew (expected/encountered);
 * - `digest-mismatch` — a claimed content digest that does not match the
 *   recomputed canonical SHA-256 (tamper detection);
 * - `chain-broken` — a decision chain whose `previousDecisionDigest` links
 *   do not line up with the prior record's content digest;
 * - `tenant-isolation-rejected` — a cross-tenant proposal reference (R12:
 *   a proposal digest grounds decisions in exactly one tenant);
 * - `duplicate-decision` — the same proposal digest under the same
 *   policy-set digest was already decided (idempotent replay; the existing
 *   sealed decision is echoed, state unchanged);
 * - `duplicate-approval` — the same approver already approved this request
 *   (idempotent replay; the existing sealed approval is echoed);
 * - `proposal-drift-rejected` — an approval/rejection references a
 *   proposal revision that differs from the ORIGINAL decision's revision;
 * - `approval-deadline-expired` — the approval deadline passed (expiry is
 *   typed, never implicit);
 * - `delegation-depth-exceeded` — the delegation path exceeds the
 *   directive's maximum depth (or the hard cap);
 * - `delegation-cycle` — the delegation path revisits an approver
 *   (self-delegation / circular delegation abuse);
 * - `approver-role-rejected` — the acting authorizer is not a human
 *   approver acting in one of the request's quorum roles;
 * - `unknown-decision` — a referenced decision digest that does not
 *   resolve;
 * - `decision-not-awaiting-approval` — the referenced decision is not a
 *   `requires-approval` decision (nothing to approve);
 * - `approval-request-settled` — the request is already
 *   approved/rejected/expired/superseded (fail-closed terminal state).
 */
export type ActionPolicyErrorCode =
  | 'validation'
  | 'version-unsupported'
  | 'digest-mismatch'
  | 'chain-broken'
  | 'tenant-isolation-rejected'
  | 'duplicate-decision'
  | 'duplicate-approval'
  | 'proposal-drift-rejected'
  | 'approval-deadline-expired'
  | 'delegation-depth-exceeded'
  | 'delegation-cycle'
  | 'approver-role-rejected'
  | 'unknown-decision'
  | 'decision-not-awaiting-approval'
  | 'approval-request-settled';
