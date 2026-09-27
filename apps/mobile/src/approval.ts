/**
 * @epoch/mobile — field review/approval surfaces (Work Order W018 Tech
 * Lead pin: "field review and approval are TYPED PROPOSALS through the
 * W022 action-gateway seam").
 *
 * The authority split is encoded structurally:
 *
 * - The mobile client HOLDS NO CREDENTIALS and EXECUTES NOTHING. Review
 *   intents are typed data: a {@link FieldReviewProposal} (mobile-owned,
 *   sealed, content-addressed) and its W003 {@link ActionProposal}
 *   projection (built through @epoch/action-protocol's own validators —
 *   the canonical proposal grammar the gateway intakes).
 * - Every review routes through the {@link FieldApprovalGatewayPort} seam
 *   (the W022 action-gateway boundary). The client RECEIVES gateway
 *   decision records ({@link GatewayDecisionRecord}: allow / deny /
 *   requires-approval) and never applies their effects — acceptance and
 *   actualization are the W036 DeliveryRecord authority's, driven from the
 *   gateway side (lock rules 2/3/16).
 * - `gateway-bypass-rejected` is a named negative outcome: an approval
 *   intent settled WITHOUT the gateway seam (see src/sync.ts) is a typed
 *   rejection, never a silent direct execution.
 *
 * The decision-record shapes consumed from runtime dependencies
 * (ProposalReference, ActionTypeReference, ApprovalQuorum, tenancy scope)
 * are the REAL @epoch/action-protocol / @epoch/tenancy grammars. The
 * outcome/denial-code vocabularies and the record version MIRROR the W022
 * policy kernel (@epoch/action-policy is a devDependency) and are
 * drift-pinned by test/parity.test.ts — the apps/web shell precedent,
 * never a runtime dep.
 */
import { z } from 'zod';
import {
  canonicalDigest,
  TimestampSchema,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import { TenantIdSchema, ProjectIdSchema, WorkspaceIdSchema } from '@epoch/tenancy';
import {
  ActionProposalSchema,
  ApprovalQuorumSchema,
  ProposalReferenceSchema,
  ActionTypeReferenceSchema,
  parseActionProposal,
  type ActionProposal,
  type ApprovalQuorum,
} from '@epoch/action-protocol';
import {
  DeliveryIdSchema,
  DistinctionRecordIdSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
} from '@epoch/solution-delivery';
import {
  crossTenantDeniedError,
  digestMismatchError,
  fieldError,
  fieldOk,
  fieldValidationError,
  hasUnrecognizedKeys,
  vendorFieldsError,
  type MobileFieldResult,
} from './errors';
import { FieldApprovalIdSchema, FieldDecisionIdSchema, FieldSessionIdSchema } from './primitives';
import {
  FieldReviewKindSchema,
  GATEWAY_DECISION_OUTCOMES,
  GatewayDecisionOutcomeSchema,
  MOBILE_FIELD_RECORD_VERSION,
  type FieldReviewKind,
  type GatewayDecisionOutcome,
} from './version';

// ---------------------------------------------------------------------------
// The W022 decision-vocabulary mirrors (drift-pinned by test/parity.test.ts).
// ---------------------------------------------------------------------------

/**
 * The gateway decision-record version, MIRRORING @epoch/action-policy's
 * ACTION_POLICY_RECORD_VERSION (devDep parity — never a runtime dep).
 */
export const GATEWAY_DECISION_RECORD_VERSION = 1 as const;

/**
 * The typed denial codes, MIRRORING @epoch/action-policy's
 * POLICY_DENIAL_CODES (devDep parity).
 */
export const GATEWAY_DENIAL_CODES = [
  'constraint-blocked',
  'unresolved-constraint',
  'no-applicable-policy',
  'proposal-expired',
] as const;

/** One mirrored gateway denial code. */
export type GatewayDenialCode = (typeof GATEWAY_DENIAL_CODES)[number];

export const GatewayDenialCodeSchema = z.enum(GATEWAY_DENIAL_CODES);

/** The typed denial carried by a deny decision (exactly one code + reason). */
export const GatewayDenialSchema = z
  .strictObject({
    code: GatewayDenialCodeSchema,
    reason: z.string().min(1).max(10000),
  })
  .readonly()
  .meta({
    id: 'GatewayDenial',
    title: 'GatewayDenial',
    description: 'The typed denial a deny decision carries (mirrored W022 policy denial: one code + reason).',
  });

/** One gateway denial. */
export type GatewayDenial = z.infer<typeof GatewayDenialSchema>;

/** The tenancy scope approvers must belong to (the W009 shapes, runtime-composed). */
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
    description: 'The tenancy scope gateway approvers must belong to (W009 shapes).',
  });

