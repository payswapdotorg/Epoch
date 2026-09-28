// W034 — complexity models + ratio analysis: exact rational bounds,
// verified/mismatch verdicts, ladder discipline, tamper detection,
// round trips (synthetic counts — real kernel ratios live in
// tests/performance).
import { describe, expect, it } from 'vitest';
import {
  ratioWithinBounds,
  COMPLEXITY_CLASS_BOUNDS,
  isDoublingLadder,
  sealComplexityModel,
  verifySealedComplexityModel,
  analyzeComplexity,
  serializeComplexityModel,
  deserializeComplexityModel,
  serializeComplexityAnalysis,
  deserializeComplexityAnalysis,
  verifySealedComplexityAnalysis,
  type ScaleLadder,
  type SealedComplexityModel,
  type ComplexitySample,
} from '../src/index';
import { expectError, ok } from './helpers';

const TENANT = 'tenant:globex';

const LADDER: ScaleLadder = {
  ladderId: 'ladder:synthetic',
  rungs: [
    { label: 'small', inputSize: 8 },
    { label: 'medium', inputSize: 16 },
    { label: 'large', inputSize: 32 },
  ],
};

const LINEAR_SAMPLES: ComplexitySample[] = [
  { inputSize: 8, measuredCount: 16 },
  { inputSize: 16, measuredCount: 32 },
  { inputSize: 32, measuredCount: 64 },
];

const QUADRATIC_SAMPLES: ComplexitySample[] = [
  { inputSize: 8, measuredCount: 36 }, // 8*9/2
  { inputSize: 16, measuredCount: 136 }, // 16*17/2
  { inputSize: 32, measuredCount: 528 }, // 32*33/2
];

const CONSTANT_SAMPLES: ComplexitySample[] = [
  { inputSize: 8, measuredCount: 3 },
  { inputSize: 16, measuredCount: 3 },
  { inputSize: 32, measuredCount: 3 },
];

function mustSealModel(declaredClass: 'constant' | 'linear' | 'quadratic'): SealedComplexityModel {
  return ok(
    sealComplexityModel({
      schema: 'epoch.performance.complexity-model',
      schemaVersion: 1,
      tenantId: TENANT,
      modelId: `complexity-model:synthetic-${declaredClass}`,
      subject: 'synthetic-subject',
      operationClass: 'kernel-fold',
      declaredClass,
      rationale: 'synthetic model for the analysis battery',
      provenance: { kind: 'derived', sourceRef: 'test:complexity' },
    }),
    'seal model',
  );
}

describe('exact rational ratio bounds (integer cross-multiplication)', () => {
  it('constant bounds accept ~1 ratios and reject drift', () => {
    expect(ratioWithinBounds(1, 1, COMPLEXITY_CLASS_BOUNDS.constant)).toBe(true);
    expect(ratioWithinBounds(3, 2, COMPLEXITY_CLASS_BOUNDS.constant)).toBe(true); // 1.5 = upper bound
    expect(ratioWithinBounds(1, 2, COMPLEXITY_CLASS_BOUNDS.constant)).toBe(true); // 0.5 = lower bound
    expect(ratioWithinBounds(7, 4, COMPLEXITY_CLASS_BOUNDS.constant)).toBe(false); // 1.75
  });

  it('linear bounds accept ~2 ratios and reject constants/quadratics', () => {
    expect(ratioWithinBounds(2, 1, COMPLEXITY_CLASS_BOUNDS.linear)).toBe(true);
    expect(ratioWithinBounds(3, 2, COMPLEXITY_CLASS_BOUNDS.linear)).toBe(true); // 1.5 = lower bound
    expect(ratioWithinBounds(5, 2, COMPLEXITY_CLASS_BOUNDS.linear)).toBe(true); // 2.5 = upper bound
    expect(ratioWithinBounds(1, 1, COMPLEXITY_CLASS_BOUNDS.linear)).toBe(false);
    expect(ratioWithinBounds(4, 1, COMPLEXITY_CLASS_BOUNDS.linear)).toBe(false);
  });

  it('quadratic bounds accept ~4 ratios', () => {
    expect(ratioWithinBounds(4, 1, COMPLEXITY_CLASS_BOUNDS.quadratic)).toBe(true);
    expect(ratioWithinBounds(3, 1, COMPLEXITY_CLASS_BOUNDS.quadratic)).toBe(true); // lower bound
    expect(ratioWithinBounds(5, 1, COMPLEXITY_CLASS_BOUNDS.quadratic)).toBe(true); // upper bound
    expect(ratioWithinBounds(2, 1, COMPLEXITY_CLASS_BOUNDS.quadratic)).toBe(false);
  });

  it('zero denominators and negative numerators fail closed', () => {
    expect(ratioWithinBounds(1, 0, COMPLEXITY_CLASS_BOUNDS.linear)).toBe(false);
    expect(ratioWithinBounds(-1, 1, COMPLEXITY_CLASS_BOUNDS.linear)).toBe(false);
  });
});

