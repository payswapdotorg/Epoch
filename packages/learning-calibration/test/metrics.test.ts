// CALIBRATION METRICS: the deterministic folds per (model, version,
// applicability scope) — bias / MAE / hit-rate over exact decimal
// arithmetic, per-domain-pack and per-realization-variant breakdowns,
// the dataset digest + exact fold definition carried on every record,
// the W005-convention justification entries, and content-addressed
// metric ids (identical fold inputs derive identical digests).
import { describe, expect, it } from 'vitest';
import {
  foldCalibrationMetrics,
  verifySealedCalibrationMetricSet,
  type MetricModelScope,
} from '../src/metrics';
import { assembleDataset } from '../src/dataset';
import {
  admitModelRevisionProposal,
  assembleDatasetFromStore,
  foldMetrics,
  intakeLearningRecord,
  openLearningStore,
  registerComparisonFact,
  registerOutcomeRecord,
} from '../src/store';
import { projectPackView } from '../src/projections';
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

/** The stocked metric-fold environment: dataset + admitted model revision. */
function stockedEnvironment() {
  const pool = candidateFamilyPool();
  const candidates = eligibleCandidateFamily();
  const dataset = unwrap(
    assembleDataset(SCOPE, pool, candidates, {
      bandThresholds: BAND_THRESHOLDS,
    }),
  );
  let store = openLearningStore(SCOPE);
  for (const candidate of candidates) {
    store = unwrap(registerComparisonFact(store, candidate.comparisonFact));
    store = unwrap(registerOutcomeRecord(store, candidate.outcome as never));
    store = unwrap(intakeLearningRecord(store, candidate)).store;
  }
  // Admit the dataset into the store BEFORE the proposal (the lineage
  // resolves against the registered dataset evidence).
  const assembled = unwrap(
    assembleDatasetFromStore(store, { bandThresholds: BAND_THRESHOLDS }),
  );
  store = assembled.store;
  store = unwrap(
    admitModelRevisionProposal(
      store,
      sealedProposal({
        draft: revisionDraftContent({
          lineage: lineageOf(dataset, observationsOf(dataset)),
        }),
      }),
    ),
  ).store;
  const revision = store.revisions[0]!;
  return { dataset, store, revision };
}

