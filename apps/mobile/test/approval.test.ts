// REVIEW/APPROVAL SURFACE EVIDENCE: field review/approval as W003 typed
// proposals through the W022 action-gateway seam. The client holds no
// credentials, executes nothing, and RECEIVES gateway decision records
// (allow/deny/requires-approval — all three outcomes exercised). The
// submission carries no credential material; tamper detection and tenant
// isolation hold on every surface.
import { describe, expect, it } from 'vitest';
import {
  canonicalDigest,
} from '@epoch/agent-protocol';
import {
  buildFieldReviewSubmission,
  buildReviewActionProposal,
  sealFieldReviewProposal,
  verifyGatewayDecisionRecord,
  verifySealedFieldReviewProposal,
  ReferenceFieldApprovalGateway,
  FIELD_REVIEW_ACTION_TYPE_ID,
  type ReferenceDecisionDirective,
} from '../src/index';
import {
  OTHER_TENANT,
  REVIEWER,
  T4,
  T5,
  TENANT,
  sealedReview,
  sealedSession,
} from './helpers';

/** A policy-set digest stand-in (the reference gateway's directed input). */
const POLICY_SET_DIGEST = '9'.repeat(64);

/** Build one directed outcome for the reference gateway. */
function directive(
  outcome: 'allow' | 'deny' | 'requires-approval',
  messageId = 'field-review-directed',
): ReferenceDecisionDirective {
  const review = sealedReview();
  const proposal = buildReviewActionProposal(review, {
    proposedBy: 'agent:field-sync-host',
    messageId,
    proposalId: messageId,
    createdAt: T5,
    requiresHumanApproval: false,
  });
  if (!proposal.ok) {
    throw new Error(`fixture proposal failed to build: ${proposal.error.message}`);
  }
  const proposalDigest = canonicalDigest(proposal.value as unknown as Parameters<typeof canonicalDigest>[0]);
  return {
    proposalDigest,
    decisionId: `field-decision:${outcome}-pit-volume`,
    outcome,
    ...(outcome === 'deny'
      ? { denial: { code: 'no-applicable-policy' as const, reason: 'no policy covers this review yet' } }
      : {}),
    ...(outcome === 'requires-approval'
      ? {
          approval: {
            quorum: { approvals: 1, roles: ['field-reviewer'] },
            approverScope: { tenantId: TENANT },
            deadline: '2026-03-03T08:00:00.000Z',
            maxDelegationDepth: 1,
          },
        }
      : {}),
    policySetDigest: POLICY_SET_DIGEST,
    decidedAt: T5,
  };
}

/** Submit the fixture review through a directed reference gateway. */
function submitDirected(outcome: 'allow' | 'deny' | 'requires-approval', messageId = 'field-review-directed') {
  const review = sealedReview();
  const proposal = buildReviewActionProposal(review, {
    proposedBy: 'agent:field-sync-host',
    messageId,
    proposalId: messageId,
    createdAt: T5,
    requiresHumanApproval: false,
  });
  if (!proposal.ok) throw new Error('proposal fixture failed');
  const submission = buildFieldReviewSubmission(proposal.value, {
    submissionId: 'field-approval:pit-volume-review',
    tenantId: TENANT,
    sessionId: review.sessionId,
    submittedBy: REVIEWER,
    submittedAt: T5,
  });
  if (!submission.ok) throw new Error('submission fixture failed');
  const gateway = new ReferenceFieldApprovalGateway({
    expectedTenantId: TENANT,
    directives: [directive(outcome, messageId)],
  });
  return { submission: submission.value, decision: gateway.submitFieldReview(submission.value), gateway };
}

