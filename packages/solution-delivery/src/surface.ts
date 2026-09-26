/**
 * The solution-delivery schema-surface registry: every data type published
 * at the `@epoch/solution-delivery` ownership boundary, paired with its
 * zod schema.
 *
 * W036 publishes TWO versioned contract artifact sets from this one
 * surface (both drift-pinned by test/contract-drift.test.ts):
 *
 * - the IN-PACKAGE full surface under `packages/solution-delivery/schemas`
 *   (the W006/W007/W009/W023 in-package precedent) — every entry below;
 * - the PUBLIC core-record projection under
 *   `contracts/solution-delivery/schemas` (the W012 convention) — the
 *   CORE_RECORD_SURFACE subset (see src/contract-emission.ts).
 *
 * Invariants enforced by the drift test: every committed schema file is
 * byte-identical to the deterministic emission of its surface entry.
 */
import { z, type ZodType } from 'zod';
import {
  ActivityIdSchema,
  BaselineApprovalIdSchema,
  BlockerIdSchema,
  CurrencyCodeSchema,
  DeliveryIdSchema,
  DeliveryStreamIdSchema,
  DistinctionRecordIdSchema,
  ExternalEventIdSchema,
  ExternalRequestIdSchema,
  GateIdSchema,
  InfoRequestIdSchema,
  MilestoneIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PositiveIntegerSchema,
  PrincipalIdSchema,
  ProgramIdSchema,
  ProgressFractionSchema,
  QualifiedNameSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  SolutionLineIdSchema,
  StageRecordIdSchema,
  TimestampSchema,
  TransitionRecordIdSchema,
  UnitLabelSchema,
  WorkPackageIdSchema,
} from './primitives';
import {
  ConfidenceStateSchema,
  FreshnessStateSchema,
  ProvenanceStateSchema,
  UncertaintyStateSchema,
} from './uncertainty';
import {
  BaselineApprovalSchema,
  ConstraintReferenceSchema,
  EvidenceReferenceSchema,
  SealedSolutionVersionSchema,
  SolutionLineSchema,
  SolutionVersionContentSchema,
  WorldEntityReferenceSchema,
} from './solution';
import {
  ActualPayloadSchema,
  BaselinePayloadSchema,
  CommitmentPayloadSchema,
  CostMeasureSchema,
  DistinctionRecordContentSchema,
  DistinctionSubjectSchema,
  EstimatePayloadSchema,
  ForecastPayloadSchema,
  InstantMeasureSchema,
  LearningPayloadSchema,
  MeasureSchema,
  ObservationPayloadSchema,
  OutcomePayloadSchema,
  PredictionPayloadSchema,
  ProgressMeasureSchema,
  QuantityMeasureSchema,
  SealedDistinctionRecordSchema,
} from './distinctions';
import {
  ActivitySchema,
  BlockerRecordSchema,
  MilestoneRecordSchema,
  ProgramOfWorkContentSchema,
  ResourceAssignmentSchema,
  SealedProgramOfWorkSchema,
  VerificationGateSchema,
  WorkApprovalSchema,
  WorkPackageSchema,
  MILESTONE_STATUSES,
} from './program';
import {
  DeliveryRecordContentSchema,
  SealedDeliveryRecordSchema,
  DELIVERY_STATUSES,
} from './delivery';
import {
  LifecycleStageRecordSchema,
  LifecycleSubjectSchema,
  LifecycleTransitionRecordSchema,
  ProjectionRuleSchema,
  SolutionPackProfileSchema,
} from './lifecycle';
import {
  AcquisitionFulfillmentRecordSchema,
  AcquisitionLineSchema,
  AcquisitionRequestDetailSchema,
  AcquisitionRequestRecordSchema,
} from './acquisition';
import {
  DecisionImpactSchema,
  FreshnessRequirementSchema,
  InformationAcquisitionRequestSchema,
} from './info-request';
import {
  ExternalEventEnvelopeSchema,
  ExternalRequestEnvelopeSchema,
} from './external';
import {
  DeliveryCausalParentSchema,
  DeliveryEventContentSchema,
  DeliveryEventPayloadSchema,
  DeliveryEventSequenceSchema,
  SealedDeliveryEventSchema,
} from './events';

