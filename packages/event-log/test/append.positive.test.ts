// Positive round-trips of the append machinery: the pinned envelope
// admits, digests, reads back, and snapshots deterministically.
import { describe, expect, it } from 'vitest';
import {
  computeEventDigest,
  EventLog,
  eventRecordFor,
  parseEventRecord,
  sealEvent,
} from '../src/index';
import { appended, firstEvent, logWithThreeEvents, secondEvent } from './helpers';

describe('event-log append (positive)', () => {
  it('admits a valid first event and returns the stored record', () => {
    const log = new EventLog();
    const record = appended(log, firstEvent());
    expect(record.event.sequence).toBe(1);
    expect(record.event.streamId).toBe('stream:world-a');
    expect(record.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(log.size).toBe(1);
    expect(log.streamCount).toBe(1);
  });

  it('admits a causally-parented follow-up event', () => {
    const log = new EventLog();
    appended(log, firstEvent());
    const second = appended(log, secondEvent());
    expect(second.event.causalParent).toEqual({
      streamId: 'stream:world-a',
      sequence: 1,
    });
    expect(log.size).toBe(2);
  });

  it('admits an action-derived event (action lifecycle payload contract)', () => {
    const log = logWithThreeEvents();
    const records = log.readStream('stream:world-a');
    if (!records.ok) throw new Error(records.error.message);
    expect(records.value).toHaveLength(3);
    expect(records.value[2]?.event.payload.discriminator).toBe('action:lifecycle');
  });

  it('sealing is canonical: key order does not affect the digest', () => {
    const a = sealEvent(firstEvent());
    const reordered = firstEvent();
    // Reorder every object level: envelope fields, causal null, payload.
    const envelope = reordered as Record<string, unknown>;
    const reorderedEnvelope: Record<string, unknown> = {
      occurredAt: envelope.occurredAt,
      payload: envelope.payload,
      causalParent: envelope.causalParent,
      actor: envelope.actor,
      tenantId: envelope.tenantId,
      sequence: envelope.sequence,
      streamId: envelope.streamId,
      schemaVersion: envelope.schemaVersion,
    };
    const b = sealEvent(reorderedEnvelope);
    if (!a.ok || !b.ok) throw new Error('fixture events must seal');
    expect(a.value.digest).toBe(b.value.digest);
    expect(computeEventDigest(a.value.event)).toBe(a.value.digest);
  });

  it('record round-trip: parseEventRecord accepts the stored record', () => {
    const sealed = sealEvent(firstEvent());
    if (!sealed.ok) throw new Error('fixture must seal');
    const record = eventRecordFor(sealed.value.event);
    const parsed = parseEventRecord(record);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.contentDigest).toBe(record.contentDigest);
    }
  });

  it('snapshot -> restore -> snapshot is a byte-identical round-trip', () => {
    const log = logWithThreeEvents();
    const snapshot = log.snapshot();
    const restored = EventLog.fromSnapshot(snapshot);
    if (!restored.ok) throw new Error(restored.error.message);
    expect(restored.value.snapshot()).toEqual(snapshot);
    expect(restored.value.size).toBe(3);
  });

  it('snapshots are append-order independent (no insertion-order leaks)', () => {
    // Two logs whose appends interleave stream creation differently.
    const logA = new EventLog();
    appended(logA, firstEvent()); // stream:world-a first
    appended(logA, secondEvent());
    const logB = new EventLog();
    // Different stream first, then back: insertion orders differ.
    appended(logB, firstEvent({ streamId: 'stream:world-b', payload: {
      discriminator: 'acme:note',
      data: {},
    } }));
    appended(logB, firstEvent());
    appended(logB, secondEvent());
    const snapshotA = logA.snapshot();
    const snapshotB = logB.snapshot();
    // logB has an extra stream; compare only the shared stream's records.
    const aRecords = snapshotA.records;
    const bRecords = snapshotB.records.filter(
      (record) => record.event.streamId === 'stream:world-a',
    );
    expect(bRecords).toEqual(aRecords);
    // Stream listing is sorted regardless of insertion order.
    expect(logB.listStreams().map((stream) => stream.streamId)).toEqual([
      'stream:world-a',
      'stream:world-b',
    ]);
  });
});
