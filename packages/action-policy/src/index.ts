/**
 * @epoch/action-policy — public API (kernel layer, Work Order W022).
 *
 * The typed policy EVALUATION layer of the Action Gateway boundary
 * (architecture.md, binding: "Agents propose; the Action Gateway authorizes
 * execution."). This kernel:
 *
 * - evaluates W003 action proposals against W004 policy sets THROUGH
 *   @epoch/policy-contracts (precedence/scope/composition semantics are
 *   W004's authority — consumed verbatim, never re-implemented) and
 *   produces typed, content-addressed decisions (allow / deny /
 *   requires-approval) with FULL provenance (which policies matched, the
 *   precedence applied, the scope evaluated, the composite decision);
 * - seals decisions as append-only, per-proposal HASH-CHAINED records (a
 *   decision is never mutated; a changed situation is a NEW decision with
 *   `previousDecisionDigest`, W023 style);
 * - carries human approval as a first-class typed surface: approval
 *   directives (W009-shaped approver scope, quorum, deadline, delegation
 *   depth), sealed approval/rejection/expiry records referencing the
 *   ORIGINAL decision digest — approval NEVER re-evaluates policy, drift
 *   is `proposal-drift-rejected`;
 * - replays idempotently: the same proposal digest under the same
 *   policy-set digest is the typed `duplicate-decision` negative echoing
 *   the existing decision; an approval replayed by the same approver is
 *   the typed `duplicate-approval` negative echoing the sealed approval;
 * - enforces tenant isolation (R12): decisions are tenant-scoped; the
 *   same exact proposal revision grounds decisions in exactly one tenant;
 *   cross-tenant references are typed `tenant-isolation-rejected`.
 *
 * Fail-closed everywhere: unresolved constraints block, out-of-policy
 * actions are denied (`no-applicable-policy`), expired proposals are
 * denied, unknown principals/tenants never error-open. Deterministic:
 * zero wall-clock, zero randomness — every instant is caller-supplied;
 * input order never leaks into digests.
 *
 * Runtime dependency policy (W022 Tech Lead pin): @epoch/action-protocol
 * (the proposal/authorization vocabulary), @epoch/policy-contracts (the
 * policy kernel), @epoch/agent-protocol (canonical digests + timestamps),
 * @epoch/tenancy (the W009 tenant grammars), and zod — NOTHING else.
 * Compatibility with @epoch/event-log / @epoch/evidence /
 * @epoch/verification is pinned via devDependencies + compile-time parity
 * (src/kernel-parity.ts) + runtime parity tests — never runtime deps.
 *
 * The service host over this kernel (intake, authorization gate, execution
 * dispatch, outcome recording) is services/action-gateway (W022 service
 * layer). This kernel never executes anything.
 */

// Version + vocabularies.
export {
  ACTION_POLICY_CONTRACT_VERSION,
  ACTION_POLICY_RECORD_VERSION,
  APPROVAL_REQUEST_STATUSES,
  MAX_DELEGATION_DEPTH,
  POLICY_DECISION_OUTCOMES,
  POLICY_DENIAL_CODES,
} from './version';
export type {
  ActionPolicyErrorCode,
  ApprovalRequestStatus,
  PolicyDecisionOutcome,
  PolicyDenialCode,
} from './version';

// Published contract types.
export type {
  ActionPolicyIssue,
  ActionPolicyRegistryOptions,
  ActionPolicyResult,
  ActionPolicySnapshot,
  ApprovalDelegation,
  ApprovalDirective,
  ApprovalRecordContent,
  ApprovalRequestState,
  ApprovalSubmission,
  ApproverScope,
  ExpiryRecordContent,
  PolicyDecisionContent,
  PolicyDenial,
  PolicyEvaluationInput,
  PolicyEvaluationScope,
  PolicyProvenance,
  PolicySetEntry,
  RejectionRecordContent,
  RejectionSubmission,
  SealedApprovalRecord,
  SealedExpiryRecord,
  SealedPolicyDecision,
  SealedRejectionRecord,
} from './types';

// The typed error taxonomy (values, never thrown).
export type { ActionPolicyError } from './types';

// Runtime validators.
export {
  SHA256_HEX_PATTERN,
  ActionPolicyRecordVersionSchema,
  ActionPolicySnapshotSchema,
  ApprovalDelegationSchema,
  ApprovalDirectiveSchema,
  ApprovalRecordContentSchema,
  ApprovalRequestStateSchema,
  ApprovalRequestStatusSchema,
  ApproverScopeSchema,
  ExpiryRecordContentSchema,
  PolicyDecisionContentSchema,
  PolicyDecisionOutcomeSchema,
  PolicyDecisionSealInputSchema,
  PolicyDenialCodeSchema,
  PolicyDenialSchema,
  PolicyProvenanceSchema,
  PolicySetEntrySchema,
  RejectionRecordContentSchema,
  SealedApprovalRecordSchema,
  SealedExpiryRecordSchema,
  SealedPolicyDecisionSchema,
  SealedRejectionRecordSchema,
} from './schema';

// Digest discipline (canonical SHA-256 content addressing + tamper-checked
// sealing + per-proposal chain verification).
export {
  computeApprovalDigest,
  computeDecisionDigest,
  computeExpiryDigest,
  computeRejectionDigest,
  sealApproval,
  sealDecision,
  sealExpiry,
  sealRejection,
  verifyDecisionChain,
  verifySealedApproval,
  verifySealedDecision,
  verifySealedExpiry,
  verifySealedRejection,
  type PolicyDecisionSealInput,
} from './digest';

// The pure policy evaluation layer.
export {
  canonicalizePolicySet,
  evaluateActionPolicy,
  toActionPolicyTarget,
} from './evaluate';
export type { ActionPolicyTarget, CanonicalPolicySet, PolicyEvaluation } from './evaluate';

// The reference registry (append-only decisions + the approval flow).
export { ActionPolicyRegistry } from './registry';

// Shared protocol primitives, re-exported for one-stop imports (the W003
// action-protocol precedent; their canonical home is @epoch/agent-protocol
// — the W022 service dependency policy composes them through this kernel).
export { canonicalDigest, JsonValueSchema, TimestampSchema } from '@epoch/agent-protocol';
export type { JsonValue, Sha256Hex, Timestamp } from '@epoch/agent-protocol';

// W004 vocabulary re-exports (types only — the policy kernel stays the
// authority; consumers of this package need no direct policy-contracts
// dependency to construct evaluation inputs).
export type {
  ApplicablePolicyResolution,
  CompositeDecision,
  ConstraintResolver,
  PolicyDocument,
  PolicyTarget,
} from '@epoch/policy-contracts';

// Compile-time contract parity (compiled by tsc --noEmit; type-only).
export type { ActionPolicyResultSync, ActionPolicySchemaSync } from './parity';
