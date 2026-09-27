// IMMUTABLE HISTORICAL PREDICTION COMPARISON — the typed battery:
// forecast-revision and forecast-to-actual comparisons, the
// history-immutable guards (the named test), determinism, and the
// comparison bands.
import { describe, expect, it } from 'vitest';
import {
  admitPredictionComparison,
  computePredictionComparison,
  foldPredictionComparisons,
  openComparisonHistory,
  sealPredictionComparison,
  verifySealedPredictionComparison,
} from '../src/index';
import { expectError, unwrap } from './helpers';
import {
  OTHER_TENANT,
  PRINCIPAL,
  SOLUTION_ID,
  TENANT,
  TOLERANCE,
  T5,
  comparisonInput,
  confidence,
} from './fixtures';

describe('the deterministic comparison computation', () => {
  it('computes a forecast-to-actual comparison: deviation, direction, band', () => {
    const comparison = unwrap(computePredictionComparison(comparisonInput() as never));
    // |118.5 - 130| = 11.5 > tolerance 5 -> outside-tolerance; the actual
    // fell short of the forecast.
    expect(comparison.deviation).toBe('11.5');
    expect(comparison.direction).toBe('fell-short');
    expect(comparison.band).toBe('outside-tolerance');
    expect(comparison.comparisonKind).toBe('forecast-to-actual');
  });

  it('computes a forecast-revision comparison (the refinement chain)', () => {
    const comparison = unwrap(
      computePredictionComparison(
        comparisonInput({
          comparisonId: 'comparison:pit-volume-r1-r2',
          comparisonKind: 'forecast-revision',
          toRef: { kind: 'forecast', recordId: 'forecast:pit-volume-r2', contentDigest: '6'.repeat(64) },
          fromMeasure: { kind: 'quantity', value: '130', unit: 'm3' },
          toMeasure: { kind: 'quantity', value: '135', unit: 'm3' },
        }) as never,
      ),
    );
    expect(comparison.deviation).toBe('5');
    expect(comparison.direction).toBe('exceeded');
    expect(comparison.band).toBe('within-tolerance');
  });

  it('an exact match folds deviation 0 / direction exact / band exact', () => {
    const comparison = unwrap(
      computePredictionComparison(
        comparisonInput({
          toMeasure: { kind: 'quantity', value: '130', unit: 'm3' },
        }) as never,
      ),
    );
    expect(comparison.deviation).toBe('0');
    expect(comparison.direction).toBe('exact');
    expect(comparison.band).toBe('exact');
  });

  it('identical inputs derive identical digests (determinism)', () => {
    const a = unwrap(computePredictionComparison(comparisonInput() as never));
    const b = unwrap(computePredictionComparison(comparisonInput() as never));
    expect(a.contentDigest).toBe(b.contentDigest);
  });

  it('measure-kind mismatches are typed rejections', () => {
    const error = expectError(
      computePredictionComparison(
        comparisonInput({
          toMeasure: { kind: 'cost', amount: '118.5', currency: 'EUR' },
        }) as never,
      ),
    );
    expect(error.code).toBe('measure-kind-mismatch');
  });

  it('a malformed tolerance is a typed validation rejection', () => {
    const error = expectError(
      computePredictionComparison(comparisonInput({ tolerance: 'not-a-decimal' }) as never),
    );
    expect(error.code).toBe('validation');
  });

  it('a malformed comparison content is a typed validation rejection', () => {
    const error = sealPredictionComparison({ schema: 'nope' });
    expect(error.ok).toBe(false);
    expect(!error.ok && error.error.code).toBe('validation');
  });

  it('a comparison kind inconsistent with its refs is a typed validation rejection', () => {
    // A forecast-revision comparison whose later side is an ACTUAL: the
    // computation builds the content, and the seal rejects the
    // kind/ref inconsistency.
    const error = expectError(
      computePredictionComparison(
        comparisonInput({ comparisonKind: 'forecast-revision' }) as never,
      ),
    );
    expect(error.code).toBe('validation');
  });
});

