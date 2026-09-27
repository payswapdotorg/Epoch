// NAMED POSITIVE: cost/resource classifications — engineering /
// infrastructure / licensing / operations folds over the W036
// CostSchedule/ResourceSchedule; unclassified rows roll into the
// deterministic unclassified bucket.
import { describe, expect, it } from 'vitest';
import { foldCostSchedule, foldResourceSchedule } from '@epoch/solution-delivery';
import {
  CostClassIndexSchema,
  ResourceClassIndexSchema,
  foldClassifiedCostSummary,
  foldClassifiedResourceSummary,
} from '../src/index';
import { costClassIndex, resourceClassIndex, sealedSolution, sealedProgram } from './fixtures';

describe('NAMED POSITIVE: the classified cost fold', () => {
  const program = sealedProgram(sealedSolution());
  const schedule = foldCostSchedule(program);

  it('the fixture indexes parse through their schemas', () => {
    expect(CostClassIndexSchema.safeParse(costClassIndex()).success).toBe(true);
    expect(ResourceClassIndexSchema.safeParse(resourceClassIndex()).success).toBe(true);
  });

  it('classified activities roll into exact per-(class, currency) totals', () => {
    const summary = foldClassifiedCostSummary(schedule, costClassIndex());
    const totals = new Map(summary.totals.map((row) => [`${row.resourceClass}:${row.currency}`, row.totalAmount]));
    expect(totals.get('engineering:EUR')).toBe('20480');
    expect(totals.get('infrastructure:EUR')).toBe('7200');
    expect(totals.get('licensing:EUR')).toBe('3600');
    expect(totals.get('operations:EUR')).toBe('1200');
  });

  it('rows the index does not classify roll into the unclassified bucket', () => {
    const summary = foldClassifiedCostSummary(schedule, costClassIndex());
    expect(summary.unclassified).toEqual([{ currency: 'EUR', totalAmount: '3520' }]);
  });

  it('an EMPTY index classifies nothing (everything unclassified)', () => {
    const summary = foldClassifiedCostSummary(schedule, {
      schema: 'epoch.pack-software.cost-class-index',
      schemaVersion: 1,
      assignments: [],
    });
    expect(summary.totals).toEqual([]);
    expect(summary.unclassified).toEqual([{ currency: 'EUR', totalAmount: '36000' }]);
  });

  it('an unsorted index is rejected (deterministic serialization)', () => {
    const parsed = CostClassIndexSchema.safeParse({
      schema: 'epoch.pack-software.cost-class-index',
      schemaVersion: 1,
      assignments: [
        { activityId: 'activity:zzz-late', resourceClass: 'engineering' },
        { activityId: 'activity:aaa-early', resourceClass: 'engineering' },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('NAMED POSITIVE: the classified resource fold', () => {
  const program = sealedProgram(sealedSolution());
  const schedule = foldResourceSchedule(program);

  it('resources roll into per-(class, unit) quantity rollups with counts', () => {
    const summary = foldClassifiedResourceSummary(schedule, resourceClassIndex());
    const rows = new Map(summary.rows.map((row) => [`${row.resourceClass}:${row.unit}`, row]));
    expect(rows.get('engineering:team')).toEqual({
      resourceClass: 'engineering',
      unit: 'team',
      totalQuantity: '2',
      resourceCount: 1,
    });
    expect(rows.get('infrastructure:hour')).toEqual({
      resourceClass: 'infrastructure',
      unit: 'hour',
      totalQuantity: '40',
      resourceCount: 1,
    });
    expect(rows.get('operations:pipeline')).toEqual({
      resourceClass: 'operations',
      unit: 'pipeline',
      totalQuantity: '1',
      resourceCount: 1,
    });
    expect(summary.unclassified).toEqual([]);
  });

  it('an empty index leaves every resource unclassified', () => {
    const summary = foldClassifiedResourceSummary(schedule, {
      schema: 'epoch.pack-software.resource-class-index',
      schemaVersion: 1,
      assignments: [],
    });
    expect(summary.rows).toEqual([]);
    expect(summary.unclassified).toHaveLength(schedule.rows.length);
  });

  it('the fold is invariant under row permutation', () => {
    const forward = foldClassifiedResourceSummary(schedule, resourceClassIndex());
    const permuted = foldClassifiedResourceSummary(
      { ...schedule, rows: [...schedule.rows].reverse() },
      resourceClassIndex(),
    );
    expect(permuted).toEqual(forward);
  });
});
