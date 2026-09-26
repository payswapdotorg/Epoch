/**
 * @epoch/execution-tracking — public API (kernel layer, Work Order W038).
 *
 * The universal REALIZATION-TRACKING DOMAIN MODEL over the W036
 * solution-delivery kernel (USL1.0/SD1.0, binding): construction
 * execution is ONE projection; build/deployment/fabrication/installation/
 * commissioning vocabulary maps onto the same spine.
 *
 * - work-package/activity STATE TRACKING: typed, sealed, append-only
 *   tracking-state records referencing ProgramOfWork items by OPAQUE ID
 *   (never structural copies); state transitions
 *   (not-started/in-progress/completed/blocked + domain-mappable
 *   equivalents) are recorded events with provenance — the schedule
 *   authority STAYS in ProgramOfWork (tracking records OBSERVE, never
 *   re-schedule; schedule fields are typed
 *   `authority-violation-rejected` before validation);
 * - progress ACTUALIZATION: progress observations (percent-complete,
 *   quantity progress, milestone hits) as W036 Observation-distinction
 *   records; actualization flows ONLY through the W036 DeliveryRecord
 *   acceptance/actualization path — this package produces observations
 *   and reconciles them, it NEVER writes Actual records directly
 *   (`actualization-bypass-rejected`);
 * - labor/equipment/material/resource OBSERVATIONS: typed,
 *   content-addressed usage records (quantity + unit + time + provenance
 *   + the mandatory uncertainty state), each linked to a work-package
 *   reference;
 * - FIELD EVIDENCE REFERENCES: typed references to W006 evidence records
 *   by digest (photos, sensor readings, documents) with capture context —
 *   NEVER embedded payloads;
 * - changes/delays/rework/defects/BLOCKERS: typed record families with
 *   severity + impact references (opaque ProgramOfWork ids) + resolution
 *   state; rework references the original work records; blockers carry
 *   dependency semantics;
 * - confidence/provenance/freshness on EVERY observation (the mandatory
 *   uncertainty state; `uncertainty-missing-rejected`);
 * - replay/idempotent observation handling (same payload + idempotency
 *   key -> the same sealed record; the typed `duplicate-observation`
 *   admission returns the prior digest);
 * - the EXPLICIT Observation ≠ Actual separation: reconciliation is a
 *   typed, recorded proposal that the W036 DeliveryRecord authority
 *   accepts/actualizes (`applyReconciliationProposal` calls the REAL
 *   W036 recordObservation -> acceptObservation -> actualizeObservation
 *   path exclusively);
 * - the LOW-FRICTION single-call field intake
 *   (`intakeFieldObservation`) that infers work-package linkage —
 *   ambiguous linkage is `ambiguous-linkage-rejected`, never a guess;
 * - the `execution:*` event vocabulary over the W010 event shapes (one
 *   stream per work package `stream:execution-<suffix>`);
 * - the deterministic execution state PROJECTION (folds never depend on
 *   intake order).
 *
 * Versioned contract surface: version constants + typed index export (this
 * file), runtime zod validators (src/*.ts), compile-time kernel parity
 * (src/kernel-parity.ts), the committed in-package JSON Schema projection
 * under schemas/ (the W007/W009/W023/W036 convention), the public
 * core-record surface at contracts/execution/ (the W012 convention), both
 * pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  DOMAIN_TRACKING_STATE_BINDINGS,
  EXECUTION_EVENT_DISCRIMINATORS,
  EXECUTION_EVENT_RECORD_VERSION,
  EXECUTION_PRINCIPAL_ID_PATTERN,
  EXECUTION_STREAM_ID_PATTERN,
  EXECUTION_TRACKING_CONTRACT_VERSION,
  EXECUTION_TRACKING_RECORD_VERSION,
  FIELD_EVIDENCE_KINDS,
  INITIAL_TRACKING_STATE,
  ISSUE_KINDS,
  ISSUE_RESOLUTIONS,
  ISSUE_SEVERITIES,
  RESOLUTION_STATES,
  RESOURCE_KINDS,
  TRACKING_STATES,
  TRACKING_TRANSITIONS,
  BLOCKER_ID_PATTERN,
  CHANGE_ID_PATTERN,
  DEFECT_ID_PATTERN,
  DELAY_ID_PATTERN,
  EVIDENCE_LINK_ID_PATTERN,
  FIELD_CAPTURE_KEY_PATTERN,
  ISSUE_ID_PATTERNS,
  ISSUE_RESOLUTION_ID_PATTERN,
  RECONCILIATION_ID_PATTERN,
  RESOURCE_OBSERVATION_ID_PATTERN,
  REWORK_ID_PATTERN,
  STATE_ID_PATTERN,
  executionStreamIdOf,
  issueKindOfId,
  kindPrefixOf,
} from './version';
export type {
  ExecutionEventDiscriminator,
  FieldEvidenceKind,
  IssueKind,
  IssueResolutionDecision,
  IssueSeverity,
  ResolutionState,
  ResourceKind,
  TrackingState,
} from './version';

// Primitives (zod schemas + types).
export {
  ExecutionPrincipalIdSchema,
  ExecutionStreamIdSchema,
  EvidenceLinkIdSchema,
  IssueRecordIdSchema,
  IssueResolutionIdSchema,
  ReconciliationIdSchema,
  ResourceObservationIdSchema,
  StateIdSchema,
  FieldCaptureKeySchema,
  ChangeIdSchema,
  DelayIdSchema,
  ReworkIdSchema,
  DefectIdSchema,
  BlockerIdSchema,
  canonicalDigest,
  sha256Hex,
} from './primitives';
export {
  ActivityIdSchema,
  DeliveryIdSchema,
  DistinctionRecordIdSchema,
  MilestoneIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PrincipalIdSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  UnitLabelSchema,
  WorkPackageIdSchema,
  CurrencyCodeSchema,
  ProgressFractionSchema,
  TenantIdSchema,
} from './primitives';
export type {
  ActivityId,
  BlockerId,
  ChangeId,
  CurrencyCode,
  DefectId,
  DelayId,
  DeliveryId,
  DistinctionRecordId,
  EvidenceLinkId,
  ExecutionPrincipalId,
  ExecutionStreamId,
  FieldCaptureKey,
  IssueRecordId,
  IssueResolutionId,
  MilestoneId,
  NonNegativeDecimal,
  OpaqueReference,
  PrincipalId,
  ProgressFraction,
  ReconciliationId,
  ResourceObservationId,
  ReworkId,
  SemverCore,
  Sha256Hex,
  SolutionId,
  StateId,
  Timestamp,
  UnitLabel,
  WorkPackageId,
} from './primitives';
export type { TenantId } from '@epoch/solution-delivery';

// Typed error taxonomy + result.
export type {
  ExecutionError,
  ExecutionErrorCode,
  ExecutionIssue,
  ExecutionReferenceKind,
  ExecutionResult,
  TenantIsolationSubject,
} from './errors';

// Flattened-issue pre-classifiers (the W038 uncertainty pin).
export {
  SCHEDULE_AUTHORITY_FIELDS,
  authorityViolationError,
  scheduleAuthorityError,
  uncertaintyMissingError,
} from './issues';

// W036 error-taxonomy adapter.
export { adaptDeliveryResult, mapDeliveryError } from './w036-adapter';

// Idempotency keys.
export {
  deriveExecutionEventKey,
  deriveObservationReplayKey,
} from './idempotency';
export type { ExecutionIntakeKey } from './idempotency';

// Field evidence references.
export {
  FieldEvidenceLinkSchema,
  FieldEvidenceLinkArraySchema,
  FieldEvidenceLinkRecordContentSchema,
  SealedFieldEvidenceLinkSchema,
  computeFieldEvidenceLinkDigest,
  refineSortedEvidenceLinks,
  sealFieldEvidenceLink,
  verifySealedFieldEvidenceLink,
} from './field-evidence';
export type {
  FieldEvidenceLink,
  FieldEvidenceLinkRecordContent,
  SealedFieldEvidenceLink,
} from './field-evidence';

// Work-package/activity state tracking.
export {
  SealedTrackingStateRecordSchema,
  TrackingStateRecordContentSchema,
  TrackingSubjectSchema,
  computeTrackingStateRecordDigest,
  currentTrackingState,
  deriveWorkPackageState,
  foldTrackingStates,
  sealTrackingStateRecord,
  trackingSubjectKey,
  verifySealedTrackingStateRecord,
} from './state';
export type {
  SealedTrackingStateRecord,
  TrackingStateProjection,
  TrackingStateRecordContent,
  TrackingSubject,
  TrackingTransition,
} from './state';

// Resource observations.
export {
  ResourceKindSchema,
  ResourceObservationContentSchema,
  SealedResourceObservationSchema,
  computeResourceObservationDigest,
  foldResourceUsage,
  sealResourceObservation,
  verifySealedResourceObservation,
} from './resource';
export type {
  ResourceObservationContent,
  ResourceUsageTotal,
  SealedResourceObservation,
} from './resource';

// Changes, delays, rework, defects and blockers.
export {
  BlockerSemanticsSchema,
  IssueImpactSchema,
  IssueRecordContentSchema,
  IssueResolutionContentSchema,
  ReworkReferenceSchema,
  SealedIssueRecordSchema,
  SealedIssueResolutionSchema,
  computeIssueRecordDigest,
  computeIssueResolutionDigest,
  foldIssues,
  sealIssueRecord,
  sealIssueResolution,
  verifySealedIssueRecord,
  verifySealedIssueResolution,
} from './execution-issues';
export type {
  BlockerSemantics,
  FoldedIssue,
  IssueImpact,
  IssueRecordContent,
  IssueResolutionContent,
  ReworkReference,
  SealedIssueRecord,
  SealedIssueResolution,
} from './execution-issues';

// Reconciliation proposals (the Observation != Actual separation).
export {
  ReconciliationEntrySchema,
  ReconciliationProposalContentSchema,
  SealedReconciliationProposalSchema,
  applyReconciliationProposal,
  computeReconciliationProposalDigest,
  sealReconciliationProposal,
  verifySealedReconciliationProposal,
} from './reconciliation';
export type {
  ReconciliationApplication,
  ReconciliationApplicationOutcome,
  ReconciliationApplicationResult,
  ReconciliationEntry,
  ReconciliationProposalContent,
  SealedReconciliationProposal,
} from './reconciliation';

// The store: program index, admissions, the low-friction intake, folds.
export {
  CaptureResourceUsageSchema,
  CaptureSubjectSchema,
  EMPTY_PROGRAM_INDEX,
  FieldCaptureSchema,
  activityOwnersOf,
  admitFieldEvidenceLink,
  admitIssue,
  admitIssueResolution,
  admitObservation,
  admitReconciliationProposal,
  admitResourceObservation,
  admitTrackingState,
  buildProgramIndex,
  intakeFieldObservation,
  linkedWorkPackageOfObservation,
  openExecutionTrackingStore,
  projectExecutionState,
  workPackagesOfActivity,
  workPackagesOfMilestone,
} from './store';
export type {
  CaptureResourceUsage,
  CaptureSubject,
  ExecutionStateProjection,
  ExecutionTrackingStore,
  FieldCapture,
  FieldIntakeOutcome,
  ObservationAdmission,
  ObservationAdmissionOutcome,
  ObservationKeyBinding,
  ProgramIndex,
  ProgramMilestoneIndex,
  ProgramWorkPackageIndex,
  ProjectedIssue,
  RecordAdmission,
  WorkPackageExecutionProjection,
} from './store';

// The execution:* event vocabulary over the W010 event shapes.
export {
  EXECUTION_EVENT_DATA_SCHEMAS,
  EvidenceLinkedDataSchema,
  ExecutionCausalParentSchema,
  ExecutionEventContentSchema,
  ExecutionEventPayloadSchema,
  ExecutionEventSequenceSchema,
  IssueRaisedDataSchema,
  IssueResolvedDataSchema,
  ObservationRecordedDataSchema,
  ReconciliationAppliedDataSchema,
  ReconciliationProposedDataSchema,
  ResourceObservationRecordedDataSchema,
  SealedExecutionEventSchema,
  StateProjectedDataSchema,
  TrackingRecordedDataSchema,
  computeExecutionEventDigest,
  parseExecutionEventData,
  sealExecutionEvent,
  verifySealedExecutionEvent,
} from './events';
export type {
  EvidenceLinkedData,
  ExecutionCausalParent,
  ExecutionEventContent,
  ExecutionEventPayload,
  ExecutionEventSequence,
  IssueRaisedData,
  IssueResolvedData,
  ObservationRecordedData,
  ReconciliationAppliedData,
  ReconciliationProposedData,
  ResourceObservationRecordedData,
  SealedExecutionEvent,
  StateProjectedData,
  TrackingRecordedData,
} from './events';

// Published schema surface + contract emission.
export {
  EXECUTION_TRACKING_SCHEMA_SURFACE,
  CORE_RECORD_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  EXECUTION_TRACKING_CONTRACT_DIR,
  EXECUTION_TRACKING_PUBLIC_CONTRACT_DIR,
  renderExecutionTrackingContractFiles,
  renderExecutionTrackingPublicContractFiles,
  typeToKebabCase,
} from './contract-emission';

// Shared W036 re-exports used by consumers of this surface (the REAL
// delivery-facts authority functions the reconciliation path calls).
export {
  CONFIDENCE_METHODS,
  FRESHNESS_STATES,
  PROVENANCE_KINDS,
  acceptObservation,
  actualizeObservation,
  addNonNegativeDecimals,
  closeDeliveryRecord,
  foldDeliveryActuals,
  recordObservation,
  rejectObservation,
  sealDistinctionRecord,
  verifySealedDistinctionRecord,
  verifySealedDeliveryRecord,
  verifySealedProgramOfWork,
  buildProgramOfWork,
  openDeliveryRecord,
} from '@epoch/solution-delivery';
export type {
  Measure,
  ObservationRecord,
  SealedDeliveryRecord,
  SealedDistinctionRecord,
  SealedProgramOfWork,
  UncertaintyState,
} from '@epoch/solution-delivery';