/** One approver scope. */
export type ApproverScope = z.infer<typeof ApproverScopeSchema>;

/**
 * The approval directive a `requires-approval` decision carries (mirrored
 * W022 approval directive: quorum + approver scope + deadline + delegation
 * bound).
 */
export const ApprovalDirectiveSchema = z
  .strictObject({
    quorum: ApprovalQuorumSchema,
    approverScope: ApproverScopeSchema,
    deadline: TimestampSchema,
    maxDelegationDepth: z.number().int().min(0).max(8),
  })
  .readonly()
  .meta({
    id: 'ApprovalDirective',
    title: 'ApprovalDirective',
    description:
      'The approval directive a requires-approval decision carries: quorum, approver scope, deadline, delegation bound (mirrored W022 shapes).',
  });

/** One approval directive. */
export type ApprovalDirective = z.infer<typeof ApprovalDirectiveSchema>;

/**
 * The SEALED gateway decision record the mobile client RECEIVES from the
 * W022 seam: a structural mirror of the kernel's SealedPolicyDecision
 * (tenant scope, exact-revision proposal reference, action type, policy-set
 * digest, outcome with denial/directive iff rules, decided instant, the
 * per-proposal chain link, and the content digest covering content AND
 * chain link — the W022 digest discipline).
 */
export const GatewayDecisionRecordSchema = z
  .strictObject({
    schemaVersion: z.literal(GATEWAY_DECISION_RECORD_VERSION),
    decisionId: FieldDecisionIdSchema,
    tenantId: TenantIdSchema,
    proposalRef: ProposalReferenceSchema,
    actionType: ActionTypeReferenceSchema,
    policySetDigest: Sha256HexSchema,
    outcome: GatewayDecisionOutcomeSchema,
    denial: GatewayDenialSchema.optional(),
    approval: ApprovalDirectiveSchema.optional(),
    decidedAt: TimestampSchema,
    previousDecisionDigest: Sha256HexSchema.nullable(),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .superRefine((decision, ctx) => {
    if (decision.outcome === 'deny' && decision.denial === undefined) {
      ctx.addIssue({ code: 'custom', message: 'a deny decision carries its typed denial', path: ['denial'] });
    }
    if (decision.outcome !== 'deny' && decision.denial !== undefined) {
      ctx.addIssue({ code: 'custom', message: 'only a deny decision carries a denial', path: ['denial'] });
    }
    if (decision.outcome === 'requires-approval' && decision.approval === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a requires-approval decision carries its approval directive',
        path: ['approval'],
      });
    }
    if (decision.outcome !== 'requires-approval' && decision.approval !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'only a requires-approval decision carries an approval directive',
        path: ['approval'],
      });
    }
  })
  .meta({
    id: 'GatewayDecisionRecord',
    title: 'GatewayDecisionRecord',
    description:
      'The sealed gateway decision record received from the W022 action-gateway seam: exact-revision proposal reference, outcome (allow/deny/requires-approval) with denial/directive iff rules, per-proposal chain link, content digest.',
  });

