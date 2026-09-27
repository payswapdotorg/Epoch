// PREDICTION-TO-OUTCOME DATASETS: the deterministic fold + the typed
// admission gates — content-addressed ids/digests (identical eligible
// inputs derive identical datasets; input order never leaks), replay
// idempotence + the history-immutable replay conflict (same identity,
// different content — the replay seals the PRIOR record), tenant
// isolation (R12), dangling references, duplicate/version conflicts,
// and the pair-immutability pin.
import { describe, expect, it } from 'vitest';
import {
  assembleDataset,
  sealLearningDataset,
  verifySealedLearningDataset,
} from '../src/dataset';
import {
  admitDataset,
  assembleDatasetFromStore,
  intakeLearningRecord,
  openLearningStore,
  registerComparisonFact,
  registerOutcomeRecord,
} from '../src/store';
import { sealOutcomeLearningCandidate } from '../src/eligibility';
import {
  BAND_THRESHOLDS,
  OTHER_TENANT,
  SOLUTION_ID,
  TENANT,
  candidateContent,
  candidateFamilyPool,
  eligibleCandidateFamily,
  sealedCandidate,
  sealedComparisonFactInput,
  sealedOutcomeRecord,
} from './fixtures';
import { expectError, unwrap } from './helpers';

const SCOPE = { tenantId: TENANT, solutionId: SOLUTION_ID };

describe('the deterministic fold (content-addressed datasets)', () => {
  it('identical eligible inputs derive identical dataset ids AND digests', () => {
    const pool = candidateFamilyPool();
    const first = unwrap(
      assembleDataset(SCOPE, pool, eligibleCandidateFamily(), {
        bandThresholds: BAND_THRESHOLDS,
      }),
    );
    const second = unwrap(
      assembleDataset(SCOPE, pool, eligibleCandidateFamily(), {
        bandThresholds: BAND_THRESHOLDS,
      }),
    );
    expect(second.datasetId).toBe(first.datasetId);
    expect(second.contentDigest).toBe(first.contentDigest);
    expect(second).toEqual(first);
  });

  it('input order never leaks (shuffled candidates derive the identical dataset)', () => {
    const pool = candidateFamilyPool();
    const candidates = eligibleCandidateFamily();
    const forward = unwrap(
      assembleDataset(SCOPE, pool, candidates, { bandThresholds: BAND_THRESHOLDS }),
    );
    const reversed = unwrap(
      assembleDataset(SCOPE, pool, [...candidates].reverse(), {
        bandThresholds: BAND_THRESHOLDS,
      }),
    );
    expect(reversed.datasetId).toBe(forward.datasetId);
    expect(reversed.contentDigest).toBe(forward.contentDigest);
    expect(reversed.rows.map((row) => row.rowId)).toEqual(
      [...forward.rows.map((row) => row.rowId)].sort(),
    );
  });

  it('different band thresholds derive different content under the same dataset id (the replay-conflict trap)', () => {
    const pool = candidateFamilyPool();
    const candidates = eligibleCandidateFamily();
    const first = unwrap(
      assembleDataset(SCOPE, pool, candidates, { bandThresholds: BAND_THRESHOLDS }),
    );
    const second = unwrap(
      assembleDataset(SCOPE, pool, candidates, {
        bandThresholds: { minor: '1', material: '2', severe: '3' },
      }),
    );
    expect(second.datasetId).toBe(first.datasetId);
    expect(second.contentDigest).not.toBe(first.contentDigest);
  });

  it('each row carries the prediction + outcome references by exact digest, the features, the pack reference, and the W006-convention provenance', () => {
    const pool = candidateFamilyPool();
    const candidates = eligibleCandidateFamily();
    const dataset = unwrap(
      assembleDataset(SCOPE, pool, candidates, { bandThresholds: BAND_THRESHOLDS }),
    );
    expect(dataset.rows).toHaveLength(3);
    for (const row of dataset.rows) {
      expect(row.predictionRef.recordId).toMatch(/^forecast:/);
      expect(row.outcomeRef.recordId).toMatch(/^outcome:/);
      expect(row.provenance.comparisonFact.recordId).toMatch(/^comparison-fact:/);
      expect(row.provenance.outcomeRecord.recordId).toMatch(/^outcome:/);
      expect(row.features.deviationMagnitude).toMatch(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/);
      expect(row.packRef.packId).toMatch(/^[a-z0-9]+(\.[a-z0-9-]+)+$/);
      expect(row.tenantId).toBe(TENANT);
      expect(row.solutionId).toBe(SOLUTION_ID);
    }
    const first = dataset.rows.find(
      (row) => row.provenance.comparisonFact.recordId === 'comparison-fact:pit-volume-f1-a1',
    );
    expect(first!.features.deviationMagnitude).toBe('11.5');
    expect(first!.features.bias).toBe('over-forecast');
    expect(first!.measureClass).toBe('quantity');
    expect(first!.unit).toBe('m3');
    expect(first!.realizationVariant).toBe('construction-build');
  });

  it('the sealed dataset verifies (schema + digest recomputation)', () => {
    const pool = candidateFamilyPool();
    const dataset = unwrap(
      assembleDataset(SCOPE, pool, eligibleCandidateFamily(), {
        bandThresholds: BAND_THRESHOLDS,
      }),
    );
    expect(verifySealedLearningDataset(dataset).ok).toBe(true);
    const tampered = { ...dataset, eligibleCount: 99 };
    const error = expectError(verifySealedLearningDataset(tampered));
    expect(error.code).toBe('digest-mismatch');
  });
});

