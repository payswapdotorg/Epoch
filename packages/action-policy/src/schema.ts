/**
 * @epoch/action-policy — runtime zod validators for the published contract
 * types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider/vendor semantics cannot enter kernel types through the
 * action-policy door (same policy as the W002-W010 validators).
 *
 * Runtime vocabulary composition (the W022 dependency policy):
 * - proposal/action-type references, approval quorums, and authorizer
 *   references use @epoch/action-protocol's validators directly (W003
 *   grammar — genuine runtime composition);
 * - provenance embeds @epoch/policy-contracts' resolution/composite
 *   validators directly (W004 grammar — reused verbatim, never mirrored);
 * - tenant/workspace/project ids use @epoch/tenancy's validators (W009
 *   grammar — genuine runtime composition);
 * - timestamps/digests use @epoch/agent-protocol's canonical primitives.
 *
 * Readonly discipline (the W009 house pattern): every published record
 * schema applies `.readonly()` at its own level and every array-valued
 * field applies `.readonly()` to its array, so the validators infer
 * exactly the hand-written contract types in src/types.ts (pinned by
 * src/parity.ts).
 */
import { z } from 'zod';
import { Sha256DigestSchema, TenantIdSchema, WorkspaceIdSchema, ProjectIdSchema } from '@epoch/tenancy';
import { TimestampSchema } from '@epoch/agent-protocol';
import {
  ActionTypeReferenceSchema,
  ApprovalQuorumSchema,
  AuthorizerReferenceSchema,
  ProposalReferenceSchema,
} from '@epoch/action-protocol';
import {
  applicablePolicyResolutionSchema,
  compositeDecisionSchema,
} from '@epoch/policy-contracts';
import {
  ACTION_POLICY_RECORD_VERSION,
  APPROVAL_REQUEST_STATUSES,
  MAX_DELEGATION_DEPTH,
  POLICY_DECISION_OUTCOMES,
  POLICY_DENIAL_CODES,
} from './version';

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Version discriminator on serialized action-policy records (v1). */
export const ActionPolicyRecordVersionSchema = z.literal(ACTION_POLICY_RECORD_VERSION).meta({
  id: 'ActionPolicyRecordVersion',
  title: 'ActionPolicyRecordVersion',
  description: 'Version discriminator carried by every serialized action-policy record (currently 1).',
});

/** One policy-decision outcome (allow / deny / requires-approval). */
export const PolicyDecisionOutcomeSchema = z.enum(POLICY_DECISION_OUTCOMES).meta({
  id: 'PolicyDecisionOutcome',
  title: 'PolicyDecisionOutcome',
  description:
    'Policy-decision outcome: allow (may execute), deny (may never execute), or requires-approval (execute only after the human-approval flow completes).',
});

/** One typed denial code. */
export const PolicyDenialCodeSchema = z.enum(POLICY_DENIAL_CODES).meta({
  id: 'PolicyDenialCode',
  title: 'PolicyDenialCode',
  description: 'Machine-readable denial code carried by deny decisions (every code is fail-closed).',
});

/** One approval-request status. */
export const ApprovalRequestStatusSchema = z.enum(APPROVAL_REQUEST_STATUSES).meta({
  id: 'ApprovalRequestStatus',
  title: 'ApprovalRequestStatus',
  description:
    'Approval-request lifecycle status: pending, approved, rejected, expired, or superseded.',
});

/** One contributing policy-set entry (policyId + semver version). */
export const PolicySetEntrySchema = z
  .strictObject({
    policyId: z.string().min(1).max(128),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
  })
  .readonly()
  .meta({
    id: 'PolicySetEntry',
    title: 'PolicySetEntry',
    description: 'One policy-set contributor named on a decision record: policy id plus semver version.',
  });

