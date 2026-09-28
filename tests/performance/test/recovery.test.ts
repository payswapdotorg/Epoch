// W034 — recovery: an over-budget verdict is a TYPED RECORD, never a
// crash. The evaluation returns a sealed verdict carrying exact counts;
// the measured-counts pipeline continues operating afterwards (the
// suite recovers by construction).
import { describe, expect, it } from 'vitest';
import {
  evaluateBudget,
  verifySealedBudgetVerdict,
  verifySealedMeasuredCounts,
  collectBudgetViolations,
} from '@epoch/performance';
import { budgetOf } from '../src/budget-catalog';
import { measureSubject } from '../src/measure';

describe('recovery (an over-budget verdict is a typed record, never a crash)', () => {
  it('evaluateBudget returns a SEALED over-budget record (no exception thrown)', () => {
    const inflated = measureSubject('distinction-refold', 'medium', { mode: 'inflated' });
    // measureSubject never threw — the evaluation produced a record:
    expect(inflated.verdict.overall).toBe('over-budget');
    expect(inflated.verdict.perClass.length).toBeGreaterThan(0);
    // The verdict record verifies (content-addressed, tamper-free):
    const verified = verifySealedBudgetVerdict(inflated.verdict);
    expect(verified.ok).toBe(true);
    // The counts record verifies too:
    const verifiedCounts = verifySealedMeasuredCounts(inflated.counts);
    expect(verifiedCounts.ok).toBe(true);
  });

  it('the over-budget record carries the exact exceeded envelope + counts', () => {
    const inflated = measureSubject('distinction-refold', 'large', { mode: 'inflated' });
    const foldFinding = inflated.verdict.perClass.find((finding) => finding.operationClass === 'kernel-fold')!;
    const m = inflated.verdict.inputSize;
    expect(foldFinding.measured).toBe((m * (m + 1)) / 2);
    expect(foldFinding.allowed).toBe(8 + 2 * m);
    expect(foldFinding.exceededBy).toBe(foldFinding.measured - foldFinding.allowed);
    expect(inflated.verdict.workloadId).toContain('distinction-refold-large');
  });

  it('the pipeline recovers: a subsequent healthy measurement evaluates + verifies cleanly', () => {
    const inflated = measureSubject('distinction-refold', 'medium', { mode: 'inflated' });
    expect(inflated.verdict.overall).toBe('over-budget');
    // The very same pipeline immediately measures a healthy composition:
    const healthy = measureSubject('observation-stack', 'medium');
    expect(healthy.verdict.overall).toBe('within-budget');
    expect(verifySealedBudgetVerdict(healthy.verdict).ok).toBe(true);
    // Violation collection separates the two (typed, not exceptional):
    const violations = collectBudgetViolations([healthy.verdict, inflated.verdict]);
    expect(violations.length).toBe(1);
    expect(violations[0]!.verdict.verdictId).toBe(inflated.verdict.verdictId);
  });

  it('tampered inputs to evaluation fail closed as typed records (never crashes)', () => {
    const measurement = measureSubject('observation-stack', 'small');
    const tamperedWorkload = { ...measurement.workload, contentDigest: 'f'.repeat(64) };
    const evaluation = evaluateBudget({
      workload: tamperedWorkload,
      counts: measurement.counts,
      budget: budgetOf('observation-stack'),
    });
    expect(evaluation.ok).toBe(false);
    if (evaluation.ok) {
      throw new Error('unreachable');
    }
    expect(evaluation.error.code).toBe('digest-mismatch');
    // The pristine evaluation still works afterwards:
    const retry = evaluateBudget({
      workload: measurement.workload,
      counts: measurement.counts,
      budget: budgetOf('observation-stack'),
    });
    expect(retry.ok).toBe(true);
  });
});
