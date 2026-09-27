/**
 * The reference in-memory LEARNING STORE (one tenant/solution scope):
 * the append-only admission surface for the learning history —
 * registered comparison facts + outcome records (the READ-ONLY source
 * history), intaken candidates, assembled datasets (with replay
 * idempotence), folded metric sets, and the model-registry revisions
 * admitted through proposals.
 *
 * - Every admission is TOTAL (typed errors, never exceptions) and
 *   IDEMPOTENT for exact re-admission;
 * - the SOURCE facts/outcomes are READ-ONLY by construction: the store
 *   exposes NO write path onto them (history-immutable — re-admission
 *   of the same identity with different content is a typed
 *   `history-immutable`, never a mutation);
 * - the DATASET fold is deterministic over the admitted candidates; the
 *   same dataset id re-derived with different content (e.g. different
 *   band thresholds over the same inputs) is a typed
 *   `history-immutable` replay conflict — the replay seals the PRIOR
 *   record;
 * - the METRIC fold resolves its dataset + model revision against the
 *   registered history (`dangling-reference-rejected` /
 *   `stale-reference-rejected`);
 * - the MODEL REGISTRY admits revisions ONLY through proposals (the
 *   controlled update gate of model-registry.ts);
 * - ZERO wall-clock, ZERO randomness: every instant is caller-supplied;
 *   every list is canonically ordered (input order never leaks).
 */
import {
  verifySealedDistinctionRecord,
  type SealedDistinctionRecord,
} from '@epoch/solution-delivery';
import {
  verifySealedComparisonFactInput,
  type SealedComparisonFactInput,
} from './references';
import {
  verifySealedOutcomeLearningCandidate,
  type SealedOutcomeLearningCandidate,
} from './eligibility';
import {
  assembleDataset,
  verifySealedLearningDataset,
  type DatasetAssemblyOptions,
  type SealedLearningDataset,
} from './dataset';
import {
  foldCalibrationMetrics,
  verifySealedCalibrationMetricSet,
  type MetricFoldOptions,
  type SealedCalibrationMetricSet,
} from './metrics';
import {
  admitModelRevision,
  resolveModelRevision,
  verifySealedModelRevisionProposal,
  type SealedModelRevision,
  type SealedModelRevisionProposal,
} from './model-registry';
import { projectLearningState, type LearningStateProjection } from './projections';
import type { LearningResult } from './errors';

// --------------------------------------------------------------------------------
// The store shape.
// --------------------------------------------------------------------------------

/** The state of one learning store after admissions. */
export interface LearningStore {
  readonly tenantId: string;
  readonly solutionId: string;
  /** The registered W039-grammar comparison facts (read-only source history). */
  readonly comparisonFacts: readonly SealedComparisonFactInput[];
  /** The registered W036 Outcome-distinction records (read-only source history). */
  readonly outcomeRecords: readonly SealedDistinctionRecord[];
  /** The intaken outcome-learning candidates. */
  readonly candidates: readonly SealedOutcomeLearningCandidate[];
  /** The admitted (assembled + replayed) datasets. */
  readonly datasets: readonly SealedLearningDataset[];
  /** The admitted calibration metric sets. */
  readonly metricSets: readonly SealedCalibrationMetricSet[];
  /** The model registry: revisions admitted through proposals. */
  readonly revisions: readonly SealedModelRevision[];
  /** The admitted proposals (idempotence keys of the controlled updates). */
  readonly proposals: readonly SealedModelRevisionProposal[];
}

/** Open (validate + create) one learning store for a solution scope. */
export function openLearningStore(scope: {
  readonly tenantId: string;
  readonly solutionId: string;
}): LearningStore {
  return {
    tenantId: scope.tenantId,
    solutionId: scope.solutionId,
    comparisonFacts: [],
    outcomeRecords: [],
    candidates: [],
    datasets: [],
    metricSets: [],
    revisions: [],
    proposals: [],
  };
}

// --------------------------------------------------------------------------------
// The read-only source history: comparison facts + outcome records.
// --------------------------------------------------------------------------------

/**
 * REGISTER one sealed comparison fact (append-only source history; the
 * store never writes onto it): the fact verifies, matches the store
 * scope, and grounds an unclaimed (forecast, actual) pair. Exact
 * re-registration is idempotent; the same fact id with different
 * content, or a second fact for the same pair, is a typed
 * `history-immutable` (the historical verdict is fixed).
 */
