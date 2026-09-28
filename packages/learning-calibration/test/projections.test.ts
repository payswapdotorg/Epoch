// PURE PROJECTIONS: pack views over the universal dataset (never
// pack-keyed stores — the `parallel-history-store-rejected` guard) and
// the derived learning-state projection (pure fold, caller-supplied
// instant).
import { describe, expect, it } from 'vitest';
import {
  openPackScopedLearningStore,
  projectLearningState,
  projectPackView,
} from '../src/projections';
import { assembleDataset } from '../src/dataset';
import {
  assembleDatasetFromStore,
  intakeLearningRecord,
  openLearningStore,
  projectStoreLearningState,
  registerComparisonFact,
  registerOutcomeRecord,
  foldMetrics,
  admitModelRevisionProposal,
} from '../src/store';
import {
  BAND_THRESHOLDS,
  PACK_REF,
  SOLUTION_ID,
  TOLERANCE_BANDS,
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

describe('the pack view (pure projection over the universal dataset)', () => {
  it('projects one pack\'s rows — rowId order, pack context by typed reference', () => {
    const dataset = unwrap(
      assembleDataset(SCOPE, candidateFamilyPool(), eligibleCandidateFamily(), {
        bandThresholds: BAND_THRESHOLDS,
      }),
    );
    const view = unwrap(
      projectPackView(dataset, { solutionId: SOLUTION_ID, packId: PACK_REF.packId }),
    );
    expect(view.packId).toBe(PACK_REF.packId);
    expect(view.solutionId).toBe(SOLUTION_ID);
    expect(view.rowCount).toBe(2);
    expect(view.rows.every((row) => row.packRef.packId === PACK_REF.packId)).toBe(true);
    const ids = view.rows.map((row) => row.rowId);
    expect(ids).toEqual([...ids].sort());
  });

  it('two packs project INDEPENDENTLY over the SAME universal dataset (no duplicate stores)', () => {
    const dataset = unwrap(
      assembleDataset(SCOPE, candidateFamilyPool(), eligibleCandidateFamily(), {
        bandThresholds: BAND_THRESHOLDS,
      }),
    );
    const core = unwrap(
      projectPackView(dataset, { solutionId: SOLUTION_ID, packId: 'epoch.construction.core' }),
    );
    const mep = unwrap(
      projectPackView(dataset, { solutionId: SOLUTION_ID, packId: 'epoch.construction.mep' }),
    );
    expect(core.rowCount + mep.rowCount).toBe(dataset.rows.length);
    // Every row appears in exactly one pack view; nothing duplicated, nothing lost.
    const seen = new Set([...core.rows, ...mep.rows].map((row) => row.rowId));
    expect(seen.size).toBe(dataset.rows.length);
  });

  it('a pack with no rows is a typed validation rejection (empty projections are not surfaces)', () => {
    const dataset = unwrap(
      assembleDataset(SCOPE, candidateFamilyPool(), eligibleCandidateFamily(), {
        bandThresholds: BAND_THRESHOLDS,
      }),
    );
    const error = expectError(
      projectPackView(dataset, { solutionId: SOLUTION_ID, packId: 'epoch.unknown.pack' }),
    );
    expect(error.code).toBe('validation');
  });

  it('a solution mismatch is a typed validation rejection', () => {
    const dataset = unwrap(
      assembleDataset(SCOPE, candidateFamilyPool(), eligibleCandidateFamily(), {
        bandThresholds: BAND_THRESHOLDS,
      }),
    );
    const error = expectError(
      projectPackView(dataset, { solutionId: 'solution:other-scope', packId: PACK_REF.packId }),
    );
    expect(error.code).toBe('validation');
  });
});

describe('the parallel-history-store guard (the DP1.0 pin)', () => {
  it('ANY attempt to open a pack-scoped learning store is parallel-history-store-rejected', () => {
    const rejection = expectError(
      openPackScopedLearningStore({ solutionId: SOLUTION_ID, packId: 'epoch.construction.core' }),
    );
    expect(rejection.code).toBe('parallel-history-store-rejected');
    // The rejection message points at the pure projection.
    expect(rejection.message).toContain('PURE PROJECTIONS');
  });
});

describe('the derived learning-state projection', () => {
  it('folds the counts of a fully-stocked store (caller-supplied instant — zero wall-clock)', () => {
    const candidates = eligibleCandidateFamily();
    let store = openLearningStore(SCOPE);
    for (const candidate of candidates) {
      store = unwrap(registerComparisonFact(store, candidate.comparisonFact));
      store = unwrap(registerOutcomeRecord(store, candidate.outcome as never));
      store = unwrap(intakeLearningRecord(store, candidate)).store;
    }
    const assembled = unwrap(
      assembleDatasetFromStore(store, { bandThresholds: BAND_THRESHOLDS }),
    );
    store = assembled.store;
    store = unwrap(
      admitModelRevisionProposal(
        store,
        sealedProposal({
          draft: revisionDraftContent({
            lineage: lineageOf(assembled.dataset, observationsOf(assembled.dataset)),
          }),
        }),
      ),
    ).store;
    const folded = unwrap(
      foldMetrics(store, {
        revisionId: store.revisions[0]!.revisionId,
        toleranceBands: [...TOLERANCE_BANDS],
      }),
    );
    store = folded.store;

    const projection = projectStoreLearningState(store, '2026-04-06T09:00:00.000Z');
    expect(projection.solutionId).toBe(SOLUTION_ID);
    expect(projection.candidateCount).toBe(3);
    expect(projection.registeredFactCount).toBe(3);
    expect(projection.registeredOutcomeCount).toBe(3);
    expect(projection.datasetCount).toBe(1);
    expect(projection.rowCount).toBe(3);
    expect(projection.exclusionCount).toBe(0);
    expect(projection.metricSetCount).toBe(1);
    expect(projection.modelCount).toBe(1);
    expect(projection.revisionCount).toBe(1);
    expect(projection.projectedAt).toBe('2026-04-06T09:00:00.000Z');

    // Identical inputs derive identical projections (pure fold).
    expect(projectLearningState(store, '2026-04-06T09:00:00.000Z')).toEqual(projection);
    // A different instant changes only the instant.
    const later = projectStoreLearningState(store, '2026-04-06T09:00:01.000Z');
    expect(later.projectedAt).toBe('2026-04-06T09:00:01.000Z');
    expect({ ...later, projectedAt: projection.projectedAt }).toEqual(projection);
  });

  it('an empty store projects zero counts', () => {
    const store = openLearningStore(SCOPE);
    const projection = projectStoreLearningState(store, '2026-04-06T09:00:00.000Z');
    expect(projection.candidateCount).toBe(0);
    expect(projection.datasetCount).toBe(0);
    expect(projection.rowCount).toBe(0);
    expect(projection.modelCount).toBe(0);
  });
});
