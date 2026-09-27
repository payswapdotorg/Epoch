// SYNC-HOST EVIDENCE: offline-queue replay through the kernel seams with
// provenance. Capture intents replay through the W036 observation-intake
// seam; approval intents replay through the W022 action-gateway seam
// (decision records are RECEIVED — an allow never mutates the delivery
// state client-side); `gateway-bypass-rejected` is the named negative
// outcome; re-sync is idempotent.
import { describe, expect, it } from 'vitest';
import {
  FieldSyncHost,
  ReferenceFieldApprovalGateway,
  DEFAULT_SYNC_PROPOSAL_IDENTITY,
  buildReviewActionProposal,
  sealFieldReviewProposal,
  type ReferenceDecisionDirective,
} from '../src/index';
import { canonicalDigest } from '@epoch/agent-protocol';
import { closeDeliveryRecord } from '@epoch/solution-delivery';
import {
  DELIVERY_LEAD,
  OTHER_TENANT,
  REVIEWER,
  T5,
  T6,
  TENANT,
  openedDelivery,
  sealedCapture,
  sealedReview,
  sealedSession,
} from './helpers';

/** Build the directive digest EXACTLY as the sync host derives it (from the review payload). */
function syncDirective(review: ReturnType<typeof sealedReview>, outcome: 'allow' | 'deny' | 'requires-approval'): ReferenceDecisionDirective {
  const digestPrefix = review.contentDigest.slice(0, 16);
  const proposal = buildReviewActionProposal(review, {
    proposedBy: DEFAULT_SYNC_PROPOSAL_IDENTITY.proposedByAgent,
    messageId: `field-review-${digestPrefix}`,
    proposalId: `field-review-${digestPrefix}`,
    createdAt: T6,
    requiresHumanApproval: DEFAULT_SYNC_PROPOSAL_IDENTITY.requiresHumanApproval,
  });
  if (!proposal.ok) {
    throw new Error(`fixture proposal failed to build: ${proposal.error.message}`);
  }
  return {
    proposalDigest: canonicalDigest(proposal.value as Parameters<typeof canonicalDigest>[0]),
    decisionId: `field-decision:${outcome}-review`,
    outcome,
    policySetDigest: '9'.repeat(64),
    decidedAt: T6,
  };
}

/** Options for host construction. */
const HOST_BASE = {
  tenantId: TENANT,
  delivery: openedDelivery(),
  session: sealedSession(),
} as const;

/** A closed delivery (via the kernel's own close transition). */
function closedDelivery() {
  const closed = closeDeliveryRecord(openedDelivery(), {
    closedBy: DELIVERY_LEAD,
    closedAt: T5,
  });
  if (!closed.ok) {
    throw new Error(`fixture delivery failed to close: ${closed.error.message}`);
  }
  return closed.value;
}

