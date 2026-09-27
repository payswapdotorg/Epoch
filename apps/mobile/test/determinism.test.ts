// DETERMINISM EVIDENCE: same inputs → same digests, everywhere. Captures,
// reviews, sessions, queue dedup keys, W003 proposal projections, sync
// outcomes; plus key-order irrelevance of every content digest and the
// offline-queue replay idempotency (duplicate = sealed prior).
import { describe, expect, it } from 'vitest';
import {
  FieldSyncHost,
  buildReviewActionProposal,
  openFieldSession,
  buildFieldDeviceDescriptor,
  type SealedFieldCapture,
} from '../src/index';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  DELIVERY_LEAD,
  T5,
  T6,
  TENANT,
  captureInput,
  fieldDevice,
  openedDelivery,
  reviewInput,
  sealedSession,
  sealLooseCapture,
  sealLooseReview,
} from './helpers';

describe('capture determinism', () => {
  it('identical capture inputs produce identical sealed digests', () => {
    const first = sealLooseCapture(captureInput());
    const second = sealLooseCapture(captureInput());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.contentDigest).toBe(second.value.contentDigest);
    expect(first.value).toEqual(second.value);
  });

  it('a single differing field produces a different digest (capture sensitivity)', () => {
    const first = sealLooseCapture(captureInput());
    const second = sealLooseCapture({
      ...captureInput(),
      measure: { kind: 'quantity', value: '120', unit: 'm3' },
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.contentDigest).not.toBe(second.value.contentDigest);
  });

  it('key-order irrelevance: reversed input keys seal identically', () => {
    const input = captureInput();
    const reversed: Record<string, unknown> = {};
    for (const key of Object.keys(input).reverse()) {
      reversed[key] = (input as Record<string, unknown>)[key];
    }
    const a = sealLooseCapture(input);
    const b = sealLooseCapture(reversed);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.value.contentDigest).toBe(b.value.contentDigest);
  });

  it('canonical JSON digests agree with the sealed digests (the shared machinery)', () => {
    const sealed = sealLooseCapture(captureInput());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const { contentDigest, ...content } = sealed.value;
    expect(contentDigest).toBe(canonicalDigest(content as Parameters<typeof canonicalDigest>[0]));
  });
});

describe('review proposal determinism', () => {
  it('identical review inputs produce identical sealed digests', () => {
    const first = sealLooseReview(reviewInput());
    const second = sealLooseReview(reviewInput());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.contentDigest).toBe(second.value.contentDigest);
  });
});

describe('session determinism', () => {
  it('identical session inputs produce identical sealed digests', () => {
    const device = fieldDevice();
    if (!device.ok) throw new Error('fixture device failed');
    const first = openFieldSession({
      sessionId: 'field-session:shift-alpha',
      tenantId: TENANT,
      device: device.value,
      solutionId: 'solution:tower-retrofit',
      deliveryId: 'delivery:tower-retrofit-v1',
      openedBy: 'principal:field-engineer',
      openedAt: '2026-03-02T08:00:00.000Z',
    });
    const second = openFieldSession({
      sessionId: 'field-session:shift-alpha',
      tenantId: TENANT,
      device: device.value,
      solutionId: 'solution:tower-retrofit',
      deliveryId: 'delivery:tower-retrofit-v1',
      openedBy: 'principal:field-engineer',
      openedAt: '2026-03-02T08:00:00.000Z',
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.contentDigest).toBe(second.value.contentDigest);
  });
});

describe('W003 proposal projection determinism', () => {
  it('identical projection options produce identical W003 proposals (same digest)', () => {
    const review = sealLooseReview(reviewInput());
    if (!review.ok) throw new Error('fixture review failed');
    const build = () =>
      buildReviewActionProposal(review.value, {
        proposedBy: 'agent:field-sync-host',
        messageId: 'field-review-det',
        proposalId: 'field-review-det',
        createdAt: T5,
        requiresHumanApproval: false,
      });
    const first = build();
    const second = build();
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value).toEqual(second.value);
    expect(canonicalDigest(first.value as Parameters<typeof canonicalDigest>[0])).toBe(
      canonicalDigest(second.value as Parameters<typeof canonicalDigest>[0]),
    );
  });
});

describe('offline-queue replay idempotency (determinism across sync sweeps)', () => {
  it('replaying the same queue twice produces the same final state (duplicate = sealed prior)', () => {
    const build = (): { host: FieldSyncHost; capture: SealedFieldCapture } => {
      const host = new FieldSyncHost({
        tenantId: TENANT,
        delivery: openedDelivery(),
        session: sealedSession(),
      });
      const capture = sealLooseCapture(captureInput());
      if (!capture.ok) throw new Error('fixture capture failed');
      const enqueued = host.enqueueCapture(capture.value, {
        recordId: 'field-queue:det',
        tenantId: TENANT,
        sessionId: capture.value.sessionId,
        enqueuedBy: DELIVERY_LEAD,
        enqueuedAt: T5,
      });
      if (!enqueued.ok) throw new Error('fixture enqueue failed');
      return { host, capture: capture.value };
    };
    const a = build();
    const b = build();
    const syncA = a.host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    const syncB = b.host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    expect(syncA.ok).toBe(true);
    expect(syncB.ok).toBe(true);
    if (!syncA.ok || !syncB.ok) return;
    expect(syncA.value.delivery.contentDigest).toBe(syncB.value.delivery.contentDigest);
    // A second sweep over the SAME host is a no-op (idempotent).
    const again = a.host.syncQueue({ at: T6, performedBy: DELIVERY_LEAD });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.replayed).toHaveLength(0);
    expect(again.value.delivery.contentDigest).toBe(syncA.value.delivery.contentDigest);
  });
});

describe('device descriptor determinism', () => {
  it('identical descriptor options produce identical descriptors (and therefore identical digests)', () => {
    const first = buildFieldDeviceDescriptor({ deviceClass: 'tablet' });
    const second = buildFieldDeviceDescriptor({ deviceClass: 'tablet' });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value).toEqual(second.value);
    expect(
      canonicalDigest(first.value as Parameters<typeof canonicalDigest>[0]),
    ).toBe(canonicalDigest(second.value as Parameters<typeof canonicalDigest>[0]));
  });

  it('modality input order never leaks into the descriptor (sorted set semantics)', () => {
    const first = buildFieldDeviceDescriptor({ interaction: ['voice', 'touch'] });
    const second = buildFieldDeviceDescriptor({ interaction: ['touch', 'voice'] });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value).toEqual(second.value);
  });
});

describe('zero wall-clock / zero randomness (source discipline)', () => {
  it('no Date/Math.random usage in src (determinism by construction)', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const srcDir = path.join(import.meta.dirname, '..', 'src');
    const walk = (dir: string): string[] => {
      const files: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...walk(full));
        else if (entry.name.endsWith('.ts')) files.push(full);
      }
      return files;
    };
    for (const file of walk(srcDir)) {
      const source = readFileSync(file, 'utf8');
      expect(source.includes('Date.now'), `${file}: Date.now is forbidden (caller-supplied instants)`).toBe(false);
      expect(source.includes('new Date('), `${file}: wall-clock Date construction is forbidden`).toBe(false);
      expect(source.includes('Math.random'), `${file}: Math.random is forbidden`).toBe(false);
    }
  });
});
