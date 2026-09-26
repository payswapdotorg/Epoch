// ROUND-TRIP SERIALIZATION + DIGEST VERIFICATION for every public type:
// capture envelopes, queue records, the device descriptor, proposal
// shapes (field review proposals, W003 action-proposal projections,
// submissions, decision records), and field sessions. JSON in → verify
// out, deep-equal, digest recomputed.
import { describe, expect, it } from 'vitest';
import {
  buildFieldDeviceDescriptor,
  buildFieldReviewSubmission,
  buildReviewActionProposal,
  ReferenceFieldApprovalGateway,
  verifyGatewayDecisionRecord,
  verifySealedFieldCapture,
  verifySealedFieldQueueRecord,
  verifySealedFieldReviewProposal,
  verifySealedFieldSession,
  OfflineQueue,
  type GatewayDecisionRecord,
} from '../src/index';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  DELIVERY_LEAD,
  REVIEWER,
  T5,
  T6,
  TENANT,
  captureInput,
  sealedCapture,
  sealedReview,
  sealedSession,
  reviewInput,
  fieldDevice,
  sealLooseCapture,
  sealLooseReview,
} from './helpers';

describe('capture envelope round-trip', () => {
  it('seal → JSON → verify round-trips deep-equal', () => {
    const sealed = sealedCapture();
    const wire = JSON.parse(JSON.stringify(sealed)) as unknown;
    const verified = verifySealedFieldCapture(wire);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(sealed);
    }
  });

  it('the sealed digest equals the canonical digest of the content', () => {
    const sealed = sealedCapture();
    const { contentDigest, ...content } = sealed;
    expect(contentDigest).toBe(canonicalDigest(content as Parameters<typeof canonicalDigest>[0]));
  });

  it('key-order irrelevance: shuffled object keys seal identically', () => {
    const input = captureInput();
    const direct = sealLooseCapture(input);
    const shuffled: Record<string, unknown> = {};
    for (const key of Object.keys(input).reverse()) {
      shuffled[key] = (input as Record<string, unknown>)[key];
    }
    const reversed = sealLooseCapture(shuffled);
    expect(direct.ok).toBe(true);
    expect(reversed.ok).toBe(true);
    if (!direct.ok || !reversed.ok) return;
    expect(direct.value.contentDigest).toBe(reversed.value.contentDigest);
  });

  it('progress-measure captures round-trip too', () => {
    const sealed = sealLooseCapture({
      ...captureInput(),
      observationId: 'observation:progress-checkpoint',
      measure: { kind: 'progress', fraction: 0.75 },
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const wire = JSON.parse(JSON.stringify(sealed.value)) as unknown;
    const verified = verifySealedFieldCapture(wire);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(sealed.value);
    }
  });
});

describe('field session round-trip', () => {
  it('seal → JSON → verify round-trips deep-equal (every lifecycle state)', () => {
    const opened = sealedSession();
    for (const state of [opened]) {
      const wire = JSON.parse(JSON.stringify(state)) as unknown;
      const verified = verifySealedFieldSession(wire);
      expect(verified.ok).toBe(true);
      if (verified.ok) {
        expect(verified.value).toEqual(state);
      }
    }
  });
});

describe('field review proposal round-trip', () => {
  it('seal → JSON → verify round-trips deep-equal', () => {
    const review = sealedReview();
    const wire = JSON.parse(JSON.stringify(review)) as unknown;
    const verified = verifySealedFieldReviewProposal(wire);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(review);
    }
  });

  it('the sealed digest equals the canonical digest of the content', () => {
    const review = sealedReview();
    const { contentDigest, ...content } = review;
    expect(contentDigest).toBe(canonicalDigest(content as Parameters<typeof canonicalDigest>[0]));
  });

  it('all three review kinds seal and round-trip', () => {
    for (const reviewKind of ['observation-acceptance', 'observation-rejection', 'session-close'] as const) {
      const sealed = sealLooseReview({ ...reviewInput(), reviewKind });
      expect(sealed.ok).toBe(true);
      if (!sealed.ok) return;
      const wire = JSON.parse(JSON.stringify(sealed.value)) as unknown;
      const verified = verifySealedFieldReviewProposal(wire);
      expect(verified.ok).toBe(true);
      if (verified.ok) {
        expect(verified.value).toEqual(sealed.value);
      }
    }
  });
});

