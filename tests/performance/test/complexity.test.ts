// W034 — complexity-class verification: measured count ratios across the
// doubling ladder rungs prove the declared class per (subject,
// operation-class) pair (`complexity-class-verified`); the inflated
// refold composition proves the analyzer DETECTS the quadratic
// signature (and flags it as a mismatch against a linear declaration).
import { describe, expect, it } from 'vitest';
import {
  analyzeComplexity,
  createCounterHub,
  sealComplexityModel,
  verifySealedComplexityAnalysis,
  type ComplexitySample,
  type SealedComplexityModel,
} from '@epoch/performance';
import { COMPLEXITY_MODELS, grammarOf, workloadAtRung } from '../src/budget-catalog';
import { measureSubject } from '../src/measure';
import { runRefoldFlow } from '../src/flows';

/** The refold mode a model's samples are measured in (the quadratic model models the inflated composition). */
function refoldModeOf(model: SealedComplexityModel): 'batched' | 'inflated' {
  return model.declaredClass === 'quadratic' ? 'inflated' : 'batched';
}

/** Collect the measured samples of one model across its subject's ladder. */
function samplesOfModel(model: SealedComplexityModel): ComplexitySample[] {
  const grammar = grammarOf(model.subject);
  return grammar.ladder.rungs.map((rung) => {
    const measurement = measureSubject(model.subject, rung.label, {
      mode: model.subject === 'distinction-refold' ? refoldModeOf(model) : 'batched',
    });
    return { inputSize: rung.inputSize, measuredCount: measurement.counts.counts[model.operationClass] };
  });
}

/** A linear-declared variant of a catalog model (the batched expectation). */
function linearVariantOf(model: SealedComplexityModel): SealedComplexityModel {
  const { contentDigest: _drop, ...content } = model;
  void _drop;
  const sealed = sealComplexityModel({
    ...content,
    modelId: 'complexity-model:refold-linear-expectation',
    declaredClass: 'linear',
    rationale:
      'The batched fold discipline: ONE fold over the completed ledger — linear in the observation count (the expected composition).',
  });
  if (!sealed.ok) {
    throw new Error(JSON.stringify(sealed.error));
  }
  return sealed.value;
}

describe('complexity-class-verified (measured count ratios across doubling rungs)', () => {
  it('every catalog model verifies against its measured samples', () => {
    for (const model of COMPLEXITY_MODELS) {
      const samples = samplesOfModel(model);
      const analysis = analyzeComplexity({ model, ladder: grammarOf(model.subject).ladder, samples });
      expect(analysis.ok, `model ${model.modelId}`).toBe(true);
      if (!analysis.ok) {
        throw new Error(JSON.stringify(analysis.error));
      }
      expect(
        analysis.value.verdict,
        `${model.subject}/${model.operationClass} samples=${JSON.stringify(samples)} findings=${JSON.stringify(analysis.value.findings)}`,
      ).toBe('complexity-class-verified');
      // The analysis record verifies (tamper-free, content-addressed).
      const verified = verifySealedComplexityAnalysis(analysis.value);
      expect(verified.ok).toBe(true);
    }
  }, 120000);

  it('the linear folds double their counts when the input doubles (ratio evidence)', () => {
    const model = COMPLEXITY_MODELS.find((candidate) => candidate.modelId === 'complexity-model:program-fold-linear')!;
    const analysis = analyzeComplexity({
      model,
      ladder: grammarOf('program-fold').ladder,
      samples: samplesOfModel(model),
    });
    expect(analysis.ok).toBe(true);
    if (!analysis.ok) {
      throw new Error(JSON.stringify(analysis.error));
    }
    for (const finding of analysis.value.findings) {
      // measured ratio ~ 2 (exactly: (3*2N + ...)/(3N + ...), just above 2).
      expect(finding.ratioNumerator / finding.ratioDenominator).toBeGreaterThan(1.9);
      expect(finding.ratioNumerator / finding.ratioDenominator).toBeLessThan(2.2);
    }
  });

  it('the constant admission path keeps flat counts (ratio ~1)', () => {
    const model = COMPLEXITY_MODELS.find((candidate) => candidate.modelId === 'complexity-model:solution-admission-constant')!;
    const samples = samplesOfModel(model);
    const analysis = analyzeComplexity({
      model,
      ladder: grammarOf('solution-admission').ladder,
      samples,
    });
    expect(analysis.ok).toBe(true);
    if (!analysis.ok) {
      throw new Error(JSON.stringify(analysis.error));
    }
    expect(analysis.value.verdict).toBe('complexity-class-verified');
    expect(new Set(samples.map((sample) => sample.measuredCount)).size).toBe(1);
  });

  it('the harness seam doubles with the step count (the double-run discipline, slope 4)', () => {
    const small = measureSubject('harness-scenario', 'small');
    const large = measureSubject('harness-scenario', 'large');
    expect(small.counts.counts['harness-scenario']).toBe(4 * small.verdict.inputSize + 4);
    expect(large.counts.counts['harness-scenario']).toBe(4 * large.verdict.inputSize + 4);
  });
});

