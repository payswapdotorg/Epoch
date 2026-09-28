/**
 * @epoch/supervision — public API (kernel layer, Work Order W043).
 *
 * The DELIVERY SUPERVISION DOMAIN MODEL over the W036 solution-delivery
 * kernel (USL1.0/SD1.0, binding: "Alerts are policy-controlled and
 * severity-classified" — this kernel produces the FINDINGS; the
 * severity/escalation policy lives in @epoch/alerts):
 *
 * - PLANNED-VS-ACTUAL MONITORING: pure evaluation of ProgramOfWork plan
 *   lines against DeliveryRecord/execution-tracking actual state —
 *   typed findings (due / late / blocked / drifted), each carrying
 *   W006-convention provenance;
 * - CRITICAL-PATH AND PREREQUISITE CHECKS: a typed CPM traversal over
 *   the ProgramOfWork dependency graph (the graph authority STAYS in
 *   W036; supervision OBSERVES, never re-schedules —
 *   `re-schedule-rejected`);
 * - ACQUISITION/LEAD-TIME RISK CHECKS: W037-shaped lead-time
 *   observations vs commitments — typed risk findings when a required
 *   acquisition's realistic lead time threatens downstream
 *   prerequisites;
 * - CONSUMPTION/COST ANOMALIES: typed threshold rules over actualized
 *   quantities/costs (the W036 foldDeliveryActuals shapes) — anomaly
 *   findings with magnitude + breach class;
 * - VERIFICATION FAILURES: W036 VerificationGate + W038 issue records
 *   surface as typed findings (a failed/overdue gate is a finding,
 *   never a mutation of the gate);
 * - UNRESOLVED HIGH-IMPACT UNKNOWN DETECTION: W036
 *   DecisionImpact-material unknowns/info-requests unresolved past
 *   their freshness requirements become findings;
 * - the SEALED SUPERVISION PASS: one total evaluation over verified
 *   inputs — findings are content-addressed, deterministic, replay-safe
 *   (identical inputs produce identical digests); the derived
 *   supervision-state projection folds pass histories deterministically;
 * - the `supervision:*` event vocabulary over the W010 event shapes
 *   (one stream per supervised program `stream:supervision-<suffix>`),
 *   INCLUDING the alert-lifecycle steps of the W043 service (payload
 *   fields owned by @epoch/alerts stay bounded neutral strings —
 *   cross-kernel vocabulary never re-declares a sibling authority).
 *
 * Supervision is READ-ONLY over delivery state: every check is a pure
 * function of sealed inputs to findings. NO persistence, NO UI, NO
 * provider vocabulary, NO external providers — synthetic schedules only.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/*.ts), compile-time kernel
 * parity (src/kernel-parity.ts), the committed in-package JSON Schema
 * projection under schemas/ (the W007/W009/W023/W036/W038 convention),
 * the public core-record surface at contracts/supervision/ (the W012
 * convention, composed with the alerts core records by the
 * supervision-runtime service), both pinned by drift tests.
 */

// Version + vocabularies.
export {
  ANOMALY_BREACH_CLASSES,
  FINDING_CLASSES,
  FINDING_ID_PATTERN,
  FINDING_STATUSES,
  FINDING_SUBJECT_KINDS,
  LEAD_TIME_INPUT_ID_PATTERN,
  ISSUE_SUMMARY_ID_PATTERN,
  PROVENANCE_REFERENCE_KINDS,
  SCHEDULE_MUTATION_FIELDS,
  SUBJECT_KIND_TOKEN_PATTERN,
  SUPERVISION_CONTRACT_VERSION,
  SUPERVISION_EVENT_DISCRIMINATORS,
  SUPERVISION_EVENT_RECORD_VERSION,
  SUPERVISION_FINDING_SCHEMA_NAME,
  SUPERVISION_PASS_ID_PATTERN,
  SUPERVISION_PASS_SCHEMA_NAME,
  SUPERVISION_PRINCIPAL_ID_PATTERN,
  SUPERVISION_RECORD_VERSION,
  SUPERVISION_STREAM_ID_PATTERN,
  EXECUTION_ISSUE_SUMMARY_SCHEMA_NAME,
  LEAD_TIME_RISK_INPUT_SCHEMA_NAME,
  SUPERVISION_EVENT_SCHEMA_NAME,
  kindPrefixOf,
  supervisionHostStreamIdOf,
  supervisionStreamIdOf,
} from './version';
export type {
  AnomalyBreachClass,
  FindingClass,
  FindingStatus,
  FindingSubjectKind,
  ProvenanceReferenceKind,
  ScheduleMutationField,
  SupervisionEventDiscriminator,
} from './version';

