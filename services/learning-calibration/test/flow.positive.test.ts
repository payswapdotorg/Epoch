// THE FULL POSITIVE FLOW through the learning-calibration runtime host:
// learning-record intake (idempotent), dataset assembly (typed
// eligibility — only validated actual/outcome records fold into rows),
// controlled model revision through a lineage-complete proposal, the
// calibration metric fold, the pack-view projection, the state
// projection, and the learning:* event stream (every step sealed).
import { describe, expect, it } from 'vitest';
import { LearningCalibrationRuntime } from '../src/runtime';
import { InMemoryLearningRecordSourceAdapter } from '../src/record-source-port';
import { RUNTIME_RECORD_VERSION } from '../src/version';
import {
  sealComparisonFactInput,
  sealModelRevisionProposal,
  sealOutcomeLearningCandidate,
  type SealedLearningDataset,
} from '@epoch/learning-calibration';
import {
  BAND_THRESHOLDS,
  PACK_ID,
  PRINCIPAL,
  SOLUTION_ID,
  TENANT,
  TOLERANCE_BANDS,
  T3,
  T5,
  T6,
  T7,
  T8,
  T9,
  allowContext,
  candidateContent,
  comparisonFactContent,
  eligibleCandidates,
} from './helpers';
import { unwrap } from './helpers';

const AUTH = { principalId: PRINCIPAL, context: allowContext() };