export function registerComparisonFact(
  store: LearningStore,
  fact: unknown,
): LearningResult<LearningStore> {
  const verified = verifySealedComparisonFactInput(fact);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  if (admitted.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `comparison fact "${admitted.factId}" belongs to tenant "${admitted.tenantId}" but the store is scoped to "${store.tenantId}" (R12)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.factId,
      },
    };
  }
  if (admitted.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `comparison fact "${admitted.factId}" subjects solution "${admitted.solutionId}" but the store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'fact/store solution mismatch' }],
      },
    };
  }
  const existingById = store.comparisonFacts.find(
    (candidate) => candidate.factId === admitted.factId,
  );
  if (existingById !== undefined) {
    if (existingById.contentDigest === admitted.contentDigest) {
      return { ok: true, value: store };
    }
    return {
      ok: false,
      error: {
        code: 'history-immutable',
        message: `comparison fact "${admitted.factId}" is already registered with different content — source history is immutable; changed content ships as a NEW fact id`,
        subject: 'comparison-fact',
        subjectId: admitted.factId,
        publishedDigest: existingById.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  const existingPair = store.comparisonFacts.find(
    (candidate) =>
      candidate.forecastRef.recordId === admitted.forecastRef.recordId &&
      candidate.actualRef.recordId === admitted.actualRef.recordId,
  );
  if (existingPair !== undefined) {
    return {
      ok: false,
      error: {
        code: 'history-immutable',
        message: `the (${admitted.forecastRef.recordId}, ${admitted.actualRef.recordId}) pair is already judged by fact "${existingPair.factId}" — the historical verdict of a forecast/actual pair is immutable`,
        subject: 'comparison-fact-pair',
        subjectId: `${admitted.forecastRef.recordId}->${admitted.actualRef.recordId}`,
        publishedDigest: existingPair.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  return { ok: true, value: { ...store, comparisonFacts: [...store.comparisonFacts, admitted] } };
}

/**
 * REGISTER one sealed W036 Outcome-distinction record (append-only
 * source history; read-only): the record verifies through the REAL
 * W036 verify path, carries kind `outcome`, and matches the store
 * scope. Exact re-registration is idempotent; the same record id with
 * different content is a typed `history-immutable`.
 */
export function registerOutcomeRecord(
  store: LearningStore,
  record: unknown,
): LearningResult<LearningStore> {
  const verified = verifySealedDistinctionRecord(record);
  if (!verified.ok) {
    // Map the W036 typed rejection into the learning taxonomy (the W036
    // error shapes stay behind the composed boundary; the learning store
    // speaks only LearningError).
    const w036 = verified.error as { readonly code?: string; readonly message?: string };
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `the outcome slot carries a W036 Outcome-distinction record that failed the W036 verify path (${w036.code ?? 'validation'}: ${w036.message ?? 'verification failed'})`,
        issues: [{ path: 'record', message: 'W036 verification failed' }],
      },
    };
  }
  const admitted = verified.value;
  if (admitted.kind !== 'outcome') {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `record "${admitted.recordId}" is of kind "${admitted.kind}" — the learning history registers OUTCOME records only`,
        issues: [{ path: 'kind', message: 'only outcome records register as source history' }],
      },
    };
  }
  if (admitted.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `outcome record "${admitted.recordId}" belongs to tenant "${admitted.tenantId}" but the store is scoped to "${store.tenantId}" (R12)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.recordId,
      },
    };
  }
  if (admitted.subject.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `outcome record "${admitted.recordId}" subjects solution "${admitted.subject.solutionId}" but the store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'subject.solutionId', message: 'record/store solution mismatch' }],
      },
    };
  }
  const existing = store.outcomeRecords.find(
    (candidate) => candidate.recordId === admitted.recordId,
  );
  if (existing !== undefined) {
    if (existing.contentDigest === admitted.contentDigest) {
      return { ok: true, value: store };
    }
    return {
      ok: false,
      error: {
        code: 'history-immutable',
        message: `outcome record "${admitted.recordId}" is already registered with different content — source history is immutable`,
        subject: 'outcome-record',
        subjectId: admitted.recordId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  return { ok: true, value: { ...store, outcomeRecords: [...store.outcomeRecords, admitted] } };
}

// --------------------------------------------------------------------------------
// The candidate intake (the learning-record admission).
// --------------------------------------------------------------------------------

/** The outcome of one candidate intake. */
export type CandidateIntakeOutcome =
  | { readonly admission: 'intaken'; readonly store: LearningStore }
  | { readonly admission: 'duplicate-candidate'; readonly store: LearningStore };

/**
 * INTAKE one sealed outcome-learning candidate (append-only): the
 * candidate verifies, matches the store scope, embeds REGISTERED source
 * history (exact revisions — `dangling-reference-rejected` otherwise),
 * and grounds an unclaimed (prediction, outcome) pair. Exact
 * re-intake is idempotent (`duplicate-candidate`).
 */
export function intakeLearningRecord(
  store: LearningStore,
  candidate: unknown,
): LearningResult<CandidateIntakeOutcome> {
  const verified = verifySealedOutcomeLearningCandidate(candidate);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  if (admitted.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `candidate "${admitted.candidateId}" belongs to tenant "${admitted.tenantId}" but the store is scoped to "${store.tenantId}" (R12)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.candidateId,
      },
    };
  }
  if (admitted.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `candidate "${admitted.candidateId}" subjects solution "${admitted.solutionId}" but the store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'candidate/store solution mismatch' }],
      },
    };
  }
  const existing = store.candidates.find(
    (candidate) => candidate.candidateId === admitted.candidateId,
  );
  if (existing !== undefined) {
    if (existing.contentDigest === admitted.contentDigest) {
      return { ok: true, value: { admission: 'duplicate-candidate', store } };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `candidate "${admitted.candidateId}" is already intaken with different content — a sealed candidate is immutable; changed content ships as a NEW candidate id`,
        subject: 'outcome-learning-candidate',
        subjectId: admitted.candidateId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  // The embedded records must be REGISTERED source history (exact revisions).
  const fact = store.comparisonFacts.find(
    (candidate) => candidate.factId === admitted.comparisonFact.factId,
  );
  if (fact === undefined || fact.contentDigest !== admitted.comparisonFact.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `candidate "${admitted.candidateId}" embeds comparison fact "${admitted.comparisonFact.factId}" @ ${admitted.comparisonFact.contentDigest.slice(0, 8)}… which is not registered source history — register the source records first`,
        referenceKind: 'comparison-fact',
        referenceId: admitted.comparisonFact.factId,
      },
    };
  }
  const outcome = store.outcomeRecords.find(
    (candidate) => candidate.recordId === admitted.outcome.recordId,
  );
  if (outcome === undefined || outcome.contentDigest !== admitted.outcome.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `candidate "${admitted.candidateId}" embeds outcome record "${admitted.outcome.recordId}" @ ${admitted.outcome.contentDigest.slice(0, 8)}… which is not registered source history — register the source records first`,
        referenceKind: 'outcome-record',
        referenceId: admitted.outcome.recordId,
      },
    };
  }
  // The prediction/outcome pair grounds at most one candidate.
  const pairKey = `${admitted.comparisonFact.forecastRef.recordId}->${admitted.outcome.recordId}`;
  const pairOwner = store.candidates.find(
    (candidate) =>
      `${candidate.comparisonFact.forecastRef.recordId}->${candidate.outcome.recordId}` ===
      pairKey,
  );
  if (pairOwner !== undefined) {
    return {
      ok: false,
      error: {
        code: 'history-immutable',
        message: `the (${admitted.comparisonFact.forecastRef.recordId}, ${admitted.outcome.recordId}) pair is already grounded by candidate "${pairOwner.candidateId}" — the prediction-to-outcome verdict of a pair is immutable`,
        subject: 'prediction-outcome-pair',
        subjectId: pairKey,
        publishedDigest: pairOwner.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  return {
    ok: true,
    value: { admission: 'intaken', store: { ...store, candidates: [...store.candidates, admitted] } },
  };
}

// --------------------------------------------------------------------------------
// Dataset assembly + replay idempotence.
// --------------------------------------------------------------------------------

/** The outcome of one dataset assembly. */
export interface DatasetAssemblyOutcome {
  /** `assembled` when the store grew; `replayed` on exact idempotent replay. */
  readonly admission: 'assembled' | 'replayed';
  readonly store: LearningStore;
  readonly dataset: SealedLearningDataset;
}

/**
 * ASSEMBLE the dataset of the store's CURRENT candidate set (the
 * deterministic fold over the admitted candidates, cross-checked
 * against the registered source history), then ADMIT it:
 *
 * - a NEW dataset id enters the store (`assembled`);
 * - an EXACT re-derivation of an admitted dataset is idempotent
 *   (`replayed` — the fold is deterministic, so re-assembly with the
 *   same inputs over the same policy seals the prior record);
 * - the same dataset id with DIFFERENT content (e.g. different band
 *   thresholds over the same inputs — the id derives from the input
 *   digests, the content from the policy) is a typed
 *   `history-immutable` replay conflict: the replay must seal the
 *   PRIOR record, never replace it.
 */
export function assembleDatasetFromStore(
  store: LearningStore,
  options: DatasetAssemblyOptions,
): LearningResult<DatasetAssemblyOutcome> {
  if (store.candidates.length === 0) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'a dataset assembly requires at least one intaken candidate',
        issues: [{ path: 'candidates', message: 'no candidates intaken' }],
      },
    };
  }
  const folded = assembleDataset(
    { tenantId: store.tenantId, solutionId: store.solutionId },
    {
      comparisonFacts: store.comparisonFacts,
      outcomeRecords: store.outcomeRecords,
    },
    store.candidates,
    options,
  );
  if (!folded.ok) {
    return folded;
  }
  const dataset = folded.value;
  const existing = store.datasets.find((candidate) => candidate.datasetId === dataset.datasetId);
  if (existing !== undefined) {
    if (existing.contentDigest === dataset.contentDigest) {
      return { ok: true, value: { admission: 'replayed', store, dataset: existing } };
    }
    return {
      ok: false,
      error: {
        code: 'history-immutable',
        message: `dataset "${dataset.datasetId}" is already admitted with different content — the dataset id derives from the input digests, the content from the assembly policy; the replay must seal the PRIOR record (changed policy over the same inputs ships as a NEW scope)`,
        subject: 'learning-dataset',
        subjectId: dataset.datasetId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: dataset.contentDigest,
      },
    };
  }
  return {
    ok: true,
    value: { admission: 'assembled', store: { ...store, datasets: [...store.datasets, dataset] }, dataset },
  };
}

