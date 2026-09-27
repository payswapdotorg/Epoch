// CONFIDENCE/CALIBRATION STATE — the deterministic calibration fold over
// immutable comparison facts, the honest-history checks, and the derived
// confidence.
import { describe, expect, it } from 'vitest';
import {
  foldCalibration,
  sealCalibrationState,
  verifySealedCalibrationState,
  sealComparisonFact,
  verifySealedComparisonFact,
} from '../src/index';
import { expectError, unwrap } from './helpers';
import {
  ACTIVITY_ID,
  SOLUTION_ID,
  TENANT,
  T6,
  T7,
  T8,
  comparisonFactContent,
} from './fixtures';

function fact(
  overrides: Record<string, unknown> = {},
): import('../src/calibration').SealedComparisonFact {
  return unwrap(sealComparisonFact(comparisonFactContent(overrides)));
}

describe('the calibration fold (pure comparison of past forecasts vs actualized outcomes)', () => {
  it('folds comparison facts into a sealed calibration state with exact tallies', () => {
    const facts = [
      fact(), // over-forecast, deviation 11.5
      fact({
        factId: 'comparison-fact:pit-volume-f2-a2',
        comparisonRef: { recordId: 'comparison:pit-volume-f2-a2', contentDigest: 'e'.repeat(64) },
        forecastRef: { recordId: 'forecast:pit-volume-r2', contentDigest: 'a'.repeat(64) },
        actualRef: { recordId: 'actual:pit-volume-tuesday', contentDigest: 'b'.repeat(64) },
        forecastMeasure: { kind: 'quantity', value: '110', unit: 'm3' },
        actualMeasure: { kind: 'quantity', value: '115', unit: 'm3' },
        deviation: '5',
        bias: 'under-forecast',
        observedAt: T7,
      }),
      fact({
        factId: 'comparison-fact:pit-volume-f3-a3',
        comparisonRef: { recordId: 'comparison:pit-volume-f3-a3', contentDigest: 'f'.repeat(64) },
        forecastRef: { recordId: 'forecast:pit-volume-r3', contentDigest: 'c'.repeat(64) },
        actualRef: { recordId: 'actual:pit-volume-wednesday', contentDigest: 'd'.repeat(64) },
        forecastMeasure: { kind: 'quantity', value: '120', unit: 'm3' },
        actualMeasure: { kind: 'quantity', value: '120', unit: 'm3' },
        deviation: '0',
        bias: 'exact',
        observedAt: T8,
      }),
    ];
    const state = unwrap(
      foldCalibration(
        { tenantId: TENANT, solutionId: SOLUTION_ID },
        { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
        facts,
      ),
    );
    expect(state.comparisonCount).toBe(3);
    expect(state.overCount).toBe(1);
    expect(state.underCount).toBe(1);
    expect(state.exactCount).toBe(1);
    expect(state.totalAbsoluteDeviation).toBe('16.5');
    expect(state.worstDeviation).not.toBeNull();
    expect(state.worstDeviation!.deviation).toBe('11.5');
    expect(state.worstDeviation!.comparisonRef.recordId).toBe('comparison:pit-volume-f1-a1');
    expect(state.measureKind).toBe('quantity');
    expect(state.unit).toBe('m3');
    // The derived confidence: exact fraction 1/3.
    expect(state.confidence.method).toBe('derived');
    expect(state.confidence.value).toBeCloseTo(1 / 3, 10);
    expect(state.confidence.rationale).toContain('1/3');
  });

  it('identical fact sets derive identical calibration ids and digests (determinism)', () => {
    const build = () =>
      foldCalibration(
        { tenantId: TENANT, solutionId: SOLUTION_ID },
        { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
        [
          fact(),
          fact({
            factId: 'comparison-fact:pit-volume-f2-a2',
            comparisonRef: { recordId: 'comparison:pit-volume-f2-a2', contentDigest: 'e'.repeat(64) },
            forecastRef: { recordId: 'forecast:pit-volume-r2', contentDigest: 'a'.repeat(64) },
            actualRef: { recordId: 'actual:pit-volume-tuesday', contentDigest: 'b'.repeat(64) },
            forecastMeasure: { kind: 'quantity', value: '110', unit: 'm3' },
            actualMeasure: { kind: 'quantity', value: '115', unit: 'm3' },
            deviation: '5',
            bias: 'under-forecast',
            observedAt: T7,
          }),
        ],
      );
    const a = unwrap(build());
    const b = unwrap(build());
    expect(a.calibrationId).toBe(b.calibrationId);
    expect(a.contentDigest).toBe(b.contentDigest);
  });

  it('the sealed calibration state round-trips through JSON and verifies', () => {
    const state = unwrap(
      foldCalibration(
        { tenantId: TENANT, solutionId: SOLUTION_ID },
        { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
        [fact()],
      ),
    );
    const roundTrip = verifySealedCalibrationState(JSON.parse(JSON.stringify(state)));
    expect(roundTrip.ok).toBe(true);
    const tampered = verifySealedCalibrationState({ ...state, overCount: 99 });
    expect(tampered.ok).toBe(false);
    expect(!tampered.ok && tampered.error.code).toBe('digest-mismatch');
  });

  it('honest history: a fact whose deviation does not match its measures is rejected at the fold', () => {
    const dishonest = fact({ deviation: '99' });
    const error = expectError(
      foldCalibration(
        { tenantId: TENANT, solutionId: SOLUTION_ID },
        { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
        [dishonest],
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('honest history: a fact whose bias does not match its measures is rejected at the fold', () => {
    const dishonest = fact({ bias: 'under-forecast' });
    const error = expectError(
      foldCalibration(
        { tenantId: TENANT, solutionId: SOLUTION_ID },
        { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
        [dishonest],
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('mixed measure kinds or units across the group are typed validation rejections', () => {
    const mixed = fact({
      forecastMeasure: { kind: 'cost', amount: '130', currency: 'EUR' },
      actualMeasure: { kind: 'cost', amount: '118.5', currency: 'EUR' },
      deviation: '11.5',
    });
    const error = expectError(
      foldCalibration(
        { tenantId: TENANT, solutionId: SOLUTION_ID },
        { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
        [fact(), mixed],
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('duplicate comparison references in one group are rejected', () => {
    const error = expectError(
      foldCalibration(
        { tenantId: TENANT, solutionId: SOLUTION_ID },
        { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
        [fact(), fact({ observedAt: T7 })],
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('cross-tenant facts are tenant-isolation rejections', () => {
    const foreign = fact({ tenantId: 'tenant:initech' });
    const error = expectError(
      foldCalibration(
        { tenantId: TENANT, solutionId: SOLUTION_ID },
        { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
        [foreign],
      ),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('a tampered comparison fact is a typed digest-mismatch', () => {
    const sealed = fact();
    const verified = verifySealedComparisonFact({ ...sealed, deviation: '1' });
    expect(verified.ok).toBe(false);
    expect(!verified.ok && verified.error.code).toBe('digest-mismatch');
  });

  it('a malformed calibration state content is a typed validation rejection', () => {
    const error = sealCalibrationState({ schema: 'nope' });
    expect(error.ok).toBe(false);
    expect(!error.ok && error.error.code).toBe('validation');
  });

  it('an empty fold is a typed validation rejection', () => {
    const error = foldCalibration(
      { tenantId: TENANT, solutionId: SOLUTION_ID },
      { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
      [],
    );
    expect(error.ok).toBe(false);
    expect(!error.ok && error.error.code).toBe('validation');
  });
});

void T6;