/** FULL provenance of one decision (the W004 results, reused verbatim). */
export const PolicyProvenanceSchema = z
  .strictObject({
    resolution: applicablePolicyResolutionSchema,
    composite: compositeDecisionSchema,
    policies: z.array(PolicySetEntrySchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'PolicyProvenance',
    title: 'PolicyProvenance',
    description:
      'Full decision provenance: the W004 applicable-policy resolution (matched policies, applied precedence, evaluated scope) and the W004 composite decision, reused verbatim.',
  });

/** The typed denial carried by deny decisions. */
export const PolicyDenialSchema = z
  .strictObject({
    code: PolicyDenialCodeSchema,
    reason: z.string().min(1).max(10000),
  })
  .readonly()
  .meta({
    id: 'PolicyDenial',
    title: 'PolicyDenial',
    description: 'A typed denial: exactly one machine-readable code plus a human-auditable reason.',
  });

/** The W009-shaped approver scope of an approval directive. */
export const ApproverScopeSchema = z
  .strictObject({
    tenantId: TenantIdSchema,
    workspaceId: WorkspaceIdSchema.optional(),
    projectId: ProjectIdSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'ApproverScope',
    title: 'ApproverScope',
    description:
      'The tenancy scope an approval request approvers must belong to (W009 grammars, composed from @epoch/tenancy).',
  });

/** The approval directive carried by requires-approval decisions. */
export const ApprovalDirectiveSchema = z
  .strictObject({
    quorum: ApprovalQuorumSchema,
    approverScope: ApproverScopeSchema,
    deadline: TimestampSchema,
    maxDelegationDepth: z
      .number()
      .int('maxDelegationDepth must be an integer')
      .min(0, 'maxDelegationDepth starts at 0 (no delegation)')
      .max(MAX_DELEGATION_DEPTH, `maxDelegationDepth cannot exceed the hard cap (${MAX_DELEGATION_DEPTH})`),
  })
  .readonly()
  .meta({
    id: 'ApprovalDirective',
    title: 'ApprovalDirective',
    description:
      'Approval directive of a requires-approval decision: the human-approval quorum (W003), the W009-shaped approver scope, the deadline, and the maximum delegation depth.',
  });

/**
 * The shared decision shape (the sealed record extends it with the chain
 * link and the content digest).
 */
const policyDecisionShape = z.strictObject({
  schemaVersion: ActionPolicyRecordVersionSchema,
  tenantId: TenantIdSchema,
  proposalRef: ProposalReferenceSchema,
  actionType: ActionTypeReferenceSchema,
  policySetDigest: Sha256DigestSchema,
  outcome: PolicyDecisionOutcomeSchema,
  denial: PolicyDenialSchema.optional(),
  approval: ApprovalDirectiveSchema.optional(),
  provenance: PolicyProvenanceSchema,
  decidedAt: TimestampSchema,
});

/** Denial is present iff deny; an approval directive iff requires-approval. */
function refineDecisionShape(
  content: {
    outcome: (typeof POLICY_DECISION_OUTCOMES)[number];
    denial?: unknown;
    approval?: unknown;
  },
  ctx: z.RefinementCtx,
): void {
  if (content.outcome === 'deny' && content.denial === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'a deny decision must carry its typed denial',
      path: ['denial'],
    });
  }
  if (content.outcome !== 'deny' && content.denial !== undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'only a deny decision carries a denial',
      path: ['denial'],
    });
  }
  if (content.outcome === 'requires-approval' && content.approval === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'a requires-approval decision must carry its approval directive',
      path: ['approval'],
    });
  }
  if (content.outcome !== 'requires-approval' && content.approval !== undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'only a requires-approval decision carries an approval directive',
      path: ['approval'],
    });
  }
}

/** The immutable content of one policy decision. */
export const PolicyDecisionContentSchema = policyDecisionShape
  .readonly()
  .superRefine(refineDecisionShape)
  .meta({
    id: 'PolicyDecisionContent',
    title: 'PolicyDecisionContent',
    description:
      'Immutable content of one policy decision: tenant scope, exact proposal revision, policy-set digest, outcome (+ denial / approval directive), full provenance, decision instant.',
  });

/**
 * The seal input of a policy decision: the content plus its (registry-
 * assigned) chain link — everything the content digest covers.
 */
const policyDecisionSealShape = policyDecisionShape.extend({
  previousDecisionDigest: Sha256DigestSchema.nullable(),
});

export const PolicyDecisionSealInputSchema = policyDecisionSealShape
  .readonly()
  .superRefine(refineDecisionShape)
  .meta({
    id: 'PolicyDecisionSealInput',
    title: 'PolicyDecisionSealInput',
    description:
      'The seal input of a policy decision: content plus the per-proposal chain link (previousDecisionDigest) — everything the content digest covers.',
  });

/** The sealed policy decision record (content + chain link + digest). */
export const SealedPolicyDecisionSchema = policyDecisionSealShape
  .extend({
    contentDigest: Sha256DigestSchema,
  })
  .readonly()
  .superRefine(refineDecisionShape)
  .meta({
    id: 'SealedPolicyDecision',
    title: 'SealedPolicyDecision',
    description:
      'Published policy-decision record: immutable content plus the per-proposal version-chain link (previousDecisionDigest, W023 style) and the SHA-256 content address.',
  });

/** The delegation facts carried by an approval record. */
export const ApprovalDelegationSchema = z
  .strictObject({
    depth: z.number().int().min(0).max(MAX_DELEGATION_DEPTH),
    path: z.array(z.string().min(1).max(128)).readonly(),
  })
  .readonly()
  .superRefine((delegation, ctx) => {
    if (delegation.path.length !== delegation.depth + 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'the delegation path length must equal depth + 1',
        path: ['path'],
      });
    }
  })
  .meta({
    id: 'ApprovalDelegation',
    title: 'ApprovalDelegation',
    description:
      'Delegation facts of an approval: depth plus the approver path (originally designated approver first, acting approver last; all distinct).',
  });

/** The shared approval shape (the sealed record adds the content digest). */
const approvalShape = z.strictObject({
  schemaVersion: ActionPolicyRecordVersionSchema,
  tenantId: TenantIdSchema,
  decisionDigest: Sha256DigestSchema,
  proposalRef: ProposalReferenceSchema,
  decidedBy: AuthorizerReferenceSchema,
  asRole: z.string().min(1).max(128),
  delegation: ApprovalDelegationSchema,
  note: z.string().min(1).max(10000).optional(),
  decidedAt: TimestampSchema,
});