// Primitives (zod schemas + types).
export {
  FindingIdSchema,
  SupervisionPassIdSchema,
  SupervisionStreamIdSchema,
  SupervisionPrincipalIdSchema,
  IssueSummaryIdSchema,
  LeadTimeInputIdSchema,
  FindingClassTokenSchema,
  SubjectKindTokenSchema,
  ActivityIdMirrorSchema,
  canonicalDigest,
  sha256Hex,
} from './primitives';
export {
  BlockerIdSchema,
  CurrencyCodeSchema,
  DeliveryIdSchema,
  DistinctionRecordIdSchema,
  GateIdSchema,
  InfoRequestIdSchema,
  MilestoneIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PrincipalIdSchema,
  ProgramIdSchema,
  ProgressFractionSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  UnitLabelSchema,
  WorkPackageIdSchema,
} from '@epoch/solution-delivery';
export type {
  FindingId,
  SupervisionPassId,
  SupervisionStreamId,
  SupervisionPrincipalId,
  IssueSummaryId,
  LeadTimeInputId,
  FindingClassToken,
  SubjectKindToken,
  ActivityIdMirror,
  BlockerId,
  CurrencyCode,
  DeliveryId,
  DistinctionRecordId,
  GateId,
  InfoRequestId,
  MilestoneId,
  NonNegativeDecimal,
  OpaqueReference,
  PrincipalId,
  ProgramId,
  ProgressFraction,
  SemverCore,
  Sha256Hex,
  SolutionId,
  Timestamp,
  UnitLabel,
  WorkPackageId,
} from './primitives';
export type { TenantId } from '@epoch/tenancy';

// Typed error taxonomy + result.
export type {
  SupervisionError,
  SupervisionErrorCode,
  SupervisionIssue,
  SupervisionResult,
} from './errors';

// Flattened-issue pre-classifiers (the W043 schedule-authority pin).
export {
  flattenIssues,
  hasUnrecognizedKeys,
  scheduleAuthorityError,
  scanScheduleMutation,
  validationError,
  vendorFieldsError,
} from './issues';

// Exact decimal + instant arithmetic (deterministic, pure).
export {
  addNonNegativeDecimals,
  compareNonNegativeDecimals,
  multiplyNonNegativeDecimals,
  signedDecimalSubtraction,
  subtractNonNegativeDecimals,
} from './decimal';
export { dayDifference, instantToEpochMs, secondDifference } from './instant';

// Provenance (the W006 convention).
export {
  FindingProvenanceSchema,
  ProvenanceSourceSchema,
  ProvenanceReferenceKindSchema,
} from './provenance';
export type { FindingProvenance, ProvenanceSource } from './provenance';

// Findings.
export {
  SealedSupervisionFindingSchema,
  SupervisionFindingContentSchema,
  computeSupervisionFindingDigest,
  deriveFindingId,
  FindingMeasuresSchema,
  FindingSubjectSchema,
  sealSupervisionFinding,
  verifySealedSupervisionFinding,
} from './findings';
export type {
  FindingMeasures,
  FindingSubject,
  SealedSupervisionFinding,
  SupervisionFindingContent,
} from './findings';

