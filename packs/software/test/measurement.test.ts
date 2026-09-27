// NAMED POSITIVE: measurement methods — effort/count derivation cases over
// plan quantities (exact decimal arithmetic; net/contingency rules;
// unmatched units carry through, never a blocker).
import { describe, expect, it } from 'vitest';
import {
  foldMeasuredQuantities,
  measureQuantity,
  SOFTWARE_MEASUREMENT_METHODS,
} from '../src/index';

describe('NAMED POSITIVE: effort derivations (net/contingency rules)', () => {
  it('an effort-hours plan quantity derives its contingency-shaped value exactly', () => {
    const measured = measureQuantity(SOFTWARE_MEASUREMENT_METHODS, 'hour', '120');
    expect(measured.net).toBe('120');
    expect(measured.withContingency).toBe('138');
    expect(measured.measurementMethodId).toBe('software.measure.effort-hours');
    expect(measured.basis).toBe('contingency');
  });

  it('the contingency derivation is exact decimal arithmetic (no floats)', () => {
    const measured = measureQuantity(SOFTWARE_MEASUREMENT_METHODS, 'hour', '16.5');
    expect(measured.withContingency).toBe('18.975');
    const zero = measureQuantity(SOFTWARE_MEASUREMENT_METHODS, 'hour', '0');
    expect(zero.withContingency).toBe('0');
  });

  it('the NET plan value is never rewritten', () => {
    const measured = measureQuantity(SOFTWARE_MEASUREMENT_METHODS, 'hour', '80');
    expect(measured.net).toBe('80');
  });
});

describe('NAMED POSITIVE: count derivations (deliverable/deployment/environment counts)', () => {
  it('a deliverable count projects net (no allowance)', () => {
    const measured = measureQuantity(SOFTWARE_MEASUREMENT_METHODS, 'deliverable', '24');
    expect(measured.net).toBe('24');
    expect(measured.withContingency).toBeUndefined();
    expect(measured.measurementMethodId).toBe('software.measure.deliverable-count');
    expect(measured.basis).toBe('net');
  });

  it('a deployment count projects net', () => {
    const measured = measureQuantity(SOFTWARE_MEASUREMENT_METHODS, 'deployment', '1');
    expect(measured.basis).toBe('net');
    expect(measured.measurementMethodId).toBe('software.measure.deployment-count');
  });

  it('an environment count projects net', () => {
    const measured = measureQuantity(SOFTWARE_MEASUREMENT_METHODS, 'environment', '2');
    expect(measured.basis).toBe('net');
    expect(measured.measurementMethodId).toBe('software.measure.environment-count');
  });

  it('a unit with no matching method projects unmatched — the quantity carries through (SN1.0)', () => {
    const measured = measureQuantity(SOFTWARE_MEASUREMENT_METHODS, 'month', '3');
    expect(measured.net).toBe('3');
    expect(measured.withContingency).toBeUndefined();
    expect(measured.measurementMethodId).toBeUndefined();
    expect(measured.basis).toBe('unmatched');
  });
});

describe('NAMED POSITIVE: the measured-quantity fold', () => {
  it('folds one measured row per input row with per-method rollups', () => {
    const fold = foldMeasuredQuantities(SOFTWARE_MEASUREMENT_METHODS, [
      { unit: 'hour', plannedValue: '120' },
      { unit: 'hour', plannedValue: '16' },
      { unit: 'deliverable', plannedValue: '24' },
      { unit: 'month', plannedValue: '3' },
    ]);
    expect(fold.rows).toHaveLength(4);
    expect(fold.rows[0]).toEqual({
      unit: 'hour',
      plannedValue: '120',
      measured: {
        net: '120',
        withContingency: '138',
        measurementMethodId: 'software.measure.effort-hours',
        basis: 'contingency',
      },
    });
    expect(fold.methodCounts).toEqual([
      { methodId: 'software.measure.deliverable-count', rowCount: 1 },
      { methodId: 'software.measure.effort-hours', rowCount: 2 },
    ]);
  });

  it('is deterministic under method permutation (the first methodId order wins)', () => {
    const forward = measureQuantity(SOFTWARE_MEASUREMENT_METHODS, 'hour', '40');
    const permuted = measureQuantity([...SOFTWARE_MEASUREMENT_METHODS].reverse(), 'hour', '40');
    expect(permuted).toEqual(forward);
  });

  it('an effort rule with a contingency factor below 1 is structurally invalid', async () => {
    const { EffortRuleSchema } = await import('../src/measurement');
    expect(
      EffortRuleSchema.safeParse({ rule: 'contingency', contingencyFactor: '0.9' }).success,
    ).toBe(false);
    expect(
      EffortRuleSchema.safeParse({ rule: 'contingency', contingencyFactor: '1.15' }).success,
    ).toBe(true);
    expect(EffortRuleSchema.safeParse({ rule: 'net' }).success).toBe(true);
  });
});