/** One published schema-surface entry: the type name + its zod schema. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete in-package schema surface (the W023 in-package convention). */
export const SOLUTION_DELIVERY_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  // Primitives.
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'SolutionId', schema: SolutionIdSchema },
  { type: 'SolutionLineId', schema: SolutionLineIdSchema },
  { type: 'DeliveryId', schema: DeliveryIdSchema },
  { type: 'ProgramId', schema: ProgramIdSchema },
  { type: 'WorkPackageId', schema: WorkPackageIdSchema },
  { type: 'ActivityId', schema: ActivityIdSchema },
  { type: 'MilestoneId', schema: MilestoneIdSchema },
  { type: 'DistinctionRecordId', schema: DistinctionRecordIdSchema },
  { type: 'StageRecordId', schema: StageRecordIdSchema },
  { type: 'TransitionRecordId', schema: TransitionRecordIdSchema },
  { type: 'AcquisitionId', schema: z.string().regex(/^acquisition:[a-z0-9][a-z0-9-]{0,62}$/) },
  { type: 'InfoRequestId', schema: InfoRequestIdSchema },
  { type: 'ExternalRequestId', schema: ExternalRequestIdSchema },
  { type: 'ExternalEventId', schema: ExternalEventIdSchema },
  { type: 'BaselineApprovalId', schema: BaselineApprovalIdSchema },
  { type: 'GateId', schema: GateIdSchema },
  { type: 'BlockerId', schema: BlockerIdSchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'DeliveryStreamId', schema: DeliveryStreamIdSchema },
  { type: 'SemverCore', schema: SemverCoreSchema },
  { type: 'CurrencyCode', schema: CurrencyCodeSchema },
  { type: 'NonNegativeDecimal', schema: NonNegativeDecimalSchema },
  { type: 'PositiveInteger', schema: PositiveIntegerSchema },
  { type: 'UnitLabel', schema: UnitLabelSchema },
  { type: 'OpaqueReference', schema: OpaqueReferenceSchema },
  { type: 'QualifiedName', schema: QualifiedNameSchema },
  { type: 'ProgressFraction', schema: ProgressFractionSchema },
  { type: 'Timestamp', schema: TimestampSchema },
  // Uncertainty states.
  { type: 'ProvenanceState', schema: ProvenanceStateSchema },
  { type: 'FreshnessState', schema: FreshnessStateSchema },
  { type: 'ConfidenceState', schema: ConfidenceStateSchema },
  { type: 'UncertaintyState', schema: UncertaintyStateSchema },
  // Solution packages and versions.
  { type: 'WorldEntityReference', schema: WorldEntityReferenceSchema },
  { type: 'ConstraintReference', schema: ConstraintReferenceSchema },
  { type: 'EvidenceReference', schema: EvidenceReferenceSchema },
  { type: 'SolutionLine', schema: SolutionLineSchema },
  { type: 'SolutionVersionContent', schema: SolutionVersionContentSchema },
  { type: 'SealedSolutionVersion', schema: SealedSolutionVersionSchema },
  { type: 'BaselineApproval', schema: BaselineApprovalSchema },
  // The nine semantic distinctions.
  { type: 'QuantityMeasure', schema: QuantityMeasureSchema },
  { type: 'CostMeasure', schema: CostMeasureSchema },
  { type: 'InstantMeasure', schema: InstantMeasureSchema },
  { type: 'ProgressMeasure', schema: ProgressMeasureSchema },
  { type: 'Measure', schema: MeasureSchema },
  { type: 'DistinctionSubject', schema: DistinctionSubjectSchema },
  { type: 'PredictionPayload', schema: PredictionPayloadSchema },
  { type: 'EstimatePayload', schema: EstimatePayloadSchema },
  { type: 'BaselinePayload', schema: BaselinePayloadSchema },
  { type: 'CommitmentPayload', schema: CommitmentPayloadSchema },
  { type: 'ObservationPayload', schema: ObservationPayloadSchema },
  { type: 'ActualPayload', schema: ActualPayloadSchema },
  { type: 'ForecastPayload', schema: ForecastPayloadSchema },
  { type: 'OutcomePayload', schema: OutcomePayloadSchema },
  { type: 'LearningPayload', schema: LearningPayloadSchema },
  { type: 'DistinctionRecordContent', schema: DistinctionRecordContentSchema },
  { type: 'SealedDistinctionRecord', schema: SealedDistinctionRecordSchema },
  // Program of work.
  { type: 'ResourceAssignment', schema: ResourceAssignmentSchema },
  { type: 'WorkApproval', schema: WorkApprovalSchema },
  { type: 'VerificationGate', schema: VerificationGateSchema },
  { type: 'BlockerRecord', schema: BlockerRecordSchema },
  { type: 'Activity', schema: ActivitySchema },
  { type: 'WorkPackage', schema: WorkPackageSchema },
  { type: 'MilestoneStatus', schema: z.enum(MILESTONE_STATUSES) },
  { type: 'MilestoneRecord', schema: MilestoneRecordSchema },
  { type: 'ProgramOfWorkContent', schema: ProgramOfWorkContentSchema },
  { type: 'SealedProgramOfWork', schema: SealedProgramOfWorkSchema },
  // Delivery records.
  { type: 'DeliveryStatus', schema: z.enum(DELIVERY_STATUSES) },
  { type: 'DeliveryRecordContent', schema: DeliveryRecordContentSchema },
  { type: 'SealedDeliveryRecord', schema: SealedDeliveryRecordSchema },
  // Lifecycle.
  { type: 'LifecycleSubject', schema: LifecycleSubjectSchema },
  { type: 'LifecycleStageRecord', schema: LifecycleStageRecordSchema },
  { type: 'LifecycleTransitionRecord', schema: LifecycleTransitionRecordSchema },
  { type: 'ProjectionRule', schema: ProjectionRuleSchema },
  { type: 'SolutionPackProfile', schema: SolutionPackProfileSchema },
  // Acquisition.
  { type: 'AcquisitionLine', schema: AcquisitionLineSchema },
  { type: 'AcquisitionRequestDetail', schema: AcquisitionRequestDetailSchema },
  { type: 'AcquisitionRequestRecord', schema: AcquisitionRequestRecordSchema },
  { type: 'AcquisitionFulfillmentRecord', schema: AcquisitionFulfillmentRecordSchema },
  // Information-acquisition requests.
  { type: 'DecisionImpact', schema: DecisionImpactSchema },
  { type: 'FreshnessRequirement', schema: FreshnessRequirementSchema },
  { type: 'InformationAcquisitionRequest', schema: InformationAcquisitionRequestSchema },
  // External request/event seam.
  { type: 'ExternalRequestEnvelope', schema: ExternalRequestEnvelopeSchema },
  { type: 'ExternalEventEnvelope', schema: ExternalEventEnvelopeSchema },
  // Delivery events (the W010-shaped vocabulary).
  { type: 'DeliveryEventSequence', schema: DeliveryEventSequenceSchema },
  { type: 'DeliveryCausalParent', schema: DeliveryCausalParentSchema },
  { type: 'DeliveryEventPayload', schema: DeliveryEventPayloadSchema },
  { type: 'DeliveryEventContent', schema: DeliveryEventContentSchema },
  { type: 'SealedDeliveryEvent', schema: SealedDeliveryEventSchema },
];