/** One sealed gateway decision record. */
export type GatewayDecisionRecord = z.infer<typeof GatewayDecisionRecordSchema>;

/** The decision content (everything except the content digest). */
export type GatewayDecisionContent = Omit<GatewayDecisionRecord, 'contentDigest'>;

// ---------------------------------------------------------------------------
// The field review proposal (mobile-owned, sealed, content-addressed).
// ---------------------------------------------------------------------------

/** The serialized schema name of a field review proposal. */
export const FIELD_REVIEW_PROPOSAL_SCHEMA_NAME = 'field.review-proposal' as const;

/** The exact-revision observation subject a review concerns. */
export const ReviewSubjectSchema = z
  .strictObject({
    deliveryId: DeliveryIdSchema,
    observationId: DistinctionRecordIdSchema,
    observationDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'ReviewSubject',
    title: 'ReviewSubject',
    description:
      'The exact-revision observation subject of one field review: delivery scope plus the observation record id and its content digest.',
  });

/** One review subject. */
export type ReviewSubject = z.infer<typeof ReviewSubjectSchema>;

/** The immutable content of one field review proposal. */
const fieldReviewProposalShape = z.strictObject({
  schema: z.literal(FIELD_REVIEW_PROPOSAL_SCHEMA_NAME),
  schemaVersion: z.literal(MOBILE_FIELD_RECORD_VERSION),
  proposalId: FieldApprovalIdSchema,
  tenantId: TenantIdSchema,
  sessionId: FieldSessionIdSchema,
  reviewKind: FieldReviewKindSchema,
  subject: ReviewSubjectSchema,
  reviewer: PrincipalIdSchema,
  /** Mandatory-free audit justification (bounded). */
  justification: z.string().min(1).max(10000),
  createdAt: TimestampSchema,
});

/** The shared content refinement (applied to BOTH content and sealed forms). */
function refineFieldReviewProposal(
  content: { subject: { observationId: string } },
  ctx: z.RefinementCtx,
): void {
  if (!content.subject.observationId.startsWith('observation:')) {
    ctx.addIssue({
      code: 'custom',
      message: 'a review subject references an observation record (the "observation:" prefix)',
      path: ['subject', 'observationId'],
    });
  }
}

export const FieldReviewProposalContentSchema = fieldReviewProposalShape
  .superRefine(refineFieldReviewProposal)
  .readonly()
  .meta({
    id: 'FieldReviewProposalContent',
    title: 'FieldReviewProposalContent',
    description:
      'The immutable content of one field review proposal: review kind, exact-revision observation subject, reviewer principal, mandatory justification, session linkage.',
  });

/** One field review proposal content. */
export type FieldReviewProposalContent = z.infer<typeof FieldReviewProposalContentSchema>;

/** The sealed field review proposal: content plus its SHA-256 content digest. */
export const SealedFieldReviewProposalSchema = z
  .strictObject({
    ...fieldReviewProposalShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .superRefine(refineFieldReviewProposal)
  .readonly()
  .meta({
    id: 'SealedFieldReviewProposal',
    title: 'SealedFieldReviewProposal',
    description:
      'The sealed field review proposal: immutable review content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed field review proposal. */
export type SealedFieldReviewProposal = z.infer<typeof SealedFieldReviewProposalSchema>;

/** Options to seal a field review proposal. */
export interface SealFieldReviewOptions {
  readonly proposalId: string;
  readonly tenantId: string;
  readonly sessionId: string;
  readonly reviewKind: FieldReviewKind;
  readonly subject: ReviewSubject | unknown;
  readonly reviewer: string;
  readonly justification: string;
  readonly createdAt: string;
}

/** Admit + seal a field review proposal (the total form). */
export function sealFieldReviewProposal(
  options: SealFieldReviewOptions,
): MobileFieldResult<SealedFieldReviewProposal> {
  const content = {
    schema: FIELD_REVIEW_PROPOSAL_SCHEMA_NAME,
    schemaVersion: MOBILE_FIELD_RECORD_VERSION,
    proposalId: options.proposalId,
    tenantId: options.tenantId,
    sessionId: options.sessionId,
    reviewKind: options.reviewKind,
    subject: options.subject,
    reviewer: options.reviewer,
    justification: options.justification,
    createdAt: options.createdAt,
  };
  const parsed = FieldReviewProposalContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return fieldError(vendorFieldsError(parsed.error));
    }
    return fieldError(fieldValidationError(parsed.error));
  }
  return fieldOk({
    ...parsed.data,
    contentDigest: canonicalDigest(parsed.data as unknown as JsonValue),
  });
}

/** Verify a sealed field review proposal (schema + digest recomputation). */
export function verifySealedFieldReviewProposal(
  sealed: unknown,
): MobileFieldResult<SealedFieldReviewProposal> {
  const parsed = SealedFieldReviewProposalSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return fieldError(vendorFieldsError(parsed.error));
    }
    return fieldError(fieldValidationError(parsed.error));
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return fieldError(digestMismatchError(expected, contentDigest));
  }
  return fieldOk(parsed.data);
}

