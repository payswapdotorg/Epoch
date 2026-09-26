/**
 * Compile-time conformance assertions for the solution-delivery contract
 * surface.
 *
 * Mirrors `contracts/experience-compiler/parity.ts` and
 * `contracts/agent/parity.ts`: imports both the published declarations
 * (`./index`) and the runtime implementation (`@epoch/solution-delivery`)
 * and asserts strict type identity for every surface type, so the
 * self-contained declarations cannot drift from the zod-inferred
 * implementation types. Compiled by `packages/solution-delivery`'s
 * `typecheck` script (`tsconfig.contracts.json`); any drift fails
 * `pnpm typecheck`. Verification-only; no runtime dependency.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/solution-delivery';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
type Expect<T extends true> = T;

// Versions + closed vocabularies.
export type UniversalLifecycleStageParity = Expect<
  Equals<contracts.UniversalLifecycleStage, impl.UniversalLifecycleStage>
>;
export type LifecycleTransitionRelationParity = Expect<
  Equals<contracts.LifecycleTransitionRelation, impl.LifecycleTransitionRelation>
>;
export type SemanticDistinctionKindParity = Expect<
  Equals<contracts.SemanticDistinctionKind, impl.SemanticDistinctionKind>
>;
export type AcquisitionVariantParity = Expect<
  Equals<contracts.AcquisitionVariant, impl.AcquisitionVariant>
>;
export type RealizationVariantParity = Expect<
  Equals<contracts.RealizationVariant, impl.RealizationVariant>
>;
export type ProvenanceKindParity = Expect<
  Equals<contracts.ProvenanceKind, impl.ProvenanceKind>
>;
export type FreshnessStateKindParity = Expect<
  Equals<contracts.FreshnessStateKind, impl.FreshnessStateKind>
>;
export type ConfidenceMethodParity = Expect<
  Equals<contracts.ConfidenceMethod, impl.ConfidenceMethod>
>;
export type OutcomeKindParity = Expect<Equals<contracts.OutcomeKind, impl.OutcomeKind>>;
export type NavigatorProjectionKindParity = Expect<
  Equals<contracts.NavigatorProjectionKind, impl.NavigatorProjectionKind>
>;
export type DeliveryEventDiscriminatorParity = Expect<
  Equals<contracts.DeliveryEventDiscriminator, impl.DeliveryEventDiscriminator>
>;
export type ForbiddenAuthorityFieldParity = Expect<
  Equals<contracts.ForbiddenAuthorityField, impl.ForbiddenAuthorityField>
>;

// Neutral primitives.
export type Sha256HexParity = Expect<Equals<contracts.Sha256Hex, impl.Sha256Hex>>;
export type TimestampParity = Expect<Equals<contracts.Timestamp, impl.Timestamp>>;
export type TenantIdParity = Expect<Equals<contracts.TenantId, impl.TenantId>>;
export type PrincipalIdParity = Expect<Equals<contracts.PrincipalId, impl.PrincipalId>>;
export type SolutionIdParity = Expect<Equals<contracts.SolutionId, impl.SolutionId>>;
export type SolutionLineIdParity = Expect<
  Equals<contracts.SolutionLineId, impl.SolutionLineId>
>;
export type DeliveryIdParity = Expect<Equals<contracts.DeliveryId, impl.DeliveryId>>;
export type ProgramIdParity = Expect<Equals<contracts.ProgramId, impl.ProgramId>>;
export type WorkPackageIdParity = Expect<
  Equals<contracts.WorkPackageId, impl.WorkPackageId>
>;
export type ActivityIdParity = Expect<Equals<contracts.ActivityId, impl.ActivityId>>;
export type MilestoneIdParity = Expect<Equals<contracts.MilestoneId, impl.MilestoneId>>;
export type DistinctionRecordIdParity = Expect<
  Equals<contracts.DistinctionRecordId, impl.DistinctionRecordId>
>;
export type StageRecordIdParity = Expect<
  Equals<contracts.StageRecordId, impl.StageRecordId>
>;
export type TransitionRecordIdParity = Expect<
  Equals<contracts.TransitionRecordId, impl.TransitionRecordId>
>;
export type AcquisitionIdParity = Expect<
  Equals<contracts.AcquisitionId, impl.AcquisitionId>
>;
export type InfoRequestIdParity = Expect<
  Equals<contracts.InfoRequestId, impl.InfoRequestId>
>;
export type ExternalRequestIdParity = Expect<
  Equals<contracts.ExternalRequestId, impl.ExternalRequestId>
>;
export type ExternalEventIdParity = Expect<
  Equals<contracts.ExternalEventId, impl.ExternalEventId>
>;
export type BaselineApprovalIdParity = Expect<
  Equals<contracts.BaselineApprovalId, impl.BaselineApprovalId>
>;
export type GateIdParity = Expect<Equals<contracts.GateId, impl.GateId>>;
export type BlockerIdParity = Expect<Equals<contracts.BlockerId, impl.BlockerId>>;
export type DeliveryStreamIdParity = Expect<
  Equals<contracts.DeliveryStreamId, impl.DeliveryStreamId>
>;
export type SemverCoreParity = Expect<Equals<contracts.SemverCore, impl.SemverCore>>;
export type CurrencyCodeParity = Expect<
  Equals<contracts.CurrencyCode, impl.CurrencyCode>
>;
export type NonNegativeDecimalParity = Expect<
  Equals<contracts.NonNegativeDecimal, impl.NonNegativeDecimal>
>;
export type PositiveIntegerParity = Expect<
  Equals<contracts.PositiveInteger, impl.PositiveInteger>
>;
export type UnitLabelParity = Expect<Equals<contracts.UnitLabel, impl.UnitLabel>>;
export type OpaqueReferenceParity = Expect<
  Equals<contracts.OpaqueReference, impl.OpaqueReference>
>;
export type QualifiedNameParity = Expect<
  Equals<contracts.QualifiedName, impl.QualifiedName>
>;
export type ProgressFractionParity = Expect<
  Equals<contracts.ProgressFraction, impl.ProgressFraction>
>;

// Typed error taxonomy.
export type DeliveryIssueParity = Expect<
  Equals<contracts.DeliveryIssue, impl.DeliveryIssue>
>;
export type DeliveryErrorCodeParity = Expect<
  Equals<contracts.DeliveryErrorCode, impl.DeliveryErrorCode>
>;
export type DeliveryErrorParity = Expect<
  Equals<contracts.DeliveryError, impl.DeliveryError>
>;
export type DeliveryResultParity = Expect<
  Equals<contracts.DeliveryResult<string>, impl.DeliveryResult<string>>
>;

// Uncertainty states.
export type ProvenanceStateParity = Expect<
  Equals<contracts.ProvenanceState, impl.ProvenanceState>
>;
export type FreshnessStateParity = Expect<
  Equals<contracts.FreshnessState, impl.FreshnessState>
>;
export type ConfidenceStateParity = Expect<
  Equals<contracts.ConfidenceState, impl.ConfidenceState>
>;
export type UncertaintyStateParity = Expect<
  Equals<contracts.UncertaintyState, impl.UncertaintyState>
>;

// Solution packages + immutable version baselines.
export type WorldEntityReferenceParity = Expect<
  Equals<contracts.WorldEntityReference, impl.WorldEntityReference>
>;
export type ConstraintReferenceParity = Expect<
  Equals<contracts.ConstraintReference, impl.ConstraintReference>
>;
export type EvidenceReferenceParity = Expect<
  Equals<contracts.EvidenceReference, impl.EvidenceReference>
>;
export type SolutionLineParity = Expect<
  Equals<contracts.SolutionLine, impl.SolutionLine>
>;
export type SolutionVersionContentParity = Expect<
  Equals<contracts.SolutionVersionContent, impl.SolutionVersionContent>
>;
export type SealedSolutionVersionParity = Expect<
  Equals<contracts.SealedSolutionVersion, impl.SealedSolutionVersion>
>;
export type BaselineApprovalParity = Expect<
  Equals<contracts.BaselineApproval, impl.BaselineApproval>
>;
export type SolutionChainSummaryParity = Expect<
  Equals<contracts.SolutionChainSummary, impl.SolutionChainSummary>
>;
export type WorldEntityLookupParity = Expect<
  Equals<contracts.WorldEntityLookup, impl.WorldEntityLookup>
>;
export type ConstraintLookupParity = Expect<
  Equals<contracts.ConstraintLookup, impl.ConstraintLookup>
>;
export type EvidenceLookupParity = Expect<
  Equals<contracts.EvidenceLookup, impl.EvidenceLookup>
>;

// The nine semantic-distinction record types.
export type QuantityMeasureParity = Expect<
  Equals<contracts.QuantityMeasure, impl.QuantityMeasure>
>;
export type CostMeasureParity = Expect<Equals<contracts.CostMeasure, impl.CostMeasure>>;
export type InstantMeasureParity = Expect<
  Equals<contracts.InstantMeasure, impl.InstantMeasure>
>;
export type ProgressMeasureParity = Expect<
  Equals<contracts.ProgressMeasure, impl.ProgressMeasure>
>;
export type MeasureParity = Expect<Equals<contracts.Measure, impl.Measure>>;
export type DistinctionSubjectKindParity = Expect<
  Equals<contracts.DistinctionSubjectKind, impl.DistinctionSubjectKind>
>;
export type DistinctionSubjectParity = Expect<
  Equals<contracts.DistinctionSubject, impl.DistinctionSubject>
>;
export type PredictionPayloadParity = Expect<
  Equals<contracts.PredictionPayload, impl.PredictionPayload>
>;
export type EstimatePayloadParity = Expect<
  Equals<contracts.EstimatePayload, impl.EstimatePayload>
>;
export type BaselinePayloadParity = Expect<
  Equals<contracts.BaselinePayload, impl.BaselinePayload>
>;
export type CommitmentPayloadParity = Expect<
  Equals<contracts.CommitmentPayload, impl.CommitmentPayload>
>;
export type ObservationPayloadParity = Expect<
  Equals<contracts.ObservationPayload, impl.ObservationPayload>
>;
export type ActualPayloadParity = Expect<
  Equals<contracts.ActualPayload, impl.ActualPayload>
>;
export type ForecastPayloadParity = Expect<
  Equals<contracts.ForecastPayload, impl.ForecastPayload>
>;
export type OutcomePayloadParity = Expect<
  Equals<contracts.OutcomePayload, impl.OutcomePayload>
>;
export type LearningPayloadParity = Expect<
  Equals<contracts.LearningPayload, impl.LearningPayload>
>;
export type DistinctionRecordContentParity = Expect<
  Equals<contracts.DistinctionRecordContent, impl.DistinctionRecordContent>
>;
export type SealedDistinctionRecordParity = Expect<
  Equals<contracts.SealedDistinctionRecord, impl.SealedDistinctionRecord>
>;
export type ObservationRecordParity = Expect<
  Equals<contracts.ObservationRecord, impl.ObservationRecord>
>;
export type ActualRecordParity = Expect<Equals<contracts.ActualRecord, impl.ActualRecord>>;
export type DistinctionLedgerParity = Expect<
  Equals<contracts.DistinctionLedger, impl.DistinctionLedger>
>;

// Program of work.
export type ResourceAssignmentParity = Expect<
  Equals<contracts.ResourceAssignment, impl.ResourceAssignment>
>;
export type WorkApprovalParity = Expect<
  Equals<contracts.WorkApproval, impl.WorkApproval>
>;
export type VerificationGateParity = Expect<
  Equals<contracts.VerificationGate, impl.VerificationGate>
>;
export type BlockerRecordParity = Expect<
  Equals<contracts.BlockerRecord, impl.BlockerRecord>
>;
export type ActivityParity = Expect<Equals<contracts.Activity, impl.Activity>>;
export type WorkPackageParity = Expect<
  Equals<contracts.WorkPackage, impl.WorkPackage>
>;
export type MilestoneStatusParity = Expect<
  Equals<contracts.MilestoneStatus, impl.MilestoneStatus>
>;
export type MilestoneRecordParity = Expect<
  Equals<contracts.MilestoneRecord, impl.MilestoneRecord>
>;
export type ProgramOfWorkContentParity = Expect<
  Equals<contracts.ProgramOfWorkContent, impl.ProgramOfWorkContent>
>;
export type SealedProgramOfWorkParity = Expect<
  Equals<contracts.SealedProgramOfWork, impl.SealedProgramOfWork>
>;
export type QuantityScheduleParity = Expect<
  Equals<contracts.QuantitySchedule, impl.QuantitySchedule>
>;
export type CostScheduleParity = Expect<
  Equals<contracts.CostSchedule, impl.CostSchedule>
>;
export type ResourceScheduleParity = Expect<
  Equals<contracts.ResourceSchedule, impl.ResourceSchedule>
>;
export type MilestoneScheduleParity = Expect<
  Equals<contracts.MilestoneSchedule, impl.MilestoneSchedule>
>;
export type RealizationSummaryParity = Expect<
  Equals<contracts.RealizationSummary, impl.RealizationSummary>
>;

// Delivery records.
export type DeliveryStatusParity = Expect<
  Equals<contracts.DeliveryStatus, impl.DeliveryStatus>
>;
export type DeliveryRecordContentParity = Expect<
  Equals<contracts.DeliveryRecordContent, impl.DeliveryRecordContent>
>;
export type SealedDeliveryRecordParity = Expect<
  Equals<contracts.SealedDeliveryRecord, impl.SealedDeliveryRecord>
>;
export type ObservationAcceptanceParity = Expect<
  Equals<contracts.ObservationAcceptance, impl.ObservationAcceptance>
>;
export type ObservationRejectionParity = Expect<
  Equals<contracts.ObservationRejection, impl.ObservationRejection>
>;
export type ActualizationParity = Expect<
  Equals<contracts.Actualization, impl.Actualization>
>;
export type DeliveryClosingParity = Expect<
  Equals<contracts.DeliveryClosing, impl.DeliveryClosing>
>;
export type DeliveryActualTotalParity = Expect<
  Equals<contracts.DeliveryActualTotal, impl.DeliveryActualTotal>
>;
export type DeliveryActualsSummaryParity = Expect<
  Equals<contracts.DeliveryActualsSummary, impl.DeliveryActualsSummary>
>;

// The universal lifecycle + pack profiles.
export type LifecycleSubjectKindParity = Expect<
  Equals<contracts.LifecycleSubjectKind, impl.LifecycleSubjectKind>
>;
export type LifecycleSubjectParity = Expect<
  Equals<contracts.LifecycleSubject, impl.LifecycleSubject>
>;
export type StageProjectedStatusParity = Expect<
  Equals<contracts.StageProjectedStatus, impl.StageProjectedStatus>
>;
export type LifecycleStageRecordParity = Expect<
  Equals<contracts.LifecycleStageRecord, impl.LifecycleStageRecord>
>;
export type LifecycleTransitionRecordParity = Expect<
  Equals<contracts.LifecycleTransitionRecord, impl.LifecycleTransitionRecord>
>;
export type LifecycleGraphParity = Expect<
  Equals<contracts.LifecycleGraph, impl.LifecycleGraph>
>;
export type LifecycleStageProjectionParity = Expect<
  Equals<contracts.LifecycleStageProjection, impl.LifecycleStageProjection>
>;
export type ProjectionRuleParity = Expect<
  Equals<contracts.ProjectionRule, impl.ProjectionRule>
>;
export type SolutionPackProfileParity = Expect<
  Equals<contracts.SolutionPackProfile, impl.SolutionPackProfile>
>;

// Acquisition.
export type AcquisitionLineParity = Expect<
  Equals<contracts.AcquisitionLine, impl.AcquisitionLine>
>;
export type AcquisitionRequestDetailParity = Expect<
  Equals<contracts.AcquisitionRequestDetail, impl.AcquisitionRequestDetail>
>;
export type AcquisitionRequestRecordParity = Expect<
  Equals<contracts.AcquisitionRequestRecord, impl.AcquisitionRequestRecord>
>;
export type AcquisitionFulfillmentRecordParity = Expect<
  Equals<contracts.AcquisitionFulfillmentRecord, impl.AcquisitionFulfillmentRecord>
>;

// Information-acquisition requests.
export type DecisionImpactMaterialityParity = Expect<
  Equals<contracts.DecisionImpactMateriality, impl.DecisionImpactMateriality>
>;
export type DecisionImpactKindParity = Expect<
  Equals<contracts.DecisionImpactKind, impl.DecisionImpactKind>
>;
export type DecisionImpactParity = Expect<
  Equals<contracts.DecisionImpact, impl.DecisionImpact>
>;
export type FreshnessRequirementParity = Expect<
  Equals<contracts.FreshnessRequirement, impl.FreshnessRequirement>
>;
export type InformationAcquisitionRequestParity = Expect<
  Equals<contracts.InformationAcquisitionRequest, impl.InformationAcquisitionRequest>
>;

// External request/event seam.
export type ExternalRequestKindParity = Expect<
  Equals<contracts.ExternalRequestKind, impl.ExternalRequestKind>
>;
export type ExternalEventKindParity = Expect<
  Equals<contracts.ExternalEventKind, impl.ExternalEventKind>
>;
export type ExternalRequestEnvelopeParity = Expect<
  Equals<contracts.ExternalRequestEnvelope, impl.ExternalRequestEnvelope>
>;
export type ExternalEventEnvelopeParity = Expect<
  Equals<contracts.ExternalEventEnvelope, impl.ExternalEventEnvelope>
>;
export type CorrelatedExchangeParity = Expect<
  Equals<contracts.CorrelatedExchange, impl.CorrelatedExchange>
>;
export type ExternalObservationContextParity = Expect<
  Equals<contracts.ExternalObservationContext, impl.ExternalObservationContext>
>;

// The delivery:* event vocabulary.
export type DeliveryEventSequenceParity = Expect<
  Equals<contracts.DeliveryEventSequence, impl.DeliveryEventSequence>
>;
export type DeliveryCausalParentParity = Expect<
  Equals<contracts.DeliveryCausalParent, impl.DeliveryCausalParent>
>;
export type DeliveryEventPayloadParity = Expect<
  Equals<contracts.DeliveryEventPayload, impl.DeliveryEventPayload>
>;
export type DeliveryEventContentParity = Expect<
  Equals<contracts.DeliveryEventContent, impl.DeliveryEventContent>
>;
export type SealedDeliveryEventParity = Expect<
  Equals<contracts.SealedDeliveryEvent, impl.SealedDeliveryEvent>
>;
export type StageEnteredDataParity = Expect<
  Equals<contracts.StageEnteredData, impl.StageEnteredData>
>;
export type StageTransitionDataParity = Expect<
  Equals<contracts.StageTransitionData, impl.StageTransitionData>
>;
export type BaselineApprovedDataParity = Expect<
  Equals<contracts.BaselineApprovedData, impl.BaselineApprovedData>
>;
export type BaselineRevisionDataParity = Expect<
  Equals<contracts.BaselineRevisionData, impl.BaselineRevisionData>
>;
export type ObservationEventDataParity = Expect<
  Equals<contracts.ObservationEventData, impl.ObservationEventData>
>;
export type ObservationActualizedDataParity = Expect<
  Equals<contracts.ObservationActualizedData, impl.ObservationActualizedData>
>;
export type AcquisitionRequestedDataParity = Expect<
  Equals<contracts.AcquisitionRequestedData, impl.AcquisitionRequestedData>
>;
export type AcquisitionFulfilledDataParity = Expect<
  Equals<contracts.AcquisitionFulfilledData, impl.AcquisitionFulfilledData>
>;
export type MilestoneReachedDataParity = Expect<
  Equals<contracts.MilestoneReachedData, impl.MilestoneReachedData>
>;
export type ForecastRecordedDataParity = Expect<
  Equals<contracts.ForecastRecordedData, impl.ForecastRecordedData>
>;
export type OutcomeRecordedDataParity = Expect<
  Equals<contracts.OutcomeRecordedData, impl.OutcomeRecordedData>
>;
export type LearningRecordedDataParity = Expect<
  Equals<contracts.LearningRecordedData, impl.LearningRecordedData>
>;
export type InfoRequestIssuedDataParity = Expect<
  Equals<contracts.InfoRequestIssuedData, impl.InfoRequestIssuedData>
>;

// Solution Navigator projections.
export type NavigatorInputsParity = Expect<
  Equals<contracts.NavigatorInputs, impl.NavigatorInputs>
>;
export type WorldEntityViewParity = Expect<
  Equals<contracts.WorldEntityView, impl.WorldEntityView>
>;
export type WorkPackageViewParity = Expect<
  Equals<contracts.WorkPackageView, impl.WorkPackageView>
>;
export type VerificationGateViewParity = Expect<
  Equals<contracts.VerificationGateView, impl.VerificationGateView>
>;
export type AcquisitionRequestViewParity = Expect<
  Equals<contracts.AcquisitionRequestView, impl.AcquisitionRequestView>
>;
export type ObservationViewParity = Expect<
  Equals<contracts.ObservationView, impl.ObservationView>
>;
export type ActualViewParity = Expect<Equals<contracts.ActualView, impl.ActualView>>;
export type NavigatorProjectionParity = Expect<
  Equals<contracts.NavigatorProjection, impl.NavigatorProjection>
>;
export type WorldEntityChainParity = Expect<
  Equals<contracts.WorldEntityChain, impl.WorldEntityChain>
>;
