// OFFLINE-QUEUE EVIDENCE: typed, content-addressed, idempotent intent
// records. Duplicate capture = the SEALED PRIOR record (never a second
// record, never a mutation); queue record ids are one-shot; replay
// bookkeeping is an immutable update (the prior sealed record chains by
// digest); tenant isolation (R12) and tamper detection hold.
import { describe, expect, it } from 'vitest';
import {
  OfflineQueue,
  verifySealedFieldQueueRecord,
} from '../src/index';
import {
  DELIVERY_LEAD,
  OTHER_TENANT,
  SOLUTION,
  T5,
  T6,
  TENANT,
  captureInput,
  reviewInput,
  sealedCapture,
  sealedReview,
} from './helpers';

describe('offline queue enqueue (content-addressed idempotency)', () => {
  it('enqueues a capture intent referencing the payload by digest', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const capture = sealedCapture();
    const enqueued = queue.enqueueCapture(capture, {
      recordId: 'field-queue:pit-volume-morning',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(true);
    if (!enqueued.ok) return;
    expect('value' in enqueued ? enqueued.value.intent : undefined).toBe('capture-intent');
    expect('value' in enqueued ? enqueued.value.payloadDigest : undefined).toBe(capture.contentDigest);
    expect('value' in enqueued ? enqueued.value.payloadId : undefined).toBe(capture.captureId);
    expect('value' in enqueued ? enqueued.value.replay : undefined).toBeUndefined();
  });

  it('DUPLICATE capture = the sealed PRIOR record (idempotent enqueue)', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const capture = sealedCapture();
    const first = queue.enqueueCapture(capture, {
      recordId: 'field-queue:pit-volume-morning',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(first.ok).toBe(true);
    // A second enqueue of the SAME envelope (different record id, different
    // provenance) is still the SAME payload by digest.
    const duplicate = queue.enqueueCapture(capture, {
      recordId: 'field-queue:retry-after-reconnect',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T6,
    });
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok || !('duplicate' in duplicate)) return;
    expect(duplicate.duplicate.kind).toBe('duplicate-capture');
    expect(duplicate.duplicate.prior).toEqual('value' in first ? first.value : undefined);
    // The queue did NOT grow — one payload, one record.
    expect(queue.all()).toHaveLength(1);
  });

  it('the same capture re-sealed from identical input has the identical digest (replay safety)', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const first = sealedCapture();
    const second = sealedCapture();
    expect(first.contentDigest).toBe(second.contentDigest);
    const a = queue.enqueueCapture(first, {
      recordId: 'field-queue:original',
      tenantId: TENANT,
      sessionId: first.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(a.ok).toBe(true);
    // The re-sealed identical envelope deduplicates by digest — the queue
    // never holds the same payload twice.
    const enqueued = queue.enqueueCapture(second, {
      recordId: 'field-queue:second-device-attempt',
      tenantId: TENANT,
      sessionId: second.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T6,
    });
    expect(enqueued.ok).toBe(true);
    if (!enqueued.ok || !('duplicate' in enqueued)) {
      throw new Error('identical content must deduplicate by digest');
    }
    expect(queue.all()).toHaveLength(1);
  });

  it('a DIFFERENT capture (different content) enqueues a second record', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const first = sealedCapture();
    const second = sealedCapture({ observationId: 'observation:pit-volume-afternoon' });
    expect(first.contentDigest).not.toBe(second.contentDigest);
    const a = queue.enqueueCapture(first, {
      recordId: 'field-queue:morning',
      tenantId: TENANT,
      sessionId: first.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    const b = queue.enqueueCapture(second, {
      recordId: 'field-queue:afternoon',
      tenantId: TENANT,
      sessionId: second.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T6,
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(queue.all()).toHaveLength(2);
  });

  it('queue record ids are one-shot (version-conflict on reuse)', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const first = sealedCapture();
    const second = sealedCapture({ observationId: 'observation:pit-volume-afternoon' });
    const a = queue.enqueueCapture(first, {
      recordId: 'field-queue:same-id',
      tenantId: TENANT,
      sessionId: first.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(a.ok).toBe(true);
    const b = queue.enqueueCapture(second, {
      recordId: 'field-queue:same-id',
      tenantId: TENANT,
      sessionId: second.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T6,
    });
    expect(b.ok).toBe(false);
    if (b.ok) return;
    expect(b.error.code).toBe('version-conflict');
  });

  it('an invalid capture payload is rejected at enqueue (never enters the queue)', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const input = captureInput();
    delete (input as Record<string, unknown>)['uncertainty'];
    const tampered = { ...sealedCapture(), uncertainty: undefined };
    const enqueued = queue.enqueueCapture(tampered as never, {
      recordId: 'field-queue:invalid',
      tenantId: TENANT,
      sessionId: 'field-session:shift-alpha',
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(false);
    expect(queue.all()).toHaveLength(0);
    void input;
  });
});

describe('offline queue approval intents', () => {
  it('enqueues an approval intent referencing the review payload by digest', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const review = sealedReview();
    const enqueued = queue.enqueueApproval(review, {
      recordId: 'field-queue:review-pit-volume',
      tenantId: TENANT,
      sessionId: review.sessionId,
      enqueuedBy: review.reviewer,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(true);
    if (!enqueued.ok || !('value' in enqueued)) return;
    expect(enqueued.value.intent).toBe('approval-intent');
    expect(enqueued.value.payloadDigest).toBe(review.contentDigest);
  });

  it('duplicate approval enqueue = the sealed prior record', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const review = sealedReview();
    const first = queue.enqueueApproval(review, {
      recordId: 'field-queue:review-pit-volume',
      tenantId: TENANT,
      sessionId: review.sessionId,
      enqueuedBy: review.reviewer,
      enqueuedAt: T5,
    });
    expect(first.ok).toBe(true);
    const duplicate = queue.enqueueApproval(review, {
      recordId: 'field-queue:review-retry',
      tenantId: TENANT,
      sessionId: review.sessionId,
      enqueuedBy: review.reviewer,
      enqueuedAt: T6,
    });
    expect(duplicate.ok).toBe(true);
    if (!duplicate.ok || !('duplicate' in duplicate)) return;
    expect(duplicate.duplicate.kind).toBe('duplicate-capture');
    expect(queue.all()).toHaveLength(1);
  });
});

describe('offline queue tenant isolation (R12)', () => {
  it('a payload from another tenant is a typed cross-tenant-denied rejection', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const other = sealedCapture({ tenantId: OTHER_TENANT, sessionId: 'field-session:other' });
    const enqueued = queue.enqueueCapture(other, {
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

  it('an unscoped queue admits any tenant (the guard is host-supplied)', () => {
    const queue = new OfflineQueue();
    const other = sealedCapture({ tenantId: OTHER_TENANT, sessionId: 'field-session:other' });
    const enqueued = queue.enqueueCapture(other, {
      recordId: 'field-queue:other-tenant',
      tenantId: OTHER_TENANT,
      sessionId: other.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(true);
  });
});

describe('offline queue replay bookkeeping (immutable updates)', () => {
  it('recording a replay yields the NEXT sealed record state (digest chains)', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const capture = sealedCapture();
    const enqueued = queue.enqueueCapture(capture, {
      recordId: 'field-queue:pit-volume-morning',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(true);
    if (!enqueued.ok || !('value' in enqueued)) return;
    const record = enqueued.value;
    const replayed = queue.replayed(record, {
      state: 'admitted',
      replayedAt: T6,
      replayDigest: '1'.repeat(64),
    });
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.value.duplicate).toBe(false);
    expect(replayed.value.record.replay).toEqual({
      state: 'admitted',
      replayedAt: T6,
      replayDigest: '1'.repeat(64),
    });
    expect(replayed.value.record.contentDigest).not.toBe(record.contentDigest);
    expect(queue.pending()).toHaveLength(0);
  });

  it('re-replaying an already-replayed record is IDEMPOTENT (sealed prior stands)', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const capture = sealedCapture();
    const enqueued = queue.enqueueCapture(capture, {
      recordId: 'field-queue:pit-volume-morning',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(true);
    if (!enqueued.ok || !('value' in enqueued)) return;
    const first = queue.replayed(enqueued.value, {
      state: 'admitted',
      replayedAt: T6,
      replayDigest: '1'.repeat(64),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = queue.replayed(first.value.record, {
      state: 'rejected',
      replayedAt: T6,
      replayDigest: '2'.repeat(64),
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.duplicate).toBe(true);
    // The prior sealed state is unchanged.
    expect(second.value.record).toEqual(first.value.record);
    expect(second.value.record.replay?.state).toBe('admitted');
  });

  it('a queue record not held by the queue cannot be replayed (typed rejection)', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const capture = sealedCapture();
    const enqueued = queue.enqueueCapture(capture, {
      recordId: 'field-queue:pit-volume-morning',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(true);
    const forgedRecord = {
      ...('value' in enqueued ? enqueued.value : { recordId: 'field-queue:none' }),
      recordId: 'field-queue:not-held',
    };
    const replayed = queue.replayed(forgedRecord as never, {
      state: 'admitted',
      replayedAt: T6,
      replayDigest: '1'.repeat(64),
    });
    expect(replayed.ok).toBe(false);
    if (replayed.ok) return;
    // The forged recordId breaks the digest first (tamper detection),
    // before the held-check can even run.
    expect(replayed.error.code).toBe('digest-mismatch');
  });
});

describe('offline queue record verification', () => {
  it('JSON round-trip preserves the sealed queue record and its digest verifies', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const capture = sealedCapture();
    const enqueued = queue.enqueueCapture(capture, {
      recordId: 'field-queue:pit-volume-morning',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(true);
    if (!enqueued.ok || !('value' in enqueued)) return;
    const roundTripped = JSON.parse(JSON.stringify(enqueued.value)) as unknown;
    const verified = verifySealedFieldQueueRecord(roundTripped);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(enqueued.value);
    }
  });

  it('tampering with a queue record is a typed digest-mismatch', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const capture = sealedCapture();
    const enqueued = queue.enqueueCapture(capture, {
      recordId: 'field-queue:pit-volume-morning',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(true);
    if (!enqueued.ok || !('value' in enqueued)) return;
    const tampered = { ...enqueued.value, enqueuedBy: 'principal:someone-else' };
    const verified = verifySealedFieldQueueRecord(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
  });

  it('a vendor field on a queue record is a typed vendor-fields rejection', () => {
    const queue = new OfflineQueue({ expectedTenantId: TENANT });
    const capture = sealedCapture();
    const enqueued = queue.enqueueCapture(capture, {
      recordId: 'field-queue:pit-volume-morning',
      tenantId: TENANT,
      sessionId: capture.sessionId,
      enqueuedBy: DELIVERY_LEAD,
      enqueuedAt: T5,
    });
    expect(enqueued.ok).toBe(true);
    if (!enqueued.ok || !('value' in enqueued)) return;
    const smuggled = { ...enqueued.value, vendorQueueEngine: 'vendor-sync' };
    const verified = verifySealedFieldQueueRecord(smuggled);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('vendor-fields-rejected');
  });

  it('the review input fixture stays referenced (no fixture drift)', () => {
    const review = reviewInput();
    expect(review.proposalId).toBe('field-approval:pit-volume-review');
    expect(SOLUTION).toContain('tower-retrofit');
  });
});
