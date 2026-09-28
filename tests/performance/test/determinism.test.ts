// W034 — determinism: reruns are byte-identical. Identical seeds derive
// identical workload digests; identical workloads derive identical
// measured counts and verdicts; the whole measurement pipeline is a
// pure function of its inputs (zero clock, zero randomness, zero
// network).
import { describe, expect, it } from 'vitest';
import {
  countsDigestOf,
  generateWorkload,
  serializeBudgetVerdict,
  serializeMeasuredCounts,
  serializeWorkload,
} from '@epoch/performance';
import { workloadAtRung } from '../src/budget-catalog';
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

describe('workload generator determinism', () => {
  it('the same seed derives byte-identical workloads (every subject grammar)', () => {
    for (const subject of SUBJECTS) {
      const first = workloadAtRung(subject, 'medium');
      const second = workloadAtRung(subject, 'medium');
      expect(serializeWorkload(first)).toBe(serializeWorkload(second));
      expect(first.contentDigest).toBe(second.contentDigest);
    }
  });

  it('two independent generations of the same seed are byte-identical', () => {
    const seed = {
      workloadId: 'workload:determinism-probe',
      tenantId: 'tenant:globex',
      shape: { planLines: 48, observations: 12, packProjections: 9, scenarioSteps: 24 },
      salt: 'probe',
    };
    const first = generateWorkload(seed);
    const second = generateWorkload(seed);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error('unreachable');
    }
    expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value));
  });

  it('different rungs derive different workloads (scale is real)', () => {
    const small = workloadAtRung('program-fold', 'small');
    const medium = workloadAtRung('program-fold', 'medium');
    expect(small.contentDigest).not.toBe(medium.contentDigest);
    expect(medium.sizes.planLines).toBe(small.sizes.planLines * 2);
  });
});

describe('measurement determinism (rerun = byte-identical counts + verdicts)', () => {
  it('every subject at the medium rung: two independent measurements agree byte-for-byte', () => {
    for (const subject of SUBJECTS) {
      const first = measureSubject(subject, 'medium', { salt: 'determinism-run' });
      const second = measureSubject(subject, 'medium', { salt: 'determinism-run' });
      expect(
        serializeMeasuredCounts(first.counts),
        `${subject}: measured counts differ between reruns`,
      ).toBe(serializeMeasuredCounts(second.counts));
      expect(first.counts.contentDigest).toBe(second.counts.contentDigest);
      expect(countsDigestOf(first.counts.counts)).toBe(countsDigestOf(second.counts.counts));
      expect(
        serializeBudgetVerdict(first.verdict),
        `${subject}: verdicts differ between reruns`,
      ).toBe(serializeBudgetVerdict(second.verdict));
      expect(first.verdict.contentDigest).toBe(second.verdict.contentDigest);
    }
  });

  it('the flow summaries (real kernel artifacts) are identical between reruns', () => {
    for (const subject of SUBJECTS) {
      const first = measureSubject(subject, 'small', { salt: 'determinism-summary' });
      const second = measureSubject(subject, 'small', { salt: 'determinism-summary' });
      expect(JSON.stringify(first.summary)).toBe(JSON.stringify(second.summary));
    }
  });

  it('the same workload measured through DIFFERENT salts yields the same counts (counts depend on shape, not identity)', () => {
    const first = measureSubject('variance-stack', 'medium', { salt: 'alpha' });
    const second = measureSubject('variance-stack', 'medium', { salt: 'beta' });
    expect(first.workload.contentDigest).not.toBe(second.workload.contentDigest);
    expect(serializeMeasuredCounts(first.counts)).toBe(
      serializeMeasuredCounts({
        ...second.counts,
        workloadId: first.counts.workloadId,
        workloadDigest: first.counts.workloadDigest,
        countsId: first.counts.countsId,
      } as never),
    );
  });
});