// ---------------------------------------------------------------------------
// The W003 action-proposal projection (the canonical proposal grammar).
// ---------------------------------------------------------------------------

/** The field review action-type id (dot-namespaced, versioned). */
export const FIELD_REVIEW_ACTION_TYPE_ID = 'delivery.observation.review' as const;

/** The field review action-type version. */
export const FIELD_REVIEW_ACTION_TYPE_VERSION = '1.0.0' as const;

/** Options of {@link buildReviewActionProposal}. */
export interface BuildReviewActionProposalOptions {
  /** The acting field client agent (the W003 proposals-are-agent-authored grammar). */
  readonly proposedBy: string;
  readonly messageId: string;
  readonly proposalId: string;
  readonly createdAt: string;
  /**
   * Whether the review escalates to a human-approval quorum at the gateway
   * (the authority requirements the W004 policy evaluates). When true, the
   * quorum is mandatory (the W003 iff refinement).
   */
  readonly requiresHumanApproval: boolean;
  readonly quorum?: ApprovalQuorum | undefined;
  readonly expiresAt?: string | undefined;
}

/**
 * Project a sealed field review proposal into its W003 {@link ActionProposal}
 * form (validated through @epoch/action-protocol's own admission pipeline —
 * the canonical typed-proposal grammar the W022 gateway intakes):
 *
 * - action type `delivery.observation.review` (dot-namespaced, versioned);
 * - target: the delivery observation as an opaque external-resource
 *   reference (delivery-domain ids are opaque to the action vocabulary;
 *   effect application stays behind the gateway's execution seam);
 * - parameters carry the review kind and the exact-revision subject
 *   references (review kind, delivery, observation id + digest, reviewer
 *   principal);
 * - evidence refs carry the observation digest and the field review
 *   proposal digest (exact-revision provenance);
 * - authority requirements declare the `delivery:review` scope (plus the
 *   human-approval quorum iff escalated).
 */
