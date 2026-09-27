// TYPED DATA ELIGIBILITY (the W040 acceptance pin #1): fixtures prove
// ONLY VALIDATED actual/outcome records can enter calibration datasets
// — every other axis combination is a TYPED exclusion record (never a
// silent drop), with the documented precedence
// foreign-tenant > unvalidated > unresolved.
import { describe, expect, it } from 'vitest';
import {
  evaluateEligibility,
  sealOutcomeLearningCandidate,
  type SealedOutcomeLearningCandidate,
} from '../src/eligibility';
import { assembleDataset } from '../src/dataset';
import type { LearningDatasetContent } from '../src/index';
import {
  BAND_THRESHOLDS,
  OTHER_TENANT,
  PACK_REF,
  SOLUTION_ID,
  TENANT,
  candidateContent,
  sealedCandidate,
  sealedComparisonFactInput,
  sealedOutcomeRecord,
} from './fixtures';
import { expectError, unwrap } from './helpers';

const SCOPE = { tenantId: TENANT, solutionId: SOLUTION_ID };

/** Assemble one dataset over a single-candidate pool (the eligibility probe). */
function probeEligibility(candidate: SealedOutcomeLearningCandidate) {
  return assembleDataset(
    SCOPE,
    {
      comparisonFacts: [candidate.comparisonFact],
      outcomeRecords: [candidate.outcome as never],
    },
    [candidate],
    { bandThresholds: BAND_THRESHOLDS },
  );
}

describe('the four typed eligibility states (the closed vocabulary)', () => {
  it('a validated actual (corroborated group) + accepted outcome (delivered) is ELIGIBLE', () => {
    const evaluation = evaluateEligibility(SCOPE, sealedCandidate());
    expect(evaluation.state).toBe('eligible');
    expect(evaluation.reasons).toEqual([]);
  });

  it('a resolved observation group is also validated (the W039 resolved state)', () => {
    const candidate = unwrap(
      sealOutcomeLearningCandidate(
        candidateContent({
          validationEvidence: {
            state: 'resolved',
            assessmentRef: {
              recordId: 'validation:pit-volume-group-1',
              contentDigest: '3'.repeat(64),
            },
          },
        }),
      ),
    );
    expect(evaluateEligibility(SCOPE, candidate).state).toBe('eligible');
  });

  it('an INSUFFICIENT observation group (below quorum — no validated actual) is excluded-unvalidated', () => {
    const candidate = unwrap(
      sealOutcomeLearningCandidate(
        candidateContent({
          validationEvidence: {
            state: 'insufficient',
            assessmentRef: {
              recordId: 'validation:pit-volume-group-1',
              contentDigest: '3'.repeat(64),
            },
          },
        }),
      ),
    );
    const evaluation = evaluateEligibility(SCOPE, candidate);
    expect(evaluation.state).toBe('excluded-unvalidated');
    expect(evaluation.reasons).toEqual(['observation-group-insufficient']);
  });

  it('an UNACCEPTED outcome kind (rejected / abandoned) is excluded-unvalidated', () => {
    for (const outcomeKind of ['rejected', 'abandoned'] as const) {
      const candidate = unwrap(
        sealOutcomeLearningCandidate(
          candidateContent({
            outcome: sealedOutcomeRecord({
              payload: { outcomeKind, verificationRefs: [] },
            }),
          }),
        ),
      );
      const evaluation = evaluateEligibility(SCOPE, candidate);
      expect(evaluation.state).toBe('excluded-unvalidated');
      expect(evaluation.reasons).toEqual(['outcome-kind-unaccepted']);
    }
  });

  it('a CONFLICTING observation group (still awaiting resolution) is excluded-unresolved', () => {
    const candidate = unwrap(
      sealOutcomeLearningCandidate(
        candidateContent({
          validationEvidence: {
            state: 'conflicting',
            assessmentRef: {
              recordId: 'validation:pit-volume-group-1',
              contentDigest: '3'.repeat(64),
            },
          },
        }),
      ),
    );
    const evaluation = evaluateEligibility(SCOPE, candidate);
    expect(evaluation.state).toBe('excluded-unresolved');
    expect(evaluation.reasons).toEqual(['observation-group-conflicting']);
  });

  it('a RESIDUAL outcome (unresolved residuals) is excluded-unresolved', () => {
    const candidate = unwrap(
      sealOutcomeLearningCandidate(
        candidateContent({
          outcome: sealedOutcomeRecord({
            payload: { outcomeKind: 'residual', verificationRefs: [] },
          }),
        }),
      ),
    );
    const evaluation = evaluateEligibility(SCOPE, candidate);
    expect(evaluation.state).toBe('excluded-unresolved');
    expect(evaluation.reasons).toEqual(['outcome-kind-residual']);
  });

  it('a FOREIGN embedded comparison fact is excluded-foreign-tenant (the fold continues)', () => {
    const candidate = unwrap(
      sealOutcomeLearningCandidate(
        candidateContent({
          comparisonFact: sealedComparisonFactInput({ tenantId: OTHER_TENANT }),
        }),
      ),
    );
    const evaluation = evaluateEligibility(SCOPE, candidate);
    expect(evaluation.state).toBe('excluded-foreign-tenant');
    expect(evaluation.reasons).toEqual(['tenant-mismatch']);
  });

  it('precedence: foreign-tenant > unvalidated > unresolved (multiple failing axes)', () => {
    // Foreign fact + insufficient group + residual outcome -> foreign tier wins,
    // but EVERY failing axis is recorded.
    const candidate = unwrap(
      sealOutcomeLearningCandidate(
        candidateContent({
          comparisonFact: sealedComparisonFactInput({ tenantId: OTHER_TENANT }),
          validationEvidence: {
            state: 'insufficient',
            assessmentRef: {
              recordId: 'validation:pit-volume-group-1',
              contentDigest: '3'.repeat(64),
            },
          },
          outcome: sealedOutcomeRecord({
            payload: { outcomeKind: 'residual', verificationRefs: [] },
          }),
        }),
      ),
    );
    const evaluation = evaluateEligibility(SCOPE, candidate);
    expect(evaluation.state).toBe('excluded-foreign-tenant');
    expect(evaluation.reasons).toEqual([
      'observation-group-insufficient',
      'outcome-kind-residual',
      'tenant-mismatch',
    ]);

    // Unvalidated + unresolved (no foreign component) -> unvalidated wins.
    const candidate2 = unwrap(
      sealOutcomeLearningCandidate(
        candidateContent({
          validationEvidence: {
            state: 'insufficient',
            assessmentRef: {
              recordId: 'validation:pit-volume-group-1',
              contentDigest: '3'.repeat(64),
            },
          },
          outcome: sealedOutcomeRecord({
            payload: { outcomeKind: 'residual', verificationRefs: [] },
          }),
        }),
      ),
    );
    const evaluation2 = evaluateEligibility(SCOPE, candidate2);
    expect(evaluation2.state).toBe('excluded-unvalidated');
    expect(evaluation2.reasons).toEqual([
      'observation-group-insufficient',
      'outcome-kind-residual',
    ]);
  });
});

