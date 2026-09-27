// SERVICE-LEVEL PROVIDER NEUTRALITY: no vendor, brand, marketplace,
// ERP, PM tool, or API surface can enter the learning-calibration host
// records — unknown structural fields surface as the typed
// `vendor-fields-rejected`; the host speaks no vendor names.
import { describe, expect, it } from 'vitest';
import { LearningCalibrationRuntime } from '../src/runtime';
import {
  PRINCIPAL,
  TENANT,
  T5,
  allowContext,
  candidateContent,
} from './helpers';
import { expectError } from './helpers';

const AUTH = { principalId: PRINCIPAL, context: allowContext() };

describe('vendor fields cannot enter through the host (strict objects)', () => {
  it('a candidate carrying a vendor field is vendor-fields-rejected at intake', () => {
    const runtime = new LearningCalibrationRuntime();
    const error = expectError(
      runtime.intakeLearningRecord({
        tenantId: TENANT,
        authorization: AUTH,
        candidate: { ...candidateContent(), vendorAccountId: 'acct-12345' },
        intakenAt: T5,
      }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
    expect(runtime.health().candidateCount).toBe(0);
  });

  it('a candidate embedding a vendor-poisoned comparison fact is rejected', () => {
    const runtime = new LearningCalibrationRuntime();
    const poisoned = {
      ...candidateContent(),
      comparisonFact: {
        ...(candidateContent().comparisonFact as Record<string, unknown>),
        vendorForecastTag: 'vendor',
      },
    };
    const error = expectError(
      runtime.intakeLearningRecord({
        tenantId: TENANT,
        authorization: AUTH,
        candidate: poisoned,
        intakenAt: T5,
      }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('the host surface carries no provider vocabulary (the neutral seam)', () => {
    // The record-source port is the ONLY external seam, and its surface
    // names no vendor (the in-memory reference adapter is the default).
    const runtime = new LearningCalibrationRuntime();
    const health = runtime.health();
    expect(Object.keys(health).sort()).toEqual([
      'candidateCount',
      'comparisonFactCount',
      'datasetCount',
      'eventCount',
      'metricSetCount',
      'outcomeRecordCount',
      'revisionCount',
      'scopeCount',
    ]);
    expect(health.scopeCount).toBe(0);
  });
});
