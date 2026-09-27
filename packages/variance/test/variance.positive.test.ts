// THE FULL VARIANCE CLASS SET — every class instantiated in a named test
// with magnitude + direction (+ band), the explainability summary fold,
// and the round-trip/digest battery.
import { describe, expect, it } from 'vitest';
import {
  admitVarianceRecord,
  computeVariance,
  foldVarianceRecords,
  foldVarianceSummary,
  openVarianceLedger,
  sealVarianceRecord,
  verifySealedVarianceRecord,
  VARIANCE_CLASSES,
  type SealedVarianceRecord,
} from '../src/index';
import { expectError, unwrap } from './helpers';
import {
  ACTIVITY_ID,
  EVIDENCE_DIGEST,
  EVIDENCE_DIGEST_2,
  OTHER_TENANT,
  PRINCIPAL,
  SOLUTION_ID,
  TENANT,
  THRESHOLDS,
  T3,
  confidence,
  varianceInput,
} from './fixtures';

/** Build one variance computation input over the quantity grammar. */
function quantityVariance(
  varianceClass: string,
  baselineValue: string,
  actualValue: string,
  varianceId: string,
): Record<string, unknown> {
  return varianceInput({
    varianceId,
    varianceClass,
    baselineMeasure: { kind: 'quantity', value: baselineValue, unit: 'm3' },
    actualMeasure: { kind: 'quantity', value: actualValue, unit: 'm3' },
  });
}

describe('the full variance class set (magnitude + direction on every class)', () => {
  it('QUANTITY: actual below baseline is adverse (higher-is-favorable polarity)', () => {
    const record = unwrap(
      computeVariance(quantityVariance('quantity', '120', '118.5', 'variance:q1') as never),
    );
    expect(record.magnitude).toBe('1.5');
    expect(record.direction).toBe('adverse');
    expect(record.band).toBe('minor');
    expect(record.varianceClass).toBe('quantity');
  });

  it('QUANTITY: actual above baseline is favorable', () => {
    const record = unwrap(
      computeVariance(quantityVariance('quantity', '120', '135', 'variance:q2') as never),
    );
    expect(record.magnitude).toBe('15');
    expect(record.direction).toBe('favorable');
    expect(record.band).toBe('material');
  });

  it('PRICE/RATE: actual rate above baseline is adverse (lower-is-favorable polarity)', () => {
    const record = unwrap(
      computeVariance(
        varianceInput({
          varianceId: 'variance:pr1',
          varianceClass: 'price-rate',
          baselineMeasure: { kind: 'cost', amount: '18.50', currency: 'EUR' },
          actualMeasure: { kind: 'cost', amount: '21.00', currency: 'EUR' },
        }) as never,
      ),
    );
    expect(record.magnitude).toBe('2.5');
    expect(record.direction).toBe('adverse');
    expect(record.band).toBe('minor');
  });

  it('PRODUCTIVITY: actual output above baseline is favorable', () => {
    const record = unwrap(
      computeVariance(quantityVariance('productivity', '40', '55', 'variance:prod1') as never),
    );
    expect(record.magnitude).toBe('15');
    expect(record.direction).toBe('favorable');
    expect(record.band).toBe('material');
  });

  it('SCHEDULE: a later actual instant is adverse (exact millisecond fold)', () => {
    const record = unwrap(
      computeVariance(
        varianceInput({
          varianceId: 'variance:sch1',
          varianceClass: 'schedule',
          baselineMeasure: { kind: 'instant', at: '2026-04-06T08:00:00.000Z' },
          actualMeasure: { kind: 'instant', at: '2026-04-08T08:00:00.000Z' },
        }) as never,
      ),
    );
    // Exactly two days late = 172,800,000 milliseconds.
    expect(record.magnitude).toBe('172800000');
    expect(record.direction).toBe('adverse');
    expect(record.band).toBe('severe');
  });

  it('WASTE: material loss above allowance is adverse', () => {
    const record = unwrap(
      computeVariance(quantityVariance('waste', '2', '5.25', 'variance:w1') as never),
    );
    expect(record.magnitude).toBe('3.25');
    expect(record.direction).toBe('adverse');
    expect(record.band).toBe('minor');
  });

  it('REWORK: any redo volume above the zero-rework assumption is adverse', () => {
    const record = unwrap(
      computeVariance(quantityVariance('rework', '0', '12', 'variance:rw1') as never),
    );
    expect(record.magnitude).toBe('12');
    expect(record.direction).toBe('adverse');
    expect(record.band).toBe('material');
  });

  it('CHANGE: a change-record deviation is direction-NEUTRAL by class vocabulary', () => {
    const record = unwrap(
      computeVariance(quantityVariance('change', '120', '126', 'variance:c1') as never),
    );
    expect(record.magnitude).toBe('6');
    expect(record.direction).toBe('neutral');
    expect(record.band).toBe('minor');
  });

  it('EXTERNAL-CONDITION: condition-driven overrun above plan is adverse', () => {
    const record = unwrap(
      computeVariance(quantityVariance('external-condition', '0', '240', 'variance:ext1') as never),
    );
    expect(record.magnitude).toBe('240');
    expect(record.direction).toBe('adverse');
    expect(record.band).toBe('severe');
  });

  it('the class vocabulary is exactly the eight-class set (closed under zod)', () => {
    expect([...VARIANCE_CLASSES]).toEqual([
      'quantity',
      'price-rate',
      'productivity',
      'schedule',
      'waste',
      'rework',
      'change',
      'external-condition',
    ]);
  });

  it('an exact match folds an immaterial, neutral variance', () => {
    const record = unwrap(
      computeVariance(quantityVariance('quantity', '120', '120', 'variance:exact1') as never),
    );
    expect(record.magnitude).toBe('0');
    expect(record.direction).toBe('neutral');
    expect(record.band).toBe('immaterial');
  });

  it('progress measures fold exact decimals (no float math)', () => {
    const record = unwrap(
      computeVariance(
        varianceInput({
          varianceId: 'variance:prog1',
          varianceClass: 'productivity',
          baselineMeasure: { kind: 'progress', fraction: 0.25 },
          actualMeasure: { kind: 'progress', fraction: 0.6 },
        }) as never,
      ),
    );
    expect(record.magnitude).toBe('0.35');
    expect(record.direction).toBe('favorable');
  });
});