describe('history-immutable (the named test)', () => {
  it('history-immutable: the same comparison id with different content', () => {
    let history = openComparisonHistory({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const first = unwrap(computePredictionComparison(comparisonInput() as never));
    history = unwrap(admitPredictionComparison(history, first));
    const mutated = unwrap(
      computePredictionComparison(
        comparisonInput({
          toMeasure: { kind: 'quantity', value: '125', unit: 'm3' },
        }) as never,
      ),
    );
    const error = expectError(admitPredictionComparison(history, mutated));
    expect(error.code).toBe('history-immutable');
    expect(error.message).toContain('immutable');
  });

  it('history-immutable: a different comparison for the SAME compared pair', () => {
    let history = openComparisonHistory({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const first = unwrap(computePredictionComparison(comparisonInput() as never));
    history = unwrap(admitPredictionComparison(history, first));
    const replacement = unwrap(
      computePredictionComparison(
        comparisonInput({
          comparisonId: 'comparison:pit-volume-f1-a1-replacement',
          toMeasure: { kind: 'quantity', value: '130', unit: 'm3' },
        }) as never,
      ),
    );
    const error = expectError(admitPredictionComparison(history, replacement));
    expect(error.code).toBe('history-immutable');
    expect(error.message).toContain('never a rewrite of the historical prediction');
  });

  it('the exact re-admission is idempotent (replay)', () => {
    let history = openComparisonHistory({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const first = unwrap(computePredictionComparison(comparisonInput() as never));
    history = unwrap(admitPredictionComparison(history, first));
    history = unwrap(admitPredictionComparison(history, first));
    expect(history.comparisons.length).toBe(1);
  });

  it('a NEW pair (new actual) admits cleanly — comparison against new actuals ships as a NEW pair', () => {
    let history = openComparisonHistory({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const first = unwrap(computePredictionComparison(comparisonInput() as never));
    history = unwrap(admitPredictionComparison(history, first));
    const second = unwrap(
      computePredictionComparison(
        comparisonInput({
          comparisonId: 'comparison:pit-volume-f1-a2',
          toRef: { kind: 'actual', recordId: 'actual:pit-volume-tuesday', contentDigest: '7'.repeat(64) },
        }) as never,
      ),
    );
    history = unwrap(admitPredictionComparison(history, second));
    expect(history.comparisons.length).toBe(2);
    expect(foldPredictionComparisons(history).map((c) => c.comparisonId)).toEqual([
      'comparison:pit-volume-f1-a1',
      'comparison:pit-volume-f1-a2',
    ]);
  });
});

describe('comparison record integrity', () => {
  it('a tampered comparison is a typed digest-mismatch', () => {
    const comparison = unwrap(computePredictionComparison(comparisonInput() as never));
    const tampered = { ...comparison, deviation: '1' };
    const verified = verifySealedPredictionComparison(tampered);
    expect(verified.ok).toBe(false);
    expect(!verified.ok && verified.error.code).toBe('digest-mismatch');
  });

  it('a sealed comparison round-trips through JSON and verifies', () => {
    const comparison = unwrap(computePredictionComparison(comparisonInput() as never));
    const roundTrip = verifySealedPredictionComparison(JSON.parse(JSON.stringify(comparison)));
    expect(roundTrip.ok).toBe(true);
    expect(roundTrip.ok && roundTrip.value.contentDigest).toBe(comparison.contentDigest);
  });

  it('tenant-isolation-rejected: a cross-tenant comparison', () => {
    const history = openComparisonHistory({ tenantId: TENANT, solutionId: SOLUTION_ID });
    const foreign = unwrap(
      computePredictionComparison(comparisonInput({ tenantId: OTHER_TENANT }) as never),
    );
    const error = expectError(admitPredictionComparison(history, foreign));
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('validation: a vendor field on the comparison is a vendor-fields rejection', () => {
    const error = expectError(
      sealPredictionComparison(
        comparisonInput({
          schema: 'epoch.variance.prediction-comparison',
          schemaVersion: 1,
          powerBIDashboard: 'dashboard-42',
        }),
      ),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });
});

void TOLERANCE;
void T5;
void PRINCIPAL;
void confidence;
