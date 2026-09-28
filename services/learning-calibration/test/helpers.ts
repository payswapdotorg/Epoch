// Shared fixtures for the learning-calibration-runtime service tests.
// Builders return loose JSON objects so negative tests can corrupt
// single fields precisely. ZERO clock reads. W036 records are built
// through the REAL @epoch/solution-delivery pipelines; comparison facts
// seal through the REAL W039 @epoch/actualization kernel; the
// authorization contexts are REAL @epoch/authorization shapes (W009).
import { sealDistinctionRecord } from '@epoch/solution-delivery';
import type { SealedDistinctionRecord } from '@epoch/solution-delivery';
import type {
  SealedComparisonFactInput,
  SealedOutcomeLearningCandidate,
  UncertaintyState,
} from '@epoch/learning-calibration';
import type { AuthorizationContext } from '@epoch/authorization';
import {
  sealComparisonFactInput,
  sealOutcomeLearningCandidate,
} from '@epoch/learning-calibration';

/** Unwrap a total result or fail loudly (positive-path helper). */
export function unwrap<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): T {
  if (!result.ok) {
    throw new Error(`fixture failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** Assert a typed error code (negative-path helper). */
export function expectError<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): { readonly code: string; readonly message: string } {
  if (result.ok) {
    throw new Error(`expected a typed rejection, got ok: ${JSON.stringify(result.value)}`);
  }
  return result.error as { code: string; message: string };
}

export const T0 = '2026-04-06T08:00:00.000Z';
export const T1 = '2026-04-06T08:00:01.000Z';
export const T2 = '2026-04-06T08:00:02.000Z';
export const T3 = '2026-04-06T08:00:03.000Z';
export const T4 = '2026-04-06T08:00:04.000Z';
export const T5 = '2026-04-06T08:00:05.000Z';
export const T6 = '2026-04-06T08:00:06.000Z';
export const T7 = '2026-04-06T08:00:07.000Z';
export const T8 = '2026-04-06T08:00:08.000Z';
export const T9 = '2026-04-06T08:00:09.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const SOLUTION_ID = 'solution:tower-retrofit';
export const PRINCIPAL = 'principal:delivery-lead';
export const OBSERVER = 'principal:field-engineer';
export const ACTIVITY_ID = 'activity:excavate';
export const EVIDENCE_DIGEST = 'a'.repeat(64);
export const EVIDENCE_DIGEST_2 = 'b'.repeat(64);

export const BAND_THRESHOLDS = { minor: '5', material: '20', severe: '50' } as const;
export const TOLERANCE_BANDS = ['5', '10'] as const;
export const PACK_ID = 'epoch.construction.core';

/** One valid uncertainty state. */
export function uncertainty(overrides: Record<string, unknown> = {}): UncertaintyState {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:field-report', actor: OBSERVER },
    freshness: { state: 'fresh', assessedAt: T1 },
    confidence: { method: 'measured', value: 0.92, rationale: 'direct field measurement' },
    ...overrides,
  } as UncertaintyState;
}

/** One comparison-fact content builder (loose JSON). */
export function comparisonFactContent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema: 'epoch.actualization.comparison-fact',
    schemaVersion: 1,
    factId: 'comparison-fact:pit-volume-f1-a1',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    subject: { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
    comparisonRef: { recordId: 'comparison:pit-volume-f1-a1', contentDigest: 'd'.repeat(64) },
    forecastRef: { recordId: 'forecast:pit-volume-r1', contentDigest: 'e'.repeat(64) },
    actualRef: { recordId: 'actual:pit-volume-monday', contentDigest: 'f'.repeat(64) },
    forecastMeasure: { kind: 'quantity', value: '130', unit: 'm3' },
    actualMeasure: { kind: 'quantity', value: '118.5', unit: 'm3' },
    deviation: '11.5',
    bias: 'over-forecast',
    observedAt: T6,
    ...overrides,
  };
}

/** One sealed comparison-fact input. */
export function sealedComparisonFact(
  overrides: Record<string, unknown> = {},
): SealedComparisonFactInput {
  return unwrap(sealComparisonFactInput(comparisonFactContent(overrides)));
}

/** One W036 Outcome record content as loose JSON. */
export function outcomeContent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'outcome',
    recordId: 'outcome:pit-volume-delivered',
    tenantId: TENANT,
    subject: { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
    payload: { outcomeKind: 'delivered', verificationRefs: [EVIDENCE_DIGEST] },
    recordedAt: T5,
    recordedBy: PRINCIPAL,
    uncertainty: uncertainty(),
    ...overrides,
  };
}

/** One sealed W036 Outcome record. */
export function sealedOutcomeRecord(
  overrides: Record<string, unknown> = {},
): SealedDistinctionRecord {
  return unwrap(sealDistinctionRecord(outcomeContent(overrides)));
}

/** One candidate content builder (loose JSON; embeds sealed records). */
export function candidateContent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema: 'epoch.learning-calibration.candidate',
    schemaVersion: 1,
    candidateId: 'candidate:pit-volume-f1-a1',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    comparisonFact: sealedComparisonFact(),
    outcome: sealedOutcomeRecord(),
    validationEvidence: {
      state: 'corroborated',
      assessmentRef: {
        recordId: 'validation:pit-volume-group-1',
        contentDigest: '3'.repeat(64),
      },
    },
    varianceEvidence: {
      varianceClass: 'quantity',
      varianceRecordRef: {
        recordId: 'variance:pit-volume-f1-a1',
        contentDigest: '4'.repeat(64),
      },
      attribution: {
        cause: {
          causeKind: 'change-record',
          recordId: 'change:pit-volume-design-revision',
          contentDigest: '5'.repeat(64),
        },
        evidence: [EVIDENCE_DIGEST],
      },
    },
    packRef: { packId: PACK_ID, packVersion: '1.0.0', contentDigest: '1'.repeat(64) },
    realizationVariant: 'construction-build',
    ...overrides,
  };
}

/** One sealed outcome-learning candidate. */
export function sealedCandidate(
  overrides: Record<string, unknown> = {},
): SealedOutcomeLearningCandidate {
  return unwrap(sealOutcomeLearningCandidate(candidateContent(overrides)));
}

/** A family of three DISTINCT eligible candidates (the full-flow fixture). */
export function eligibleCandidates(): SealedOutcomeLearningCandidate[] {
  return [
    sealedCandidate(),
    sealedCandidate({
      candidateId: 'candidate:pit-volume-f2-a2',
      comparisonFact: sealedComparisonFact({
        factId: 'comparison-fact:pit-volume-f2-a2',
        comparisonRef: { recordId: 'comparison:pit-volume-f2-a2', contentDigest: '6'.repeat(64) },
        forecastRef: { recordId: 'forecast:pit-volume-r2', contentDigest: '7'.repeat(64) },
        actualRef: { recordId: 'actual:pit-volume-tuesday', contentDigest: '8'.repeat(64) },
        forecastMeasure: { kind: 'quantity', value: '40', unit: 'm3' },
        actualMeasure: { kind: 'quantity', value: '49.5', unit: 'm3' },
        deviation: '9.5',
        bias: 'under-forecast',
      }),
      outcome: sealedOutcomeRecord({
        recordId: 'outcome:pit-volume-accepted',
        payload: { outcomeKind: 'accepted', verificationRefs: [EVIDENCE_DIGEST_2] },
      }),
    }),
    sealedCandidate({
      candidateId: 'candidate:pit-volume-f3-a3',
      comparisonFact: sealedComparisonFact({
        factId: 'comparison-fact:pit-volume-f3-a3',
        comparisonRef: { recordId: 'comparison:pit-volume-f3-a3', contentDigest: '9'.repeat(64) },
        forecastRef: { recordId: 'forecast:pit-volume-r3', contentDigest: 'a2'.repeat(32) },
        actualRef: { recordId: 'actual:pit-volume-wednesday', contentDigest: 'b2'.repeat(32) },
        forecastMeasure: { kind: 'quantity', value: '25', unit: 'm3' },
        actualMeasure: { kind: 'quantity', value: '25', unit: 'm3' },
        deviation: '0',
        bias: 'exact',
      }),
      outcome: sealedOutcomeRecord({
        recordId: 'outcome:pit-volume-handover',
        payload: { outcomeKind: 'handover', verificationRefs: [EVIDENCE_DIGEST] },
      }),
    }),
  ];
}

// --------------------------------------------------------------------------------
// The W009 authorization contexts (REAL @epoch/authorization shapes).
// --------------------------------------------------------------------------------

/** The authorization context that allows the operation principal. */
export function allowContext(
  principalId: string = PRINCIPAL,
  tenantId: string = TENANT,
): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId, status: 'active', authenticated: true }],
    memberships: [{ principalId, tenantId }],
    knownTenants: [tenantId],
  };
}

/** The authorization context with an UNKNOWN principal (fail-closed deny). */
export function unknownPrincipalContext(): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [],
    memberships: [],
    knownTenants: [TENANT],
  };
}

/** The authorization context with a membership in ANOTHER tenant (R12 deny). */
export function foreignMembershipContext(): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
    memberships: [{ principalId: PRINCIPAL, tenantId: OTHER_TENANT }],
    knownTenants: [TENANT, OTHER_TENANT],
  };
}

/** The authorization context with an INACTIVE principal. */
export function inactivePrincipalContext(): AuthorizationContext {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'suspended', authenticated: true }],
    memberships: [{ principalId: PRINCIPAL, tenantId: TENANT }],
    knownTenants: [TENANT],
  };
}