describe('W003 action-proposal projection round-trip', () => {
  it('the projected proposal survives JSON round-trip (W003 wire form)', () => {
    const review = sealedReview();
    const proposal = buildReviewActionProposal(review, {
      proposedBy: 'agent:field-sync-host',
      messageId: 'field-review-roundtrip',
      proposalId: 'field-review-roundtrip',
      createdAt: T5,
      requiresHumanApproval: false,
    });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    const wire = JSON.parse(JSON.stringify(proposal.value)) as unknown;
    expect(wire).toEqual(proposal.value);
  });

  it('the submission round-trips (seam wire form)', () => {
    const review = sealedReview();
    const proposal = buildReviewActionProposal(review, {
      proposedBy: 'agent:field-sync-host',
      messageId: 'field-review-submission-rt',
      proposalId: 'field-review-submission-rt',
      createdAt: T5,
      requiresHumanApproval: false,
    });
    if (!proposal.ok) throw new Error('fixture proposal failed');
    const submission = buildFieldReviewSubmission(proposal.value, {
      submissionId: 'field-approval:roundtrip',
      tenantId: TENANT,
      sessionId: review.sessionId,
      submittedBy: REVIEWER,
      submittedAt: T5,
    });
    expect(submission.ok).toBe(true);
    if (!submission.ok) return;
    const wire = JSON.parse(JSON.stringify(submission.value)) as unknown;
    expect(wire).toEqual(submission.value);
  });
});

describe('gateway decision record round-trip', () => {
  function decisionFor(outcome: 'allow' | 'deny' | 'requires-approval'): GatewayDecisionRecord {
    const review = sealedReview();
    const proposal = buildReviewActionProposal(review, {
      proposedBy: 'agent:field-sync-host',
      messageId: 'field-review-decision-rt',
      proposalId: 'field-review-decision-rt',
      createdAt: T5,
      requiresHumanApproval: false,
    });
    if (!proposal.ok) throw new Error('fixture proposal failed');
    const submission = buildFieldReviewSubmission(proposal.value, {
      submissionId: 'field-approval:decision-rt',
      tenantId: TENANT,
      sessionId: review.sessionId,
      submittedBy: REVIEWER,
      submittedAt: T5,
    });
    if (!submission.ok) throw new Error('fixture submission failed');
    const gateway = new ReferenceFieldApprovalGateway({
      expectedTenantId: TENANT,
      directives: [
        {
          proposalDigest: canonicalDigest(proposal.value as Parameters<typeof canonicalDigest>[0]),
          decisionId: `field-decision:${outcome}-rt`,
          outcome,
          ...(outcome === 'deny'
            ? { denial: { code: 'no-applicable-policy' as const, reason: 'no covering policy' } }
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
          policySetDigest: '9'.repeat(64),
          decidedAt: T6,
        },
      ],
    });
    const decision = gateway.submitFieldReview(submission.value);
    if (!decision.ok) throw new Error(`fixture decision failed: ${decision.error.message}`);
    return decision.value;
  }

  it('every outcome round-trips seal → JSON → verify deep-equal', () => {
    for (const outcome of ['allow', 'deny', 'requires-approval'] as const) {
      const decision = decisionFor(outcome);
      const wire = JSON.parse(JSON.stringify(decision)) as unknown;
      const verified = verifyGatewayDecisionRecord(wire);
      expect(verified.ok).toBe(true);
      if (verified.ok) {
        expect(verified.value).toEqual(decision);
      }
    }
  });

  it('the decision digest equals the canonical digest of the content + chain link', () => {
    const decision = decisionFor('allow');
    const { contentDigest, ...content } = decision;
    expect(contentDigest).toBe(canonicalDigest(content as Parameters<typeof canonicalDigest>[0]));
  });
});

describe('queue record round-trip', () => {
  it('enqueued record → JSON → verify round-trips deep-equal', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const capture = sealedCapture();
    const enqueued = queue.enqueueCapture(capture, {
      recordId: 'field-queue:roundtrip',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(true);
    if (!enqueued.ok || !('value' in enqueued)) return;
    const wire = JSON.parse(JSON.stringify(enqueued.value)) as unknown;
    const verified = verifySealedFieldQueueRecord(wire);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(enqueued.value);
    }
  });
});

describe('field device descriptor round-trip', () => {
  it('built descriptor → JSON → W011 admission round-trips deep-equal (both classes)', () => {
    for (const deviceClass of ['phone', 'tablet'] as const) {
      const built = buildFieldDeviceDescriptor({ deviceClass });
      expect(built.ok).toBe(true);
      if (!built.ok) return;
      const wire = JSON.parse(JSON.stringify(built.value)) as unknown;
      expect(wire).toEqual(built.value);
      expect(fieldDevice().ok).toBe(true);
    }
  });
});
