// THE MODEL REGISTRY (the W040 acceptance pin #2): fixtures prove model
// revisions RETAIN LINEAGE to the observations that changed them —
// lineage-less drafts are `model-revision-lineage-required` rejections,
// tampered/stale dataset or observation references are
// `stale-reference-rejected` rejections, updates flow ONLY through
// proposals, and history is immutable (revision ids never rebind,
// chains append exactly).
import { describe, expect, it } from 'vitest';
import {
  admitModelRevision,
  modelRevisionChain,
  resolveModelRevision,
  verifySealedModelRevision,
} from '../src/model-registry';
import { assembleDataset } from '../src/dataset';
import {
  admitModelRevisionProposal,
  assembleDatasetFromStore,
  intakeLearningRecord,
  openLearningStore,
  registerComparisonFact,
  registerOutcomeRecord,
} from '../src/store';
import {
  BAND_THRESHOLDS,
  OTHER_TENANT,
  SOLUTION_ID,
  TENANT,
  candidateFamilyPool,
  eligibleCandidateFamily,
  lineageOf,
  observationsOf,
  sealedProposal,
  revisionDraftContent,
} from './fixtures';
import { expectError, unwrap } from './helpers';

const SCOPE = { tenantId: TENANT, solutionId: SOLUTION_ID };

/** The reference environment: registered history + one admitted dataset. */
function stockedEnvironment() {
  const pool = candidateFamilyPool();
  const candidates = eligibleCandidateFamily();
  const dataset = unwrap(
    assembleDataset(SCOPE, pool, candidates, { bandThresholds: BAND_THRESHOLDS }),
  );
  let store = openLearningStore(SCOPE);
  for (const candidate of candidates) {
    store = unwrap(registerComparisonFact(store, candidate.comparisonFact));
    store = unwrap(registerOutcomeRecord(store, candidate.outcome as never));
    store = unwrap(intakeLearningRecord(store, candidate)).store;
  }
  store = unwrap(assembleDatasetFromStore(store, { bandThresholds: BAND_THRESHOLDS })).store;
  return { dataset, store, candidates };
}

describe('the controlled update interface (proposals only)', () => {
  it('a lineage-complete proposal admits its draft revision (lineage RETAINED to the changing observations)', () => {
    const { dataset, store } = stockedEnvironment();
    const observations = observationsOf(dataset);
    const admitted = unwrap(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({
            lineage: lineageOf(dataset, observations),
          }),
        }),
      ),
    );
    expect(admitted.admission).toBe('admitted');
    expect(admitted.revision.lineage.datasets).toHaveLength(1);
    expect(admitted.revision.lineage.datasets[0]!.datasetId).toBe(dataset.datasetId);
    expect(admitted.revision.lineage.datasets[0]!.contentDigest).toBe(dataset.contentDigest);
    // The changing observations are the EXACT digests of the rows' provenance.
    expect(admitted.revision.lineage.changingObservations).toEqual(observations);
    expect(admitted.store.revisions).toHaveLength(1);
    // Idempotent replay: the same proposal re-admitted is a duplicate.
    const replay = unwrap(
      admitModelRevisionProposal(admitted.store, sealedProposal({
        draft: revisionDraftContent({
          lineage: lineageOf(dataset, observations),
        }),
      })),
    );
    expect(replay.admission).toBe('duplicate-proposal');
    expect(replay.store.revisions).toHaveLength(1);
    expect(replay.store.proposals).toHaveLength(1);
  });

  it('the sealed revision verifies and resolves by exact digest', () => {
    const { dataset, store } = stockedEnvironment();
    const admitted = unwrap(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({ lineage: lineageOf(dataset, observationsOf(dataset)) }),
        }),
      ),
    );
    expect(verifySealedModelRevision(admitted.revision).ok).toBe(true);
    const resolved = unwrap(
      resolveModelRevision([admitted.revision], {
        revisionId: admitted.revision.revisionId,
      }),
    );
    expect(resolved.contentDigest).toBe(admitted.revision.contentDigest);
    const stale = expectError(
      resolveModelRevision([admitted.revision], {
        revisionId: admitted.revision.revisionId,
        contentDigest: '0'.repeat(64),
      }),
    );
    expect(stale.code).toBe('stale-reference-rejected');
    const ghost = expectError(
      resolveModelRevision([admitted.revision], { revisionId: 'model-revision:ghost' }),
    );
    expect(ghost.code).toBe('dangling-reference-rejected');
  });
});