describe('the deterministic metric fold (bias / MAE / hit-rate)', () => {
  it('folds the exact summaries over the selected rows (zero float math)', () => {
    const { dataset, revision } = stockedEnvironment();
    const metricSet = unwrap(
      foldCalibrationMetrics(
        SCOPE,
        dataset,
        {
          modelId: revision.modelId,
          revisionId: revision.revisionId,
          contentDigest: revision.contentDigest,
          applicability: revision.applicability,
        },
        { toleranceBands: [...TOLERANCE_BANDS] },
      ),
    );
    // 3 rows: over 11.5, under 9.5, exact 0.
    expect(metricSet.selectedRowCount).toBe(3);
    expect(metricSet.bias.overCount).toBe(1);
    expect(metricSet.bias.underCount).toBe(1);
    expect(metricSet.bias.exactCount).toBe(1);
    expect(metricSet.bias.overTotalDeviation).toBe('11.5');
    expect(metricSet.bias.underTotalDeviation).toBe('9.5');
    // Net = over - under = +2 (not negative).
    expect(metricSet.bias.netDeviation).toEqual({ negative: false, magnitude: '2' });
    // Mean = 2 / 3 truncated at scale 9.
    expect(metricSet.bias.meanDeviation).toEqual({ negative: false, magnitude: '0.666666666' });
    // MAE: total 21, mean 7, worst 11.5 with its row.
    expect(metricSet.meanAbsoluteError.totalAbsoluteDeviation).toBe('21');
    expect(metricSet.meanAbsoluteError.mean).toBe('7');
    expect(metricSet.meanAbsoluteError.worstDeviation!.deviation).toBe('11.5');
    expect(metricSet.meanAbsoluteError.worstDeviation!.rowId).toMatch(/^row:/);
    // Hit rates: band 5 -> within {9.5? no... deviations 11.5, 9.5, 0}: within 5 = {0} -> 1/3.
    expect(metricSet.hitRates).toHaveLength(2);
    expect(metricSet.hitRates[0]!.tolerance).toBe('5');
    expect(metricSet.hitRates[0]!.withinCount).toBe(1);
    expect(metricSet.hitRates[0]!.outsideCount).toBe(2);
    expect(metricSet.hitRates[0]!.hitRate).toBe('0.333333333');
    expect(metricSet.hitRates[1]!.tolerance).toBe('10');
    expect(metricSet.hitRates[1]!.withinCount).toBe(2);
    expect(metricSet.hitRates[1]!.outsideCount).toBe(1);
    expect(metricSet.hitRates[1]!.hitRate).toBe('0.666666666');
  });

  it('carries the dataset digest + the exact fold definition + W005-convention justification', () => {
    const { dataset, revision } = stockedEnvironment();
    const metricSet = unwrap(
      foldCalibrationMetrics(
        SCOPE,
        dataset,
        {
          modelId: revision.modelId,
          revisionId: revision.revisionId,
          contentDigest: revision.contentDigest,
          applicability: revision.applicability,
        },
        { toleranceBands: [...TOLERANCE_BANDS] },
      ),
    );
    expect(metricSet.foldDefinition.datasetRef.datasetId).toBe(dataset.datasetId);
    expect(metricSet.foldDefinition.datasetRef.contentDigest).toBe(dataset.contentDigest);
    expect(metricSet.foldDefinition.toleranceBands).toEqual([...TOLERANCE_BANDS]);
    expect(metricSet.foldDefinition.applicability).toEqual({
      measureClass: 'quantity',
      packId: null,
      realizationVariant: null,
    });
    expect(metricSet.modelRef).toEqual({
      modelId: revision.modelId,
      revisionId: revision.revisionId,
      contentDigest: revision.contentDigest,
    });
    const kinds = metricSet.justification.map((entry) => entry.kind);
    expect(kinds).toEqual(['dataset', 'fold-definition', 'model']);
    const datasetEntry = metricSet.justification.find((entry) => entry.kind === 'dataset');
    expect(datasetEntry!.reference).toBe(dataset.datasetId);
    const modelEntry = metricSet.justification.find((entry) => entry.kind === 'model');
    expect(modelEntry!.reference).toBe(revision.revisionId);
  });

  it('the per-domain-pack and per-realization-variant breakdowns group the SAME selected rows', () => {
    const { dataset, revision } = stockedEnvironment();
    const metricSet = unwrap(
      foldCalibrationMetrics(
        SCOPE,
        dataset,
        {
          modelId: revision.modelId,
          revisionId: revision.revisionId,
          contentDigest: revision.contentDigest,
          applicability: revision.applicability,
        },
        { toleranceBands: [...TOLERANCE_BANDS] },
      ),
    );
    expect(metricSet.packBreakdowns.map((b) => b.packId)).toEqual([
      'epoch.construction.core',
      'epoch.construction.mep',
    ]);
    const core = metricSet.packBreakdowns.find((b) => b.packId === 'epoch.construction.core')!;
    expect(core.rowCount).toBe(2);
    expect(core.overCount).toBe(1);
    expect(core.exactCount).toBe(1);
    expect(core.totalAbsoluteDeviation).toBe('11.5');
    const mep = metricSet.packBreakdowns.find((b) => b.packId === 'epoch.construction.mep')!;
    expect(mep.rowCount).toBe(1);
    expect(mep.underCount).toBe(1);
    expect(mep.totalAbsoluteDeviation).toBe('9.5');

    expect(metricSet.variantBreakdowns.map((b) => b.realizationVariant)).toEqual([
      'construction-build',
      'software-implementation-deployment',
    ]);
    expect(metricSet.variantBreakdowns[0]!.rowCount).toBe(2);
    expect(metricSet.variantBreakdowns[1]!.rowCount).toBe(1);
  });

  it('a pack-scoped applicability selects only that pack\'s rows', () => {
    const { dataset, revision } = stockedEnvironment();
    const metricSet = unwrap(
      foldCalibrationMetrics(
        SCOPE,
        dataset,
        {
          modelId: revision.modelId,
          revisionId: revision.revisionId,
          contentDigest: revision.contentDigest,
          applicability: {
            measureClass: 'quantity',
            packId: PACK_REF.packId,
            realizationVariant: null,
          },
        },
        { toleranceBands: [...TOLERANCE_BANDS] },
      ),
    );
    expect(metricSet.selectedRowCount).toBe(2);
    expect(metricSet.packBreakdowns).toHaveLength(1);
    expect(metricSet.packBreakdowns[0]!.packId).toBe(PACK_REF.packId);
    expect(metricSet.meanAbsoluteError.totalAbsoluteDeviation).toBe('11.5');
  });

  it('identical fold inputs derive identical metric ids AND digests; different bands derive different ids', () => {
    const { dataset, revision } = stockedEnvironment();
    const model = {
      modelId: revision.modelId,
      revisionId: revision.revisionId,
      contentDigest: revision.contentDigest,
      applicability: revision.applicability,
    };
    const first = unwrap(
      foldCalibrationMetrics(SCOPE, dataset, model, { toleranceBands: [...TOLERANCE_BANDS] }),
    );
    const second = unwrap(
      foldCalibrationMetrics(SCOPE, dataset, model, { toleranceBands: [...TOLERANCE_BANDS] }),
    );
    expect(second.metricId).toBe(first.metricId);
    expect(second.contentDigest).toBe(first.contentDigest);

    const other = unwrap(
      foldCalibrationMetrics(SCOPE, dataset, model, { toleranceBands: ['3'] }),
    );
    expect(other.metricId).not.toBe(first.metricId);
    expect(other.contentDigest).not.toBe(first.contentDigest);
  });

  it('the sealed metric set verifies (schema + digest recomputation)', () => {
    const { dataset, revision } = stockedEnvironment();
    const metricSet = unwrap(
      foldCalibrationMetrics(
        SCOPE,
        dataset,
        {
          modelId: revision.modelId,
          revisionId: revision.revisionId,
          contentDigest: revision.contentDigest,
          applicability: revision.applicability,
        },
        { toleranceBands: [...TOLERANCE_BANDS] },
      ),
    );
    expect(verifySealedCalibrationMetricSet(metricSet).ok).toBe(true);
    const tampered = { ...metricSet, selectedRowCount: 99 };
    expect(verifySealedCalibrationMetricSet(tampered).ok).toBe(false);
  });

  it('an empty scope slice and degenerate bands are typed validation rejections', () => {
    const { dataset, revision } = stockedEnvironment();
    const model: MetricModelScope = {
      modelId: revision.modelId,
      revisionId: revision.revisionId,
      contentDigest: revision.contentDigest,
      applicability: {
        measureClass: 'cost',
        packId: null,
        realizationVariant: null,
      },
    };
    const empty = expectError(
      foldCalibrationMetrics(SCOPE, dataset, model, { toleranceBands: [...TOLERANCE_BANDS] }),
    );
    expect(empty.code).toBe('validation');

    const degenerate = expectError(
      foldCalibrationMetrics(
        SCOPE,
        dataset,
        { ...model, applicability: revision.applicability },
        { toleranceBands: ['5', '5'] },
      ),
    );
    expect(degenerate.code).toBe('validation');

    const noBands = expectError(
      foldCalibrationMetrics(
        SCOPE,
        dataset,
        { ...model, applicability: revision.applicability },
        { toleranceBands: [] },
      ),
    );
    expect(noBands.code).toBe('validation');
  });

  it('a scope-mismatched dataset is rejected (tenant R12)', () => {
    const { dataset, revision } = stockedEnvironment();
    const model = {
      modelId: revision.modelId,
      revisionId: revision.revisionId,
      contentDigest: revision.contentDigest,
      applicability: revision.applicability,
    };
    const r12 = expectError(
      foldCalibrationMetrics(
        { tenantId: 'tenant:other', solutionId: SOLUTION_ID },
        dataset,
        model,
        { toleranceBands: [...TOLERANCE_BANDS] },
      ),
    );
    expect(r12.code).toBe('tenant-isolation-rejected');
    const solution = expectError(
      foldCalibrationMetrics(
        { tenantId: TENANT, solutionId: 'solution:other-scope' },
        dataset,
        model,
        { toleranceBands: [...TOLERANCE_BANDS] },
      ),
    );
    expect(solution.code).toBe('validation');
  });
});

