/**
 * Compile-time conformance assertions for the learning-calibration
 * contract surface.
 *
 * Mirrors `contracts/actualization/parity.ts`: imports both the published
 * declarations (`./index`) and the runtime implementation
 * (`@epoch/learning-calibration`) and asserts strict type identity for
 * every surface type, so the self-contained declarations cannot drift
 * from the zod-inferred implementation types. Compiled by
 * `packages/learning-calibration`'s `typecheck` script
 * (`tsconfig.contracts.json`); any drift fails `pnpm typecheck`.
 * Verification-only; no runtime dependency.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/learning-calibration';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
type Expect<T extends true> = T;

// Versions + closed vocabularies.
export type ValidationStateParity = Expect<
  Equals<contracts.LearningValidationState, impl.LearningValidationState>
>;
export type ForecastBiasDirectionParity = Expect<
  Equals<contracts.LearningForecastBiasDirection, impl.LearningForecastBiasDirection>
>;
export type EligibilityStateParity = Expect<
  Equals<contracts.LearningEligibilityState, impl.LearningEligibilityState>
>;
export type ExclusionStateParity = Expect<
  Equals<contracts.LearningExclusionState, impl.LearningExclusionState>
>;
export type ExclusionReasonParity = Expect<
  Equals<contracts.LearningExclusionReason, impl.LearningExclusionReason>
>;
export type VarianceClassParity = Expect<
  Equals<contracts.LearningVarianceClass, impl.LearningVarianceClass>
>;
export type VarianceDirectionParity = Expect<
  Equals<contracts.LearningVarianceDirection, impl.LearningVarianceDirection>
>;
export type VarianceMagnitudeBandParity = Expect<
  Equals<contracts.LearningVarianceMagnitudeBand, impl.LearningVarianceMagnitudeBand>
>;
export type AttributionCauseKindParity = Expect<
  Equals<contracts.LearningAttributionCauseKind, impl.LearningAttributionCauseKind>
>;
export type AttributionFeatureKindParity = Expect<
  Equals<contracts.LearningAttributionFeatureKind, impl.LearningAttributionFeatureKind>
>;
export type MeasureClassParity = Expect<
  Equals<contracts.LearningMeasureClass, impl.LearningMeasureClass>
>;
export type MetricSummaryKindParity = Expect<
  Equals<contracts.LearningMetricSummaryKind, impl.LearningMetricSummaryKind>
>;
export type JustificationKindParity = Expect<
  Equals<contracts.LearningJustificationKind, impl.LearningJustificationKind>
>;
export type EventDiscriminatorParity = Expect<
  Equals<contracts.LearningEventDiscriminator, impl.LearningEventDiscriminator>
>;
export type RealizationVariantParity = Expect<
  Equals<contracts.RealizationVariant, impl.RealizationVariant>
>;

// Neutral primitives + record identities.
export type Sha256HexParity = Expect<Equals<contracts.Sha256Hex, impl.Sha256Hex>>;
export type TimestampParity = Expect<Equals<contracts.Timestamp, impl.Timestamp>>;
export type TenantIdParity = Expect<Equals<contracts.TenantId, impl.TenantId>>;
export type PrincipalIdParity = Expect<Equals<contracts.PrincipalId, impl.PrincipalId>>;
export type SolutionIdParity = Expect<Equals<contracts.SolutionId, impl.SolutionId>>;
export type NonNegativeDecimalParity = Expect<
  Equals<contracts.NonNegativeDecimal, impl.NonNegativeDecimal>
>;
export type QualifiedNameParity = Expect<Equals<contracts.QualifiedName, impl.QualifiedName>>;
export type SemverCoreParity = Expect<Equals<contracts.SemverCore, impl.SemverCore>>;
export type UnitLabelParity = Expect<Equals<contracts.UnitLabel, impl.UnitLabel>>;
export type CurrencyCodeParity = Expect<Equals<contracts.CurrencyCode, impl.CurrencyCode>>;

// The composed W036 grammars.
export type DistinctionSubjectParity = Expect<
  Equals<contracts.DistinctionSubject, impl.DistinctionSubject>
>;
export type MeasureParity = Expect<Equals<contracts.Measure, impl.Measure>>;
export type UncertaintyStateParity = Expect<
  Equals<contracts.UncertaintyState, impl.UncertaintyState>
>;
export type SealedOutcomeRecordParity = Expect<
  Equals<contracts.SealedOutcomeRecord, impl.SealedOutcomeRecord>
>;

// The opaque W039 comparison-fact mirror.
export type ComparisonRecordReferenceParity = Expect<
  Equals<contracts.ComparisonRecordReference, impl.ComparisonRecordReference>
>;
export type ForecastSideReferenceParity = Expect<
  Equals<contracts.ForecastSideReference, impl.ForecastSideReference>
>;
export type ActualSideReferenceParity = Expect<
  Equals<contracts.ActualSideReference, impl.ActualSideReference>
>;
export type ComparisonFactInputParity = Expect<
  Equals<contracts.ComparisonFactInput, impl.ComparisonFactInput>
>;
export type SealedComparisonFactInputParity = Expect<
  Equals<contracts.SealedComparisonFactInput, impl.SealedComparisonFactInput>
>;

// Evidence records + the pack reference.
export type ValidationStateEvidenceParity = Expect<
  Equals<contracts.ValidationStateEvidence, impl.ValidationStateEvidence>
>;
export type LearningCauseRefParity = Expect<
  Equals<contracts.LearningCauseRef, impl.LearningCauseRef>
>;
export type VarianceEvidenceParity = Expect<
  Equals<contracts.VarianceEvidence, impl.VarianceEvidence>
>;
export type PackReferenceParity = Expect<Equals<contracts.PackReference, impl.PackReference>>;

// The candidate + the typed exclusion records.
export type OutcomeLearningCandidateParity = Expect<
  Equals<contracts.OutcomeLearningCandidate, impl.OutcomeLearningCandidate>
>;
export type SealedOutcomeLearningCandidateParity = Expect<
  Equals<contracts.SealedOutcomeLearningCandidate, impl.SealedOutcomeLearningCandidate>
>;
export type ExclusionRecordContentParity = Expect<
  Equals<contracts.ExclusionRecordContent, impl.ExclusionRecordContent>
>;
export type SealedExclusionRecordParity = Expect<
  Equals<contracts.SealedExclusionRecord, impl.SealedExclusionRecord>
>;

// Features + band thresholds.
export type LearningBandThresholdsParity = Expect<
  Equals<contracts.LearningBandThresholds, impl.LearningBandThresholds>
>;
export type ErrorVarianceFeaturesParity = Expect<
  Equals<contracts.ErrorVarianceFeatures, impl.ErrorVarianceFeatures>
>;

// The dataset.
export type DatasetRowContentParity = Expect<
  Equals<contracts.DatasetRowContent, impl.DatasetRowContent>
>;
export type SealedDatasetRowParity = Expect<
  Equals<contracts.SealedDatasetRow, impl.SealedDatasetRow>
>;
export type LearningDatasetContentParity = Expect<
  Equals<contracts.LearningDatasetContent, impl.LearningDatasetContent>
>;
export type SealedLearningDatasetParity = Expect<
  Equals<contracts.SealedLearningDataset, impl.SealedLearningDataset>
>;

// Calibration metrics.
export type LearningApplicabilityParity = Expect<
  Equals<contracts.LearningApplicability, impl.LearningApplicability>
>;
export type ToleranceBandsParity = Expect<
  Equals<contracts.ToleranceBands, impl.ToleranceBands>
>;
export type SignedDeviationParity = Expect<
  Equals<contracts.SignedDeviation, impl.SignedDeviation>
>;
export type BiasSummaryParity = Expect<Equals<contracts.BiasSummary, impl.BiasSummary>>;
export type MeanAbsoluteErrorSummaryParity = Expect<
  Equals<contracts.MeanAbsoluteErrorSummary, impl.MeanAbsoluteErrorSummary>
>;
export type HitRateSummaryParity = Expect<
  Equals<contracts.HitRateSummary, impl.HitRateSummary>
>;
export type PackBreakdownParity = Expect<Equals<contracts.PackBreakdown, impl.PackBreakdown>>;
export type VariantBreakdownParity = Expect<
  Equals<contracts.VariantBreakdown, impl.VariantBreakdown>
>;
export type MetricJustificationParity = Expect<
  Equals<contracts.MetricJustification, impl.MetricJustification>
>;
export type CalibrationMetricSetContentParity = Expect<
  Equals<contracts.CalibrationMetricSetContent, impl.CalibrationMetricSetContent>
>;
export type SealedCalibrationMetricSetParity = Expect<
  Equals<contracts.SealedCalibrationMetricSet, impl.SealedCalibrationMetricSet>
>;

// The model registry.
export type DatasetLineageRefParity = Expect<
  Equals<contracts.DatasetLineageRef, impl.DatasetLineageRef>
>;
export type ChangingObservationRefParity = Expect<
  Equals<contracts.ChangingObservationRef, impl.ChangingObservationRef>
>;
export type ModelRevisionContentParity = Expect<
  Equals<contracts.ModelRevisionContent, impl.ModelRevisionContent>
>;
export type SealedModelRevisionParity = Expect<
  Equals<contracts.SealedModelRevision, impl.SealedModelRevision>
>;
export type ModelRevisionProposalContentParity = Expect<
  Equals<contracts.ModelRevisionProposalContent, impl.ModelRevisionProposalContent>
>;
export type SealedModelRevisionProposalParity = Expect<
  Equals<contracts.SealedModelRevisionProposal, impl.SealedModelRevisionProposal>
>;

// The learning:* events over the W010 event shapes.
export type LearningEventSequenceParity = Expect<
  Equals<contracts.LearningEventSequence, impl.LearningEventSequence>
>;
export type LearningCausalParentParity = Expect<
  Equals<contracts.LearningCausalParent, impl.LearningCausalParent>
>;
export type LearningEventPayloadParity = Expect<
  Equals<contracts.LearningEventPayload, impl.LearningEventPayload>
>;
export type LearningEventContentParity = Expect<
  Equals<contracts.LearningEventContent, impl.LearningEventContent>
>;
export type SealedLearningEventParity = Expect<
  Equals<contracts.SealedLearningEvent, impl.SealedLearningEvent>
>;
