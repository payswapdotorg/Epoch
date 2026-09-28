/**
 * The learning-calibration schema-surface registry: every data type
 * published at the `@epoch/learning-calibration` ownership boundary,
 * paired with its zod schema.
 *
 * W040 publishes TWO versioned contract artifact sets from this one
 * surface (both drift-pinned by test/contract-drift.test.ts):
 *
 * - the IN-PACKAGE full surface under
 *   `packages/learning-calibration/schemas` (the W006/W007/W009/W023/
 *   W036/W039 in-package convention) — every entry below;
 * - the PUBLIC core-record projection under
 *   `contracts/learning-calibration/schemas` (the W012 convention) —
 *   the CORE_RECORD_SURFACE subset (see src/contract-emission.ts).
 *
 * Invariants enforced by the drift test: every committed schema file is
 * byte-identical to the deterministic emission of its surface entry.
 */
import { type ZodType } from 'zod';
import {
  LearningCandidateIdSchema,
  LearningDatasetIdSchema,
  LearningExclusionIdSchema,
  LearningMetricIdSchema,
  LearningModelIdSchema,
  LearningProposalIdSchema,
  LearningRevisionIdSchema,
  LearningRowIdSchema,
  PrincipalIdSchema,
  NonNegativeDecimalSchema,
  QualifiedNameSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  UnitLabelSchema,
  CurrencyCodeSchema,
} from './primitives';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  ComparisonFactInputSchema,
  SealedComparisonFactInputSchema,
  ComparisonRecordReferenceSchema,
  ForecastSideReferenceSchema,
  ActualSideReferenceSchema,
  OutcomeRecordSlotSchema,
  OutcomeRecordReferenceSchema,
  PackReferenceSchema,
  ValidationStateEvidenceSchema,
  LearningCauseRefSchema,
  VarianceEvidenceSchema,
} from './references';
import {
  OutcomeLearningCandidateSchema,
  SealedOutcomeLearningCandidateSchema,
  ExclusionRecordContentSchema,
  SealedExclusionRecordSchema,
} from './eligibility';
import {
  DatasetRowContentSchema,
  SealedDatasetRowSchema,
  LearningDatasetContentSchema,
  SealedLearningDatasetSchema,
} from './dataset';
import {
  ErrorVarianceFeaturesSchema,
  LearningBandThresholdsSchema,
} from './features';
import {
  LearningApplicabilitySchema,
  ToleranceBandsSchema,
  SignedDeviationSchema,
  BiasSummarySchema,
  MeanAbsoluteErrorSummarySchema,
  HitRateSummarySchema,
  PackBreakdownSchema,
  VariantBreakdownSchema,
  MetricJustificationSchema,
  CalibrationMetricSetContentSchema,
  SealedCalibrationMetricSetSchema,
} from './metrics';
import {
  DatasetLineageRefSchema,
  ChangingObservationRefSchema,
  ModelRevisionContentSchema,
  SealedModelRevisionSchema,
  ModelRevisionProposalContentSchema,
  SealedModelRevisionProposalSchema,
} from './model-registry';
import {
  LearningEventSequenceSchema,
  LearningCausalParentSchema,
  LearningEventPayloadSchema,
  LearningEventContentSchema,
  SealedLearningEventSchema,
  RecordIntakenDataSchema,
  DatasetAssembledDataSchema,
  DatasetReplayedDataSchema,
  MetricsFoldedDataSchema,
  RevisionProposedDataSchema,
  RevisionAdmittedDataSchema,
  StateProjectedDataSchema,
  PackViewProjectedDataSchema,
} from './events';
import { DistinctionSubjectSchema, MeasureSchema } from '@epoch/solution-delivery';