export function buildReviewActionProposal(
  review: SealedFieldReviewProposal,
  options: BuildReviewActionProposalOptions,
): MobileFieldResult<ActionProposal> {
  const verified = verifySealedFieldReviewProposal(review);
  if (!verified.ok) {
    return verified;
  }
  const proposal = verified.value;
  const quorum =
    options.requiresHumanApproval && options.quorum === undefined
      ? { approvals: 1, roles: ['field-reviewer'] }
      : options.quorum;
  const candidate = {
    protocolVersion: '1.0.0' as const,
    messageKind: 'action.proposal' as const,
    messageId: options.messageId,
    createdAt: options.createdAt,
    proposalId: options.proposalId,
    proposedBy: options.proposedBy,
    actionType: { id: FIELD_REVIEW_ACTION_TYPE_ID, version: FIELD_REVIEW_ACTION_TYPE_VERSION },
    target: { kind: 'external-resource' as const, ref: proposal.subject.observationId },
    parameters: {
      'review-kind': proposal.reviewKind,
      'delivery-id': proposal.subject.deliveryId,
      'observation-id': proposal.subject.observationId,
      'observation-digest': proposal.subject.observationDigest,
      'reviewer-principal': proposal.reviewer,
      'field-session': proposal.sessionId,
      'justification': proposal.justification,
    },
    preconditions: [
      {
        description: `The observation ${proposal.subject.observationId} is recorded and not yet settled in delivery ${proposal.subject.deliveryId}.`,
      },
    ],
    predictedEffects: [
      {
        description:
          proposal.reviewKind === 'observation-acceptance'
            ? `Observation ${proposal.subject.observationId} moves to the accepted set of delivery ${proposal.subject.deliveryId} (the W036 authority applies it).`
            : proposal.reviewKind === 'observation-rejection'
              ? `Observation ${proposal.subject.observationId} moves to the rejected set of delivery ${proposal.subject.deliveryId} (the W036 authority applies it).`
              : `The field session ${proposal.sessionId} closes its delivery scope ${proposal.subject.deliveryId}.`,
        confidence: { kind: 'deterministic' as const },
      },
    ],
    sideEffects: [],
    reversibility: { kind: 'reversible' as const, via: 'manual' as const },
    authorityRequirements: {
      requiredScopes: ['delivery:review'],
      requiresHumanApproval: options.requiresHumanApproval,
      ...(quorum !== undefined ? { approvalQuorum: quorum } : {}),
    },
    rationale: `Field review (${proposal.reviewKind}) of observation ${proposal.subject.observationId} by ${proposal.reviewer}: ${proposal.justification}`,
    evidenceRefs: [proposal.subject.observationDigest, proposal.contentDigest],
    ...(options.expiresAt !== undefined ? { expiresAt: options.expiresAt } : {}),
  };
  const parsed = ActionProposalSchema.safeParse(candidate);
  if (!parsed.success) {
    return fieldError(fieldValidationError(parsed.error));
  }
  const admitted = parseActionProposal(parsed.data);
  if (!admitted.ok) {
    const protocolError = admitted.error;
    const issues =
      protocolError.kind === 'schema-violation'
        ? protocolError.issues.map((issue) => ({ path: issue.path, message: issue.message }))
        : [
            {
              path: 'messageKind',
              message: `${protocolError.kind} (expected ${protocolError.expected}, encountered ${protocolError.encountered})`,
            },
          ];
    return fieldError({
      code: 'validation',
      message: `the field review did not project to a valid W003 action proposal: ${protocolError.message}`,
      issues,
    });
  }
  return fieldOk(admitted.value);
}

// ---------------------------------------------------------------------------
// The gateway seam (the W022 action-gateway boundary).
// ---------------------------------------------------------------------------

/** The serialized schema name of a field review submission. */
export const FIELD_REVIEW_SUBMISSION_SCHEMA_NAME = 'field.review-submission' as const;

/**
 * The seam intake: the W003 typed proposal plus its field provenance. The
 * submission carries NO credentials, NO tokens, NO authorization context —
 * the W009 authorization decision happens gateway-side (the client only
 * identifies the acting principal opaquely).
 */
export const FieldReviewSubmissionSchema = z
  .strictObject({
    schema: z.literal(FIELD_REVIEW_SUBMISSION_SCHEMA_NAME),
    schemaVersion: z.literal(MOBILE_FIELD_RECORD_VERSION),
    submissionId: FieldApprovalIdSchema,
    tenantId: TenantIdSchema,
    sessionId: FieldSessionIdSchema,
    /** The acting field principal (opaque W009/W036 principal id). */
    submittedBy: PrincipalIdSchema,
    /** The W003 typed proposal (admitted through the W003 pipeline). */
    proposal: ActionProposalSchema,
    submittedAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'FieldReviewSubmission',
    title: 'FieldReviewSubmission',
    description:
      'The field review submission through the W022 gateway seam: the W003 typed proposal plus field provenance — no credentials, no authorization context (the gateway decides).',
  });

