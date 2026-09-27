// Shared fixtures for the variance kernel tests. Builders return loose
// JSON objects so negative tests can corrupt single fields precisely.
// ZERO clock reads: every instant is a fixed constant.
export const T0 = '2026-04-06T08:00:00.000Z';
export const T1 = '2026-04-06T08:00:01.000Z';
export const T2 = '2026-04-06T08:00:02.000Z';
export const T3 = '2026-04-06T08:00:03.000Z';
export const T4 = '2026-04-06T08:00:04.000Z';
export const T5 = '2026-04-06T08:00:05.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const SOLUTION_ID = 'solution:tower-retrofit';
export const PRINCIPAL = 'principal:delivery-lead';
export const ACTIVITY_ID = 'activity:excavate';
export const EVIDENCE_DIGEST = 'a'.repeat(64);
export const EVIDENCE_DIGEST_2 = 'b'.repeat(64);

/** One valid confidence state (measured, high). */
export function confidence(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    method: 'measured',
    value: 0.9,
    rationale: 'grounded in the accepted delivery actuals',
    ...overrides,
  };
}

/** The standard band thresholds of the fixtures. */
export const THRESHOLDS = { minor: '10', material: '100', severe: '1000' };

/** The standard comparison tolerance of the fixtures. */
export const TOLERANCE = '5';

/** One variance computation input as loose JSON. */
export function varianceInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    varianceId: 'variance:pit-volume-quantity',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    subjectKind: 'activity',
    subjectId: ACTIVITY_ID,
    varianceClass: 'quantity',
    baselineRef: {
      kind: 'baseline',
      recordId: 'baseline:pit-volume-v1',
      contentDigest: '1'.repeat(64),
    },
    actualRef: {
      kind: 'actual',
      recordId: 'actual:pit-volume-monday',
      contentDigest: '2'.repeat(64),
    },
    baselineMeasure: { kind: 'quantity', value: '120', unit: 'm3' },
    actualMeasure: { kind: 'quantity', value: '118.5', unit: 'm3' },
    evidence: [EVIDENCE_DIGEST, EVIDENCE_DIGEST_2],
    confidence: confidence(),
    thresholds: THRESHOLDS,
    computedAt: T3,
    computedBy: PRINCIPAL,
    ...overrides,
  };
}

/** One attribution-record content as loose JSON. */
export function attributionContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.variance.attribution-record',
    schemaVersion: 1,
    attributionId: 'attribution:pit-volume-geometry',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    varianceRef: {
      recordId: 'variance:pit-volume-quantity',
      contentDigest: '3'.repeat(64),
    },
    cause: {
      causeKind: 'issue-record',
      recordId: 'change:pit-geometry-revision',
      contentDigest: '4'.repeat(64),
    },
    evidence: [EVIDENCE_DIGEST],
    note: 'the geometry revision changed the measured pit volume',
    attributedAt: T4,
    attributedBy: PRINCIPAL,
    ...overrides,
  };
}

/** One prediction-comparison input as loose JSON (forecast-to-actual). */
export function comparisonInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    comparisonId: 'comparison:pit-volume-f1-a1',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    subjectKind: 'activity',
    subjectId: ACTIVITY_ID,
    comparisonKind: 'forecast-to-actual',
    fromRef: {
      kind: 'forecast',
      recordId: 'forecast:pit-volume-r1',
      contentDigest: '5'.repeat(64),
    },
    toRef: {
      kind: 'actual',
      recordId: 'actual:pit-volume-monday',
      contentDigest: '2'.repeat(64),
    },
    fromMeasure: { kind: 'quantity', value: '130', unit: 'm3' },
    toMeasure: { kind: 'quantity', value: '118.5', unit: 'm3' },
    tolerance: TOLERANCE,
    confidence: confidence(),
    comparedAt: T5,
    comparedBy: PRINCIPAL,
    ...overrides,
  };
}