/** One entry of the published schema surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The full published schema surface of @epoch/learning-calibration. */
export const LEARNING_CALIBRATION_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'Timestamp', schema: TimestampSchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'TenantId', schema: TenantIdSchema },
  { type: 'SolutionId', schema: SolutionIdSchema },
  { type: 'NonNegativeDecimal', schema: NonNegativeDecimalSchema },
  { type: 'QualifiedName', schema: QualifiedNameSchema },
  { type: 'SemverCore', schema: SemverCoreSchema },
  { type: 'UnitLabel', schema: UnitLabelSchema },
  { type: 'CurrencyCode', schema: CurrencyCodeSchema },
  { type: 'DistinctionSubject', schema: DistinctionSubjectSchema },
  { type: 'Measure', schema: MeasureSchema },
  { type: 'LearningCandidateId', schema: LearningCandidateIdSchema },
  { type: 'LearningDatasetId', schema: LearningDatasetIdSchema },
  { type: 'LearningRowId', schema: LearningRowIdSchema },
  { type: 'LearningExclusionId', schema: LearningExclusionIdSchema },
  { type: 'LearningMetricId', schema: LearningMetricIdSchema },
  { type: 'LearningModelId', schema: LearningModelIdSchema },
  { type: 'LearningRevisionId', schema: LearningRevisionIdSchema },
  { type: 'LearningProposalId', schema: LearningProposalIdSchema },
  { type: 'ComparisonRecordReference', schema: ComparisonRecordReferenceSchema },
  { type: 'ForecastSideReference', schema: ForecastSideReferenceSchema },
  { type: 'ActualSideReference', schema: ActualSideReferenceSchema },
  { type: 'OutcomeRecordSlot', schema: OutcomeRecordSlotSchema },
  { type: 'OutcomeRecordReference', schema: OutcomeRecordReferenceSchema },
  { type: 'PackReference', schema: PackReferenceSchema },
  { type: 'ValidationStateEvidence', schema: ValidationStateEvidenceSchema },
  { type: 'LearningCauseRef', schema: LearningCauseRefSchema },
  { type: 'VarianceEvidence', schema: VarianceEvidenceSchema },
  { type: 'ComparisonFactInput', schema: ComparisonFactInputSchema },
  { type: 'SealedComparisonFactInput', schema: SealedComparisonFactInputSchema },
  { type: 'OutcomeLearningCandidate', schema: OutcomeLearningCandidateSchema },
  { type: 'SealedOutcomeLearningCandidate', schema: SealedOutcomeLearningCandidateSchema },
  { type: 'ExclusionRecordContent', schema: ExclusionRecordContentSchema },
  { type: 'SealedExclusionRecord', schema: SealedExclusionRecordSchema },
  { type: 'LearningBandThresholds', schema: LearningBandThresholdsSchema },
  { type: 'ErrorVarianceFeatures', schema: ErrorVarianceFeaturesSchema },
  { type: 'DatasetRowContent', schema: DatasetRowContentSchema },
  { type: 'SealedDatasetRow', schema: SealedDatasetRowSchema },
  { type: 'LearningDatasetContent', schema: LearningDatasetContentSchema },
  { type: 'SealedLearningDataset', schema: SealedLearningDatasetSchema },
  { type: 'LearningApplicability', schema: LearningApplicabilitySchema },
  { type: 'ToleranceBands', schema: ToleranceBandsSchema },
  { type: 'SignedDeviation', schema: SignedDeviationSchema },
  { type: 'BiasSummary', schema: BiasSummarySchema },
  { type: 'MeanAbsoluteErrorSummary', schema: MeanAbsoluteErrorSummarySchema },
  { type: 'HitRateSummary', schema: HitRateSummarySchema },
  { type: 'PackBreakdown', schema: PackBreakdownSchema },
  { type: 'VariantBreakdown', schema: VariantBreakdownSchema },
  { type: 'MetricJustification', schema: MetricJustificationSchema },
  { type: 'CalibrationMetricSetContent', schema: CalibrationMetricSetContentSchema },
  { type: 'SealedCalibrationMetricSet', schema: SealedCalibrationMetricSetSchema },
  { type: 'DatasetLineageRef', schema: DatasetLineageRefSchema },
  { type: 'ChangingObservationRef', schema: ChangingObservationRefSchema },
  { type: 'ModelRevisionContent', schema: ModelRevisionContentSchema },
  { type: 'SealedModelRevision', schema: SealedModelRevisionSchema },
  { type: 'ModelRevisionProposalContent', schema: ModelRevisionProposalContentSchema },
  { type: 'SealedModelRevisionProposal', schema: SealedModelRevisionProposalSchema },
  { type: 'LearningEventSequence', schema: LearningEventSequenceSchema },
  { type: 'LearningCausalParent', schema: LearningCausalParentSchema },
  { type: 'LearningEventPayload', schema: LearningEventPayloadSchema },
  { type: 'LearningEventContent', schema: LearningEventContentSchema },
  { type: 'SealedLearningEvent', schema: SealedLearningEventSchema },
  { type: 'RecordIntakenData', schema: RecordIntakenDataSchema },
  { type: 'DatasetAssembledData', schema: DatasetAssembledDataSchema },
  { type: 'DatasetReplayedData', schema: DatasetReplayedDataSchema },
  { type: 'MetricsFoldedData', schema: MetricsFoldedDataSchema },
  { type: 'RevisionProposedData', schema: RevisionProposedDataSchema },
  { type: 'RevisionAdmittedData', schema: RevisionAdmittedDataSchema },
  { type: 'StateProjectedData', schema: StateProjectedDataSchema },
  { type: 'PackViewProjectedData', schema: PackViewProjectedDataSchema },
];