describe('lineage is mandatory (the acceptance pin)', () => {
  it('a draft with NO dataset references is model-revision-lineage-required', () => {
    const { store } = stockedEnvironment();
    const error = expectError(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({
            lineage: { datasets: [], changingObservations: [] },
          }),
        }),
      ),
    );
    expect(error.code).toBe('model-revision-lineage-required');
  });

  it('a draft with datasets but NO changing observations is model-revision-lineage-required', () => {
    const { dataset, store } = stockedEnvironment();
    const error = expectError(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({
            lineage: {
              datasets: [{ datasetId: dataset.datasetId, contentDigest: dataset.contentDigest }],
              changingObservations: [],
            },
          }),
        }),
      ),
    );
    expect(error.code).toBe('model-revision-lineage-required');
  });

  it('a draft with observations but NO datasets is model-revision-lineage-required', () => {
    const { dataset, store } = stockedEnvironment();
    const error = expectError(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({
            lineage: {
              datasets: [],
              changingObservations: observationsOf(dataset),
            },
          }),
        }),
      ),
    );
    expect(error.code).toBe('model-revision-lineage-required');
  });
});

describe('stale / tampered references are typed rejections', () => {
  it('an UNREGISTERED dataset reference is stale-reference-rejected', () => {
    const { store } = stockedEnvironment();
    const error = expectError(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({
            lineage: {
              datasets: [{ datasetId: 'dataset:ghost-00000000', contentDigest: '0'.repeat(64) }],
              changingObservations: [
                { recordId: 'comparison-fact:pit-volume-f1-a1', contentDigest: '0'.repeat(64) },
              ],
            },
          }),
        }),
      ),
    );
    expect(error.code).toBe('stale-reference-rejected');
  });

  it('a TAMPERED dataset digest is stale-reference-rejected', () => {
    const { dataset, store } = stockedEnvironment();
    const error = expectError(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({
            lineage: {
              datasets: [{ datasetId: dataset.datasetId, contentDigest: '0'.repeat(64) }],
              changingObservations: observationsOf(dataset),
            },
          }),
        }),
      ),
    );
    expect(error.code).toBe('stale-reference-rejected');
  });

  it('a changing observation OUTSIDE the referenced datasets is stale-reference-rejected', () => {
    const { dataset, store } = stockedEnvironment();
    const error = expectError(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({
            lineage: {
              datasets: [{ datasetId: dataset.datasetId, contentDigest: dataset.contentDigest }],
              changingObservations: [
                { recordId: 'comparison-fact:never-registered', contentDigest: '0'.repeat(64) },
              ],
            },
          }),
        }),
      ),
    );
    expect(error.code).toBe('stale-reference-rejected');
  });

  it('a TAMPERED observation digest is stale-reference-rejected', () => {
    const { dataset, store } = stockedEnvironment();
    const observations = observationsOf(dataset);
    const tampered = observations.map((observation, index) =>
      index === 0 ? { ...observation, contentDigest: '0'.repeat(64) } : observation,
    );
    const error = expectError(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({ lineage: lineageOf(dataset, tampered) }),
        }),
      ),
    );
    expect(error.code).toBe('stale-reference-rejected');
  });
});

