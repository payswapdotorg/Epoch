// Total admission of serialized documents: version gates, digest
// verification, snapshot ordering/projection consistency — and the
// tampered-snapshot negatives.
import { describe, expect, it } from 'vitest';
import { EventLog, parseEventLogSnapshot, parseEventRecord, sealEvent } from '../src/index';
import { appended, firstEvent, logWithThreeEvents, secondEvent } from './helpers';

describe('parseEventRecord', () => {
  it('admits a stored record unchanged', () => {
    const log = logWithThreeEvents();
    const snapshot = log.snapshot();
    const record = JSON.parse(JSON.stringify(snapshot.records[0]));
    const parsed = parseEventRecord(record);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.contentDigest).toBe(record.contentDigest);
    }
  });

  it('rejects a tampered record (payload mutated after the fact)', () => {
    const log = logWithThreeEvents();
    const record = JSON.parse(
      JSON.stringify(log.snapshot().records[0]),
    ) as Record<string, unknown>;
    const event = record.event as Record<string, unknown>;
    event.occurredAt = '2026-12-31T23:59:59.999Z'; // mutated content
    const parsed = parseEventRecord(record);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('digest-mismatch');
    }
  });

  it('rejects version skew with a typed error', () => {
    const log = logWithThreeEvents();
    const record = JSON.parse(
      JSON.stringify(log.snapshot().records[0]),
    ) as Record<string, unknown>;
    record.schemaVersion = 2;
    const parsed = parseEventRecord(record);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('version-unsupported');
    }
  });

  it('rejects a non-object root with a typed validation error', () => {
    const parsed = parseEventRecord('not-an-object');
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('validation');
    }
  });
});

describe('parseEventLogSnapshot', () => {
  it('admits a canonical snapshot unchanged', () => {
    const snapshot = logWithThreeEvents().snapshot();
    const parsed = parseEventLogSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(parsed.ok).toBe(true);
  });

  it('rejects records that are not canonically sorted', () => {
    const log = logWithThreeEvents();
    const snapshot = JSON.parse(JSON.stringify(log.snapshot()));
    // Reverse the record order: same records, wrong canonical order.
    snapshot.records.reverse();
    const parsed = parseEventLogSnapshot(snapshot);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('validation');
      if (parsed.error.code === 'validation') {
        expect(JSON.stringify(parsed.error.issues)).toContain('expected a coordinate after');
      }
    }
  });

  it('rejects a snapshot with a duplicated record coordinate', () => {
    const log = new EventLog();
    appended(log, firstEvent());
    appended(log, secondEvent());
    const snapshot = JSON.parse(JSON.stringify(log.snapshot()));
    snapshot.records.push(JSON.parse(JSON.stringify(snapshot.records[0])));
    const parsed = parseEventLogSnapshot(snapshot);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('validation');
      if (parsed.error.code === 'validation') {
        expect(JSON.stringify(parsed.error.issues)).toContain('already appeared');
      }
    }
  });

  it('rejects a stream projection inconsistent with the records', () => {
    const log = logWithThreeEvents();
    const snapshot = JSON.parse(JSON.stringify(log.snapshot()));
    snapshot.streams[0].eventCount = 99;
    const parsed = parseEventLogSnapshot(snapshot);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('validation');
    }
  });

  it('rejects a stream whose events cross tenants', () => {
    const log = new EventLog();
    appended(log, firstEvent()); // tenant:acme
    const snapshot = JSON.parse(JSON.stringify(log.snapshot()));
    const sneaky = JSON.parse(JSON.stringify(snapshot.records[0]));
    sneaky.event.sequence = 2;
    sneaky.event.tenantId = 'tenant:globex';
    // Recompute a digest so only the tenant inconsistency remains.
    const resealed = sealEvent(sneaky.event);
    if (!resealed.ok) throw new Error('fixture must seal');
    sneaky.contentDigest = resealed.value.digest;
    snapshot.records.push(sneaky);
    const parsed = parseEventLogSnapshot(snapshot);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('cross-tenant-denied');
    }
  });

  it('restore refuses a snapshot whose record fails the sequence discipline', () => {
    const log = logWithThreeEvents();
    const snapshot = JSON.parse(JSON.stringify(log.snapshot()));
    // Drop the middle record: sequence gap on restore.
    snapshot.records.splice(1, 1);
    const restored = EventLog.fromSnapshot(snapshot);
    expect(restored.ok).toBe(false);
    if (!restored.ok) {
      expect(restored.error.code).toBe('sequence-gap');
    }
  });
});
