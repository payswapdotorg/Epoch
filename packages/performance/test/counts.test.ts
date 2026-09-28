// W034 — operation counters: hub tallies, deterministic snapshots,
// count-record sealing, tamper detection, round trips.
import { describe, expect, it } from 'vitest';
import {
  createCounterHub,
  emptyCounts,
  sumCounts,
  countsDigestOf,
  countsJson,
  sealMeasuredCounts,
  verifySealedMeasuredCounts,
  serializeMeasuredCounts,
  deserializeMeasuredCounts,
  type SealedMeasuredCounts,
  type OperationCounts,
} from '../src/index';
import { expectError, ok } from './helpers';

const TENANT = 'tenant:globex';

function mustSeal(counts: OperationCounts, overrides: Record<string, unknown> = {}): SealedMeasuredCounts {
  return ok(
    sealMeasuredCounts({
      schema: 'epoch.performance.counts',
      schemaVersion: 1,
      tenantId: TENANT,
      countsId: 'counts:counts-test',
      subject: 'counts-test-subject',
      workloadId: 'workload:counts-test',
      workloadDigest: 'a'.repeat(64),
      counts,
      measuredBy: 'principal:platform-engineer',
      provenance: { kind: 'observed', sourceRef: 'test:counts' },
      ...overrides,
    }),
    'seal counts',
  );
}

describe('the counting hub (deterministic tallies)', () => {
  it('starts zeroed over the closed operation-class vocabulary', () => {
    const hub = createCounterHub();
    const snapshot = hub.snapshot();
    expect(snapshot['kernel-admission']).toBe(0);
    expect(snapshot['kernel-fold']).toBe(0);
    expect(snapshot['projection-compute']).toBe(0);
    expect(snapshot['digest-compute']).toBe(0);
    expect(snapshot['harness-scenario']).toBe(0);
    expect(emptyCounts()['kernel-fold']).toBe(0);
  });

  it('accumulates per class and supports multi-unit tallies', () => {
    const hub = createCounterHub();
    hub.tally('kernel-admission');
    hub.tally('kernel-admission');
    hub.tally('kernel-fold', 32);
    hub.tally('projection-compute', 7);
    hub.tally('harness-scenario', 4);
    const snapshot = hub.snapshot();
    expect(snapshot['kernel-admission']).toBe(2);
    expect(snapshot['kernel-fold']).toBe(32);
    expect(snapshot['projection-compute']).toBe(7);
    expect(snapshot['harness-scenario']).toBe(4);
  });

  it('rejects non-positive units loudly (contract misuse)', () => {
    const hub = createCounterHub();
    expect(() => hub.tally('kernel-fold', 0)).toThrow(RangeError);
    expect(() => hub.tally('kernel-fold', -1)).toThrow(RangeError);
  });

  it('identical tally sequences derive identical snapshots and digests', () => {
    const runA = createCounterHub();
    const runB = createCounterHub();
    for (const hub of [runA, runB]) {
      hub.tally('kernel-admission', 3);
      hub.tally('kernel-fold', 10);
      hub.tally('digest-compute', 5);
    }
    expect(JSON.stringify(runA.snapshot())).toBe(JSON.stringify(runB.snapshot()));
    expect(runA.snapshotDigest()).toBe(runB.snapshotDigest());
  });

  it('snapshots are frozen (mutation attempts fail closed)', () => {
    const hub = createCounterHub();
    hub.tally('kernel-fold', 2);
    const snapshot = hub.snapshot() as unknown as Record<string, number>;
    expect(() => {
      snapshot['kernel-fold'] = 999;
    }).toThrow();
    expect(hub.snapshot()['kernel-fold']).toBe(2);
  });

  it('sumCounts folds maps component-wise (input order never leaks)', () => {
    const a: OperationCounts = { ...emptyCounts(), 'kernel-fold': 3, 'digest-compute': 1 };
    const b: OperationCounts = { ...emptyCounts(), 'kernel-fold': 4, 'harness-scenario': 9 };
    const sum = sumCounts(a, b);
    expect(sum['kernel-fold']).toBe(7);
    expect(sum['digest-compute']).toBe(1);
    expect(sum['harness-scenario']).toBe(9);
    expect(JSON.stringify(sumCounts(b, a))).toBe(JSON.stringify(sum));
  });

  it('count-map digests are canonical (key order never leaks)', () => {
    const one: OperationCounts = { ...emptyCounts(), 'kernel-fold': 5, 'kernel-admission': 2 };
    const two: OperationCounts = { 'kernel-admission': 2, 'kernel-fold': 5, 'projection-compute': 0, 'digest-compute': 0, 'harness-scenario': 0 };
    expect(countsJson(one)).toEqual(countsJson(two));
    expect(countsDigestOf(one)).toBe(countsDigestOf(two));
  });
});