/**
 * The CORE record surface: the public projection published at
 * `contracts/learning-calibration` (the W012 convention) — the record
 * types a domain pack or downstream consumer binds to.
 */
export const CORE_RECORD_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'Timestamp', schema: TimestampSchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'TenantId', schema: TenantIdSchema },
  { type: 'SolutionId', schema: SolutionIdSchema },
  { type: 'NonNegativeDecimal', schema: NonNegativeDecimalSchema },
  { type: 'DistinctionSubject', schema: DistinctionSubjectSchema },
  { type: 'Measure', schema: MeasureSchema },
  { type: 'PackReference', schema: PackReferenceSchema },
  { type: 'ValidationStateEvidence', schema: ValidationStateEvidenceSchema },
  { type: 'VarianceEvidence', schema: VarianceEvidenceSchema },
  { type: 'ComparisonFactInput', schema: ComparisonFactInputSchema },
  { type: 'SealedComparisonFactInput', schema: SealedComparisonFactInputSchema },
  { type: 'OutcomeLearningCandidate', schema: OutcomeLearningCandidateSchema },
  { type: 'SealedOutcomeLearningCandidate', schema: SealedOutcomeLearningCandidateSchema },
  { type: 'ExclusionRecordContent', schema: ExclusionRecordContentSchema },
  { type: 'SealedExclusionRecord', schema: SealedExclusionRecordSchema },
  { type: 'LearningBandThresholds', schema: LearningBandThresholdsSchema },
  { type: 'ErrorVarianceFeatures', schema: ErrorVarianceFeaturesSchema },
  { type: 'DatasetRowContent', schema: DatasetRowContentSchema },
  { type: 'SealedDatasetRow', schema: SealedDatasetRowSchema },
  { type: 'LearningDatasetContent', schema: LearningDatasetContentSchema },
  { type: 'SealedLearningDataset', schema: SealedLearningDatasetSchema },
  { type: 'LearningApplicability', schema: LearningApplicabilitySchema },
  { type: 'ToleranceBands', schema: ToleranceBandsSchema },
  { type: 'BiasSummary', schema: BiasSummarySchema },
  { type: 'MeanAbsoluteErrorSummary', schema: MeanAbsoluteErrorSummarySchema },
  { type: 'HitRateSummary', schema: HitRateSummarySchema },
  { type: 'PackBreakdown', schema: PackBreakdownSchema },
  { type: 'VariantBreakdown', schema: VariantBreakdownSchema },
  { type: 'CalibrationMetricSetContent', schema: CalibrationMetricSetContentSchema },
  { type: 'SealedCalibrationMetricSet', schema: SealedCalibrationMetricSetSchema },
  { type: 'DatasetLineageRef', schema: DatasetLineageRefSchema },
  { type: 'ChangingObservationRef', schema: ChangingObservationRefSchema },
  { type: 'ModelRevisionContent', schema: ModelRevisionContentSchema },
  { type: 'SealedModelRevision', schema: SealedModelRevisionSchema },
  { type: 'ModelRevisionProposalContent', schema: ModelRevisionProposalContentSchema },
  { type: 'SealedModelRevisionProposal', schema: SealedModelRevisionProposalSchema },
  { type: 'LearningEventContent', schema: LearningEventContentSchema },
  { type: 'SealedLearningEvent', schema: SealedLearningEventSchema },
];
