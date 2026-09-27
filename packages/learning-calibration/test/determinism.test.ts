// CROSS-CUTTING DETERMINISM: two learning stores fed the same operations
// (in different orders where the fold allows) hold byte-identical
// state — dataset ids/digests, metric ids/digests, revision digests,
// event stream digests, and projections never depend on input order,
// wall-clock, or randomness.
import { describe, expect, it } from 'vitest';
import { assembleDataset } from '../src/dataset';
import {
  admitModelRevisionProposal,
  assembleDatasetFromStore,
  foldMetrics,
  intakeLearningRecord,
  openLearningStore,
  projectStoreLearningState,
  registerComparisonFact,
  registerOutcomeRecord,
} from '../src/store';
import { sealLearningEvent } from '../src/events';
import {
  BAND_THRESHOLDS,
  SOLUTION_ID,
  TOLERANCE_BANDS,
  TENANT,
  PRINCIPAL,
  T1,
  T7,
  T2,
  T3,
  candidateFamilyPool,
  eligibleCandidateFamily,
  lineageOf,
  observationsOf,
  sealedProposal,
  revisionDraftContent,
} from './fixtures';
import { unwrap } from './helpers';

const SCOPE = { tenantId: TENANT, solutionId: SOLUTION_ID };

/** Drive the full lifecycle over one candidate order. */
function driveLifecycle(order: 'forward' | 'reverse') {
  const candidates = eligibleCandidateFamily();
  const ordered = order === 'forward' ? candidates : [...candidates].reverse();
  let store = openLearningStore(SCOPE);
  // Registration order follows the candidate order; the folds must not care.
  for (const candidate of ordered) {
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
  return { store: folded.store, dataset: assembled.dataset, metricSet: folded.metricSet };
}

describe('store-level determinism', () => {
  it('two stores fed the same operations hold byte-identical state', () => {
    const first = driveLifecycle('forward');
    const second = driveLifecycle('forward');
    expect(second.store).toEqual(first.store);
  });

  it('opposite registration orders derive identical datasets, metric sets, and revisions', () => {
    const forward = driveLifecycle('forward');
    const reverse = driveLifecycle('reverse');
    expect(reverse.dataset.datasetId).toBe(forward.dataset.datasetId);
    expect(reverse.dataset.contentDigest).toBe(forward.dataset.contentDigest);
    expect(reverse.metricSet.metricId).toBe(forward.metricSet.metricId);
    expect(reverse.metricSet.contentDigest).toBe(forward.metricSet.contentDigest);
    expect(reverse.store.revisions[0]!.contentDigest).toBe(
      forward.store.revisions[0]!.contentDigest,
    );
    expect(reverse.store.metricSets[0]!.contentDigest).toBe(
      forward.store.metricSets[0]!.contentDigest,
    );
  });

  it('the pure fold derives identical datasets from shuffled candidate arrays', () => {
    const pool = candidateFamilyPool();
    const candidates = eligibleCandidateFamily();
    const a = unwrap(
      assembleDataset(SCOPE, pool, candidates, { bandThresholds: BAND_THRESHOLDS }),
    );
    const b = unwrap(
      assembleDataset(SCOPE, pool, [...candidates].reverse(), {
        bandThresholds: BAND_THRESHOLDS,
      }),
    );
    expect(b.contentDigest).toBe(a.contentDigest);
    // The canonical row ordering is rowId-ascending in BOTH.
    const ids = b.rows.map((row) => row.rowId);
    expect(ids).toEqual([...ids].sort());
    expect(b.inputDigests).toEqual([...b.inputDigests].sort());
  });

  it('projections are pure: identical state + instant derive identical snapshots', () => {
    const first = driveLifecycle('forward');
    const second = driveLifecycle('reverse');
    expect(projectStoreLearningState(second.store, T3)).toEqual(
      projectStoreLearningState(first.store, T3),
    );
  });

  it('event sealing is deterministic (same content -> same digest, forever)', () => {
    const content = {
      schemaVersion: 1,
      streamId: 'stream:learning-tower-retrofit',
      sequence: 1,
      tenantId: TENANT,
      actor: PRINCIPAL,
      causalParent: null,
      payload: {
        discriminator: 'learning:record-intaken',
        data: {
          solutionId: SOLUTION_ID,
          candidateId: 'candidate:pit-volume-f1-a1',
          subjectKind: 'activity',
          admission: 'intaken',
          intakenAt: T1,
        },
      },
      occurredAt: T1,
    };
    const first = unwrap(sealLearningEvent(content));
    const second = unwrap(sealLearningEvent(content));
    expect(second.contentDigest).toBe(first.contentDigest);
    // A different instant (the only allowed difference) derives a different digest.
    const later = unwrap(
      sealLearningEvent({ ...content, occurredAt: T2 }),
    );
    expect(later.contentDigest).not.toBe(first.contentDigest);
  });

  it('zero wall-clock, zero randomness: instants are caller-supplied payloads only', () => {
    // Every timestamp in every sealed record of the lifecycle is one of
    // the fixed fixture constants — nothing reads a clock.
    const { store } = driveLifecycle('forward');
    const instants = new Set<string>();
    for (const candidate of store.candidates) {
      instants.add(candidate.comparisonFact.observedAt);
      instants.add(candidate.outcome.recordedAt);
    }
    for (const instant of instants) {
      expect(instant).toMatch(/^2026-04-06T08:00:0[0-8]\.000Z$/);
    }
    expect(store.revisions[0]!.revisedAt).toBe(T7);
  });
});