/**
 * ADMIT one sealed dataset directly (the replay path): verification +
 * scope + the idempotence/history-immutability gates above. A replayed
 * dataset seals the PRIOR record (`replayed`).
 */
export function admitDataset(
  store: LearningStore,
  dataset: unknown,
): LearningResult<DatasetAssemblyOutcome> {
  const verified = verifySealedLearningDataset(dataset);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  if (admitted.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `dataset "${admitted.datasetId}" belongs to tenant "${admitted.tenantId}" but the store is scoped to "${store.tenantId}" (R12)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.datasetId,
      },
    };
  }
  if (admitted.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `dataset "${admitted.datasetId}" subjects solution "${admitted.solutionId}" but the store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'dataset/store solution mismatch' }],
      },
    };
  }
  const existing = store.datasets.find((candidate) => candidate.datasetId === admitted.datasetId);
  if (existing !== undefined) {
    if (existing.contentDigest === admitted.contentDigest) {
      return { ok: true, value: { admission: 'replayed', store, dataset: existing } };
    }
    return {
      ok: false,
      error: {
        code: 'history-immutable',
        message: `dataset "${admitted.datasetId}" is already admitted with different content — sealed datasets are immutable; the replay seals the PRIOR record`,
        subject: 'learning-dataset',
        subjectId: admitted.datasetId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  return {
    ok: true,
    value: { admission: 'assembled', store: { ...store, datasets: [...store.datasets, admitted] }, dataset: admitted },
  };
}

// --------------------------------------------------------------------------------
// The metric fold + admission.
// --------------------------------------------------------------------------------

/** The outcome of one metric fold. */
export interface MetricFoldOutcome {
  /** `folded` when the store grew; `duplicate-metrics` on exact idempotent re-fold. */
  readonly admission: 'folded' | 'duplicate-metrics';
  readonly store: LearningStore;
  readonly metricSet: SealedCalibrationMetricSet;
}

/** The options of {@link foldMetrics}. */
export interface StoreMetricFoldOptions extends MetricFoldOptions {
  /** The dataset the fold reads (the latest admitted dataset when omitted). */
  readonly datasetId?: string | undefined;
  /** The exact model revision the fold calibrates. */
  readonly revisionId: string;
}

/**
 * FOLD the calibration metric set of one model revision over one
 * admitted dataset (the latest when no dataset id is supplied), then
 * ADMIT it: the dataset + revision resolve against the registered
 * history (`dangling-reference-rejected` / `stale-reference-rejected`),
 * the fold runs deterministically, and admission is idempotent — the
 * same metric id with different content is a typed
 * `history-immutable`.
 */
export function foldMetrics(
  store: LearningStore,
  options: StoreMetricFoldOptions,
): LearningResult<MetricFoldOutcome> {
  const dataset =
    options.datasetId !== undefined
      ? store.datasets.find((candidate) => candidate.datasetId === options.datasetId)
      : store.datasets[store.datasets.length - 1];
  if (dataset === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message:
          options.datasetId !== undefined
            ? `dataset "${options.datasetId}" is not admitted with this store`
            : 'no dataset is admitted with this store — assemble one before folding metrics',
        referenceKind: 'dataset',
        referenceId: options.datasetId ?? '(none)',
      },
    };
  }
  const revision = resolveModelRevision(store.revisions, { revisionId: options.revisionId });
  if (!revision.ok) {
    return revision;
  }
  const folded = foldCalibrationMetrics(
    { tenantId: store.tenantId, solutionId: store.solutionId },
    dataset,
    {
      modelId: revision.value.modelId,
      revisionId: revision.value.revisionId,
      contentDigest: revision.value.contentDigest,
      applicability: revision.value.applicability,
    },
    { toleranceBands: options.toleranceBands },
  );
  if (!folded.ok) {
    return folded;
  }
  const metricSet = folded.value;
  const existing = store.metricSets.find(
    (candidate) => candidate.metricId === metricSet.metricId,
  );
  if (existing !== undefined) {
    if (existing.contentDigest === metricSet.contentDigest) {
      return { ok: true, value: { admission: 'duplicate-metrics', store, metricSet: existing } };
    }
    return {
      ok: false,
      error: {
        code: 'history-immutable',
        message: `metric set "${metricSet.metricId}" is already admitted with different content — the metric id derives from the fold definition, the content from the fold inputs; changed inputs ship as a NEW fold`,
        subject: 'calibration-metric-set',
        subjectId: metricSet.metricId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: metricSet.contentDigest,
      },
    };
  }
  return {
    ok: true,
    value: { admission: 'folded', store: { ...store, metricSets: [...store.metricSets, metricSet] }, metricSet },
  };
}