describe('ladder discipline (sizes are data)', () => {
  it('recognizes doubling ladders', () => {
    expect(isDoublingLadder(LADDER)).toBe(true);
    expect(
      isDoublingLadder({ ladderId: 'ladder:bad', rungs: [{ label: 'a', inputSize: 8 }, { label: 'b', inputSize: 24 }] }),
    ).toBe(false);
  });
});

describe('analyzeComplexity (measured ratios -> the sealed verdict)', () => {
  it('verifies a linear model on exactly doubling counts', () => {
    const analysis = ok(analyzeComplexity({ model: mustSealModel('linear'), ladder: LADDER, samples: LINEAR_SAMPLES }), 'analyze');
    expect(analysis.verdict).toBe('complexity-class-verified');
    expect(analysis.findings.length).toBe(2);
    expect(analysis.findings[0]!.ratioNumerator).toBe(2);
    expect(analysis.findings[0]!.ratioDenominator).toBe(1);
  });

  it('verifies a constant model on flat counts', () => {
    const analysis = ok(
      analyzeComplexity({ model: mustSealModel('constant'), ladder: LADDER, samples: CONSTANT_SAMPLES }),
      'analyze',
    );
    expect(analysis.verdict).toBe('complexity-class-verified');
  });

  it('verifies a quadratic model on squared counts', () => {
    const analysis = ok(
      analyzeComplexity({ model: mustSealModel('quadratic'), ladder: LADDER, samples: QUADRATIC_SAMPLES }),
      'analyze',
    );
    expect(analysis.verdict).toBe('complexity-class-verified');
    expect(analysis.findings[0]!.ratioNumerator / analysis.findings[0]!.ratioDenominator).toBeGreaterThan(3.5);
  });

  it('flags a mismatch when quadratic counts meet a linear model', () => {
    const analysis = ok(
      analyzeComplexity({ model: mustSealModel('linear'), ladder: LADDER, samples: QUADRATIC_SAMPLES }),
      'analyze',
    );
    expect(analysis.verdict).toBe('complexity-class-mismatch');
    expect(analysis.findings.every((finding) => finding.withinBounds)).toBe(false);
  });

  it('flags a mismatch when constant counts meet a linear model', () => {
    const analysis = ok(
      analyzeComplexity({ model: mustSealModel('linear'), ladder: LADDER, samples: CONSTANT_SAMPLES }),
      'analyze',
    );
    expect(analysis.verdict).toBe('complexity-class-mismatch');
  });

  it('reduces ratios to exact fractions', () => {
    const analysis = ok(
      analyzeComplexity({
        model: mustSealModel('linear'),
        ladder: LADDER,
        samples: [
          { inputSize: 8, measuredCount: 10 },
          { inputSize: 16, measuredCount: 15 },
          { inputSize: 32, measuredCount: 20 },
        ],
      }),
      'analyze',
    );
    expect(analysis.findings[0]!.ratioNumerator).toBe(3);
    expect(analysis.findings[0]!.ratioDenominator).toBe(2);
  });

  it('identical samples derive identical analysis digests (determinism)', () => {
    const first = ok(analyzeComplexity({ model: mustSealModel('linear'), ladder: LADDER, samples: LINEAR_SAMPLES }), 'analyze');
    const second = ok(analyzeComplexity({ model: mustSealModel('linear'), ladder: LADDER, samples: LINEAR_SAMPLES }), 'analyze');
    expect(first.contentDigest).toBe(second.contentDigest);
  });
});

