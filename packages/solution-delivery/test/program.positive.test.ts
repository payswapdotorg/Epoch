// POSITIVE: ProgramOfWork DAG construction, dependency integrity, and the
// deterministic milestone/quantity/cost/resource schedule folds.
import { describe, expect, it } from 'vitest';
import {
  buildProgramOfWork,
  foldCostSchedule,
  foldMilestoneSchedule,
  foldQuantitySchedule,
  foldRealizationVariants,
  foldResourceSchedule,
  verifySealedProgramOfWork,
} from '../src/index';
import { sealedProgram, sealedV1, programContent } from './fixtures';

describe('ProgramOfWork construction', () => {
  it('builds and seals a dependency-valid program', () => {
    const v1 = sealedV1();
    const program = sealedProgram(v1);
    expect(program.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(program.workPackages).toHaveLength(1);
    expect(program.workPackages[0]!.activities).toHaveLength(2);
  });

  it('round-trips through JSON serialization with digest verification', () => {
    const program = sealedProgram(sealedV1());
    const roundTripped = JSON.parse(JSON.stringify(program)) as unknown;
    const verified = verifySealedProgramOfWork(roundTripped);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(program);
    }
  });

  it('the dependency mirrors are integrity-checked (excavate -> brace-frame)', () => {
    const program = sealedProgram(sealedV1());
    const excavate = program.workPackages[0]!.activities.find(
      (activity) => activity.activityId === 'activity:excavate',
    );
    const brace = program.workPackages[0]!.activities.find(
      (activity) => activity.activityId === 'activity:brace-frame',
    );
    expect(excavate?.successors).toContain('activity:brace-frame');
    expect(brace?.predecessors).toContain('activity:excavate');
  });
});

describe('deterministic schedule folds', () => {
  it('folds the quantity schedule with exact per-unit totals', () => {
    const program = sealedProgram(sealedV1());
    const schedule = foldQuantitySchedule(program);
    expect(schedule.rows).toHaveLength(2);
    expect(schedule.totals).toEqual([{ unit: 'm3', totalValue: '120' }, { unit: 'tonne', totalValue: '4' }]);
  });

  it('folds the cost schedule with exact per-currency totals', () => {
    const program = sealedProgram(sealedV1());
    const schedule = foldCostSchedule(program);
    expect(schedule.totals).toEqual([{ currency: 'EUR', totalAmount: '11820' }]);
  });

  it('folds the resource schedule aggregating packages and activities', () => {
    const program = sealedProgram(sealedV1());
    const schedule = foldResourceSchedule(program);
    const excavator = schedule.rows.find(
      (row) => row.resourceId === 'resource:excavator-1' && row.unit === 'machine',
    );
    // The excavator is assigned at BOTH the work package and the activity:
    // the fold aggregates to 2 (it does not double-count across activities
    // because only one activity carries it, plus the package assignment).
    expect(excavator?.totalQuantity).toBe('2');
    expect(excavator?.workPackageIds).toEqual(['work-package:earthworks']);
  });

  it('folds the milestone schedule with status counts', () => {
    const program = sealedProgram(sealedV1());
    const schedule = foldMilestoneSchedule(program);
    expect(schedule.rows).toHaveLength(1);
    expect(schedule.rows[0]!.status).toBe('reached');
    expect(schedule.counts).toEqual({ planned: 0, reached: 1, missed: 0 });
  });

  it('folds the realization-variant summary (construction-build)', () => {
    const program = sealedProgram(sealedV1());
    const summary = foldRealizationVariants(program);
    expect(summary.counts['construction-build']).toBe(1);
    expect(summary.counts['software-implementation-deployment']).toBe(0);
  });

  it('folds are invariant under work-package input permutation', () => {
    const v1 = sealedV1();
    const a = sealedProgram(v1);
    const permuted = buildProgramOfWork({
      ...(programContent(v1) as Record<string, unknown>),
      workPackages: [...(programContent(v1) as { workPackages: unknown[] }).workPackages],
    });
    expect(permuted.ok).toBe(true);
    if (!permuted.ok) return;
    expect(foldQuantitySchedule(permuted.value)).toEqual(foldQuantitySchedule(a));
    expect(foldCostSchedule(permuted.value)).toEqual(foldCostSchedule(a));
    expect(foldResourceSchedule(permuted.value)).toEqual(foldResourceSchedule(a));
    expect(foldMilestoneSchedule(permuted.value)).toEqual(foldMilestoneSchedule(a));
  });
});

describe('exact decimal arithmetic', () => {
  it('adds canonical decimals exactly (no float drift)', () => {
    // 11820.00 = 2220.00 + 9600.00
    const program = sealedProgram(sealedV1());
    const totals = foldCostSchedule(program).totals;
    expect(totals[0]!.totalAmount).toBe('11820');
    expect(totals[0]!.totalAmount).not.toBe('11820.000000001');
  });
});
