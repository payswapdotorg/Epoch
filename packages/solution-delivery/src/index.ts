/**
 * @epoch/solution-delivery — public API (kernel layer, Work Order W036).
 *
 * The universal delivery DOMAIN MODEL (USL1.0/DP1.0/SN1.0, binding):
 *
 * - SolutionPackage identity + IMMUTABLE, content-addressed,
 *   hash-chained SolutionVersion baselines (the W023 version-chain
 *   convention) with distinct baseline APPROVAL records;
 * - the NINE semantic-distinction record types (Prediction, Estimate,
 *   Baseline, Commitment, Observation, Actual, Forecast, Outcome,
 *   Learning Record) — immutable, digest-bearing, never collapsed;
 * - the ProgramOfWork (the authoritative schedule dimension): a
 *   dependency-aware realization graph with milestone records and
 *   deterministic quantity/cost/resource schedule folds;
 * - the DeliveryRecord (the delivery-facts authority): observation
 *   intake, acceptance transitions, actualization of ACCEPTED
 *   observations only;
 * - the universal lifecycle: typed stage records + typed transitions
 *   (precedes/branch/overlap/loop/pause/resume — projections, never a
 *   linear FSM), plus the DP1.0 pack-profile admission;
 * - acquisition/realization variant catalogs (provider-neutral),
 *   information-acquisition requests, the external request/event seam;
 * - the delivery:* lifecycle event vocabulary over the W010 event shapes;
 * - Solution Navigator synchronized projections with identity-preserving
 *   navigation over the SAME identities.
 *
 * Versioned contract surface: version constants + typed index export (this
 * file), runtime zod validators (src/*.ts), compile-time kernel parity
 * (src/kernel-parity.ts), the committed in-package JSON Schema projection
 * under schemas/ (the W007/W009/W023 convention), the public core-record
 * surface at contracts/solution-delivery/ (the W012 convention), both
 * pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  ACQUISITION_VARIANTS,
  CONFIDENCE_METHODS,
  DELIVERY_EVENT_DISCRIMINATORS,
  DELIVERY_EVENT_RECORD_VERSION,
  DELIVERY_PRINCIPAL_ID_PATTERN,
  DELIVERY_STREAM_ID_PATTERN,
  DISTINCTION_ID_PATTERN,
  FRESHNESS_STATES,
  FORBIDDEN_AUTHORITY_FIELDS,
  LIFECYCLE_TRANSITION_RELATIONS,
  NAVIGATOR_PROJECTION_KINDS,
  OUTCOME_KINDS,
  PROVENANCE_KINDS,
  REALIZATION_VARIANTS,
  SEMANTIC_DISTINCTION_KINDS,
  SOLUTION_DELIVERY_CONTRACT_VERSION,
  SOLUTION_DELIVERY_RECORD_VERSION,
  SOLUTION_DELIVERY_USL_VERSION,
  UNIVERSAL_LIFECYCLE_STAGES,
  kindPrefixOf,
  deliveryStreamIdOf,
  stageOrdinal,
} from './version';
export type {
  AcquisitionVariant,
  ConfidenceMethod,
  DeliveryEventDiscriminator,
  FreshnessStateKind,
  ForbiddenAuthorityField,
  LifecycleTransitionRelation,
  NavigatorProjectionKind,
  OutcomeKind,
  ProvenanceKind,
  RealizationVariant,
  SemanticDistinctionKind,
  UniversalLifecycleStage,
} from './version';

// Primitives (zod schemas + types).
export {
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
  SHA256_HEX_PATTERN,
} from './primitives';
export type {
  AcquisitionId,
  ActivityId,
  BaselineApprovalId,
  BlockerId,
  CurrencyCode,
  DeliveryId,
  DeliveryStreamId,
  DistinctionRecordId,
  ExternalEventId,
  ExternalRequestId,
  GateId,
  InfoRequestId,
  MilestoneId,
  NonNegativeDecimal,
  OpaqueReference,
  PositiveInteger,
  PrincipalId,
  ProgramId,
  ProgressFraction,
  QualifiedName,
  SemverCore,
  Sha256Hex,
  SolutionId,
  SolutionLineId,
  StageRecordId,
  Timestamp,
  TransitionRecordId,
  UnitLabel,
  WorkPackageId,
} from './primitives';
export { TenantIdSchema } from '@epoch/tenancy';
export type { TenantId } from '@epoch/tenancy';

// Typed error taxonomy + result.
export type { DeliveryError, DeliveryErrorCode, DeliveryIssue, DeliveryResult } from './errors';

// Uncertainty states.
export {
  ConfidenceStateSchema,
  FreshnessStateSchema,
  ProvenanceStateSchema,
  UncertaintyStateSchema,
} from './uncertainty';
export type {
  ConfidenceState,
  FreshnessState,
  ProvenanceState,
  UncertaintyState,
} from './uncertainty';

// Solution packages + immutable version baselines.
export {
  admitSolutionVersion,
  approveSolutionBaseline,
  computeSolutionVersionDigest,
  reviseSolutionBaseline,
  resolveConstraintReferences,
  resolveEvidenceReferences,
  resolveWorldReferences,
  sealSolutionVersion,
  verifySealedSolutionVersion,
  verifySolutionVersionChain,
  BaselineApprovalSchema,
  ConstraintReferenceSchema,
  EvidenceReferenceSchema,
  SealedSolutionVersionSchema,
  SolutionLineSchema,
  SolutionVersionContentSchema,
  WorldEntityReferenceSchema,
} from './solution';
export type {
  BaselineApproval,
  ConstraintReference,
  EvidenceReference,
  SealedSolutionVersion,
  SolutionChainSummary,
  SolutionLine,
  SolutionVersionContent,
  WorldEntityReference,
  ConstraintLookup,
  EvidenceLookup,
  WorldEntityLookup,
} from './solution';
export { compareSemver } from './semver';
export { addNonNegativeDecimals } from './decimal';

// The nine semantic distinctions + the append-only ledger.
export {
  admitDistinctionRecord,
  computeDistinctionRecordDigest,
  foldDistinctionRecords,
  sealDistinctionRecord,
  verifySealedDistinctionRecord,
  ActualPayloadSchema,
  ActualRecordSchema,
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
  ObservationRecordSchema,
  OutcomePayloadSchema,
  PredictionPayloadSchema,
  ProgressMeasureSchema,
  QuantityMeasureSchema,
  SealedDistinctionRecordSchema,
  DISTINCTION_SUBJECT_KINDS,
} from './distinctions';
export type {
  ActualPayload,
  ActualRecord,
  BaselinePayload,
  CommitmentPayload,
  CostMeasure,
  DistinctionRecordContent,
  DistinctionSubject,
  DistinctionSubjectKind,
  EstimatePayload,
  ForecastPayload,
  InstantMeasure,
  LearningPayload,
  Measure,
  ObservationPayload,
  ObservationRecord,
  OutcomePayload,
  PredictionPayload,
  ProgressMeasure,
  QuantityMeasure,
  SealedDistinctionRecord,
  DistinctionLedger,
} from './distinctions';

// Program of work (the authoritative schedule dimension).
export {
  buildProgramOfWork,
  foldCostSchedule,
  foldMilestoneSchedule,
  foldQuantitySchedule,
  foldRealizationVariants,
  foldResourceSchedule,
  verifySealedProgramOfWork,
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
export type {
  Activity,
  BlockerRecord,
  CostSchedule,
  CostScheduleRow,
  CostTotal,
  MilestoneRecord,
  MilestoneSchedule,
  MilestoneScheduleRow,
  MilestoneStatus,
  ProgramOfWorkContent,
  QuantitySchedule,
  QuantityScheduleRow,
  QuantityTotal,
  RealizationSummary,
  ResourceAssignment,
  ResourceSchedule,
  ResourceScheduleRow,
  SealedProgramOfWork,
  VerificationGate,
  WorkApproval,
  WorkPackage,
} from './program';

// Delivery records (the delivery-facts authority).
export {
  acceptObservation,
  actualizeObservation,
  closeDeliveryRecord,
  computeDeliveryRecordDigest,
  foldDeliveryActuals,
  openDeliveryRecord,
  recordObservation,
  rejectObservation,
  verifySealedDeliveryRecord,
  DeliveryRecordContentSchema,
  SealedDeliveryRecordSchema,
  DELIVERY_STATUSES,
} from './delivery';
export type {
  Actualization,
  DeliveryActualsSummary,
  DeliveryActualTotal,
  DeliveryClosing,
  DeliveryRecordContent,
  DeliveryStatus,
  ObservationAcceptance,
  ObservationRejection,
  SealedDeliveryRecord,
} from './delivery';

// The universal lifecycle + pack profiles.
export {
  admitLifecycleStage,
  admitLifecycleTransition,
  admitPackProfile,
  classifyLifecycleAuthority,
  foldLifecycleStages,
  stageStatusOf,
  LifecycleStageRecordSchema,
  LifecycleSubjectSchema,
  LifecycleTransitionRecordSchema,
  ProjectionRuleSchema,
  SolutionPackProfileSchema,
  LIFECYCLE_SUBJECT_KINDS,
  STAGE_PROJECTED_STATUSES,
} from './lifecycle';
export type {
  LifecycleGraph,
  LifecycleStageProjection,
  LifecycleStageRecord,
  LifecycleSubject,
  LifecycleSubjectKind,
  LifecycleTransitionRecord,
  ProjectionRule,
  SolutionPackProfile,
  StageProjectedStatus,
} from './lifecycle';

// Acquisition (the universal Acquire contract).
export {
  admitAcquisitionFulfillment,
  admitAcquisitionRequest,
  AcquisitionFulfillmentRecordSchema,
  AcquisitionLineSchema,
  AcquisitionRequestDetailSchema,
  AcquisitionRequestRecordSchema,
  ACQUISITION_VARIANT_CATALOG,
} from './acquisition';
export type {
  AcquisitionFulfillmentRecord,
  AcquisitionLine,
  AcquisitionRequestDetail,
  AcquisitionRequestRecord,
} from './acquisition';

// Information-acquisition requests.
export {
  admitInformationAcquisitionRequest,
  isMaterialDecisionImpact,
  DecisionImpactSchema,
  FreshnessRequirementSchema,
  InformationAcquisitionRequestSchema,
  DECISION_IMPACT_KINDS,
  DECISION_IMPACT_MATERIALITIES,
} from './info-request';
export type {
  DecisionImpact,
  DecisionImpactKind,
  DecisionImpactMateriality,
  FreshnessRequirement,
  InformationAcquisitionRequest,
} from './info-request';

// Provider-neutral external request/event seam.
export {
  admitExternalEvent,
  admitExternalRequest,
  computeExternalEventDigest,
  correlateExternalEvent,
  externalEventToObservation,
  ExternalEventEnvelopeSchema,
  ExternalRequestEnvelopeSchema,
  EXTERNAL_EVENT_KINDS,
  EXTERNAL_REQUEST_KINDS,
} from './external';
export type {
  CorrelatedExchange,
  ExternalEventEnvelope,
  ExternalEventKind,
  ExternalObservationContext,
  ExternalRequestEnvelope,
  ExternalRequestKind,
} from './external';

// The delivery:* event vocabulary over the W010 event shapes.
export {
  computeDeliveryEventDigest,
  parseDeliveryEventData,
  sealDeliveryEvent,
  verifySealedDeliveryEvent,
  BaselineApprovedDataSchema,
  BaselineRevisionDataSchema,
  DeliveryCausalParentSchema,
  DeliveryEventContentSchema,
  DeliveryEventPayloadSchema,
  DeliveryEventSequenceSchema,
  SealedDeliveryEventSchema,
  AcquisitionFulfilledDataSchema,
  AcquisitionRequestedDataSchema,
  ForecastRecordedDataSchema,
  InfoRequestIssuedDataSchema,
  LearningRecordedDataSchema,
  MilestoneReachedDataSchema,
  ObservationActualizedDataSchema,
  ObservationEventDataSchema,
  OutcomeRecordedDataSchema,
  StageEnteredDataSchema,
  StageTransitionDataSchema,
  DELIVERY_EVENT_DATA_SCHEMAS,
} from './events';
export type {
  AcquisitionFulfilledData,
  AcquisitionRequestedData,
  BaselineApprovedData,
  BaselineRevisionData,
  DeliveryCausalParent,
  DeliveryEventContent,
  DeliveryEventPayload,
  DeliveryEventSequence,
  ForecastRecordedData,
  InfoRequestIssuedData,
  LearningRecordedData,
  MilestoneReachedData,
  ObservationActualizedData,
  ObservationEventData,
  OutcomeRecordedData,
  SealedDeliveryEvent,
  StageEnteredData,
  StageTransitionData,
} from './events';

// Solution Navigator projections (SN1.0).
export {
  navigateFromWorldEntity,
  navigatorChainIdentities,
  projectNavigator,
} from './navigator';
export type {
  AcquisitionRequestView,
  ActualView,
  NavigatorInputs,
  NavigatorProjection,
  ObservationView,
  VerificationGateView,
  WorldEntityChain,
  WorldEntityView,
  WorkPackageView,
} from './navigator';

// Published schema surface + contract emission.
export {
  SOLUTION_DELIVERY_SCHEMA_SURFACE,
  CORE_RECORD_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  SOLUTION_DELIVERY_CONTRACT_DIR,
  SOLUTION_DELIVERY_PUBLIC_CONTRACT_DIR,
  renderSolutionDeliveryContractFiles,
  renderSolutionDeliveryPublicContractFiles,
  typeToKebabCase,
} from './contract-emission';