describe('the W003 action-proposal projection', () => {
  it('projects a field review into a valid W003 typed proposal', () => {
    const review = sealedReview();
    const proposal = buildReviewActionProposal(review, {
      proposedBy: 'agent:field-sync-host',
      messageId: 'field-review-001',
      proposalId: 'field-review-001',
      createdAt: T5,
      requiresHumanApproval: false,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    expect(proposal.value.messageKind).toBe('action.proposal');
    expect(proposal.value.actionType.id).toBe(FIELD_REVIEW_ACTION_TYPE_ID);
    expect(proposal.value.actionType.id).toBe('delivery.observation.review');
    expect(proposal.value.target.kind).toBe('external-resource');
    expect(proposal.value.target.ref).toBe(review.subject.observationId);
    expect(proposal.value.parameters['review-kind']).toBe('observation-acceptance');
    expect(proposal.value.authorityRequirements.requiredScopes).toContain('delivery:review');
    expect(proposal.value.authorityRequirements.requiresHumanApproval).toBe(false);
  });

  it('escalated reviews carry the mandatory quorum (the W003 iff refinement)', () => {
    const review = sealedReview();
    const proposal = buildReviewActionProposal(review, {
      proposedBy: 'agent:field-sync-host',
      messageId: 'field-review-002',
      proposalId: 'field-review-002',
      createdAt: T5,
      requiresHumanApproval: true,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    expect(proposal.value.authorityRequirements.requiresHumanApproval).toBe(true);
    expect(proposal.value.authorityRequirements.approvalQuorum).toBeDefined();
    expect(proposal.value.authorityRequirements.approvalQuorum?.approvals).toBe(1);
  });

  it('the proposal carries exact-revision evidence (observation digest + review digest)', () => {
    const review = sealedReview();
    const proposal = buildReviewActionProposal(review, {
      proposedBy: 'agent:field-sync-host',
      messageId: 'field-review-003',
      proposalId: 'field-review-003',
      createdAt: T5,
      requiresHumanApproval: false,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    expect(proposal.value.evidenceRefs).toContain(review.subject.observationDigest);
    expect(proposal.value.evidenceRefs).toContain(review.contentDigest);
  });

  it('a tampered review (digest mismatch) does not project', () => {
    const review = sealedReview();
    const tampered = { ...review, justification: 'tampered justification' };
    const proposal = buildReviewActionProposal(tampered, {
      proposedBy: 'agent:field-sync-host',
      messageId: 'field-review-004',
      proposalId: 'field-review-004',
      createdAt: T5,
      requiresHumanApproval: false,
    });
    expect(proposal.ok).toBe(false);
    if (proposal.ok) return;
    expect(proposal.error.code).toBe('digest-mismatch');
  });
});

describe('the gateway seam submission (no credentials)', () => {
  it('the submission carries the proposal + field provenance and NO credential material', () => {
    const review = sealedReview();
    const proposal = buildReviewActionProposal(review, {
      proposedBy: 'agent:field-sync-host',
      messageId: 'field-review-005',
      proposalId: 'field-review-005',
      createdAt: T5,
      requiresHumanApproval: false,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const submission = buildFieldReviewSubmission(proposal.value, {
      submissionId: 'field-approval:pit-volume-review',
      tenantId: TENANT,
      sessionId: review.sessionId,
      submittedBy: REVIEWER,
      submittedAt: T5,
    });
    expect(submission.ok).toBe(true);
    if (!submission.ok) return;
    expect(Object.keys(submission.value).sort()).toEqual([
      'proposal',
      'schema',
      'schemaVersion',
      'sessionId',
      'submissionId',
      'submittedAt',
      'submittedBy',
      'tenantId',
    ]);
    // No credential vocabulary anywhere on the wire form.
    const serialized = JSON.stringify(submission.value);
    for (const forbidden of ['token', 'secret', 'password', 'credential', 'apiKey', 'bearer']) {
      expect(serialized.includes(forbidden)).toBe(false);
    }
  });

  it('an invalid W003 proposal does not wrap into a submission', () => {
    const invalid = { not: 'a-proposal' };
    const submission = buildFieldReviewSubmission(invalid as never, {
      submissionId: 'field-approval:invalid',
      tenantId: TENANT,
      sessionId: 'field-session:shift-alpha',
      submittedBy: REVIEWER,
      submittedAt: T5,
    });
    expect(submission.ok).toBe(false);
    if (submission.ok) return;
    // Strict objects reject the unknown key (vendor-fields-rejected), never
    // a silent wrap.
    expect(submission.error.code).toBe('vendor-fields-rejected');
  });
});

describe('gateway decision records (all three outcomes exercised)', () => {
  it('ALLOW: the client receives a sealed allow decision record', () => {
    const { decision } = submitDirected('allow');
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.value.outcome).toBe('allow');
    expect(decision.value.denial).toBeUndefined();
    expect(decision.value.approval).toBeUndefined();
    expect(decision.value.decidedAt).toBe(T5);
    const verified = verifyGatewayDecisionRecord(decision.value);
    expect(verified.ok).toBe(true);
  });

  it('DENY: the decision carries its typed denial (code + reason)', () => {
    const { decision } = submitDirected('deny');
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.value.outcome).toBe('deny');
    expect(decision.value.denial).toBeDefined();
    expect(decision.value.denial?.code).toBe('no-applicable-policy');
    expect(decision.value.denial?.reason).toContain('no policy');
    expect(decision.value.approval).toBeUndefined();
    const verified = verifyGatewayDecisionRecord(decision.value);
    expect(verified.ok).toBe(true);
  });

  it('REQUIRES-APPROVAL: the decision carries its approval directive (quorum + scope + deadline)', () => {
    const { decision } = submitDirected('requires-approval');
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.value.outcome).toBe('requires-approval');
    expect(decision.value.approval).toBeDefined();
    expect(decision.value.approval?.quorum.approvals).toBe(1);
    expect(decision.value.approval?.approverScope.tenantId).toBe(TENANT);
    expect(decision.value.approval?.deadline).toBe('2026-03-03T08:00:00.000Z');
    expect(decision.value.approval?.maxDelegationDepth).toBe(1);
    expect(decision.value.denial).toBeUndefined();
    const verified = verifyGatewayDecisionRecord(decision.value);
    expect(verified.ok).toBe(true);
  });

  it('an allow decision record never mutates the delivery state (the client executes nothing)', () => {
    // The decision record is a RECEIPT: there is no code path from it to
    // acceptObservation/actualizeObservation. Structural assertion: the
    // record carries only decision fields.
    const { decision } = submitDirected('allow');
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(Object.keys(decision.value).sort()).toEqual([
      'actionType',
      'contentDigest',
      'decidedAt',
      'decisionId',
      'outcome',
      'policySetDigest',
      'previousDecisionDigest',
      'proposalRef',
      'schemaVersion',
      'tenantId',
    ]);
  });

  it('decisions for the same proposal chain by previousDecisionDigest', () => {
    const review = sealedReview();
    const proposal = buildReviewActionProposal(review, {
      proposedBy: 'agent:field-sync-host',
      messageId: 'field-review-chain',
      proposalId: 'field-review-chain',
      createdAt: T5,
      requiresHumanApproval: false,
    });
    if (!proposal.ok) throw new Error('proposal fixture failed');
    const submission = buildFieldReviewSubmission(proposal.value, {
      submissionId: 'field-approval:chain',
      tenantId: TENANT,
      sessionId: review.sessionId,
      submittedBy: REVIEWER,
      submittedAt: T5,
    });
    if (!submission.ok) throw new Error('submission fixture failed');
    const gateway = new ReferenceFieldApprovalGateway({
      expectedTenantId: TENANT,
      directives: [directive('allow', 'field-review-chain')],
    });
    const firstDecision = gateway.submitFieldReview(submission.value);
    expect(firstDecision.ok).toBe(true);
    if (!firstDecision.ok) return;
    expect(firstDecision.value.previousDecisionDigest).toBeNull();
    const secondDecision = gateway.submitFieldReview(submission.value);
    expect(secondDecision.ok).toBe(true);
    if (!secondDecision.ok) return;
    expect(secondDecision.value.previousDecisionDigest).toBe(firstDecision.value.contentDigest);
  });

  it('a proposal with NO directed outcome is the typed undirected-proposal rejection (no invented policy)', () => {
    const review = sealedReview();
    const proposal = buildReviewActionProposal(review, {
      proposedBy: 'agent:field-sync-host',
      messageId: 'field-review-undirected',
      proposalId: 'field-review-undirected',
      createdAt: T5,
      requiresHumanApproval: false,
    });
    if (!proposal.ok) throw new Error('proposal fixture failed');
    const submission = buildFieldReviewSubmission(proposal.value, {
      submissionId: 'field-approval:undirected',
      tenantId: TENANT,
      sessionId: review.sessionId,
      submittedBy: REVIEWER,
      submittedAt: T5,
    });
    if (!submission.ok) throw new Error('submission fixture failed');
    const gateway = new ReferenceFieldApprovalGateway({ expectedTenantId: TENANT, directives: [] });
    const decision = gateway.submitFieldReview(submission.value);
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.error.code).toBe('undirected-proposal');
    expect(decision.error.message).toContain('hosts no policy engine');
  });

  it('a submission from another tenant is a typed cross-tenant-denied rejection', () => {
    const review = sealedReview();
    const proposal = buildReviewActionProposal(review, {
      proposedBy: 'agent:field-sync-host',
      messageId: 'field-review-cross',
      proposalId: 'field-review-cross',
      createdAt: T5,
      requiresHumanApproval: false,
    });
    if (!proposal.ok) throw new Error('proposal fixture failed');
    const submission = buildFieldReviewSubmission(proposal.value, {
      submissionId: 'field-approval:cross',
      tenantId: OTHER_TENANT,
      sessionId: review.sessionId,
      submittedBy: REVIEWER,
      submittedAt: T5,
    });
    if (!submission.ok) throw new Error('submission fixture failed');
    const gateway = new ReferenceFieldApprovalGateway({
      expectedTenantId: TENANT,
      directives: [],
    });
    const decision = gateway.submitFieldReview(submission.value);
    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.error.code).toBe('cross-tenant-denied');
  });

  it('a tampered decision record is a typed digest-mismatch', () => {
    const { decision } = submitDirected('allow');
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    const tampered = { ...decision.value, decidedAt: '2026-03-02T23:00:00.000Z' };
    const verified = verifyGatewayDecisionRecord(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
  });

  it('a decision with a denial on a non-deny outcome is a typed validation error (iff rules)', () => {
    const { decision } = submitDirected('allow');
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    const malformed = {
      ...decision.value,
      denial: { code: 'no-applicable-policy', reason: 'smuggled' },
    };
    const verified = verifyGatewayDecisionRecord(malformed);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('validation');
  });

  it('a vendor field on a decision record is a typed vendor-fields rejection', () => {
    const { decision } = submitDirected('allow');
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    const smuggled = { ...decision.value, vendorPolicyEngine: 'vendor-pdp' };
    const verified = verifyGatewayDecisionRecord(smuggled);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('vendor-fields-rejected');
  });
});

describe('field review proposal records', () => {
  it('seals and verifies (JSON round-trip preserves the digest)', () => {
    const review = sealedReview();
    const roundTripped = JSON.parse(JSON.stringify(review)) as unknown;
    const verified = verifySealedFieldReviewProposal(roundTripped);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(review);
    }
  });

  it('a justification is mandatory (bounded audit field)', () => {
    const sealed = sealFieldReviewProposal({
      proposalId: 'field-approval:no-justification',
      tenantId: TENANT,
      sessionId: 'field-session:shift-alpha',
      reviewKind: 'observation-acceptance',
      subject: {
        deliveryId: 'delivery:tower-retrofit-v1',
        observationId: 'observation:pit-volume-morning',
        observationDigest: 'a'.repeat(64),
      },
      reviewer: REVIEWER,
      justification: '',
      createdAt: T4,
    });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('validation');
  });

  it('a review subject outside the observation grammar is rejected', () => {
    const sealed = sealFieldReviewProposal({
      proposalId: 'field-approval:bad-subject',
      tenantId: TENANT,
      sessionId: 'field-session:shift-alpha',
      reviewKind: 'observation-acceptance',
      subject: {
        deliveryId: 'delivery:tower-retrofit-v1',
        observationId: 'baseline:pit-volume',
        observationDigest: 'a'.repeat(64),
      },
      reviewer: REVIEWER,
      justification: 'reviewing the wrong kind',
      createdAt: T4,
    });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.issues?.some((issue) => issue.path.includes('observationId'))).toBe(true);
  });

  it('the session fixture stays referenced (no drift)', () => {
    expect(sealedSession().sessionId).toBe('field-session:shift-alpha');
  });
});
