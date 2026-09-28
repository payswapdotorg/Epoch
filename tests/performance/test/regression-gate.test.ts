// W034 — regression-gate-bites: an intentionally-inflated composition
// (re-fold after EVERY admission) exceeds its budget; the suite FAILS
// with the typed verdict; the batched composition (the restored
// discipline) enforces cleanly. The gate bites, then the suite recovers.
import { describe, expect, it } from 'vitest';
import { createCounterHub, enforceBudgets, evaluateBudget, sealMeasuredCounts, PerformanceBudgetExceededError } from '@epoch/performance';
import { budgetOf, workloadAtRung } from '../src/budget-catalog';
import { runRefoldFlow } from '../src/flows';

/** Measure the refold composition in one mode at one rung. */
function measureRefold(mode: 'batched' | 'inflated', rung: string) {
  const workload = workloadAtRung('distinction-refold', rung, `${mode}-gate`);
  const hub = createCounterHub();
  runRefoldFlow(hub, workload, mode);
  const counts = sealMeasuredCounts({
    schema: 'epoch.performance.counts',
    schemaVersion: 1,
    tenantId: workload.tenantId,
    countsId: `counts:refold-${mode}-${rung}`,
    subject: 'distinction-refold',
    workloadId: workload.workloadId,
    workloadDigest: workload.contentDigest,
    counts: hub.snapshot(),
    measuredBy: 'principal:platform-engineer',
    provenance: { kind: 'observed', sourceRef: 'tests/performance/test/regression-gate.test.ts' },
  });
  if (!counts.ok) {
    throw new Error(JSON.stringify(counts.error));
  }
  const verdict = evaluateBudget({ workload, counts: counts.value, budget: budgetOf('distinction-refold') });
  if (!verdict.ok) {
    throw new Error(JSON.stringify(verdict.error));
  }
  return { workload, counts: counts.value, verdict: verdict.value };
}

describe('regression-gate-bites (the gate fails the suite on an over-budget composition)', () => {
  it('the inflated composition (fold after every admission) is OVER budget with exact counts', () => {
    const { verdict } = measureRefold('inflated', 'medium');
    expect(verdict.overall).toBe('over-budget');
    const foldFinding = verdict.perClass.find((finding) => finding.operationClass === 'kernel-fold')!;
    // The triangular sum at M=16: 16*17/2 = 136 fold records.
    expect(foldFinding.measured).toBe(136);
    expect(foldFinding.allowed).toBe(8 + 2 * 16);
    expect(foldFinding.exceededBy).toBe(136 - (8 + 2 * 16));
  });

  it('the gate FAILS on the over-budget verdict (typed error, exact counts)', () => {
    const { verdict } = measureRefold('inflated', 'medium');
    let thrown: PerformanceBudgetExceededError | undefined;
    try {
      enforceBudgets([verdict]);
    } catch (error) {
      thrown = error as PerformanceBudgetExceededError;
    }
    expect(thrown).toBeInstanceOf(PerformanceBudgetExceededError);
    expect(thrown!.message).toContain('PERFORMANCE-BUDGET-EXCEEDED');
    expect(thrown!.message).toContain('distinction-refold');
    expect(thrown!.violations[0]!.exceeded[0]!.operationClass).toBe('kernel-fold');
    expect(thrown!.violations[0]!.exceeded[0]!.measured).toBe(136);
  });

  it('a within-budget batched verdict mixed with the over-budget one still fails (no masking)', () => {
    const batched = measureRefold('batched', 'medium');
    expect(batched.verdict.overall).toBe('within-budget');
    const inflated = measureRefold('inflated', 'medium');
    expect(() => enforceBudgets([batched.verdict, inflated.verdict])).toThrow(PerformanceBudgetExceededError);
  });

  it('RESTORED: the batched composition enforces cleanly (the suite recovers)', () => {
    const { verdict } = measureRefold('batched', 'medium');
    expect(verdict.overall).toBe('within-budget');
    expect(() => enforceBudgets([verdict])).not.toThrow();
  });

  it('the smallest inflated rung already exceeds (the gate bites early)', () => {
    const { verdict } = measureRefold('inflated', 'small');
    // At M=8: 8*9/2 = 36 > 8 + 2*8 = 24.
    expect(verdict.overall).toBe('over-budget');
  });
});
