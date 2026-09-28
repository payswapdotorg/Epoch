// W034 — scale-composition evidence: BOTH domain packs + the delivery
// stack at size, over ONE workload, against the composite budget. The
// composed flow exercises: the W036 spine (solution -> baseline ->
// program -> delivery), the W026 construction projections (BOQ,
// construction programme), the W027 software projections (roadmap,
// backlog, deployment plan), the W039 actualization + variance layers,
// the navigator projection over the full stack, and the W032 harness
// scenario — all counted in ONE measured-counts record and evaluated
// against ONE composite budget.
import { describe, expect, it } from 'vitest';
import { enforceBudgets } from '@epoch/performance';
import { grammarOf } from '../src/budget-catalog';
import { measureSubject } from '../src/measure';

const RUNGS = ['small', 'medium', 'large', 'x-large', 'xx-large'] as const;

describe('the composed stack at size (both packs + the delivery spine)', () => {
  it('every ladder rung composes the full stack within the composite budget (and the gate enforces)', () => {
    for (const rung of RUNGS) {
      const measurement = measureSubject('delivery-stack-composition', rung);
      expect(
        measurement.verdict.overall,
        `composition @ ${rung} (planLines ${measurement.verdict.inputSize}): ${JSON.stringify(measurement.counts.counts)}`,
      ).toBe('within-budget');
      enforceBudgets([measurement.verdict]);
    }
  });

  it('the composed counts grow linearly with the plan-line count (every operation class)', () => {
    const small = measureSubject('delivery-stack-composition', 'small');
    const large = measureSubject('delivery-stack-composition', 'large');
    const ratio = large.verdict.inputSize / small.verdict.inputSize;
    for (const operationClass of ['kernel-admission', 'digest-compute', 'kernel-fold', 'projection-compute'] as const) {
      const smallCount = small.counts.counts[operationClass];
      const largeCount = large.counts.counts[operationClass];
      // Linear growth with the documented constants (admission 0.5N,
      // digest 0.375N, fold 3.6875N, projection 7.6875N).
      expect(largeCount / smallCount, `${operationClass} growth`).toBeGreaterThan(ratio * 0.75);
      expect(largeCount / smallCount, `${operationClass} growth`).toBeLessThan(ratio * 1.25);
    }
    // The harness seam is constant in the composition grammar (16 steps).
    expect(large.counts.counts['harness-scenario']).toBe(small.counts.counts['harness-scenario']);
  });

  it('BOTH packs project over the same program (the cross-domain composition)', () => {
    const measurement = measureSubject('delivery-stack-composition', 'medium');
    // The grammar requests one full 5-surface cycle: the construction
    // surfaces (BOQ, construction programme) AND the software surfaces
    // (roadmap, backlog, deployment plan) all emitted rows.
    const workload = measurement.workload;
    const surfaces = new Set(workload.packProjections.map((request) => request.surface));
    expect([...surfaces].sort()).toEqual(['backlog', 'boq', 'construction-programme', 'deployment-plan', 'roadmap']);
    // The measured projection rows include the pack cycle AND the
    // navigator rows over the full stack.
    expect(measurement.counts.counts['projection-compute']).toBeGreaterThan(0);
    expect(measurement.summary.navigatorRows).toBeGreaterThan(0);
  });

  it('the composed stack did real kernel work (actuals minted, variances recorded, observations folded)', () => {
    const measurement = measureSubject('delivery-stack-composition', 'medium');
    const n = measurement.verdict.inputSize;
    const expectedObservations = Math.ceil(n / 8);
    expect(measurement.summary.actualCount).toBe(expectedObservations);
    expect(measurement.summary.varianceCount).toBe(expectedObservations);
    expect(measurement.summary.solutionDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(measurement.summary.programDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(measurement.summary.deliveryDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the composition grammar is declared data (observations = ceil(N/8), one surface cycle, 16 harness steps)', () => {
    const grammar = grammarOf('delivery-stack-composition');
    const shape = grammar.shapeAt(64);
    expect(shape).toEqual({ planLines: 64, observations: 8, packProjections: 5, scenarioSteps: 16 });
    const measurement = measureSubject('delivery-stack-composition', 'medium');
    expect(measurement.workload.sizes.observations).toBe(Math.ceil(measurement.workload.sizes.planLines / 8));
  });
});
