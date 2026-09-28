// Shared fixtures for the learning-calibration kernel tests. Builders
// return loose JSON objects so negative tests can corrupt single fields
// precisely (the W036/W038/W039 helpers pattern). ZERO clock reads:
// every instant is a fixed constant (producer-supplied payload data).
// W036 records are built through the REAL @epoch/solution-delivery
// pipelines; comparison facts seal through BOTH the REAL W039
// @epoch/actualization kernel and the mirrored input path (parity).
import {
  sealDistinctionRecord,
  type SealedDistinctionRecord,
  type UncertaintyState,
} from '@epoch/solution-delivery';
import { sealComparisonFactInput } from '../src/references';
import { sealOutcomeLearningCandidate } from '../src/eligibility';
import { sealModelRevisionProposal } from '../src/model-registry';
import type {
  SealedComparisonFactInput,
  SealedModelRevisionProposal,
  SealedOutcomeLearningCandidate,
} from '../src/index';
import { unwrap } from './helpers';

export const T0 = '2026-04-06T08:00:00.000Z';
export const T1 = '2026-04-06T08:00:01.000Z';
export const T2 = '2026-04-06T08:00:02.000Z';
export const T3 = '2026-04-06T08:00:03.000Z';
export const T4 = '2026-04-06T08:00:04.000Z';
export const T5 = '2026-04-06T08:00:05.000Z';
export const T6 = '2026-04-06T08:00:06.000Z';
export const T7 = '2026-04-06T08:00:07.000Z';
export const T8 = '2026-04-06T08:00:08.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const SOLUTION_ID = 'solution:tower-retrofit';
export const PRINCIPAL = 'principal:delivery-lead';
export const OBSERVER = 'principal:field-engineer';
export const ACTIVITY_ID = 'activity:excavate';
export const ACTIVITY_ID_2 = 'activity:grade';
export const EVIDENCE_DIGEST = 'a'.repeat(64);
export const EVIDENCE_DIGEST_2 = 'b'.repeat(64);

/** The caller-supplied magnitude-band thresholds (never implicit defaults). */
export const BAND_THRESHOLDS = {
  minor: '5',
  material: '20',
  severe: '50',
} as const;

/** One declared tolerance-band set for the hit-rate folds. */
export const TOLERANCE_BANDS = ['5', '10'] as const;

/** The domain-pack reference (DP1.0 context by typed reference). */
export const PACK_REF = {
  packId: 'epoch.construction.core',
  packVersion: '1.0.0',
  contentDigest: '1'.repeat(64),
} as const;

/** A second pack reference (the per-pack breakdown fixture). */
export const PACK_REF_2 = {
  packId: 'epoch.construction.mep',
  packVersion: '1.0.0',
  contentDigest: '2'.repeat(64),
} as const;

/** One valid uncertainty state (observed provenance, fresh, measured confidence). */
export function uncertainty(overrides: Record<string, unknown> = {}): UncertaintyState {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:field-report', actor: OBSERVER },
    freshness: { state: 'fresh', assessedAt: T1 },
    confidence: { method: 'measured', value: 0.92, rationale: 'direct field measurement' },
    ...overrides,
  } as UncertaintyState;
}

// --------------------------------------------------------------------------------
// Comparison facts (the W039 grammar, sealed through the mirrored input path).
// --------------------------------------------------------------------------------

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
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_ID,
    },
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
export function sealedComparisonFactInput(
  overrides: Record<string, unknown> = {},
): SealedComparisonFactInput {
  return unwrap(sealComparisonFactInput(comparisonFactContent(overrides)));
}

// --------------------------------------------------------------------------------
// W036 Outcome records (built through the REAL solution-delivery kernel).
// --------------------------------------------------------------------------------

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
    subject: {
      solutionId: SOLUTION_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_ID,
    },
    payload: {
      outcomeKind: 'delivered',
      verificationRefs: [EVIDENCE_DIGEST],
    },
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

// --------------------------------------------------------------------------------
// Outcome-learning candidates (the intake unit).
// --------------------------------------------------------------------------------

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
    comparisonFact: sealedComparisonFactInput(),
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
    packRef: PACK_REF,
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

/**
 * A family of DISTINCT eligible candidates over the same subject:
 * over-forecast (11.5), under-forecast (9.5), exact (0) — across two
 * packs and two realization variants (the metric-fold fixture).
 */