/**
 * The CORE record surface — the subset published at
 * `contracts/solution-delivery/schemas` (the W012 public-contract
 * convention): the core record types a domain pack or downstream consumer
 * binds to.
 */
export const CORE_RECORD_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'Sha256Hex', schema: Sha256HexSchema },
  { type: 'Timestamp', schema: TimestampSchema },
  { type: 'UncertaintyState', schema: UncertaintyStateSchema },
  { type: 'WorldEntityReference', schema: WorldEntityReferenceSchema },
  { type: 'ConstraintReference', schema: ConstraintReferenceSchema },
  { type: 'EvidenceReference', schema: EvidenceReferenceSchema },
  { type: 'SolutionLine', schema: SolutionLineSchema },
  { type: 'SolutionVersionContent', schema: SolutionVersionContentSchema },
  { type: 'SealedSolutionVersion', schema: SealedSolutionVersionSchema },
  { type: 'BaselineApproval', schema: BaselineApprovalSchema },
  { type: 'Measure', schema: MeasureSchema },
  { type: 'DistinctionSubject', schema: DistinctionSubjectSchema },
  { type: 'DistinctionRecordContent', schema: DistinctionRecordContentSchema },
  { type: 'SealedDistinctionRecord', schema: SealedDistinctionRecordSchema },
  { type: 'Activity', schema: ActivitySchema },
  { type: 'WorkPackage', schema: WorkPackageSchema },
  { type: 'MilestoneRecord', schema: MilestoneRecordSchema },
  { type: 'ProgramOfWorkContent', schema: ProgramOfWorkContentSchema },
  { type: 'SealedProgramOfWork', schema: SealedProgramOfWorkSchema },
  { type: 'DeliveryRecordContent', schema: DeliveryRecordContentSchema },
  { type: 'SealedDeliveryRecord', schema: SealedDeliveryRecordSchema },
  { type: 'LifecycleStageRecord', schema: LifecycleStageRecordSchema },
  { type: 'LifecycleTransitionRecord', schema: LifecycleTransitionRecordSchema },
  { type: 'AcquisitionRequestDetail', schema: AcquisitionRequestDetailSchema },
  { type: 'AcquisitionRequestRecord', schema: AcquisitionRequestRecordSchema },
  { type: 'InformationAcquisitionRequest', schema: InformationAcquisitionRequestSchema },
  { type: 'ExternalRequestEnvelope', schema: ExternalRequestEnvelopeSchema },
  { type: 'ExternalEventEnvelope', schema: ExternalEventEnvelopeSchema },
  { type: 'DeliveryEventContent', schema: DeliveryEventContentSchema },
  { type: 'SealedDeliveryEvent', schema: SealedDeliveryEventSchema },
  { type: 'SolutionPackProfile', schema: SolutionPackProfileSchema },
];