describe('the store metric fold (resolution + admission)', () => {
  it('resolves the revision + dataset, folds, and admits idempotently', () => {
    const { store, revision } = stockedEnvironment();
    // The dataset is already admitted by the stocked environment.
    const folded = unwrap(
      foldMetrics(store, {
        revisionId: revision.revisionId,
        toleranceBands: [...TOLERANCE_BANDS],
      }),
    );
    expect(folded.admission).toBe('folded');
    expect(folded.metricSet.selectedRowCount).toBe(3);

    // Exact re-fold is idempotent.
    const refolded = unwrap(
      foldMetrics(folded.store, {
        revisionId: revision.revisionId,
        toleranceBands: [...TOLERANCE_BANDS],
      }),
    );
    expect(refolded.admission).toBe('duplicate-metrics');
    expect(refolded.store.metricSets).toHaveLength(1);

    // Different bands derive a NEW metric set.
    const other = unwrap(
      foldMetrics(refolded.store, {
        revisionId: revision.revisionId,
        toleranceBands: ['3'],
      }),
    );
    expect(other.admission).toBe('folded');
    expect(other.store.metricSets).toHaveLength(2);
  });

  it('an unknown revision or dataset is dangling-reference-rejected', () => {
    const { store } = stockedEnvironment();
    const error = expectError(
      foldMetrics(store, { revisionId: 'model-revision:ghost', toleranceBands: ['5'] }),
    );
    expect(error.code).toBe('dangling-reference-rejected');

    const noDataset = expectError(
      foldMetrics(openLearningStore(SCOPE), {
        revisionId: 'model-revision:pit-volume-1',
        toleranceBands: ['5'],
      }),
    );
    expect(noDataset.code).toBe('dangling-reference-rejected');
  });
});

describe('the pack view projection (metrics context)', () => {
  it('projects one pack\'s rows over the universal dataset (pure — never a store)', () => {
    const pool = candidateFamilyPool();
    const dataset = unwrap(
      assembleDataset(SCOPE, pool, eligibleCandidateFamily(), {
        bandThresholds: BAND_THRESHOLDS,
      }),
    );
    const view = unwrap(projectPackView(dataset, { solutionId: SOLUTION_ID, packId: PACK_REF.packId }));
    expect(view.rowCount).toBe(2);
    expect(view.rows.every((row) => row.packRef.packId === PACK_REF.packId)).toBe(true);
    expect(view.rows.map((row) => row.rowId)).toEqual([...view.rows.map((row) => row.rowId)].sort());
  });
});