// Evaluation inputs (the W038/W037 mirrors + thresholds).
export {
  admitExecutionIssueSummary,
  admitLeadTimeRiskInput,
  DEFAULT_SUPERVISION_THRESHOLDS,
  ExecutionIssueSummarySchema,
  IssueSummaryImpactSchema,
  ISSUE_SUMMARY_KINDS,
  ISSUE_SUMMARY_RESOLUTION_STATES,
  ISSUE_SUMMARY_SEVERITIES,
  LeadTimeRiskInputSchema,
  LeadTimeSourceRecordSchema,
  SupervisionEvaluationInputSchema,
  SupervisionThresholdsSchema,
} from './inputs';
export type {
  ExecutionIssueSummary,
  IssueSummaryImpact,
  IssueSummaryKind,
  IssueSummaryResolutionState,
  IssueSummarySeverity,
  LeadTimeRiskInput,
  LeadTimeSourceRecord,
  SupervisionEvaluationInput,
  SupervisionThresholds,
} from './inputs';
export type {
  InformationAcquisitionRequest,
  SealedDeliveryRecord,
  SealedProgramOfWork,
} from '@epoch/solution-delivery';

// Shared W036 re-exports used by consumers of this surface (the REAL
// delivery-facts authority verifiers the supervision host calls).
export {
  verifySealedDeliveryRecord,
  verifySealedProgramOfWork,
} from '@epoch/solution-delivery';

// The check families (pure functions over sealed inputs).
export {
  analyzeCriticalPath,
  checkConsumptionAnomalies,
  checkCriticalPath,
  checkLeadTimeRisk,
  checkPlannedVsActual,
  checkUnresolvedUnknowns,
  checkVerificationFailures,
  indexActivities,
  runAllChecks,
} from './checks';
export type {
  CriticalPathAnalysis,
  IndexedActivity,
  SupervisionCheckContext,
} from './checks';

// The supervision pass + the derived state projection.
export {
  computeSupervisionPassDigest,
  evaluateSupervisionPass,
  projectSupervisionState,
  SealedSupervisionPassSchema,
  SupervisionPassContentSchema,
  verifySealedSupervisionPass,
} from './supervision';
export type {
  SealedSupervisionPass,
  SupervisionPassContent,
  SupervisionPassEvaluation,
  SupervisionFindingRow,
  SupervisionStateProjection,
} from './supervision';

// The supervision:* event vocabulary over the W010 event shapes.
export {
  computeSupervisionEventDigest,
  parseSupervisionEventData,
  sealSupervisionEvent,
  verifySealedSupervisionEvent,
  SUPERVISION_EVENT_DATA_SCHEMAS,
  AlertEscalatedDataSchema,
  AlertRaisedDataSchema,
  AlertResolvedDataSchema,
  AlertRevisedDataSchema,
  DeliveryRegisteredDataSchema,
  FindingProducedDataSchema,
  NotificationDispatchedDataSchema,
  PassEvaluatedDataSchema,
  PolicyRegisteredDataSchema,
  ProgramRegisteredDataSchema,
  ProjectionUpdatedDataSchema,
  SealedSupervisionEventSchema,
  SupervisionCausalParentSchema,
  SupervisionEventContentSchema,
  SupervisionEventPayloadSchema,
  SupervisionEventSequenceSchema,
} from './events';
export type {
  AlertEscalatedData,
  AlertRaisedData,
  AlertResolvedData,
  AlertRevisedData,
  DeliveryRegisteredData,
  FindingProducedData,
  NotificationDispatchedData,
  PassEvaluatedData,
  PolicyRegisteredData,
  ProgramRegisteredData,
  ProjectionUpdatedData,
  SealedSupervisionEvent,
  SupervisionCausalParent,
  SupervisionEventContent,
  SupervisionEventPayload,
  SupervisionEventSequence,
} from './events';

// Published schema surface + contract emission.
export {
  SUPERVISION_SCHEMA_SURFACE,
  SUPERVISION_CORE_RECORD_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  SUPERVISION_CONTRACT_DIR,
  SUPERVISION_PUBLIC_CONTRACT_DIR,
  renderSupervisionContractFiles,
  typeToKebabCase,
} from './contract-emission';
