/**
 * @epoch/learning-calibration-runtime — public API (service layer, Work
 * Order W040).
 *
 * The reference LEARNING-CALIBRATION RUNTIME HOST over the
 * @epoch/learning-calibration kernel: source-history registration, the
 * learning-record intake through the LearningRecordSourcePort adapter
 * seam (idempotent replay), deterministic dataset assembly with typed
 * eligibility + exclusion records, replay idempotence + the
 * history-immutable replay conflict, calibration metric folds,
 * model-registry updates EXCLUSIVELY through typed proposals, pack
 * learning surfaces as pure projections, the derived learning-state
 * projection, and the learning:* event streams (W010-shaped,
 * kernel-sealed).
 */
export { LearningCalibrationRuntime } from './runtime';
export { InMemoryLearningRecordSourceAdapter } from './record-source-port';
export { seededLearningRecordSource } from './record-source-port';
export { RUNTIME_RECORD_VERSION } from './version';
export type {
  AuthorizationInput,
  DatasetAssemblyHostOutcome,
  LearningCalibrationRuntimeOptions,
  LearningCalibrationServiceError,
  LearningCalibrationServiceResult,
  LearningRecordIntakeOutcome,
  LearningRecordSourcePort,
  LearningStateProjection,
  MetricFoldHostOutcome,
  PackLearningView,
  ProposalAdmissionHostOutcome,
  RuntimeHealth,
} from './types';
export type {
  DatasetAssemblyOptions,
  LearningStore,
  SealedCalibrationMetricSet,
  SealedComparisonFactInput,
  SealedLearningDataset,
  SealedLearningEvent,
  SealedModelRevision,
  SealedModelRevisionProposal,
  SealedOutcomeLearningCandidate,
  StoreMetricFoldOptions,
} from './types';
export type { SealedDistinctionRecord } from './types';