describe('the quadratic signature is DETECTED (mismatch against a linear declaration)', () => {
  it('the inflated refold composition fails a LINEAR model (the analyzer bites)', () => {
    // The inflated refold is quadratic: measure it at every observation rung.
    const grammar = grammarOf('distinction-refold');
    const samples: ComplexitySample[] = grammar.ladder.rungs.map((rung) => {
      const workload = workloadAtRung('distinction-refold', rung.label, 'inflated-mode');
      const hub = createCounterHub();
      runRefoldFlow(hub, workload, 'inflated');
      return { inputSize: rung.inputSize, measuredCount: hub.snapshot()['kernel-fold'] };
    });
    // The measured counts are the triangular sums M(M+1)/2.
    for (const sample of samples) {
      expect(sample.measuredCount).toBe((sample.inputSize * (sample.inputSize + 1)) / 2);
    }
    // Declared LINEAR (the batched expectation): the quadratic counts mismatch.
    const quadraticModel = COMPLEXITY_MODELS.find((candidate) => candidate.modelId === 'complexity-model:refold-quadratic')!;
    const asLinear = linearVariantOf(quadraticModel);
    const mismatch = analyzeComplexity({ model: asLinear, ladder: grammar.ladder, samples });
    expect(mismatch.ok).toBe(true);
    if (!mismatch.ok) {
      throw new Error(JSON.stringify(mismatch.error));
    }
    expect(mismatch.value.verdict).toBe('complexity-class-mismatch');
    // Declared QUADRATIC (the honest model of the inflated composition): verified.
    const verified = analyzeComplexity({ model: quadraticModel, ladder: grammar.ladder, samples });
    expect(verified.ok).toBe(true);
    if (!verified.ok) {
      throw new Error(JSON.stringify(verified.error));
    }
    expect(verified.value.verdict).toBe('complexity-class-verified');
  });

  it('the batched refold composition verifies LINEAR (the correct discipline)', () => {
    const quadraticModel = COMPLEXITY_MODELS.find((candidate) => candidate.modelId === 'complexity-model:refold-quadratic')!;
    const asLinear = linearVariantOf(quadraticModel);
    const grammar = grammarOf('distinction-refold');
    const samples: ComplexitySample[] = grammar.ladder.rungs.map((rung) => {
      const measurement = measureSubject('distinction-refold', rung.label, { mode: 'batched' });
      return { inputSize: rung.inputSize, measuredCount: measurement.counts.counts['kernel-fold'] };
    });
    const analysis = analyzeComplexity({ model: asLinear, ladder: grammar.ladder, samples });
    expect(analysis.ok).toBe(true);
    if (!analysis.ok) {
      throw new Error(JSON.stringify(analysis.error));
    }
    expect(analysis.value.verdict).toBe('complexity-class-verified');
  });
});