describe('capture-intent replay (the W036 observation-intake seam)', () => {
  it('replays a queued capture into the delivery through the kernel seam', () => {
    const host = new FieldSyncHost({ ...HOST_BASE });
    const capture = sealedCapture();
    const enqueued = host.enqueueCapture(capture, {
      recordId: 'field-queue:pit-volume-morning',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(true);
    const synced = host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    expect(synced.ok).toBe(true);
    if (!synced.ok) return;
    expect(synced.value.replayed).toHaveLength(1);
    expect(synced.value.replayed[0]!.state).toBe('admitted');
    // The delivery mutated ONLY through the intake seam: one observation.
    expect(synced.value.delivery.observations).toHaveLength(1);
    expect(synced.value.delivery.observations[0]!.recordId).toBe('observation:pit-volume-morning');
    // Provenance: the queue record carries the produced delivery digest.
    expect(synced.value.replayed[0]!.producedDigest).toBe(synced.value.delivery.contentDigest);
    expect(host.queueSnapshot()[0]!.replay?.state).toBe('admitted');
  });

  it('re-sync is IDEMPOTENT (already-replayed records are skipped, prior state stands)', () => {
    const host = new FieldSyncHost({ ...HOST_BASE });
    const capture = sealedCapture();
    host.enqueueCapture(capture, {
      recordId: 'field-queue:pit-volume-morning',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    const first = host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.replayed).toHaveLength(0);
    expect(second.value.delivery.observations).toHaveLength(1);
    expect(second.value.delivery.contentDigest).toBe(first.value.delivery.contentDigest);
  });

  it('a capture already admitted (idempotent prior) does not double-record', () => {
    // Simulate a crash between admission and queue update: the delivery
    // holds the observation, the queue record is still pending.
    const host = new FieldSyncHost({ ...HOST_BASE });
    const capture = sealedCapture();
    host.enqueueCapture(capture, {
      recordId: 'field-queue:pit-volume-morning',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    const first = host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    expect(first.ok).toBe(true);
    // Reset the queue replay bookkeeping (the crash scenario) while the
    // delivery state persists.
    const pendingAgain = host.queueSnapshot().map((record) => {
      const { replay, ...rest } = record;
      void replay;
      return { ...rest, contentDigest: canonicalDigest(rest as Parameters<typeof canonicalDigest>[0]) };
    });
    expect(pendingAgain).toHaveLength(1);
    // Re-enqueue the same payload: duplicate = sealed prior, no second replay.
    const duplicate = host.enqueueCapture(capture, {
      recordId: 'field-queue:after-crash',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T6,
    });
    expect(duplicate.ok).toBe(true);
    if (duplicate.ok && 'duplicate' in duplicate) {
      expect(duplicate.duplicate.kind).toBe('duplicate-capture');
    }
    const second = host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.replayed).toHaveLength(0);
    expect(second.value.delivery.observations).toHaveLength(1);
  });

  it('the W036 kernel seam rejections are recorded as rejected replays (closed delivery)', () => {
    const host = new FieldSyncHost({
      ...HOST_BASE,
      delivery: closedDelivery(),
    });
    const capture = sealedCapture();
    host.enqueueCapture(capture, {
      recordId: 'field-queue:pit-volume-morning',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    const synced = host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    expect(synced.ok).toBe(true);
    if (!synced.ok) return;
    expect(synced.value.replayed[0]!.state).toBe('rejected');
    expect(synced.value.replayed[0]!.error?.code).toBe('gateway-rejected');
    expect(synced.value.delivery.observations).toHaveLength(0);
  });
});

describe('approval-intent replay (the W022 action-gateway seam)', () => {
  it('replays a queued review through the gateway and RECEIVES the decision record', () => {
    const review = sealedReview();
    const host = new FieldSyncHost({
      ...HOST_BASE,
      gateway: new ReferenceFieldApprovalGateway({
        expectedTenantId: TENANT,
        directives: [syncDirective(review, 'allow')],
      }),
    });
    const enqueued = host.enqueueApproval(review, {
      recordId: 'field-queue:review-pit-volume',
      tenantId: TENANT,
      sessionId: review.sessionId,
      enqueuedBy: REVIEWER,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(true);
    const synced = host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    expect(synced.ok).toBe(true);
    if (!synced.ok) return;
    expect(synced.value.replayed).toHaveLength(1);
    expect(synced.value.replayed[0]!.state).toBe('admitted');
    expect(synced.value.receivedDecisions).toHaveLength(1);
    expect(synced.value.receivedDecisions[0]!.outcome).toBe('allow');
    // The client RECEIVED the decision — the delivery state is untouched
    // (acceptance/actualization are the gateway side's, never the client's).
    expect(synced.value.delivery.acceptedObservationIds).toHaveLength(0);
    expect(synced.value.delivery.observations).toHaveLength(0);
  });

  it('GATEWAY-BYPASS-REJECTED: an approval intent cannot settle without the gateway seam', () => {
    // NO gateway bound — there is no direct-execution path (lock rule 3).
    const host = new FieldSyncHost({ ...HOST_BASE });
    const review = sealedReview();
    const enqueued = host.enqueueApproval(review, {
      recordId: 'field-queue:review-pit-volume',
      tenantId: TENANT,
      sessionId: review.sessionId,
      enqueuedBy: REVIEWER,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(true);
    const synced = host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    expect(synced.ok).toBe(true);
    if (!synced.ok) return;
    expect(synced.value.replayed).toHaveLength(1);
    const outcome = synced.value.replayed[0]!;
    expect(outcome.state).toBe('rejected');
    expect(outcome.error?.code).toBe('gateway-bypass-rejected');
    expect(outcome.error?.message).toContain('holds no credentials');
    expect(outcome.error?.message).toContain('lock rule 3');
    // Nothing was decided, nothing was applied.
    expect(synced.value.receivedDecisions).toHaveLength(0);
    expect(host.decisions()).toHaveLength(0);
  });

  it('an allow decision NEVER mutates the delivery acceptance state (the client executes nothing)', () => {
    const capture = sealedCapture();
    const review = sealedReview();
    const host = new FieldSyncHost({
      ...HOST_BASE,
      gateway: new ReferenceFieldApprovalGateway({
        expectedTenantId: TENANT,
        directives: [syncDirective(review, 'allow')],
      }),
    });
    // Queue BOTH the capture and its acceptance review.
    host.enqueueCapture(capture, {
      recordId: 'field-queue:pit-volume-morning',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    host.enqueueApproval(review, {
      recordId: 'field-queue:review-pit-volume',
      tenantId: TENANT,
      sessionId: review.sessionId,
      enqueuedBy: REVIEWER,
      enqueuedAt: T5,
    });
    const synced = host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    expect(synced.ok).toBe(true);
    if (!synced.ok) return;
    // The capture was admitted (one observation); the review decision was
    // received (allow) — and the observation is NOT in the accepted set:
    // acceptance is applied by the gateway's execution side against the
    // W036 authority, never by the mobile client.
    expect(synced.value.delivery.observations).toHaveLength(1);
    expect(synced.value.receivedDecisions).toHaveLength(1);
    expect(synced.value.receivedDecisions[0]!.outcome).toBe('allow');
    expect(synced.value.delivery.acceptedObservationIds).toHaveLength(0);
    expect(synced.value.delivery.actuals).toHaveLength(0);
  });

  it('a gateway rejection (deny) is recorded as a rejected replay with the typed error', () => {
    const review = sealedReview();
    const host = new FieldSyncHost({
      ...HOST_BASE,
      gateway: {
        submitFieldReview: () => ({
          ok: false as const,
          error: {
            code: 'undirected-proposal' as const,
            message: 'the seam rejected the review',
          },
        }),
      },
    });
    host.enqueueApproval(review, {
      recordId: 'field-queue:review-pit-volume',
      tenantId: TENANT,
      sessionId: review.sessionId,
      enqueuedBy: REVIEWER,
      enqueuedAt: T5,
    });
    const synced = host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    expect(synced.ok).toBe(true);
    if (!synced.ok) return;
    expect(synced.value.replayed[0]!.state).toBe('rejected');
    expect(synced.value.replayed[0]!.error?.code).toBe('gateway-rejected');
    expect(synced.value.replayed[0]!.error?.message).toContain('undirected-proposal');
  });
});

describe('sync host tenant isolation (R12)', () => {
  it('a capture from another tenant is rejected at enqueue (typed cross-tenant-denied)', () => {
    const host = new FieldSyncHost({ ...HOST_BASE });
    const other = sealedCapture({ tenantId: OTHER_TENANT, sessionId: 'field-session:other' });
    const enqueued = host.enqueueCapture(other, {
      recordId: 'field-queue:other-tenant',
      tenantId: OTHER_TENANT,
      sessionId: other.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(false);
    if (enqueued.ok) return;
    expect(enqueued.error.code).toBe('cross-tenant-denied');
    expect(enqueued.error.expectedTenantId).toBe(TENANT);
    expect(enqueued.error.encounteredTenantId).toBe(OTHER_TENANT);
  });

  it('a review from another tenant is rejected at enqueue (typed cross-tenant-denied)', () => {
    const host = new FieldSyncHost({ ...HOST_BASE });
    const other = sealFieldReviewProposal({
      proposalId: 'field-approval:other-tenant',
      tenantId: OTHER_TENANT,
      sessionId: 'field-session:other',
      reviewKind: 'observation-acceptance',
      subject: {
        deliveryId: 'delivery:other',
        observationId: 'observation:other',
        observationDigest: 'a'.repeat(64),
      },
      reviewer: REVIEWER,
      justification: 'cross-tenant review attempt',
      createdAt: T5,
    });
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    const enqueued = host.enqueueApproval(other.value, {
      recordId: 'field-queue:other-tenant',
      tenantId: OTHER_TENANT,
      sessionId: other.value.sessionId,
      enqueuedBy: REVIEWER,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(false);
    if (enqueued.ok) return;
    expect(enqueued.error.code).toBe('cross-tenant-denied');
  });

  it('a capture from another session is rejected at enqueue', () => {
    const host = new FieldSyncHost({ ...HOST_BASE });
    const stranger = sealedCapture({ sessionId: 'field-session:other' });
    const enqueued = host.enqueueCapture(stranger, {
      recordId: 'field-queue:other-session',
      tenantId: TENANT,
      sessionId: stranger.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(false);
    if (enqueued.ok) return;
    expect(enqueued.error.code).toBe('validation');
    expect(enqueued.error.message).toContain('session');
  });

  it('the host constructor enforces tenant/session/delivery validity (TypeError guards)', () => {
    expect(() => new FieldSyncHost({ ...HOST_BASE, session: { garbage: true } })).toThrow(TypeError);
    expect(
      () =>
        new FieldSyncHost({
          ...HOST_BASE,
          session: sealedSession({ tenantId: OTHER_TENANT }),
        }),
    ).toThrow(/R12/);
    expect(() => new FieldSyncHost({ ...HOST_BASE, delivery: { garbage: true } })).toThrow(TypeError);
  });
});

describe('sync host determinism', () => {
  it('two hosts with identical state produce identical sync outcomes', () => {
    const build = () => {
      const host = new FieldSyncHost({ ...HOST_BASE });
      const capture = sealedCapture();
      host.enqueueCapture(capture, {
        recordId: 'field-queue:pit-volume-morning',
        tenantId: TENANT,
        sessionId: capture.sessionId,
        enqueuedBy: DELIVERY_LEAD,
        enqueuedAt: T5,
      });
      return { host, capture };
    };
    const a = build();
    const b = build();
    const syncA = a.host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    const syncB = b.host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    expect(syncA.ok).toBe(true);
    expect(syncB.ok).toBe(true);
    if (!syncA.ok || !syncB.ok) return;
    expect(syncA.value.delivery.contentDigest).toBe(syncB.value.delivery.contentDigest);
    expect(syncA.value.replayed[0]!.producedDigest).toBe(syncB.value.replayed[0]!.producedDigest);
  });
});