describe('analyzeComplexity guards (typed failures, never exceptions)', () => {
  it('rejects a non-doubling ladder', () => {
    const failure = expectError(
      analyzeComplexity({
        model: mustSealModel('linear'),
        ladder: { ladderId: 'ladder:bad', rungs: [{ label: 'a', inputSize: 8 }, { label: 'b', inputSize: 12 }] },
        samples: [
          { inputSize: 8, measuredCount: 16 },
          { inputSize: 12, measuredCount: 24 },
        ],
      }),
      'analyze non-doubling',
    );
    expect(failure.code).toBe('performance-invalid');
  });

  it('rejects incomplete samples (a rung without a measurement)', () => {
    const failure = expectError(
      analyzeComplexity({
        model: mustSealModel('linear'),
        ladder: LADDER,
        samples: [
          { inputSize: 8, measuredCount: 16 },
          { inputSize: 32, measuredCount: 64 },
        ],
      }),
      'analyze incomplete',
    );
    expect(failure.code).toBe('performance-invalid');
    expect(String(failure.message)).toContain('16');
  });

  it('rejects duplicate sample sizes', () => {
    const failure = expectError(
      analyzeComplexity({
        model: mustSealModel('linear'),
        ladder: LADDER,
        samples: [
          { inputSize: 8, measuredCount: 16 },
          { inputSize: 8, measuredCount: 20 },
          { inputSize: 16, measuredCount: 32 },
          { inputSize: 32, measuredCount: 64 },
        ],
      }),
      'analyze duplicates',
    );
    expect(failure.code).toBe('performance-invalid');
    expect(String(failure.message)).toContain('duplicate');
  });

  it('rejects a tampered model (digest mismatch)', () => {
    const failure = expectError(
      analyzeComplexity({
        model: { ...mustSealModel('linear'), declaredClass: 'constant' },
        ladder: LADDER,
        samples: LINEAR_SAMPLES,
      }),
      'analyze tampered model',
    );
    expect(failure.code).toBe('digest-mismatch');
  });

  it('rejects a malformed ladder shape', () => {
    const failure = expectError(
      analyzeComplexity({
        model: mustSealModel('linear'),
        ladder: { ladderId: 'ladder:bad', rungs: [{ label: 'only', inputSize: 8 }] },
        samples: [{ inputSize: 8, measuredCount: 16 }],
      }),
      'analyze malformed ladder',
    );
    expect(failure.code).toBe('performance-invalid');
  });
});

describe('complexity record round trips + tamper detection', () => {
  const model = mustSealModel('linear');
  const analysis = ok(analyzeComplexity({ model, ladder: LADDER, samples: LINEAR_SAMPLES }), 'analyze');

  it('model: serialize + deserialize byte-identically with a verifying digest', () => {
    const text = serializeComplexityModel(model);
    const round = ok(deserializeComplexityModel(text, model.contentDigest), 'deserialize model');
    expect(round.digestVerifies).toBe(true);
    expect(serializeComplexityModel(round.record)).toBe(text);
  });

  it('model: verify detects a tampered rationale', () => {
    const failure = expectError(
      verifySealedComplexityModel({ ...model, rationale: 'edited after sealing' }),
      'verify model',
    );
    expect(failure.code).toBe('digest-mismatch');
  });

  it('analysis: serialize + deserialize byte-identically with a verifying digest', () => {
    const text = serializeComplexityAnalysis(analysis);
    const round = ok(deserializeComplexityAnalysis(text, analysis.contentDigest), 'deserialize analysis');
    expect(round.digestVerifies).toBe(true);
    expect(serializeComplexityAnalysis(round.record)).toBe(text);
  });

  it('analysis: verify detects a forged verdict field', () => {
    const failure = expectError(
      verifySealedComplexityAnalysis({ ...analysis, verdict: 'complexity-class-mismatch' }),
      'verify analysis',
    );
    expect(failure.code).toBe('digest-mismatch');
  });

  it('analysis: a wrong claimed digest does not verify', () => {
    const round = ok(deserializeComplexityAnalysis(serializeComplexityAnalysis(analysis), 'd'.repeat(64)), 'deserialize analysis');
    expect(round.digestVerifies).toBe(false);
  });
});