/** Drive the full lifecycle once; returns the host + key artifacts. */
function driveFlow() {
  const runtime = new LearningCalibrationRuntime();
  for (const candidate of eligibleCandidates()) {
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
        note: 'initial calibration of the volume model',
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
      packId: PACK_ID,
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
  return { runtime, dataset, admitted, folded, view, projection };
}

describe('the full learning flow through the host (all events sealed)', () => {
  it('intakes learning records idempotently (duplicate-candidate on replay)', () => {
    const runtime = new LearningCalibrationRuntime();
    const candidate = eligibleCandidates()[0]!;
    const first = unwrap(
      runtime.intakeLearningRecord({
        tenantId: TENANT,
        authorization: AUTH,
        candidate,
        intakenAt: T5,
      }),
    );
    expect(first.admission).toBe('intaken');
    const second = unwrap(
      runtime.intakeLearningRecord({
        tenantId: TENANT,
        authorization: AUTH,
        candidate,
        intakenAt: T5,
      }),
    );
    expect(second.admission).toBe('duplicate-candidate');
    // The source history registered from the embedding (idempotent).
    const health = runtime.health();
    expect(health.comparisonFactCount).toBe(1);
    expect(health.outcomeRecordCount).toBe(1);
    expect(health.candidateCount).toBe(1);
  });

  it('assembles the dataset with ONLY validated rows (3 eligible candidates -> 3 rows)', () => {
    const { dataset } = driveFlow();
    expect(dataset.rows).toHaveLength(3);
    expect(dataset.exclusions).toHaveLength(0);
    expect(dataset.eligibleCount).toBe(3);
    expect(dataset.tenantId).toBe(TENANT);
    expect(dataset.solutionId).toBe(SOLUTION_ID);
  });

  it('excludes unvalidated records through the host flow (typed exclusion records)', () => {
    const runtime = new LearningCalibrationRuntime();
    // The unvalidated axis: insufficient observation group.
    const unvalidated = unwrap(
      sealCandidateWith({
        candidateId: 'candidate:pit-volume-f9-a9',
        comparisonFact: sealedFactWith({
          factId: 'comparison-fact:pit-volume-f9-a9',
          comparisonRef: { recordId: 'comparison:pit-volume-f9-a9', contentDigest: '9'.repeat(64) },
          forecastRef: { recordId: 'forecast:pit-volume-r9', contentDigest: 'a'.repeat(64) },
          actualRef: { recordId: 'actual:pit-volume-friday', contentDigest: 'b'.repeat(64) },
        }),
        validationEvidence: {
          state: 'insufficient',
          assessmentRef: { recordId: 'validation:pit-volume-group-9', contentDigest: '3'.repeat(64) },
        },
      }),
    );
    unwrap(
      runtime.intakeLearningRecord({
        tenantId: TENANT,
        authorization: AUTH,
        candidate: unvalidated,
        intakenAt: T5,
      }),
    );
    const assembled = unwrap(
      runtime.assembleDataset({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        bandThresholds: BAND_THRESHOLDS,
        assembledAt: T6,
      }),
    );
    expect(assembled.dataset.rows).toHaveLength(0);
    expect(assembled.dataset.exclusions).toHaveLength(1);
    expect(assembled.dataset.exclusions[0]!.state).toBe('excluded-unvalidated');
    expect(assembled.dataset.exclusions[0]!.reasons).toEqual([
      'observation-group-insufficient',
    ]);
  });

  it('admits the lineage-complete proposal and retains the revision lineage', () => {
    const { admitted, dataset } = driveFlow();
    expect(admitted.admission).toBe('admitted');
    expect(admitted.revision.lineage.datasets).toHaveLength(1);
    expect(admitted.revision.lineage.datasets[0]!.datasetId).toBe(dataset.datasetId);
    expect(admitted.revision.lineage.changingObservations.length).toBe(6);
  });

  it('folds the calibration metrics over the assembled dataset', () => {
    const { folded } = driveFlow();
    expect(folded.admission).toBe('folded');
    expect(folded.metricSet.selectedRowCount).toBe(3);
    expect(folded.metricSet.bias.overCount).toBe(1);
    expect(folded.metricSet.bias.underCount).toBe(1);
    expect(folded.metricSet.bias.exactCount).toBe(1);
    expect(folded.metricSet.meanAbsoluteError.totalAbsoluteDeviation).toBe('21');
  });

  it('projects the pack view + the derived state', () => {
    const { view, projection } = driveFlow();
    expect(view.rowCount).toBe(3);
    expect(view.packId).toBe(PACK_ID);
    expect(projection.candidateCount).toBe(3);
    expect(projection.datasetCount).toBe(1);
    expect(projection.metricSetCount).toBe(1);
    expect(projection.modelCount).toBe(1);
    expect(projection.revisionCount).toBe(1);
    expect(projection.projectedAt).toBe(T9);
  });

  it('emits the complete learning:* event stream (W010-shaped, sealed, ordered)', () => {
    const { runtime } = driveFlow();
    const stream = unwrap(
      runtime.eventStream({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
      }),
    );
    const discriminators = stream.map((event) => event.payload.discriminator);
    // 3 record-intaken + 1 dataset-assembled + 1 revision-proposed +
    // 1 revision-admitted + 1 metrics-folded + 1 pack-view-projected +
    // 1 state-projected.
    expect(discriminators).toEqual([
      'learning:record-intaken',
      'learning:record-intaken',
      'learning:record-intaken',
      'learning:dataset-assembled',
      'learning:revision-proposed',
      'learning:revision-admitted',
      'learning:metrics-folded',
      'learning:pack-view-projected',
      'learning:state-projected',
    ]);
    // Sequences are 1-based contiguous.
    expect(stream.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // One stream per solution scope.
    expect(stream.every((event) => event.streamId === 'stream:learning-tower-retrofit')).toBe(
      true,
    );
    expect(stream.every((event) => event.tenantId === TENANT)).toBe(true);
    // The health snapshot folds the whole host.
    const health = runtime.health();
    expect(health.scopeCount).toBe(1);
    expect(health.eventCount).toBe(9);
    expect(health.datasetCount).toBe(1);
    expect(health.metricSetCount).toBe(1);
    expect(health.revisionCount).toBe(1);
    expect(runtime.recordVersion).toBe(RUNTIME_RECORD_VERSION);
  });

  it('replays the dataset assembly idempotently (dataset-replayed event)', () => {
    const runtime = new LearningCalibrationRuntime();
    for (const candidate of eligibleCandidates()) {
      unwrap(
        runtime.intakeLearningRecord({
          tenantId: TENANT,
          authorization: AUTH,
          candidate,
          intakenAt: T5,
        }),
      );
    }
    unwrap(
      runtime.assembleDataset({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        bandThresholds: BAND_THRESHOLDS,
        assembledAt: T6,
      }),
    );
    const replayed = unwrap(
      runtime.assembleDataset({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        bandThresholds: BAND_THRESHOLDS,
        assembledAt: T7,
      }),
    );
    expect(replayed.admission).toBe('replayed');
    const stream = unwrap(
      runtime.eventStream({ tenantId: TENANT, authorization: AUTH, solutionId: SOLUTION_ID }),
    );
    expect(stream.at(-1)!.payload.discriminator).toBe('learning:dataset-replayed');
    expect(runtime.health().datasetCount).toBe(1);
  });

  it('polls the LearningRecordSourcePort (the adapter seam)', () => {
    const port = new InMemoryLearningRecordSourceAdapter();
    const candidate = eligibleCandidates()[0]!;
    const submitted = port.submit({ tenantId: TENANT, solutionId: SOLUTION_ID, candidate });
    expect(submitted.ok).toBe(true);
    const polled = unwrap(
      new LearningCalibrationRuntime({ recordSourcePort: port }).pollLearningRecords({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        requestedAt: T3,
      }),
    );
    expect(polled).toHaveLength(1);
    expect(polled[0]!.admission).toBe('intaken');
  });
});

/** Build one sealed candidate with deep overrides (the negative-flow fixture). */
function sealCandidateWith(overrides: Record<string, unknown>) {
  return sealOutcomeLearningCandidate({ ...candidateContent(), ...overrides });
}

/** Build one sealed comparison fact with overrides. */
function sealedFactWith(overrides: Record<string, unknown>) {
  return unwrap(sealComparisonFactInput({ ...comparisonFactContent(), ...overrides }));
}