describe('the append-only variance ledger + the explainability fold', () => {
  it('admits computed records, replays idempotently, and folds the summary deterministically', () => {
    let ledger = openVarianceLedger({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const records: SealedVarianceRecord[] = [
      unwrap(computeVariance(quantityVariance('quantity', '120', '118.5', 'variance:q1') as never)),
      unwrap(computeVariance(quantityVariance('quantity', '120', '100', 'variance:q2') as never)),
      unwrap(computeVariance(quantityVariance('waste', '2', '5.25', 'variance:w1') as never)),
    ];
    for (const record of records) {
      ledger = unwrap(admitVarianceRecord(ledger, record));
    }
    // Exact replay is idempotent.
    ledger = unwrap(admitVarianceRecord(ledger, records[0]!));
    expect(ledger.records.length).toBe(3);
    // The fold is sorted and complete.
    expect(foldVarianceRecords(ledger).map((r) => r.varianceId)).toEqual([
      'variance:q1',
      'variance:q2',
      'variance:w1',
    ]);
    // The explainability summary groups by (class, direction, band).
    const summary = foldVarianceSummary(ledger);
    // Sorted by (class, direction, band) — 'material' sorts before 'minor'.
    expect(summary).toEqual([
      { varianceClass: 'quantity', direction: 'adverse', band: 'material', count: 1, totalMagnitude: '20' },
      { varianceClass: 'quantity', direction: 'adverse', band: 'minor', count: 1, totalMagnitude: '1.5' },
      { varianceClass: 'waste', direction: 'adverse', band: 'minor', count: 1, totalMagnitude: '3.25' },
    ]);
  });

  it('version-conflict: the same variance id with different content', () => {
    let ledger = openVarianceLedger({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const first = unwrap(computeVariance(quantityVariance('quantity', '120', '118.5', 'variance:q1') as never));
    ledger = unwrap(admitVarianceRecord(ledger, first));
    const different = unwrap(computeVariance(quantityVariance('quantity', '120', '100', 'variance:q1') as never));
    const error = expectError(admitVarianceRecord(ledger, different));
    expect(error.code).toBe('version-conflict');
  });

  it('tenant-isolation-rejected: a cross-tenant record', () => {
    const ledger = openVarianceLedger({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const foreign = unwrap(
      computeVariance(
        varianceInput({ tenantId: OTHER_TENANT, subjectKind: 'activity' }) as never,
      ),
    );
    const error = expectError(admitVarianceRecord(ledger, foreign));
    expect(error.code).toBe('tenant-isolation-rejected');
  });
});

describe('round-trip serialization + digest verification', () => {
  it('a sealed variance record round-trips through JSON and verifies', () => {
    const record = unwrap(computeVariance(varianceInput() as never));
    const roundTrip = verifySealedVarianceRecord(JSON.parse(JSON.stringify(record)));
    expect(roundTrip.ok).toBe(true);
    expect(roundTrip.ok && roundTrip.value.contentDigest).toBe(record.contentDigest);
  });

  it('a tampered variance record is a typed digest-mismatch', () => {
    const record = unwrap(computeVariance(varianceInput() as never));
    const tampered = { ...record, magnitude: '999' };
    const verified = verifySealedVarianceRecord(tampered);
    expect(verified.ok).toBe(false);
    expect(!verified.ok && verified.error.code).toBe('digest-mismatch');
  });

  it('identical inputs derive identical digests (determinism)', () => {
    const a = unwrap(computeVariance(varianceInput() as never));
    const b = unwrap(computeVariance(varianceInput() as never));
    expect(a.contentDigest).toBe(b.contentDigest);
  });

  it('a malformed variance content is a typed validation rejection', () => {
    const error = sealVarianceRecord({ schema: 'nope' });
    expect(error.ok).toBe(false);
    expect(!error.ok && error.error.code).toBe('validation');
  });

  it('a vendor field on the variance record is a typed vendor-fields rejection', () => {
    const error = sealVarianceRecord({
      ...varianceInput(),
      procoreVarianceCode: 'PC-123',
      schema: 'epoch.variance.variance-record',
      schemaVersion: 1,
    });
    expect(error.ok).toBe(false);
    expect(!error.ok && error.error.code).toBe('vendor-fields-rejected');
  });
});

describe('measure-kind mismatch guards', () => {
  it('measure-kind-mismatch: quantity vs cost', () => {
    const error = expectError(
      computeVariance(
        varianceInput({
          actualMeasure: { kind: 'cost', amount: '118.5', currency: 'EUR' },
        }) as never,
      ),
    );
    expect(error.code).toBe('measure-kind-mismatch');
  });

  it('measure-kind-mismatch: unit mismatch', () => {
    const error = expectError(
      computeVariance(
        varianceInput({
          actualMeasure: { kind: 'quantity', value: '118.5', unit: 'tonne' },
        }) as never,
      ),
    );
    expect(error.code).toBe('measure-kind-mismatch');
  });

  it('measure-kind-mismatch: currency mismatch', () => {
    const error = expectError(
      computeVariance(
        varianceInput({
          varianceClass: 'price-rate',
          baselineMeasure: { kind: 'cost', amount: '18.50', currency: 'EUR' },
          actualMeasure: { kind: 'cost', amount: '21.00', currency: 'USD' },
        }) as never,
      ),
    );
    expect(error.code).toBe('measure-kind-mismatch');
  });
});

void EVIDENCE_DIGEST;
void EVIDENCE_DIGEST_2;
void THRESHOLDS;
void T3;
void confidence;
void PRINCIPAL;
void ACTIVITY_ID;