/**
 * ADMIT one sealed metric set directly (verification + scope + the
 * idempotence/history-immutability gates above).
 */
export function admitMetricSet(
  store: LearningStore,
  metricSet: unknown,
): LearningResult<MetricFoldOutcome> {
  const verified = verifySealedCalibrationMetricSet(metricSet);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  if (admitted.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `metric set "${admitted.metricId}" belongs to tenant "${admitted.tenantId}" but the store is scoped to "${store.tenantId}" (R12)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.metricId,
      },
    };
  }
  if (admitted.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `metric set "${admitted.metricId}" subjects solution "${admitted.solutionId}" but the store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'metric-set/store solution mismatch' }],
      },
    };
  }
  const existing = store.metricSets.find((candidate) => candidate.metricId === admitted.metricId);
  if (existing !== undefined) {
    if (existing.contentDigest === admitted.contentDigest) {
      return { ok: true, value: { admission: 'duplicate-metrics', store, metricSet: existing } };
    }
    return {
      ok: false,
      error: {
        code: 'history-immutable',
        message: `metric set "${admitted.metricId}" is already admitted with different content — sealed metric sets are immutable`,
        subject: 'calibration-metric-set',
        subjectId: admitted.metricId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  return {
    ok: true,
    value: { admission: 'folded', store: { ...store, metricSets: [...store.metricSets, admitted] }, metricSet: admitted },
  };
}

// --------------------------------------------------------------------------------
// The model-registry admission (controlled updates only).
// --------------------------------------------------------------------------------

/** The outcome of one proposal admission. */
export interface ProposalAdmissionOutcome {
  /** `admitted` when the registry grew; `duplicate-proposal` on exact replay. */
  readonly admission: 'admitted' | 'duplicate-proposal';
  readonly store: LearningStore;
  readonly revision: SealedModelRevision;
}

/**
 * ADMIT one model-revision proposal (the ONLY registry update path):
 * the proposal id gates idempotence (`duplicate-proposal` on exact
 * replay, `version-conflict` on the same id with different content),
 * then the controlled update gate of model-registry.ts runs (scope,
 * lineage-required, stale-reference, history-immutable, chain
 * continuity) and the registry grows.
 */
export function admitModelRevisionProposal(
  store: LearningStore,
  proposal: unknown,
): LearningResult<ProposalAdmissionOutcome> {
  const verified = verifySealedModelRevisionProposal(proposal);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  if (admitted.draft.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `proposal "${admitted.proposalId}" drafts for tenant "${admitted.draft.tenantId}" but the store is scoped to "${store.tenantId}" (R12)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: admitted.draft.tenantId,
        subject: admitted.proposalId,
      },
    };
  }
  if (admitted.draft.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `proposal "${admitted.proposalId}" drafts for solution "${admitted.draft.solutionId}" but the store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'draft.solutionId', message: 'draft/store solution mismatch' }],
      },
    };
  }
  const existingProposal = store.proposals.find(
    (candidate) => candidate.proposalId === admitted.proposalId,
  );
  if (existingProposal !== undefined) {
    if (existingProposal.contentDigest === admitted.contentDigest) {
      const revision = store.revisions.find(
        (candidate) => candidate.revisionId === admitted.draft.revisionId,
      );
      if (revision === undefined) {
        return {
          ok: false,
          error: {
            code: 'dangling-reference-rejected',
            message: `proposal "${admitted.proposalId}" was admitted but its revision is no longer registered — registry history is corrupt`,
            referenceKind: 'model-revision',
            referenceId: admitted.draft.revisionId,
          },
        };
      }
      return { ok: true, value: { admission: 'duplicate-proposal', store, revision } };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `proposal "${admitted.proposalId}" is already admitted with different content — a sealed proposal is immutable; changed content ships as a NEW proposal id`,
        subject: 'model-revision-proposal',
        subjectId: admitted.proposalId,
        publishedDigest: existingProposal.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  const gated = admitModelRevision(
    store.revisions,
    { tenantId: store.tenantId, solutionId: store.solutionId },
    store.datasets,
    admitted,
  );
  if (!gated.ok) {
    return gated;
  }
  return {
    ok: true,
    value: {
      admission: gated.value.admission === 'admitted' ? 'admitted' : 'duplicate-proposal',
      store: {
        ...store,
        revisions: gated.value.registry,
        proposals:
          gated.value.admission === 'admitted' ? [...store.proposals, admitted] : store.proposals,
      },
      revision: gated.value.revision,
    },
  };
}

// --------------------------------------------------------------------------------
// The derived state projection + canonical folds.
// --------------------------------------------------------------------------------

/** The derived learning-state projection of the CURRENT store state. */
export function projectStoreLearningState(
  store: LearningStore,
  projectedAt: string,
): LearningStateProjection {
  return projectLearningState(
    {
      solutionId: store.solutionId,
      candidates: store.candidates,
      comparisonFacts: store.comparisonFacts,
      outcomeRecords: store.outcomeRecords,
      datasets: store.datasets,
      metricSets: store.metricSets,
      revisions: store.revisions,
    },
    projectedAt,
  );
}

/** The store fold: candidates sorted by candidateId (deterministic). */
export function foldCandidates(
  store: LearningStore,
): readonly SealedOutcomeLearningCandidate[] {
  return [...store.candidates].sort((a, b) => (a.candidateId < b.candidateId ? -1 : 1));
}

/** The store fold: datasets sorted by datasetId (deterministic). */
export function foldDatasets(store: LearningStore): readonly SealedLearningDataset[] {
  return [...store.datasets].sort((a, b) => (a.datasetId < b.datasetId ? -1 : 1));
}

/** The store fold: metric sets sorted by metricId (deterministic). */
export function foldMetricSets(
  store: LearningStore,
): readonly SealedCalibrationMetricSet[] {
  return [...store.metricSets].sort((a, b) => (a.metricId < b.metricId ? -1 : 1));
}
