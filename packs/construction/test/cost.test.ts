// NAMED POSITIVE: cost/resource classification folds over the W036
// CostSchedule / ResourceSchedule of the fixture program.
import { describe, expect, it } from 'vitest';
import {
  foldCostSchedule,
  foldResourceSchedule,
} from '@epoch/solution-delivery';
import {
  foldClassifiedCostSummary,
  foldClassifiedResourceSummary,
} from '../src/index';
import { costClassIndex, resourceClassIndex, sealedProgram, sealedSolution } from './fixtures';

describe('NAMED POSITIVE: cost classification folds over the CostSchedule', () => {
  it('the fixture cost schedule folds into per-(class, currency) exact totals', () => {
    const solution = sealedSolution();
    const program = sealedProgram(solution);
    const schedule = foldCostSchedule(program);
    const summary = foldClassifiedCostSummary(schedule, costClassIndex());

    // Classified activities: excavation-bulk 2220.00 (plant),
    // foundation-concrete 17850.00 (material), steel-erection 9600.00
    // (subcontract), facade-install 22200.00 (material),
    // door-install 11520.00 (subcontract); floor-deck-install 20480.00 EUR
    // carries no assignment -> the unclassified bucket.
    expect(summary.totals).toEqual([
      { resourceClass: 'material', currency: 'EUR', totalAmount: '40050' },
      { resourceClass: 'plant', currency: 'EUR', totalAmount: '2220' },
      { resourceClass: 'subcontract', currency: 'EUR', totalAmount: '21120' },
    ]);
    expect(summary.unclassified).toEqual([{ currency: 'EUR', totalAmount: '20480' }]);
  });

  it('the fold is deterministic under schedule-row permutation', () => {
    const solution = sealedSolution();
    const schedule = foldCostSchedule(sealedProgram(solution));
    const index = costClassIndex();
    const forward = foldClassifiedCostSummary(schedule, index);
    const permuted = foldClassifiedCostSummary({ ...schedule, rows: [...schedule.rows].reverse() }, index);
    expect(permuted).toEqual(forward);
  });
});

describe('NAMED POSITIVE: resource classification folds over the ResourceSchedule', () => {
  it('the fixture resource schedule folds into per-(class, unit) rollups with counts', () => {
    const solution = sealedSolution();
    const program = sealedProgram(solution);
    const schedule = foldResourceSchedule(program);
    const summary = foldClassifiedResourceSummary(schedule, resourceClassIndex());

    // Resource assignments: excavator 1 machine (substructure package +
    // excavation activity -> 2 total), concrete-pump 12+12 hour,
    // mobile-crane 8+8 day — all classified plant; no unclassified rows.
    expect(summary.rows).toEqual([
      { resourceClass: 'plant', unit: 'day', totalQuantity: '16', resourceCount: 1 },
      { resourceClass: 'plant', unit: 'hour', totalQuantity: '24', resourceCount: 1 },
      { resourceClass: 'plant', unit: 'machine', totalQuantity: '2', resourceCount: 1 },
    ]);
    expect(summary.unclassified).toEqual([]);
  });

  it('the fold is deterministic under schedule-row permutation', () => {
    const solution = sealedSolution();
    const schedule = foldResourceSchedule(sealedProgram(solution));
    const index = resourceClassIndex();
    const forward = foldClassifiedResourceSummary(schedule, index);
    const permuted = foldClassifiedResourceSummary(
      { ...schedule, rows: [...schedule.rows].reverse() },
      index,
    );
    expect(permuted).toEqual(forward);
  });
});