describe('history is immutable; chains append exactly', () => {
  it('the same revision id with different content is history-immutable', () => {
    const { dataset, store } = stockedEnvironment();
    const first = unwrap(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({ lineage: lineageOf(dataset, observationsOf(dataset)) }),
        }),
      ),
    );
    const conflicting = expectError(
      admitModelRevisionProposal(
        first.store,
        sealedProposal({
          proposalId: 'proposal:pit-volume-revision-1b',
          draft: revisionDraftContent({
            lineage: lineageOf(dataset, observationsOf(dataset).slice(0, 1)),
          }),
        }),
      ),
    );
    expect(conflicting.code).toBe('history-immutable');
  });

  it('the same proposal id with different content is version-conflict', () => {
    const { dataset, store } = stockedEnvironment();
    const first = unwrap(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({ lineage: lineageOf(dataset, observationsOf(dataset)) }),
        }),
      ),
    );
    const error = expectError(
      admitModelRevisionProposal(
        first.store,
        sealedProposal({
          draft: revisionDraftContent({
            note: 'tampered proposal content',
            lineage: lineageOf(dataset, observationsOf(dataset)),
          }),
        }),
      ),
    );
    expect(error.code).toBe('version-conflict');
  });

  it('a sequence break is a typed validation rejection', () => {
    const { dataset, store } = stockedEnvironment();
    const error = expectError(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({
            sequence: 2,
            supersedes: null,
            lineage: lineageOf(dataset, observationsOf(dataset)),
          }),
        }),
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('the second revision supersedes the first EXACTLY (stale chain link rejected)', () => {
    const { dataset, store } = stockedEnvironment();
    const first = unwrap(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({ lineage: lineageOf(dataset, observationsOf(dataset)) }),
        }),
      ),
    );
    const revisionOne = first.revision;
    const second = unwrap(
      admitModelRevisionProposal(
        first.store,
        sealedProposal({
          proposalId: 'proposal:pit-volume-revision-2',
          draft: revisionDraftContent({
            revisionId: 'model-revision:pit-volume-2',
            sequence: 2,
            supersedes: {
              revisionId: revisionOne.revisionId,
              contentDigest: revisionOne.contentDigest,
            },
            lineage: lineageOf(dataset, observationsOf(dataset)),
          }),
        }),
      ),
    );
    expect(second.admission).toBe('admitted');
    expect(modelRevisionChain(second.store.revisions, 'model:pit-volume-calibration')).toHaveLength(2);

    // A tampered supersedes digest is stale-reference-rejected.
    const third = expectError(
      admitModelRevisionProposal(
        second.store,
        sealedProposal({
          proposalId: 'proposal:pit-volume-revision-3',
          draft: revisionDraftContent({
            revisionId: 'model-revision:pit-volume-3',
            sequence: 3,
            supersedes: {
              revisionId: second.revision.revisionId,
              contentDigest: '0'.repeat(64),
            },
            lineage: lineageOf(dataset, observationsOf(dataset)),
          }),
        }),
      ),
    );
    expect(third.code).toBe('stale-reference-rejected');
  });

  it('the pure gate rejects a foreign-tenant draft (R12) and mismatched scope', () => {
    const { dataset, store } = stockedEnvironment();
    const foreign = expectError(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({
            tenantId: OTHER_TENANT,
            lineage: lineageOf(dataset, observationsOf(dataset)),
          }),
        }),
      ),
    );
    expect(foreign.code).toBe('tenant-isolation-rejected');

    const foreignSolution = expectError(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({
            solutionId: 'solution:other-scope',
            lineage: lineageOf(dataset, observationsOf(dataset)),
          }),
        }),
      ),
    );
    expect(foreignSolution.code).toBe('validation');
  });

  it('a malformed proposal is a typed validation rejection (schemaVersion skew included)', () => {
    const { store } = stockedEnvironment();
    const malformed = expectError(
      admitModelRevisionProposal(store, {
        ...sealedProposal(),
        schemaVersion: 2,
      }),
    );
    expect(malformed.code).toBe('validation');

    // A tampered envelope digest is digest-mismatch.
    const sealed = sealedProposal({
      draft: revisionDraftContent({
        lineage: { datasets: [], changingObservations: [] },
      }),
    });
    const tampered = { ...sealed, contentDigest: '0'.repeat(64) };
    const error = expectError(admitModelRevision([], SCOPE, [], tampered));
    expect(error.code).toBe('digest-mismatch');
  });
});