/** The immutable content of one human approval. */
export const ApprovalRecordContentSchema = approvalShape.readonly().meta({
  id: 'ApprovalRecordContent',
  title: 'ApprovalRecordContent',
  description:
    'Immutable content of one human approval: references the ORIGINAL decision digest and authorizes EXACTLY the referenced proposal revision (never re-evaluates policy).',
});

/** The sealed approval record (content + digest). */
export const SealedApprovalRecordSchema = approvalShape
  .extend({ contentDigest: Sha256DigestSchema })
  .readonly()
  .meta({
    id: 'SealedApprovalRecord',
    title: 'SealedApprovalRecord',
    description: 'Published approval record: immutable content plus its SHA-256 content address.',
  });

/** The shared rejection shape (the sealed record adds the content digest). */
const rejectionShape = z.strictObject({
  schemaVersion: ActionPolicyRecordVersionSchema,
  tenantId: TenantIdSchema,
  decisionDigest: Sha256DigestSchema,
  proposalRef: ProposalReferenceSchema,
  decidedBy: AuthorizerReferenceSchema,
  asRole: z.string().min(1).max(128),
  reason: z.string().min(1).max(10000),
  decidedAt: TimestampSchema,
});

/** The immutable content of one human rejection. */
export const RejectionRecordContentSchema = rejectionShape.readonly().meta({
  id: 'RejectionRecordContent',
  title: 'RejectionRecordContent',
  description:
    'Immutable content of one human rejection: a fail-closed veto referencing the ORIGINAL decision digest and proposal revision.',
});

/** The sealed rejection record (content + digest). */
export const SealedRejectionRecordSchema = rejectionShape
  .extend({ contentDigest: Sha256DigestSchema })
  .readonly()
  .meta({
    id: 'SealedRejectionRecord',
    title: 'SealedRejectionRecord',
    description: 'Published rejection record: immutable content plus its SHA-256 content address.',
  });

/** The shared expiry shape (the sealed record adds the content digest). */
const expiryShape = z.strictObject({
  schemaVersion: ActionPolicyRecordVersionSchema,
  tenantId: TenantIdSchema,
  decisionDigest: Sha256DigestSchema,
  proposalRef: ProposalReferenceSchema,
  deadline: TimestampSchema,
  expiredAt: TimestampSchema,
});

/** The immutable content of one approval expiry. */
export const ExpiryRecordContentSchema = expiryShape.readonly().meta({
  id: 'ExpiryRecordContent',
  title: 'ExpiryRecordContent',
  description:
    'Immutable content of one approval expiry: the typed approval-timeout record of a deadline sweep.',
});

/** The sealed expiry record (content + digest). */
export const SealedExpiryRecordSchema = expiryShape
  .extend({ contentDigest: Sha256DigestSchema })
  .readonly()
  .meta({
    id: 'SealedExpiryRecord',
    title: 'SealedExpiryRecord',
    description: 'Published expiry record: immutable content plus its SHA-256 content address.',
  });

/** The live state of one approval request. */
export const ApprovalRequestStateSchema = z
  .strictObject({
    decisionDigest: Sha256DigestSchema,
    tenantId: TenantIdSchema,
    proposalRef: ProposalReferenceSchema,
    directive: ApprovalDirectiveSchema,
    status: ApprovalRequestStatusSchema,
    approvals: z.array(SealedApprovalRecordSchema).readonly(),
    rejection: SealedRejectionRecordSchema.optional(),
    expiry: SealedExpiryRecordSchema.optional(),
    supersededBy: Sha256DigestSchema.optional(),
  })
  .readonly()
  .superRefine((state, ctx) => {
    if (state.status === 'rejected' && state.rejection === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a rejected request carries its rejection record',
        path: ['rejection'],
      });
    }
    if (state.status === 'expired' && state.expiry === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'an expired request carries its expiry record',
        path: ['expiry'],
      });
    }
    if (state.status === 'superseded' && state.supersededBy === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a superseded request names the superseding decision digest',
        path: ['supersededBy'],
      });
    }
  })
  .meta({
    id: 'ApprovalRequestState',
    title: 'ApprovalRequestState',
    description:
      'Live state of one approval request: a projection over the sealed decision and its approval/rejection/expiry records (never a second source of truth).',
  });

/** The deterministic whole-registry snapshot. */
export const ActionPolicySnapshotSchema = z
  .strictObject({
    schemaVersion: ActionPolicyRecordVersionSchema,
    decisions: z.array(SealedPolicyDecisionSchema).readonly(),
    requests: z.array(ApprovalRequestStateSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'ActionPolicySnapshot',
    title: 'ActionPolicySnapshot',
    description:
      'Deterministic, serialization-friendly projection of a whole action-policy registry: sealed decisions plus the approval-request states (sorted, no insertion-order leaks).',
  });