describe('the typed admission gates', () => {
  it('a candidate embedding UNREGISTERED history is dangling-reference-rejected', () => {
    const candidate = sealedCandidate();
    const error = expectError(
      assembleDataset(
        SCOPE,
        { comparisonFacts: [], outcomeRecords: [candidate.outcome as never] },
        [candidate],
        { bandThresholds: BAND_THRESHOLDS },
      ),
    );
    expect(error.code).toBe('dangling-reference-rejected');

    // A stale digest (registered id, different digest) is also dangling.
    const wrongFact = sealedComparisonFactInput({
      deviation: '99',
      bias: 'under-forecast',
    });
    const error2 = expectError(
      assembleDataset(
        SCOPE,
        { comparisonFacts: [wrongFact], outcomeRecords: [candidate.outcome as never] },
        [candidate],
        { bandThresholds: BAND_THRESHOLDS },
      ),
    );
    expect(error2.code).toBe('dangling-reference-rejected');
  });

  it('the same candidate id with different content is a typed version-conflict', () => {
    const pool = candidateFamilyPool();
    const candidates = eligibleCandidateFamily();
    const variant = unwrap(
      sealOutcomeLearningCandidate(
        candidateContent({
          varianceEvidence: {
            varianceClass: 'quantity',
            varianceRecordRef: {
              recordId: 'variance:pit-volume-f1-a1',
              contentDigest: '4'.repeat(64),
            },
            attribution: null,
          },
        }),
      ),
    );
    const error = expectError(
      assembleDataset(
        SCOPE,
        pool,
        [candidates[0]!, variant],
        { bandThresholds: BAND_THRESHOLDS },
      ),
    );
    expect(error.code).toBe('version-conflict');
  });

  it('a second candidate for the SAME (prediction, outcome) pair is history-immutable', () => {
    const pool = candidateFamilyPool();
    const candidates = eligibleCandidateFamily();
    const shadow = unwrap(
      sealOutcomeLearningCandidate(
        candidateContent({
          candidateId: 'candidate:pit-volume-f1-shadow',
          comparisonFact: candidates[0]!.comparisonFact,
          outcome: candidates[0]!.outcome,
          varianceEvidence: {
            varianceClass: 'quantity',
            varianceRecordRef: {
              recordId: 'variance:pit-volume-f1-a1',
              contentDigest: '4'.repeat(64),
            },
            attribution: null,
          },
        }),
      ),
    );
    const error = expectError(
      assembleDataset(SCOPE, pool, [candidates[0]!, shadow], {
        bandThresholds: BAND_THRESHOLDS,
      }),
    );
    expect(error.code).toBe('history-immutable');
  });

  it('an empty candidate set is a typed validation rejection', () => {
    const error = expectError(
      assembleDataset(SCOPE, candidateFamilyPool(), [], { bandThresholds: BAND_THRESHOLDS }),
    );
    expect(error.code).toBe('validation');
  });

  it('descending band thresholds are a typed validation rejection', () => {
    const error = expectError(
      assembleDataset(SCOPE, candidateFamilyPool(), eligibleCandidateFamily(), {
        bandThresholds: { minor: '50', material: '20', severe: '5' },
      }),
    );
    expect(error.code).toBe('validation');
  });
});