describe('measured-counts records (sealed, content-addressed)', () => {
  const counts: OperationCounts = { ...emptyCounts(), 'kernel-fold': 42, 'digest-compute': 17 };

  it('seal + verify round-trips the exact counts', () => {
    const sealed = mustSeal(counts);
    const verified = ok(verifySealedMeasuredCounts(sealed), 'verify counts');
    expect(verified.counts['kernel-fold']).toBe(42);
    expect(verified.counts['digest-compute']).toBe(17);
  });

  it('verify detects a tampered count (digest mismatch)', () => {
    const sealed = mustSeal(counts);
    const tampered = { ...sealed, counts: { ...sealed.counts, 'kernel-fold': 43 } };
    const error = expectError(verifySealedMeasuredCounts(tampered), 'verify tampered counts');
    expect(error.code).toBe('digest-mismatch');
    expect(String(error.expected)).not.toBe(String(error.encountered));
  });

  it('rejects malformed counts content with flattened issues', () => {
    const bad = expectError(
      sealMeasuredCounts({
        schema: 'epoch.performance.counts',
        schemaVersion: 1,
        tenantId: TENANT,
        countsId: 'counts:bad',
        subject: 'counts-test-subject',
        workloadId: 'workload:counts-test',
        workloadDigest: 'a'.repeat(64),
        counts: { ...counts, 'kernel-fold': -3 },
        measuredBy: 'principal:platform-engineer',
        provenance: { kind: 'observed' },
      }),
      'seal bad counts',
    );
    expect(bad.code).toBe('performance-invalid');
    expect(
      (bad.issues as { path: string }[]).some((issue) => issue.path.includes('kernel-fold')),
    ).toBe(true);
  });

  it('rejects unknown operation classes (strict-object discipline)', () => {
    const bad = expectError(
      sealMeasuredCounts({
        schema: 'epoch.performance.counts',
        schemaVersion: 1,
        tenantId: TENANT,
        countsId: 'counts:bad',
        subject: 'counts-test-subject',
        workloadId: 'workload:counts-test',
        workloadDigest: 'a'.repeat(64),
        counts: { ...counts, 'kernel-wallclock': 1 },
        measuredBy: 'principal:platform-engineer',
        provenance: { kind: 'observed' },
      }),
      'seal unknown-class counts',
    );
    expect(bad.code).toBe('performance-invalid');
  });

  it('serializes + deserializes byte-identically with a verifying digest', () => {
    const sealed = mustSeal(counts);
    const text = serializeMeasuredCounts(sealed);
    const round = ok(deserializeMeasuredCounts(text, sealed.contentDigest), 'deserialize counts');
    expect(round.digestVerifies).toBe(true);
    expect(serializeMeasuredCounts(round.record)).toBe(text);
  });

  it('a wrong claimed digest does not verify; invalid JSON is typed', () => {
    const sealed = mustSeal(counts);
    const wrong = ok(deserializeMeasuredCounts(serializeMeasuredCounts(sealed), 'c'.repeat(64)), 'deserialize counts');
    expect(wrong.digestVerifies).toBe(false);
    const bad = expectError(deserializeMeasuredCounts('[[[', sealed.contentDigest), 'deserialize counts');
    expect(bad.code).toBe('serialization-invalid');
  });

  it('sealing is deterministic (equal content -> equal digest)', () => {
    expect(mustSeal(counts).contentDigest).toBe(mustSeal(JSON.parse(JSON.stringify(counts))).contentDigest);
  });
});