export function eligibleCandidateFamily(): SealedOutcomeLearningCandidate[] {
  return [
    // Row 1: over-forecast, construction-build, pack 1.
    sealedCandidate({
      candidateId: 'candidate:pit-volume-f1-a1',
      comparisonFact: sealedComparisonFactInput({
        factId: 'comparison-fact:pit-volume-f1-a1',
        forecastRef: { recordId: 'forecast:pit-volume-r1', contentDigest: 'e'.repeat(64) },
        actualRef: { recordId: 'actual:pit-volume-monday', contentDigest: 'f'.repeat(64) },
        forecastMeasure: { kind: 'quantity', value: '130', unit: 'm3' },
        actualMeasure: { kind: 'quantity', value: '118.5', unit: 'm3' },
        deviation: '11.5',
        bias: 'over-forecast',
      }),
      outcome: sealedOutcomeRecord({
        recordId: 'outcome:pit-volume-delivered',
        payload: { outcomeKind: 'delivered', verificationRefs: [EVIDENCE_DIGEST] },
      }),
    }),
    // Row 2: under-forecast, software-implementation-deployment, pack 2.
    sealedCandidate({
      candidateId: 'candidate:pit-volume-f2-a2',
      packRef: PACK_REF_2,
      realizationVariant: 'software-implementation-deployment',
      comparisonFact: sealedComparisonFactInput({
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
        subject: {
          solutionId: SOLUTION_ID,
          subjectKind: 'activity',
          subjectId: ACTIVITY_ID,
        },
        payload: { outcomeKind: 'accepted', verificationRefs: [EVIDENCE_DIGEST_2] },
      }),
    }),
    // Row 3: exact, construction-build, pack 1.
    sealedCandidate({
      candidateId: 'candidate:pit-volume-f3-a3',
      comparisonFact: sealedComparisonFactInput({
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
        subject: {
          solutionId: SOLUTION_ID,
          subjectKind: 'activity',
          subjectId: ACTIVITY_ID,
        },
        payload: { outcomeKind: 'handover', verificationRefs: [EVIDENCE_DIGEST] },
      }),
    }),
  ];
}

/** The registered source-history pool backing the candidate family. */
export function candidateFamilyPool(): {
  readonly comparisonFacts: readonly SealedComparisonFactInput[];
  readonly outcomeRecords: readonly SealedDistinctionRecord[];
} {
  const candidates = eligibleCandidateFamily();
  const facts = candidates.map((candidate) => candidate.comparisonFact);
  const outcomes = candidates.map((candidate) =>
    // The embedded outcome is the same object shape the store registers.
    candidate.outcome as unknown as SealedDistinctionRecord,
  );
  return { comparisonFacts: facts, outcomeRecords: outcomes };
}

// --------------------------------------------------------------------------------
// Model-revision proposals (the controlled update interface).
// --------------------------------------------------------------------------------

/** One model-revision DRAFT content builder (loose JSON). */
export function revisionDraftContent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema: 'epoch.learning-calibration.model-revision',
    schemaVersion: 1,
    revisionId: 'model-revision:pit-volume-1',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    modelId: 'model:pit-volume-calibration',
    sequence: 1,
    supersedes: null,
    applicability: { measureClass: 'quantity', packId: null, realizationVariant: null },
    parameters: [{ name: 'epoch.calibration.volume.bias-offset', value: '0' }],
    lineage: {
      datasets: [
        { datasetId: 'dataset:tower-retrofit-00000000', contentDigest: '0'.repeat(64) },
      ],
      changingObservations: [
        { recordId: 'comparison-fact:pit-volume-f1-a1', contentDigest: '0'.repeat(64) },
      ],
    },
    revisedAt: T7,
    revisedBy: PRINCIPAL,
    note: 'initial calibration of the volume model',
    ...overrides,
  };
}

/** One model-revision PROPOSAL content builder (loose JSON). */
export function proposalContent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schema: 'epoch.learning-calibration.model-revision-proposal',
    schemaVersion: 1,
    proposalId: 'proposal:pit-volume-revision-1',
    draft: revisionDraftContent(),
    justification: [{ kind: 'dataset', reference: 'dataset:tower-retrofit-00000000' }],
    proposedAt: T7,
    proposedBy: PRINCIPAL,
    ...overrides,
  };
}

/** One SEALED model-revision proposal (the admission input). */
export function sealedProposal(
  overrides: Record<string, unknown> = {},
): SealedModelRevisionProposal {
  return unwrap(sealModelRevisionProposal(proposalContent(overrides)));
}

/** Derive the lineage of a proposal draft from one sealed dataset (the exact digests). */
export function lineageOf(
  dataset: { datasetId: string; contentDigest: string },
  observations: readonly { recordId: string; contentDigest: string }[],
): { datasets: { datasetId: string; contentDigest: string }[]; changingObservations: { recordId: string; contentDigest: string }[] } {
  return {
    datasets: [{ datasetId: dataset.datasetId, contentDigest: dataset.contentDigest }],
    changingObservations: [...observations].sort((a, b) => (a.recordId < b.recordId ? -1 : 1)),
  };
}

/** The row provenance observation references of one sealed dataset (the lineage resolver). */
export function observationsOf(dataset: {
  rows: readonly { provenance: { comparisonFact: { recordId: string; contentDigest: string }; outcomeRecord: { recordId: string; contentDigest: string } } }[];
}): { recordId: string; contentDigest: string }[] {
  const observations: { recordId: string; contentDigest: string }[] = [];
  for (const row of dataset.rows) {
    observations.push({
      recordId: row.provenance.comparisonFact.recordId,
      contentDigest: row.provenance.comparisonFact.contentDigest,
    });
    observations.push({
      recordId: row.provenance.outcomeRecord.recordId,
      contentDigest: row.provenance.outcomeRecord.contentDigest,
    });
  }
  return observations.sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
}
