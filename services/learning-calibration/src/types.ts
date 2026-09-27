/**
 * The service-layer host-model types: option shapes, the typed
 * service-error union (kernel errors + the service-owned codes), and
 * the LearningRecordSourcePort adapter seam (external learning-record
 * sources — W039 actualization/variance pipelines, W038 field systems —
 * live BEHIND it; the core never names a vendor).
 */
import type {
  LearningError,
  LearningStore,
  SealedCalibrationMetricSet,
  SealedComparisonFactInput,
  SealedLearningDataset,
  SealedLearningEvent,
  SealedModelRevision,
  SealedModelRevisionProposal,
  SealedOutcomeLearningCandidate,
  DatasetAssemblyOptions,
  StoreMetricFoldOptions,
  LearningStateProjection,
  PackLearningView,
} from '@epoch/learning-calibration';
import type { SealedDistinctionRecord } from '@epoch/solution-delivery';
import type { AuthorizationContext } from '@epoch/authorization';

// The sealed records the host folds (type re-exports for the service
// surface — the runtime dependency is @epoch/learning-calibration; the
// W036 record TYPES surface through the kernel's re-exports and this
// typed alias).
export type {
  LearningStore,
  SealedCalibrationMetricSet,
  SealedComparisonFactInput,
  SealedLearningDataset,
  SealedLearningEvent,
  SealedModelRevision,
  SealedModelRevisionProposal,
  SealedOutcomeLearningCandidate,
  DatasetAssemblyOptions,
  StoreMetricFoldOptions,
  LearningStateProjection,
  PackLearningView,
};

/** The W036-sealed outcome record the host registers as source history. */
export type { SealedDistinctionRecord };

/** The typed service-error union: kernel errors + service-owned codes. */
export type LearningCalibrationServiceError =
  | LearningError
  | {
      readonly code: 'authorization-rejected';
      readonly message: string;
      readonly denialCode: string;
      readonly principalId: string;
      readonly operation: string;
    }
  | {
      readonly code: 'unknown-scope';
      readonly message: string;
      readonly solutionId: string;
    };

/** Total-result wrapper of every service entry point. */
export type LearningCalibrationServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: LearningCalibrationServiceError };

/** The caller-supplied authorization context (W009 decision facts). */
export type { AuthorizationContext };

/** The caller-supplied authorization input (principal + context + justification). */
export interface AuthorizationInput {
  readonly principalId: string;
  readonly context: AuthorizationContext;
  readonly justification?: string | undefined;
}

/** Options of the {@link LearningCalibrationRuntime} constructor. */
export interface LearningCalibrationRuntimeOptions {
  /**
   * Tenant this host is scoped to. When provided, ANY operation naming a
   * different tenant is rejected with `tenant-isolation-rejected` (R12 —
   * the single-tenant guard precedent).
   */
  readonly expectedTenantId?: string | undefined;
  /**
   * The LearningRecordSourcePort adapter seam (external learning-record
   * sources — W039 pipelines, W038 field systems). Defaults to the
   * in-memory reference adapter. The core never names a vendor.
   */
  readonly recordSourcePort?: LearningRecordSourcePort | undefined;
}

/**
 * The LearningRecordSourcePort adapter seam: external learning-record
 * sources submit sealed OUTCOME-LEARNING CANDIDATES (each embedding its
 * W039-grammar comparison fact and W036 Outcome record — the complete
 * prediction-to-outcome learning record) behind this port; the host
 * polls and admits them through the kernel intake, registering the
 * embedded source history first. Provider semantics stay behind
 * adapters — the core never names a vendor.
 */
export interface LearningRecordSourcePort {
  /** Poll the pending submissions of one solution scope (deterministic order). */
  pollLearningRecords(options: {
    readonly tenantId: string;
    readonly solutionId: string;
    readonly requestedAt: string;
    readonly requestedBy: string;
  }): LearningCalibrationServiceResult<readonly SealedOutcomeLearningCandidate[]>;
  /** Submit one sealed outcome-learning candidate into the pending queue. */
  submit(options: {
    readonly tenantId: string;
    readonly solutionId: string;
    readonly candidate: SealedOutcomeLearningCandidate;
  }): LearningCalibrationServiceResult<null>;
}

/** The outcome of one learning-record intake. */
export interface LearningRecordIntakeOutcome {
  readonly candidateId: string;
  readonly admission: 'intaken' | 'duplicate-candidate';
}

/** The outcome of one dataset assembly through the host. */
export interface DatasetAssemblyHostOutcome {
  readonly admission: 'assembled' | 'replayed';
  readonly dataset: SealedLearningDataset;
}

/** The outcome of one metric fold through the host. */
export interface MetricFoldHostOutcome {
  readonly admission: 'folded' | 'duplicate-metrics';
  readonly metricSet: SealedCalibrationMetricSet;
}

/** The outcome of one proposal admission through the host. */
export interface ProposalAdmissionHostOutcome {
  readonly admission: 'admitted' | 'duplicate-proposal';
  readonly revision: SealedModelRevision;
}

/** The derived runtime health snapshot. */
export interface RuntimeHealth {
  readonly scopeCount: number;
  readonly comparisonFactCount: number;
  readonly outcomeRecordCount: number;
  readonly candidateCount: number;
  readonly datasetCount: number;
  readonly metricSetCount: number;
  readonly revisionCount: number;
  readonly eventCount: number;
}
