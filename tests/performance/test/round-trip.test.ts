// W034 — round-trip + digest verification for ALL four record families:
// budgets (the catalog), workloads (generated), counts (measured),
// verdicts (evaluated). Serialize -> deserialize -> byte-identical, with
// the claimed digest verifying; wrong claimed digests do NOT verify.
import { describe, expect, it } from 'vitest';
import {
  deserializeBudget,
  deserializeBudgetVerdict,
  deserializeMeasuredCounts,
  deserializeWorkload,
  serializeBudget,
  serializeBudgetVerdict,
  serializeMeasuredCounts,
  serializeWorkload,
  verifySealedBudget,
  verifySealedBudgetVerdict,
  verifySealedMeasuredCounts,
  verifySealedWorkload,
} from '@epoch/performance';
import { BUDGET_CATALOG } from '../src/budget-catalog';
import { measureSubject } from '../src/measure';

const SUBJECTS = [
  'solution-admission',
  'program-fold',
  'pack-projection',
  'observation-stack',
  'variance-stack',
  'harness-scenario',
  'delivery-stack-composition',
] as const;

describe('budget records round-trip + verify (the whole catalog)', () => {
  it('every catalog budget serializes, deserializes byte-identically, and verifies', () => {
    for (const budget of BUDGET_CATALOG) {
      const text = serializeBudget(budget);
      const round = deserializeBudget(text, budget.contentDigest);
      expect(round.ok, `budget ${budget.budgetId}`).toBe(true);
      if (!round.ok) {
        throw new Error(JSON.stringify(round.error));
      }
      expect(round.value.digestVerifies).toBe(true);
      expect(serializeBudget(round.value.record)).toBe(text);
      const verified = verifySealedBudget(budget);
      expect(verified.ok).toBe(true);
    }
  });

  it('a wrong claimed digest does not verify (the round-trip gate)', () => {
    const budget = BUDGET_CATALOG[0]!;
    const round = deserializeBudget(serializeBudget(budget), '0'.repeat(64));
    expect(round.ok).toBe(true);
    if (!round.ok) {
      throw new Error(JSON.stringify(round.error));
    }
    expect(round.value.digestVerifies).toBe(false);
  });
});

describe('workload records round-trip + verify', () => {
  it('every measured workload serializes, deserializes byte-identically, and verifies', () => {
    for (const subject of SUBJECTS) {
      const measurement = measureSubject(subject, 'small');
      const text = serializeWorkload(measurement.workload);
      const round = deserializeWorkload(text, measurement.workload.contentDigest);
      expect(round.ok, `workload of ${subject}`).toBe(true);
      if (!round.ok) {
        throw new Error(JSON.stringify(round.error));
      }
      expect(round.value.digestVerifies).toBe(true);
      expect(serializeWorkload(round.value.record)).toBe(text);
      expect(verifySealedWorkload(measurement.workload).ok).toBe(true);
    }
  });
});

describe('measured-counts records round-trip + verify', () => {
  it('every measured counts record serializes, deserializes byte-identically, and verifies', () => {
    for (const subject of SUBJECTS) {
      const measurement = measureSubject(subject, 'small');
      const text = serializeMeasuredCounts(measurement.counts);
      const round = deserializeMeasuredCounts(text, measurement.counts.contentDigest);
      expect(round.ok, `counts of ${subject}`).toBe(true);
      if (!round.ok) {
        throw new Error(JSON.stringify(round.error));
      }
      expect(round.value.digestVerifies).toBe(true);
      expect(serializeMeasuredCounts(round.value.record)).toBe(text);
      expect(verifySealedMeasuredCounts(measurement.counts).ok).toBe(true);
    }
  });
});

describe('budget-verdict records round-trip + verify', () => {
  it('every evaluated verdict serializes, deserializes byte-identically, and verifies', () => {
    for (const subject of SUBJECTS) {
      const measurement = measureSubject(subject, 'small');
      const text = serializeBudgetVerdict(measurement.verdict);
      const round = deserializeBudgetVerdict(text, measurement.verdict.contentDigest);
      expect(round.ok, `verdict of ${subject}`).toBe(true);
      if (!round.ok) {
        throw new Error(JSON.stringify(round.error));
      }
      expect(round.value.digestVerifies).toBe(true);
      expect(serializeBudgetVerdict(round.value.record)).toBe(text);
      expect(verifySealedBudgetVerdict(measurement.verdict).ok).toBe(true);
    }
  });

  it('an over-budget verdict also round-trips (it is a record like any other)', () => {
    const inflated = measureSubject('distinction-refold', 'small', { mode: 'inflated' });
    expect(inflated.verdict.overall).toBe('over-budget');
    const text = serializeBudgetVerdict(inflated.verdict);
    const round = deserializeBudgetVerdict(text, inflated.verdict.contentDigest);
    expect(round.ok).toBe(true);
    if (!round.ok) {
      throw new Error(JSON.stringify(round.error));
    }
    expect(round.value.digestVerifies).toBe(true);
    expect(serializeBudgetVerdict(round.value.record)).toBe(text);
  });
});