/** One field review submission. */
export type FieldReviewSubmission = z.infer<typeof FieldReviewSubmissionSchema>;

/** Options of {@link buildFieldReviewSubmission}. */
export interface BuildFieldReviewSubmissionOptions {
  readonly submissionId: string;
  readonly tenantId: string;
  readonly sessionId: string;
  readonly submittedBy: string;
  readonly submittedAt: string;
}

/** Build the seam submission around a W003 action proposal (total, typed). */
export function buildFieldReviewSubmission(
  proposal: ActionProposal,
  options: BuildFieldReviewSubmissionOptions,
): MobileFieldResult<FieldReviewSubmission> {
  const content = {
    schema: FIELD_REVIEW_SUBMISSION_SCHEMA_NAME,
    schemaVersion: MOBILE_FIELD_RECORD_VERSION,
    submissionId: options.submissionId,
    tenantId: options.tenantId,
    sessionId: options.sessionId,
    submittedBy: options.submittedBy,
    proposal,
    submittedAt: options.submittedAt,
  };
  const parsed = FieldReviewSubmissionSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return fieldError(vendorFieldsError(parsed.error));
    }
    return fieldError(fieldValidationError(parsed.error));
  }
  return fieldOk(parsed.data);
}

/**
 * The W022 action-gateway seam: how field review/approval proposals leave
 * the mobile client and how decision records arrive. The port is the ONLY
 * approval route (lock rule 3); a real host binds it to the gateway
 * service transport. The in-memory reference binding is
 * {@link ReferenceFieldApprovalGateway} (below).
 */
export interface FieldApprovalGatewayPort {
  /**
   * Submit one field review proposal. Returns the sealed gateway decision
   * record (allow / deny / requires-approval) — or a typed rejection.
   */
  submitFieldReview(submission: FieldReviewSubmission): MobileFieldResult<GatewayDecisionRecord>;
}

// ---------------------------------------------------------------------------
// The in-memory reference gateway binding (the W020/W022 reference-host
// precedent: zero policy logic, zero network, deterministic).
// ---------------------------------------------------------------------------

/**
 * One caller-directed decision outcome for the reference gateway. The
 * reference host has NO policy engine (policy evaluation is W022's
 * authority): directives are the caller-supplied stand-in, exactly like
 * caller-supplied instants. Each directive targets one proposal by its
 * canonical digest.
 */
export interface ReferenceDecisionDirective {
  /** The canonical digest of the proposal this directive directs. */
  readonly proposalDigest: Sha256Hex;
  readonly decisionId: string;
  readonly outcome: GatewayDecisionOutcome;
  readonly denial?: GatewayDenial | undefined;
  readonly approval?: ApprovalDirective | undefined;
  readonly policySetDigest: Sha256Hex;
  readonly decidedAt: string;
}

/** Options of {@link ReferenceFieldApprovalGateway}. */
export interface ReferenceFieldApprovalGatewayOptions {
  /**
   * Tenant this reference gateway is scoped to. When provided, any
   * submission naming a different tenant is rejected with
   * `cross-tenant-denied` (R12).
   */
  readonly expectedTenantId?: string | undefined;
  /** The caller-directed outcomes (proposal digest -> decision). */
  readonly directives: readonly ReferenceDecisionDirective[];
}

/**
 * The in-memory reference binding of the gateway seam. Deterministic and
 * pure: submissions are validated (tenant scope, W003 proposal admission),
 * the directed outcome is looked up by the proposal's canonical digest
 * (`undirected-proposal` when no directive exists — the reference host
 * honestly refuses to invent policy), and the decision record is sealed
 * with the W022 digest discipline (content + chain link). Decisions for
 * the same proposal chain via `previousDecisionDigest`.
 */
