// W034 — THE REGRESSION GATE SUITE: named tests per operation class,
// running workloads at declared ladder sizes (small/medium/large as
// DATA) against the budget catalog. The suite FAILS when a budget is
// exceeded: every verdict is asserted within-budget AND passed through
// `enforceBudgets` — the throwing gate (an over-budget verdict fails
// the suite with the typed PerformanceBudgetExceededError carrying the
// exact counts).
import { describe, expect, it } from 'vitest';
import { enforceBudgets } from '@epoch/performance';

import { measureSubject } from '../src/measure';

/** The rung labels every subject is measured at (the ladder is DATA). */
const RUNGS = ['small', 'medium', 'large', 'x-large', 'xx-large'] as const;

/** Assert one subject's every rung is within budget + enforced. */
function expectSubjectWithinBudget(subject: string): void {
  for (const rung of RUNGS) {
    const measurement = measureSubject(subject, rung);
    expect(
      measurement.verdict.overall,
      `${subject} @ ${rung} (inputSize ${measurement.verdict.inputSize}): ${JSON.stringify(measurement.counts.counts)}`,
    ).toBe('within-budget');
    enforceBudgets([measurement.verdict]);
  }
}

describe('kernel-admission budgets (per operation class)', () => {
  it('solution-admission: the admission path is constant in plan lines at every rung', () => {
    expectSubjectWithinBudget('solution-admission');
  });

  it('observation-stack: the observation authority path is linear in observations at every rung', () => {
    expectSubjectWithinBudget('observation-stack');
  });

  it('variance-stack: the variance layer is linear in observations at every rung', () => {
    expectSubjectWithinBudget('variance-stack');
  });

  it('distinction-refold (batched): the fold discipline is linear at every rung', () => {
    expectSubjectWithinBudget('distinction-refold');
  });
});

describe('kernel-fold budgets (per operation class)', () => {
  it('program-fold: the five synchronized schedule folds are linear in plan lines at every rung', () => {
    expectSubjectWithinBudget('program-fold');
  });

  it('observation-stack: the ledger + delivery folds are linear at every rung', () => {
    expectSubjectWithinBudget('observation-stack');
  });

  it('variance-stack: the records + summary folds are linear at every rung', () => {
    expectSubjectWithinBudget('variance-stack');
  });
});

describe('projection-compute budgets (per operation class)', () => {
  it('pack-projection: BOTH packs\' projections are linear in projection count at every rung', () => {
    expectSubjectWithinBudget('pack-projection');
  });
});

describe('digest-compute budgets (per operation class)', () => {
  it('solution-admission: the digest path is constant in plan lines at every rung', () => {
    expectSubjectWithinBudget('solution-admission');
  });

  it('observation-stack: seals + assessments + verification are linear at every rung', () => {
    expectSubjectWithinBudget('observation-stack');
  });
});

describe('harness-scenario budgets (per operation class)', () => {
  it('harness-scenario: the W032 runner seam is linear in scenario steps at every rung', () => {
    expectSubjectWithinBudget('harness-scenario');
  });
});

describe('the measured counts match the documented composition coefficients', () => {
  it('solution-admission measures 1 admission + 4 digests regardless of size', () => {
    const small = measureSubject('solution-admission', 'small');
    const large = measureSubject('solution-admission', 'xx-large');
    expect(small.counts.counts['kernel-admission']).toBe(1);
    expect(small.counts.counts['digest-compute']).toBe(4);
    expect(large.counts.counts['kernel-admission']).toBe(1);
    expect(large.counts.counts['digest-compute']).toBe(4);
  });

  it('program-fold measures 3N + N/16 + N/8 fold records at the large rung', () => {
    const measurement = measureSubject('program-fold', 'large');
    const n = measurement.verdict.inputSize;
    expect(measurement.counts.counts['kernel-fold']).toBe(3 * n + Math.ceil(n / 16) + Math.ceil(n / 8));
  });

  it('observation-stack measures 4M+1 admissions, 2M+2 digests, 3M folds', () => {
    const measurement = measureSubject('observation-stack', 'medium');
    const m = measurement.verdict.inputSize;
    expect(measurement.counts.counts['kernel-admission']).toBe(4 * m + 1);
    expect(measurement.counts.counts['digest-compute']).toBe(2 * m + 2);
    expect(measurement.counts.counts['kernel-fold']).toBe(3 * m);
  });

  it('harness-scenario measures 4S+4 seam invocations (the double-run discipline)', () => {
    const measurement = measureSubject('harness-scenario', 'medium');
    const s = measurement.verdict.inputSize;
    expect(measurement.counts.counts['harness-scenario']).toBe(4 * s + 4);
  });

  it('the flow actually did real work (actuals minted, variances recorded)', () => {
    const measurement = measureSubject('observation-stack', 'medium');
    expect(measurement.summary.actualCount).toBe(measurement.verdict.inputSize);
    const variance = measureSubject('variance-stack', 'medium');
    expect(variance.summary.varianceCount).toBe(variance.verdict.inputSize);
  });

  it('every verdict carries the exact measured and allowed counts', () => {
    const measurement = measureSubject('observation-stack', 'medium');
    for (const finding of measurement.verdict.perClass) {
      expect(finding.measured).toBeGreaterThan(0);
      expect(finding.allowed).toBeGreaterThanOrEqual(finding.measured);
      expect(finding.nearFloor).toBeLessThanOrEqual(finding.allowed);
    }
  });
});
