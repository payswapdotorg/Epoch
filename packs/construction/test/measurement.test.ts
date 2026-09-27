// NAMED POSITIVE: measurement derivations — net/gross cases, exact decimal
// arithmetic, and the measured-quantity folds over plan quantity schedules.
import { describe, expect, it } from 'vitest';
import {
  CONSTRUCTION_MEASUREMENT_METHODS,
  foldMeasuredQuantities,
  measureQuantity,
} from '../src/index';

describe('NAMED POSITIVE: net/gross derivation cases (exact decimal arithmetic)', () => {
  it('a NET method keeps the plan value unchanged with basis net', () => {
    const measured = measureQuantity(CONSTRUCTION_MEASUREMENT_METHODS, 'number', '24');
    expect(measured).toEqual({
      net: '24',
      gross: undefined,
      measurementMethodId: 'construction.measure.count',
      basis: 'net',
    });
  });

  it('a GROSS method derives net × allowanceFactor exactly (volume: 120 m3 × 1.04)', () => {
    const measured = measureQuantity(CONSTRUCTION_MEASUREMENT_METHODS, 'm3', '120');
    expect(measured.basis).toBe('gross');
    expect(measured.net).toBe('120');
    expect(measured.gross).toBe('124.8');
    expect(measured.measurementMethodId).toBe('construction.measure.volume');
  });

  it('a GROSS method derives area quantities exactly (240 m2 × 1.10)', () => {
    const measured = measureQuantity(CONSTRUCTION_MEASUREMENT_METHODS, 'm2', '240');
    expect(measured.gross).toBe('264');
  });

  it('a GROSS method derives mass quantities with trailing-zero trimming (4 tonne × 1.03)', () => {
    const measured = measureQuantity(CONSTRUCTION_MEASUREMENT_METHODS, 'tonne', '4');
    expect(measured.gross).toBe('4.12');
  });

  it('a GROSS method derives length quantities exactly (150 m × 1.05)', () => {
    const measured = measureQuantity(CONSTRUCTION_MEASUREMENT_METHODS, 'm', '150');
    expect(measured.gross).toBe('157.5');
  });

  it('fractional nets multiply exactly with canonical trailing-zero trimming (2.50 × 1.10)', () => {
    const measured = measureQuantity(CONSTRUCTION_MEASUREMENT_METHODS, 'm2', '2.50');
    expect(measured.gross).toBe('2.75');
  });

  it('an UNMATCHED unit projects as unmatched with the plan value unchanged (SN1.0: never a blocker)', () => {
    const measured = measureQuantity(CONSTRUCTION_MEASUREMENT_METHODS, 'sum', '1');
    expect(measured).toEqual({
      net: '1',
      gross: undefined,
      measurementMethodId: undefined,
      basis: 'unmatched',
    });
  });

  it('the net plan value is NEVER rewritten by a derivation', () => {
    for (const unit of ['m3', 'm2', 'number', 'tonne', 'm', 'sum']) {
      const measured = measureQuantity(CONSTRUCTION_MEASUREMENT_METHODS, unit, '118.5');
      expect(measured.net).toBe('118.5');
    }
  });
});

describe('NAMED POSITIVE: the measured-quantity fold over plan quantity rows', () => {
  it('folds one measured row per input row with per-method rollups', () => {
    const rows = [
      { unit: 'm3', plannedValue: '120' },
      { unit: 'm2', plannedValue: '240' },
      { unit: 'number', plannedValue: '24' },
      { unit: 'sum', plannedValue: '1' },
      { unit: 'm3', plannedValue: '85' },
    ];
    const fold = foldMeasuredQuantities(CONSTRUCTION_MEASUREMENT_METHODS, rows);
    expect(fold.rows).toHaveLength(5);
    expect(fold.rows[0]!.measured.gross).toBe('124.8');
    expect(fold.rows[4]!.measured.gross).toBe('88.4');
    expect(fold.methodCounts).toEqual([
      { methodId: 'construction.measure.area', rowCount: 1 },
      { methodId: 'construction.measure.count', rowCount: 1 },
      { methodId: 'construction.measure.volume', rowCount: 2 },
    ]);
  });

  it('the fold is deterministic under row-order permutation', () => {
    const rows = [
      { unit: 'm3', plannedValue: '120' },
      { unit: 'm2', plannedValue: '240' },
      { unit: 'number', plannedValue: '24' },
    ];
    const forward = foldMeasuredQuantities(CONSTRUCTION_MEASUREMENT_METHODS, rows);
    const backward = foldMeasuredQuantities(CONSTRUCTION_MEASUREMENT_METHODS, [...rows].reverse());
    expect(backward.methodCounts).toEqual(forward.methodCounts);
    expect(backward.rows.map((row) => row.unit).sort()).toEqual(forward.rows.map((row) => row.unit).sort());
  });
});