describe('the store: registration, intake, assembly, replay', () => {
  function stockedStore() {
    let store = openLearningStore(SCOPE);
    const candidates = eligibleCandidateFamily();
    for (const candidate of candidates) {
      store = unwrap(registerComparisonFact(store, candidate.comparisonFact));
      store = unwrap(registerOutcomeRecord(store, candidate.outcome as never));
      store = unwrap(intakeLearningRecord(store, candidate)).store;
    }
    return { store, candidates };
  }

  it('registers source history idempotently (exact re-registration is a no-op)', () => {
    let store = openLearningStore(SCOPE);
    const candidate = sealedCandidate();
    store = unwrap(registerComparisonFact(store, candidate.comparisonFact));
    const again = unwrap(registerComparisonFact(store, candidate.comparisonFact));
    expect(again.comparisonFacts).toHaveLength(1);
    store = unwrap(registerOutcomeRecord(store, candidate.outcome as never));
    const outcomeAgain = unwrap(registerOutcomeRecord(store, candidate.outcome as never));
    expect(outcomeAgain.outcomeRecords).toHaveLength(1);
  });

  it('the same fact id with different content is history-immutable at registration', () => {
    let store = openLearningStore(SCOPE);
    const candidate = sealedCandidate();
    store = unwrap(registerComparisonFact(store, candidate.comparisonFact));
    const mutated = sealedComparisonFactInput({ deviation: '99', bias: 'under-forecast' });
    const error = expectError(registerComparisonFact(store, mutated));
    expect(error.code).toBe('history-immutable');
  });

  it('a foreign-tenant fact is tenant-isolation-rejected at registration (R12)', () => {
    const store = openLearningStore(SCOPE);
    const foreign = sealedComparisonFactInput({ tenantId: OTHER_TENANT });
    const error = expectError(registerComparisonFact(store, foreign));
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('a non-outcome distinction record never registers as source history', () => {
    const store = openLearningStore(SCOPE);
    const observation = sealedOutcomeRecord({
      kind: 'observation' as never,
      recordId: 'observation:rogue',
      measure: { kind: 'quantity', value: '1', unit: 'm3' },
      payload: {
        deliveryId: 'delivery:tower-retrofit-v1',
        observedAt: '2026-04-06T08:00:01.000Z',
        observedBy: 'principal:field-engineer',
        evidence: [{ digest: 'a'.repeat(64) }],
      },
    });
    const error = expectError(registerOutcomeRecord(store, observation));
    expect(error.code).toBe('validation');
  });

  it('assembles from the store, replays idempotently, and traps the replay conflict', () => {
    const { store } = stockedStore();
    const assembled = unwrap(
      assembleDatasetFromStore(store, { bandThresholds: BAND_THRESHOLDS }),
    );
    expect(assembled.admission).toBe('assembled');
    expect(assembled.dataset.rows).toHaveLength(3);

    // Exact re-derivation is a REPLAY (seals the prior record).
    const replayed = unwrap(
      assembleDatasetFromStore(assembled.store, { bandThresholds: BAND_THRESHOLDS }),
    );
    expect(replayed.admission).toBe('replayed');
    expect(replayed.dataset.contentDigest).toBe(assembled.dataset.contentDigest);
    expect(replayed.store.datasets).toHaveLength(1);

    // A different policy over the same inputs is the history-immutable
    // replay conflict (same dataset id, different content).
    const conflict = expectError(
      assembleDatasetFromStore(assembled.store, {
        bandThresholds: { minor: '1', material: '2', severe: '3' },
      }),
    );
    expect(conflict.code).toBe('history-immutable');
  });

  it('direct dataset admission (the replay path) gates scope + content', () => {
    const { store } = stockedStore();
    const assembled = unwrap(
      assembleDatasetFromStore(store, { bandThresholds: BAND_THRESHOLDS }),
    );
    const admitted = unwrap(admitDataset(assembled.store, assembled.dataset));
    expect(admitted.admission).toBe('replayed');

    const content = { ...assembled.dataset };
    delete (content as { contentDigest?: string }).contentDigest;

    // A foreign-tenant dataset (properly re-sealed) is R12-rejected.
    const foreign = unwrap(sealLearningDataset({ ...content, tenantId: OTHER_TENANT }));
    const error = expectError(admitDataset(assembled.store, foreign));
    expect(error.code).toBe('tenant-isolation-rejected');

    // Same id, different (properly re-sealed) content.
    const mutated = unwrap(
      sealLearningDataset({
        ...content,
        rows: [],
        exclusions: [],
        eligibleCount: 0,
        excludedCount: 0,
        inputDigests: [],
      }),
    );
    const error2 = expectError(admitDataset(assembled.store, mutated));
    expect(error2.code).toBe('history-immutable');

    // A tampered (unresealable) envelope is digest-mismatch.
    const tampered = { ...assembled.dataset, contentDigest: '0'.repeat(64) };
    const error3 = expectError(admitDataset(assembled.store, tampered));
    expect(error3.code).toBe('digest-mismatch');
  });

  it('intake gates: duplicate candidates collapse, conflicting content is version-conflict, foreign is R12', () => {
    const { store, candidates } = stockedStore();
    const dup = unwrap(intakeLearningRecord(store, candidates[0]!));
    expect(dup.admission).toBe('duplicate-candidate');

    const conflicting = unwrap(
      sealOutcomeLearningCandidate(
        candidateContent({
          varianceEvidence: {
            varianceClass: 'price-rate',
            varianceRecordRef: {
              recordId: 'variance:pit-volume-f1-a1',
              contentDigest: '4'.repeat(64),
            },
            attribution: null,
          },
        }),
      ),
    );
    const error = expectError(intakeLearningRecord(store, conflicting));
    expect(error.code).toBe('version-conflict');

    const foreign = unwrap(
      sealOutcomeLearningCandidate(candidateContent({ tenantId: OTHER_TENANT })),
    );
    const error2 = expectError(intakeLearningRecord(store, foreign));
    expect(error2.code).toBe('tenant-isolation-rejected');
  });

  it('intake of an unregistered embedding is dangling-reference-rejected', () => {
    const store = openLearningStore(SCOPE);
    const candidate = sealedCandidate();
    const error = expectError(intakeLearningRecord(store, candidate));
    expect(error.code).toBe('dangling-reference-rejected');
  });

  it('assembly without candidates is a typed validation rejection', () => {
    const store = openLearningStore(SCOPE);
    const error = expectError(
      assembleDatasetFromStore(store, { bandThresholds: BAND_THRESHOLDS }),
    );
    expect(error.code).toBe('validation');
  });

  it('the store fold is canonically ordered (candidates by id)', () => {
    const { store } = stockedStore();
    const ids = store.candidates.map((candidate) => candidate.candidateId);
    expect(ids).toEqual([...ids].sort());
  });
});