export class ReferenceFieldApprovalGateway implements FieldApprovalGatewayPort {
  private readonly expectedTenantId: string | undefined;
  private readonly directives: readonly ReferenceDecisionDirective[];
  private readonly decisionsByProposalId: Map<string, GatewayDecisionRecord[]> = new Map();

  constructor(options: ReferenceFieldApprovalGatewayOptions) {
    this.expectedTenantId = options.expectedTenantId;
    this.directives = [...options.directives].sort((a, b) =>
      a.proposalDigest < b.proposalDigest ? -1 : a.proposalDigest > b.proposalDigest ? 1 : 0,
    );
  }

  submitFieldReview(submission: FieldReviewSubmission): MobileFieldResult<GatewayDecisionRecord> {
    const parsed = FieldReviewSubmissionSchema.safeParse(submission);
    if (!parsed.success) {
      return fieldError(fieldValidationError(parsed.error));
    }
    const intake = parsed.data;
    if (this.expectedTenantId !== undefined && intake.tenantId !== this.expectedTenantId) {
      return fieldError(crossTenantDeniedError(this.expectedTenantId, intake.tenantId));
    }
    const proposalDigest = canonicalDigest(intake.proposal as unknown as JsonValue);
    const directive = this.directives.find(
      (candidate) => candidate.proposalDigest === proposalDigest,
    );
    if (directive === undefined) {
      return fieldError({
        code: 'undirected-proposal',
        message:
          `no directed outcome exists for proposal "${intake.proposal.proposalId}" (digest ${proposalDigest}) — ` +
          'the reference gateway hosts no policy engine; direct the outcome or bind the real W022 gateway transport',
      });
    }
    const chain = this.decisionsByProposalId.get(intake.proposal.proposalId) ?? [];
    const previousDecisionDigest = chain.length === 0 ? null : chain[chain.length - 1]!.contentDigest;
    const content: GatewayDecisionContent = {
      schemaVersion: GATEWAY_DECISION_RECORD_VERSION,
      decisionId: directive.decisionId,
      tenantId: intake.tenantId,
      proposalRef: {
        proposalId: intake.proposal.proposalId,
        canonicalDigest: proposalDigest,
      },
      actionType: intake.proposal.actionType,
      policySetDigest: directive.policySetDigest,
      outcome: directive.outcome,
      ...(directive.denial !== undefined ? { denial: directive.denial } : {}),
      ...(directive.approval !== undefined ? { approval: directive.approval } : {}),
      decidedAt: directive.decidedAt,
      previousDecisionDigest,
    };
    const sealed: GatewayDecisionRecord = {
      ...content,
      contentDigest: canonicalDigest(content as unknown as JsonValue),
    };
    const recheck = GatewayDecisionRecordSchema.safeParse(sealed);
    if (!recheck.success) {
      return fieldError(fieldValidationError(recheck.error));
    }
    this.decisionsByProposalId.set(intake.proposal.proposalId, [...chain, recheck.data]);
    return fieldOk(recheck.data);
  }

  /** The decisions recorded so far for one proposal id (deterministic order). */
  decisionsFor(proposalId: string): readonly GatewayDecisionRecord[] {
    return [...(this.decisionsByProposalId.get(proposalId) ?? [])];
  }
}

/** Verify a sealed gateway decision record (schema + digest recomputation). */
export function verifyGatewayDecisionRecord(
  sealed: unknown,
): MobileFieldResult<GatewayDecisionRecord> {
  const parsed = GatewayDecisionRecordSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return fieldError(vendorFieldsError(parsed.error));
    }
    return fieldError(fieldValidationError(parsed.error));
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return fieldError(digestMismatchError(expected, contentDigest));
  }
  return fieldOk(parsed.data);
}

export { GATEWAY_DECISION_OUTCOMES };
export type { GatewayDecisionOutcome, FieldReviewKind };
