/**
 * @epoch/learning-calibration — public API (kernel layer, Work Order
 * W040).
 *
 * The LEARN spine over the W036 solution-delivery + W039
 * actualization/variance outputs (USL1.0, binding: the lifecycle spine
 * ends `... Forecast -> Close -> Learn` — LEARN turns validated
 * delivery outcomes into governed calibration records for future
 * prediction improvement):
 *
 * - PREDICTION-TO-OUTCOME DATASETS: sealed, versioned, content-addressed
 *   records — the deterministic fold over eligible outcome-learning
 *   candidates (each embedding one W039-grammar comparison fact + one
 *   W036 Outcome record + typed validation/variance evidence); identical
 *   eligible inputs derive identical dataset ids AND digests;
 * - TYPED DATA ELIGIBILITY: `eligible | excluded-unvalidated |
 *   excluded-unresolved | excluded-foreign-tenant` — ONLY validated
 *   actual/outcome records enter datasets; every exclusion is a TYPED
 *   record (never a silent drop); cross-tenant components are
 *   tenant-isolation-rejected at admission (R12);
 * - ERROR AND VARIANCE FEATURES: per-row typed feature vectors derived
 *   from the W039 variance vocabularies (magnitude, direction via the
 *   class polarity table, magnitude band via caller-supplied thresholds,
 *   attribution cause kind) — closed vocabularies, deterministic;
 * - CALIBRATION METRICS: deterministic folds per (model, version,
 *   applicability scope) — bias, MAE-class summaries, hit-rate against
 *   declared tolerance bands, per-domain-pack and per-realization-variant
 *   breakdowns, every metric set carrying the dataset digest + the exact
 *   fold definition + W005-convention justification entries;
 * - THE MODEL REGISTRY: typed revisions with MANDATORY lineage (dataset
 *   digests + the specific observation digests that changed each
 *   revision — `model-revision-lineage-required`), admitted ONLY
 *   through typed proposals (draft revision + justification + lineage —
 *   the controlled model/parameter update interface);
 * - HISTORY IS IMMUTABLE: the kernel NEVER mutates source facts/outcomes
 *   (read-only by construction — no write path exists); re-admission of
 *   the same identity with different content is typed
 *   `history-immutable`; tampered/stale references are
 *   `stale-reference-rejected`;
 * - DOMAIN-PACK CONTEXT BY TYPED REFERENCE: pack-scoped learning
 *   surfaces are PURE PROJECTIONS over the universal dataset
 *   (`parallel-history-store-rejected` — no pack-keyed duplicate
 *   stores);
 * - the `learning:*` event vocabulary over the W010 event shapes.
 *
 * NO ML runtime, NO model training, NO external provider, NO
 * persistence, NO UI, NO provider vocabulary — learning-record sources
 * stay behind the service-layer LearningRecordSourcePort seam.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/*.ts), compile-time kernel
 * parity (src/kernel-parity.ts), the committed in-package JSON Schema
 * projection under schemas/ (the W007/W009/W023/W036/W039 convention),
 * the public core-record surface at contracts/learning-calibration/
 * (the W012 convention), both pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  ATTRIBUTION_UNATTRIBUTED,
  LEARNING_ATTRIBUTION_CAUSE_KINDS,
  LEARNING_ATTRIBUTION_FEATURE_KINDS,
  LEARNING_CALIBRATION_CONTRACT_VERSION,
  LEARNING_CALIBRATION_RECORD_VERSION,
  LEARNING_DATASET_ID_PATTERN,
  LEARNING_ELIGIBILITY_RULESET_VERSION,
  LEARNING_ELIGIBILITY_STATES,
  LEARNING_EVENT_DISCRIMINATORS,
  LEARNING_EVENT_RECORD_VERSION,
  LEARNING_EXCLUSION_ID_PATTERN,
  LEARNING_EXCLUSION_REASONS,
  LEARNING_EXCLUSION_STATES,
  LEARNING_FORECAST_BIAS_DIRECTIONS,
  LEARNING_JUSTIFICATION_KINDS,
  LEARNING_MEASURE_CLASSES,
  LEARNING_METRIC_ID_PATTERN,
  LEARNING_METRIC_SPEC_VERSION,
  LEARNING_METRIC_SUMMARY_KINDS,
  LEARNING_MODEL_ID_PATTERN,
  LEARNING_PRINCIPAL_ID_PATTERN,
  LEARNING_PROPOSAL_ID_PATTERN,
  LEARNING_REVISION_ID_PATTERN,
  LEARNING_ROW_ID_PATTERN,
  LEARNING_STREAM_ID_PATTERN,
  LEARNING_VALIDATION_STATES,
  LEARNING_VARIANCE_CLASSES,
  LEARNING_VARIANCE_CLASS_POLARITY,
  LEARNING_VARIANCE_DIRECTIONS,
  LEARNING_VARIANCE_MAGNITUDE_BANDS,
  OUTCOME_KIND_ELIGIBILITY,
  UNRESOLVED_OUTCOME_KINDS,
  UNVALIDATED_OUTCOME_KINDS,
  VALIDATED_OUTCOME_KINDS,
  VALIDATION_STATE_ELIGIBILITY,
  learningStreamIdOf,
  scopeSlug,
} from './version';
export type {
  LearningAttributionCauseKind,
  LearningAttributionFeatureKind,
  LearningEligibilityState,
  LearningEventDiscriminator,
  LearningExclusionReason,
  LearningExclusionState,
  LearningForecastBiasDirection,
  LearningJustificationKind,
  LearningMeasureClass,
  LearningMetricSummaryKind,
  LearningValidationState,
  LearningVarianceClass,
  LearningVarianceDirection,
  LearningVarianceMagnitudeBand,
  OutcomeEligibilityAxis,
} from './version';

// Primitives (zod schemas + types).
export {
  CurrencyCodeSchema,
  LearningCandidateIdSchema,
  LearningDatasetIdSchema,
  LearningExclusionIdSchema,
  LearningMetricIdSchema,
  LearningModelIdSchema,
  LearningProposalIdSchema,
  LearningRevisionIdSchema,
  LearningRowIdSchema,
  NonNegativeDecimalSchema,
  PrincipalIdSchema,
  QualifiedNameSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TenantIdSchema,
  TimestampSchema,
  UnitLabelSchema,
} from './primitives';
export type {
  CurrencyCode,
  LearningCandidateId,
  LearningDatasetId,
  LearningExclusionId,
  LearningMetricId,
  LearningModelId,
  LearningProposalId,
  LearningRevisionId,
  LearningRowId,
  NonNegativeDecimal,
  PrincipalId,
  QualifiedName,
  SemverCore,
  Sha256Hex,
  SolutionId,
  Timestamp,
  UnitLabel,
} from './primitives';
export type { TenantId } from '@epoch/tenancy';

// The composed W036 grammars (re-exported for the contract surface —
// genuine runtime composition, the same objects).
export type {
  DistinctionSubject,
  Measure,
  RealizationVariant,
  UncertaintyState,
} from '@epoch/solution-delivery';

// Typed error taxonomy + result.
export type {
  LearningError,
  LearningErrorCode,
  LearningIssue,
  LearningResult,
} from './errors';

// Exact decimal-string arithmetic.
export {
  addNonNegativeDecimals,
  compareNonNegativeDecimals,
  decimalFromFraction,
  divideNonNegativeDecimals,
  multiplyNonNegativeDecimals,
  subtractNonNegativeDecimals,
} from './decimal';
export type { SignedDifference } from './decimal';

// The opaque typed references (W039 grammars mirrored, W036 composed).
export {
  ActualSideReferenceSchema,
  ComparisonFactInputSchema,
  ComparisonRecordReferenceSchema,
  ForecastSideReferenceSchema,
  LearningCauseRefSchema,
  OutcomeRecordReferenceSchema,
  OutcomeRecordSlotSchema,
  PackReferenceSchema,
  SealedComparisonFactInputSchema,
  ValidationStateEvidenceSchema,
  VarianceEvidenceSchema,
  computeComparisonFactInputDigest,
  measureValueOf,
  sealComparisonFactInput,
  verifySealedComparisonFactInput,
} from './references';
export type {
  ActualSideReference,
  ComparisonFactInput,
  ComparisonRecordReference,
  ForecastSideReference,
  LearningCauseRef,
  OutcomeRecordReference,
  PackReference,
  SealedComparisonFactInput,
  SealedOutcomeRecord,
  ValidationStateEvidence,
  VarianceEvidence,
} from './references';

// Eligibility + the candidate + the typed exclusion records.
export {
  ExclusionRecordContentSchema,
  OutcomeLearningCandidateSchema,
  SealedExclusionRecordSchema,
  SealedOutcomeLearningCandidateSchema,
  computeCandidateDigest,
  computeExclusionRecordDigest,
  evaluateEligibility,
  sealExclusionRecord,
  sealOutcomeLearningCandidate,
  verifySealedExclusionRecord,
  verifySealedOutcomeLearningCandidate,
} from './eligibility';
export type {
  EligibilityEvaluation,
  ExclusionRecordContent,
  OutcomeLearningCandidate,
  SealedExclusionRecord,
  SealedOutcomeLearningCandidate,
} from './eligibility';

// Error/variance features.
export {
  ErrorVarianceFeaturesSchema,
  LearningBandThresholdsSchema,
  computeErrorVarianceFeaturesDigest,
  deriveDirection,
  deriveErrorVarianceFeatures,
  deriveMagnitudeBand,
  verifyErrorVarianceFeatures,
} from './features';
export type {
  ErrorVarianceFeatures,
  LearningBandThresholds,
} from './features';

// Datasets.
export {
  DatasetRowContentSchema,
  LearningDatasetContentSchema,
  SealedDatasetRowSchema,
  SealedLearningDatasetSchema,
  assembleDataset,
  computeDatasetRowDigest,
  computeLearningDatasetDigest,
  foldDatasetRows,
  foldExclusions,
  sealDatasetRow,
  sealLearningDataset,
  verifySealedDatasetRow,
  verifySealedLearningDataset,
} from './dataset';
export type {
  AssemblyEvidencePool,
  DatasetAssemblyOptions,
  DatasetRowContent,
  LearningDatasetContent,
  SealedDatasetRow,
  SealedLearningDataset,
} from './dataset';

// Calibration metrics.
export {
  BiasSummarySchema,
  CalibrationMetricSetContentSchema,
  HitRateSummarySchema,
  LearningApplicabilitySchema,
  MeanAbsoluteErrorSummarySchema,
  MetricJustificationSchema,
  PackBreakdownSchema,
  SealedCalibrationMetricSetSchema,
  SignedDeviationSchema,
  ToleranceBandsSchema,
  VariantBreakdownSchema,
  computeCalibrationMetricSetDigest,
  foldCalibrationMetrics,
  rowMatchesApplicability,
  sealCalibrationMetricSet,
  verifySealedCalibrationMetricSet,
} from './metrics';
export type {
  BiasSummary,
  CalibrationMetricSetContent,
  HitRateSummary,
  LearningApplicability,
  MeanAbsoluteErrorSummary,
  MetricJustification,
  MetricFoldOptions,
  MetricModelScope,
  PackBreakdown,
  SealedCalibrationMetricSet,
  SignedDeviation,
  ToleranceBands,
  VariantBreakdown,
} from './metrics';

// The model registry (controlled updates).
export {
  ChangingObservationRefSchema,
  DatasetLineageRefSchema,
  ModelRevisionContentSchema,
  ModelRevisionProposalContentSchema,
  SealedModelRevisionProposalSchema,
  SealedModelRevisionSchema,
  admitModelRevision,
  computeModelRevisionDigest,
  computeModelRevisionProposalDigest,
  foldModelRevisions,
  modelRevisionChain,
  resolveModelRevision,
  sealModelRevision,
  sealModelRevisionProposal,
  verifySealedModelRevision,
  verifySealedModelRevisionProposal,
} from './model-registry';
export type {
  ChangingObservationRef,
  DatasetLineageRef,
  ModelRegistryAdmission,
  ModelRevisionContent,
  ModelRevisionProposalContent,
  SealedModelRevision,
  SealedModelRevisionProposal,
} from './model-registry';

// Pure projections (pack views — never pack-keyed stores).
export {
  PackLearningViewSchema,
  PackViewSelectorSchema,
  openPackScopedLearningStore,
  projectLearningState,
  projectPackView,
} from './projections';
export type {
  LearningStateInput,
  LearningStateProjection,
  PackLearningView,
  PackViewSelector,
} from './projections';

// The learning:* event vocabulary over the W010 event shapes.
export {
  DatasetAssembledDataSchema,
  DatasetReplayedDataSchema,
  LEARNING_EVENT_DATA_SCHEMAS,
  LearningCausalParentSchema,
  LearningEventContentSchema,
  LearningEventPayloadSchema,
  LearningEventSequenceSchema,
  MetricsFoldedDataSchema,
  PackViewProjectedDataSchema,
  RecordIntakenDataSchema,
  RevisionAdmittedDataSchema,
  RevisionProposedDataSchema,
  SealedLearningEventSchema,
  StateProjectedDataSchema,
  computeLearningEventDigest,
  parseLearningEventData,
  sealLearningEvent,
  verifySealedLearningEvent,
} from './events';
export type {
  DatasetAssembledData,
  DatasetReplayedData,
  LearningCausalParent,
  LearningEventContent,
  LearningEventPayload,
  LearningEventSequence,
  MetricsFoldedData,
  PackViewProjectedData,
  RecordIntakenData,
  RevisionAdmittedData,
  RevisionProposedData,
  SealedLearningEvent,
  StateProjectedData,
} from './events';

// The reference in-memory store.
export {
  admitDataset,
  admitMetricSet,
  admitModelRevisionProposal,
  assembleDatasetFromStore,
  foldCandidates,
  foldDatasets,
  foldMetricSets,
  foldMetrics,
  intakeLearningRecord,
  openLearningStore,
  projectStoreLearningState,
  registerComparisonFact,
  registerOutcomeRecord,
} from './store';
export type {
  CandidateIntakeOutcome,
  DatasetAssemblyOutcome,
  LearningStore,
  MetricFoldOutcome,
  ProposalAdmissionOutcome,
  StoreMetricFoldOptions,
} from './store';

// Published schema surface + contract emission.
export {
  CORE_RECORD_SURFACE,
  LEARNING_CALIBRATION_SCHEMA_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  LEARNING_CALIBRATION_CONTRACT_DIR,
  LEARNING_CALIBRATION_PUBLIC_CONTRACT_DIR,
  renderLearningCalibrationContractFiles,
  renderLearningCalibrationPublicContractFiles,
  typeToKebabCase,
} from './contract-emission';
