// SERVICE-LEVEL DETERMINISM: two runtimes fed the same operations hold
// byte-identical state — event stream digests, dataset digests, metric
// set digests, projections; input order never leaks; zero wall-clock,
// zero randomness.
import { describe, expect, it } from 'vitest';
import { LearningCalibrationRuntime } from '../src/runtime';
import {
  sealModelRevisionProposal,
  type SealedLearningDataset,
} from '@epoch/learning-calibration';
import {
  BAND_THRESHOLDS,
  PRINCIPAL,
  SOLUTION_ID,
  TENANT,
  TOLERANCE_BANDS,
  T5,
  T6,
  T7,
  T8,
  T9,
  allowContext,
  eligibleCandidates,
} from './helpers';
import { unwrap } from './helpers';

const AUTH = { principalId: PRINCIPAL, context: allowContext() };

/** Drive the full lifecycle over one candidate order. */
function driveLifecycle(order: 'forward' | 'reverse') {
  const runtime = new LearningCalibrationRuntime();
  const candidates = eligibleCandidates();
  const ordered = order === 'forward' ? candidates : [...candidates].reverse();
  for (const candidate of ordered) {
    unwrap(
      runtime.intakeLearningRecord({
        tenantId: TENANT,
        authorization: AUTH,
        candidate,
        intakenAt: T5,
      }),
    );
  }
  const assembled = unwrap(
    runtime.assembleDataset({
      tenantId: TENANT,
      authorization: AUTH,
      solutionId: SOLUTION_ID,
      bandThresholds: BAND_THRESHOLDS,
      assembledAt: T6,
    }),
  );
  const dataset = assembled.dataset as SealedLearningDataset;
  const proposal = unwrap(
    sealModelRevisionProposal({
      schema: 'epoch.learning-calibration.model-revision-proposal',
      schemaVersion: 1,
      proposalId: 'proposal:pit-volume-revision-1',
      draft: {
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
          datasets: [{ datasetId: dataset.datasetId, contentDigest: dataset.contentDigest }],
          changingObservations: [
            ...dataset.rows.flatMap((row) => [
              {
                recordId: row.provenance.comparisonFact.recordId,
                contentDigest: row.provenance.comparisonFact.contentDigest,
              },
              {
                recordId: row.provenance.outcomeRecord.recordId,
                contentDigest: row.provenance.outcomeRecord.contentDigest,
              },
            ]),
          ].sort((a, b) => (a.recordId < b.recordId ? -1 : 1)),
        },
        revisedAt: T7,
        revisedBy: PRINCIPAL,
      },
      justification: [{ kind: 'dataset', reference: dataset.datasetId }],
      proposedAt: T7,
      proposedBy: PRINCIPAL,
    }),
  );
  const admitted = unwrap(
    runtime.admitModelRevision({
      tenantId: TENANT,
      authorization: AUTH,
      solutionId: SOLUTION_ID,
      proposal,
      proposedAt: T7,
      admittedAt: T7,
    }),
  );
  const folded = unwrap(
    runtime.foldMetrics({
      tenantId: TENANT,
      authorization: AUTH,
      solutionId: SOLUTION_ID,
      revisionId: admitted.revision.revisionId,
      toleranceBands: [...TOLERANCE_BANDS],
      foldedAt: T8,
    }),
  );
  const view = unwrap(
    runtime.packView({
      tenantId: TENANT,
      authorization: AUTH,
      solutionId: SOLUTION_ID,
      packId: 'epoch.construction.core',
      projectedAt: T9,
    }),
  );
  const projection = unwrap(
    runtime.stateProjection({
      tenantId: TENANT,
      authorization: AUTH,
      solutionId: SOLUTION_ID,
      projectedAt: T9,
    }),
  );
  return { runtime, dataset, folded, view, projection };
}

describe('service-level determinism', () => {
  it('two runtimes fed the same operations hold identical state', () => {
    const first = driveLifecycle('forward');
    const second = driveLifecycle('forward');
    expect(second.runtime.health()).toEqual(first.runtime.health());
    expect(
      second.runtime
        .eventStream({ tenantId: TENANT, authorization: AUTH, solutionId: SOLUTION_ID })
        .ok &&
        unwrap(
          second.runtime.eventStream({
            tenantId: TENANT,
            authorization: AUTH,
            solutionId: SOLUTION_ID,
          }),
        ).map((event) => event.contentDigest),
    ).toEqual(
      unwrap(
        first.runtime.eventStream({ tenantId: TENANT, authorization: AUTH, solutionId: SOLUTION_ID }),
      ).map((event) => event.contentDigest),
    );
  });

  it('opposite intake orders derive identical datasets, metrics, views, and projections', () => {
    const forward = driveLifecycle('forward');
    const reverse = driveLifecycle('reverse');
    expect(reverse.dataset.datasetId).toBe(forward.dataset.datasetId);
    expect(reverse.dataset.contentDigest).toBe(forward.dataset.contentDigest);
    expect(reverse.folded.metricSet.metricId).toBe(forward.folded.metricSet.metricId);
    expect(reverse.folded.metricSet.contentDigest).toBe(
      forward.folded.metricSet.contentDigest,
    );
    expect(reverse.view).toEqual(forward.view);
    expect(reverse.projection).toEqual(forward.projection);
    // The canonical ordering never leaks the intake order.
    const ids = reverse.dataset.rows.map((row) => row.rowId);
    expect(ids).toEqual([...ids].sort());
  });

  it('the event stream is append-only and sequence-contiguous', () => {
    const { runtime } = driveLifecycle('forward');
    const stream = unwrap(
      runtime.eventStream({ tenantId: TENANT, authorization: AUTH, solutionId: SOLUTION_ID }),
    );
    expect(stream.map((event) => event.sequence)).toEqual(
      stream.map((_, index) => index + 1),
    );
    // Replaying the identical dataset assembly appends exactly one replay event.
    unwrap(
      runtime.assembleDataset({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        bandThresholds: BAND_THRESHOLDS,
        assembledAt: T9,
      }),
    );
    const after = unwrap(
      runtime.eventStream({ tenantId: TENANT, authorization: AUTH, solutionId: SOLUTION_ID }),
    );
    expect(after).toHaveLength(stream.length + 1);
    expect(after.slice(0, stream.length)).toEqual(stream);
  });
});