describe('only validated rows enter datasets (the assembly fold)', () => {
  it('an eligible candidate folds into a ROW; an excluded candidate folds into a typed exclusion record', () => {
    const eligible = sealedCandidate();
    const unvalidated = unwrap(
      sealOutcomeLearningCandidate(
        candidateContent({
          candidateId: 'candidate:pit-volume-f9-a9',
          comparisonFact: sealedComparisonFactInput({
            factId: 'comparison-fact:pit-volume-f9-a9',
            comparisonRef: { recordId: 'comparison:pit-volume-f9-a9', contentDigest: '9'.repeat(64) },
            forecastRef: { recordId: 'forecast:pit-volume-r9', contentDigest: 'a'.repeat(64) },
            actualRef: { recordId: 'actual:pit-volume-friday', contentDigest: 'b'.repeat(64) },
          }),
          validationEvidence: {
            state: 'insufficient',
            assessmentRef: {
              recordId: 'validation:pit-volume-group-9',
              contentDigest: '3'.repeat(64),
            },
          },
        }),
      ),
    );
    const dataset = unwrap(
      assembleDataset(
        SCOPE,
        {
          comparisonFacts: [eligible.comparisonFact, unvalidated.comparisonFact],
          outcomeRecords: [
            eligible.outcome as never,
            unvalidated.outcome as never,
          ],
        },
        [eligible, unvalidated],
        { bandThresholds: BAND_THRESHOLDS },
      ),
    );
    const content = dataset as unknown as LearningDatasetContent;
    expect(content.rows).toHaveLength(1);
    expect(content.exclusions).toHaveLength(1);
    expect(content.eligibleCount).toBe(1);
    expect(content.excludedCount).toBe(1);
    expect(content.exclusions[0]!.state).toBe('excluded-unvalidated');
    expect(content.exclusions[0]!.reasons).toEqual(['observation-group-insufficient']);
    expect(content.exclusions[0]!.candidateRef.recordId).toBe('candidate:pit-volume-f9-a9');
    expect(content.exclusions[0]!.candidateRef.contentDigest).toBe(unvalidated.contentDigest);
    // The row is the eligible candidate's.
    expect(content.rows[0]!.packRef).toEqual(PACK_REF);
  });

  it('every exclusion axis produces its typed record through the assembly fold', () => {
    const axes = [
      {
        label: 'unvalidated-outcome',
        overrides: {
          outcome: sealedOutcomeRecord({ payload: { outcomeKind: 'rejected', verificationRefs: [] } }),
        },
        expectedState: 'excluded-unvalidated',
        expectedReasons: ['outcome-kind-unaccepted'],
      },
      {
        label: 'unresolved-group',
        overrides: {
          validationEvidence: {
            state: 'conflicting',
            assessmentRef: {
              recordId: 'validation:pit-volume-group-1',
              contentDigest: '3'.repeat(64),
            },
          },
        },
        expectedState: 'excluded-unresolved',
        expectedReasons: ['observation-group-conflicting'],
      },
      {
        label: 'foreign-tenant',
        overrides: {
          comparisonFact: sealedComparisonFactInput({ tenantId: OTHER_TENANT }),
        },
        expectedState: 'excluded-foreign-tenant',
        expectedReasons: ['tenant-mismatch'],
      },
    ] as const;
    for (const axis of axes) {
      const candidate = unwrap(
        sealOutcomeLearningCandidate(
          candidateContent({
            candidateId: `candidate:pit-volume-axis-${axis.label}`,
            ...axis.overrides,
          }),
        ),
      );
      const dataset = unwrap(probeEligibility(candidate));
      const content = dataset as unknown as LearningDatasetContent;
      expect(content.rows, axis.label).toHaveLength(0);
      expect(content.exclusions, axis.label).toHaveLength(1);
      expect(content.exclusions[0]!.state, axis.label).toBe(axis.expectedState);
      expect(content.exclusions[0]!.reasons, axis.label).toEqual([...axis.expectedReasons]);
    }
  });

  it('a candidate whose OWN tenant is foreign is tenant-isolation-rejected at admission', () => {
    const candidate = unwrap(
      sealOutcomeLearningCandidate(candidateContent({ tenantId: OTHER_TENANT })),
    );
    const error = expectError(probeEligibility(candidate));
    expect(error.code).toBe('tenant-isolation-rejected');
  });
});
