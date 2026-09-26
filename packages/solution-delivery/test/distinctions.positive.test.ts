// POSITIVE: the nine semantic-distinction record types round-trip with
// digests; uncertainty states are carried on every fact; the ledger folds
// deterministically; forecast lineage chains forecast -> forecast.
import { describe, expect, it } from 'vitest';
import {
  admitDistinctionRecord,
  foldDistinctionRecords,
  sealDistinctionRecord,
  verifySealedDistinctionRecord,
  computeDistinctionRecordDigest,
  type SealedDistinctionRecord,
} from '../src/index';
import { distinctionContents, emptyLedger, TENANT } from './fixtures';

const KINDS = [
  'prediction',
  'estimate',
  'baseline',
  'commitment',
  'observation',
  'actual',
  'forecast',
  'outcome',
  'learning',
] as const;

describe('the nine semantic-distinction record types', () => {
  it('every kind seals into a digest-bearing record', () => {
    for (const kind of KINDS) {
      const sealed = sealDistinctionRecord(distinctionContents()[kind]);
      expect(sealed.ok, kind).toBe(true);
      if (sealed.ok) {
        expect(sealed.value.kind).toBe(kind);
        expect(sealed.value.contentDigest).toMatch(/^[0-9a-f]{64}$/);
        expect(sealed.value.recordId.startsWith(`${kind}:`)).toBe(true);
      }
    }
  });

  it('every kind round-trips through JSON serialization with digest verification', () => {
    for (const kind of KINDS) {
      const sealed = sealDistinctionRecord(distinctionContents()[kind]);
      expect(sealed.ok, kind).toBe(true);
      if (!sealed.ok) continue;
      const roundTripped = JSON.parse(JSON.stringify(sealed.value)) as unknown;
      const verified = verifySealedDistinctionRecord(roundTripped);
      expect(verified.ok, kind).toBe(true);
      if (verified.ok) {
        expect(verified.value).toEqual(sealed.value);
      }
    }
  });

  it('every record carries the full uncertainty state (provenance + freshness + confidence)', () => {
    for (const kind of KINDS) {
      const sealed = sealDistinctionRecord(distinctionContents()[kind]);
      expect(sealed.ok, kind).toBe(true);
      if (!sealed.ok) continue;
      expect(sealed.value.uncertainty.provenance.kind).toBe('observed');
      expect(sealed.value.uncertainty.freshness.state).toBe('fresh');
      expect(sealed.value.uncertainty.confidence.method).toBe('stated');
      expect(sealed.value.uncertainty.confidence.value).toBe(0.9);
    }
  });

  it('the digest is the SHA-256 over the canonical JSON of the content', () => {
    const sealed = sealDistinctionRecord(distinctionContents().prediction);
    if (!sealed.ok) return;
    const { contentDigest, ...content } = sealed.value;
    expect(contentDigest).toBe(computeDistinctionRecordDigest(content));
  });

  it('semantically equal content digests stably regardless of key order', () => {
    const a = sealDistinctionRecord(distinctionContents().prediction);
    const content = distinctionContents().prediction;
    const reordered = {
      recordedBy: content['recordedBy'],
      recordedAt: content['recordedAt'],
      uncertainty: content['uncertainty'],
      payload: content['payload'],
      measure: content['measure'],
      subject: content['subject'],
      tenantId: content['tenantId'],
      recordId: content['recordId'],
      kind: content['kind'],
      schemaVersion: content['schemaVersion'],
      schema: content['schema'],
    };
    const b = sealDistinctionRecord(reordered);
    expect(a.ok && b.ok && a.value.contentDigest === b.value.contentDigest).toBe(true);
  });
});

describe('the append-only DistinctionLedger', () => {
  it('admits records of every kind and folds them by kind deterministically', () => {
    let ledger = emptyLedger();
    const sealedRecords: SealedDistinctionRecord[] = [];
    for (const kind of [...KINDS].sort()) {
      const sealed = sealDistinctionRecord(distinctionContents()[kind]);
      expect(sealed.ok, kind).toBe(true);
      if (!sealed.ok) continue;
      const admitted = admitDistinctionRecord(ledger, sealed.value);
      expect(admitted.ok, kind).toBe(true);
      if (!admitted.ok) continue;
      ledger = admitted.value;
      sealedRecords.push(sealed.value);
    }
    expect(ledger.records).toHaveLength(9);
    const folded = foldDistinctionRecords(ledger);
    for (const kind of KINDS) {
      expect(folded[kind], kind).toHaveLength(1);
      expect(folded[kind]![0]!.kind, kind).toBe(kind);
    }
  });

  it('exact re-admission is idempotent', () => {
    const sealed = sealDistinctionRecord(distinctionContents().prediction);
    if (!sealed.ok) return;
    const first = admitDistinctionRecord(emptyLedger(), sealed.value);
    if (!first.ok) return;
    const second = admitDistinctionRecord(first.value, sealed.value);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.records).toHaveLength(1);
    }
  });

  it('forecast lineage: a forecast refining an earlier forecast is admitted', () => {
    const firstForecast = sealDistinctionRecord(distinctionContents().forecast);
    if (!firstForecast.ok) return;
    let ledger = emptyLedger();
    const admitted = admitDistinctionRecord(ledger, firstForecast.value);
    if (!admitted.ok) return;
    ledger = admitted.value;
    const refined = sealDistinctionRecord({
      ...distinctionContents().forecast,
      recordId: 'forecast:brace-finish-2',
      payload: { asOf: '2026-02-10T09:00:08.000Z', refines: 'forecast:brace-finish' },
    });
    expect(refined.ok).toBe(true);
    if (!refined.ok) return;
    const result = admitDistinctionRecord(ledger, refined.value);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.records).toHaveLength(2);
    }
  });

  it('the ledger carries the tenant scope on every record', () => {
    const sealed = sealDistinctionRecord(distinctionContents().prediction);
    if (!sealed.ok) return;
    expect(sealed.value.tenantId).toBe(TENANT);
  });
});
