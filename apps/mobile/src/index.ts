/**
 * @epoch/mobile — public API (app layer, Work Order W018).
 *
 * The typed field-shell architecture + in-memory reference host of the
 * Epoch Mobile Field Client (architecture.md §Clients — binding: "mobile
 * is optimized for field capture/review/approval"; experience-
 * architecture.md device-adaptation ladder: mobile = field fidelity).
 *
 * - FIELD-SHELL CONTRACTS: tenant-scoped capture sessions (W009 grammar
 *   via @epoch/tenancy), versioned content-addressed replay-safe capture
 *   envelopes (the channel a real native client would carry), the FIELD
 *   DeviceDescriptor filling the W011 slot, photo/sensor/note evidence
 *   references by W006-convention digest (never embedded payloads).
 * - FIELD CAPTURE FLOWS: quantity/progress observations shaped as W036
 *   Observation-distinction record content with the MANDATORY uncertainty
 *   state, work-package linkage by opaque id (ambiguity is a typed
 *   rejection, never a guess).
 * - REVIEW/APPROVAL SURFACES: W003 typed proposals through the W022
 *   action-gateway seam (`FieldApprovalGatewayPort`) — the client holds
 *   no credentials, executes nothing, and receives gateway decision
 *   records (allow/deny/requires-approval).
 * - OFFLINE QUEUE: typed, content-addressed, idempotent intent records
 *   (duplicate capture = sealed prior record); sync admission replays
 *   through the kernel seams with provenance (W036 observation intake for
 *   captures, the gateway port for approvals) — the queue is never a
 *   second semantic store (lock rules 8/16).
 * - REFERENCE IMPLEMENTATION discipline (the W020/W022/W029 precedent):
 *   no real native bundling, no new third-party runtime dependencies,
 *   zero wall-clock, zero randomness.
 *
 * Runtime dependency policy (W018 Tech Lead pin, frozen):
 * @epoch/experience-protocol, @epoch/solution-delivery,
 * @epoch/action-protocol, @epoch/agent-protocol, @epoch/tenancy, zod —
 * NOTHING else. Parity with @epoch/action-policy, @epoch/evidence,
 * @epoch/renderer-runtime, @epoch/identity and @epoch/authorization is
 * pinned by devDependency parity tests (test/parity.test.ts), never
 * runtime deps.
 */

// ---------------------------------------------------------------------------
// Versions + closed vocabularies.
// ---------------------------------------------------------------------------
export {
  MOBILE_FIELD_CLIENT_CONTRACT_VERSION,
  MOBILE_FIELD_RECORD_VERSION,
  FIELD_SESSION_STATES,
  FIELD_EVIDENCE_KINDS,
  FIELD_REVIEW_KINDS,
  FIELD_QUEUE_INTENT_KINDS,
  FIELD_QUEUE_REPLAY_STATES,
  GATEWAY_DECISION_OUTCOMES,
  FIELD_FIDELITY_INTERACTION_MODALITIES,
  MOBILE_FIELD_ERROR_CODES,
  FIELD_SESSION_ID_PATTERN,
  FIELD_CAPTURE_ID_PATTERN,
  FIELD_APPROVAL_ID_PATTERN,
  FIELD_QUEUE_ID_PATTERN,
  FIELD_DECISION_ID_PATTERN,
} from './version';
export type {
  FieldSessionState,
  FieldEvidenceKind,
  FieldReviewKind,
  FieldQueueIntentKind,
  FieldQueueReplayState,
  GatewayDecisionOutcome,
  FieldFidelityInteractionModality,
  MobileFieldErrorCode,
} from './version';

// ---------------------------------------------------------------------------
// Primitives (mobile-owned field id grammars + reused canonical schemas).
// ---------------------------------------------------------------------------
export {
  TimestampSchema,
  Sha256HexSchema,
  FieldSessionIdSchema,
  FieldCaptureIdSchema,
  FieldApprovalIdSchema,
  FieldQueueIdSchema,
  FieldDecisionIdSchema,
} from './primitives';
export type {
  Timestamp,
  Sha256Hex,
  FieldSessionId,
  FieldCaptureId,
  FieldApprovalId,
  FieldQueueId,
  FieldDecisionId,
} from './primitives';

// ---------------------------------------------------------------------------
// Typed error taxonomy (values, never thrown).
// ---------------------------------------------------------------------------
export {
  MobileFieldIssueSchema,
  MobileFieldErrorSchema,
  fieldOk,
  fieldError,
  zodIssuesToFieldIssues,
} from './errors';
export type {
  MobileFieldIssue,
  MobileFieldError,
  MobileFieldResult,
} from './errors';

// ---------------------------------------------------------------------------
// The FIELD-fidelity device descriptor (W011 slot + ladder).
// ---------------------------------------------------------------------------
export {
  FIELD_DEVICE_CLASSES,
  FIELD_DISPLAY_BUDGETS,
  FIELD_SPATIAL_CAPABILITIES,
  FIELD_LATENCY_BUDGET_MS,
  FIELD_DEVICE_CAPABILITY_SET,
  buildFieldDeviceDescriptor,
  validateFieldDeviceDescriptor,
} from './device';
export type { FieldDeviceClass, FieldDeviceDescriptorOptions } from './device';

// ---------------------------------------------------------------------------
// Field evidence references (W006 convention: digests only).
// ---------------------------------------------------------------------------
export {
  MAX_FIELD_EVIDENCE_REFS,
  FieldEvidenceRefSchema,
  FieldEvidenceRefArraySchema,
  admitFieldEvidenceRef,
  computeFieldEvidenceDigest,
  FIELD_EVIDENCE_RECORD_VERSION,
} from './evidence';
export type { FieldEvidenceRef } from './evidence';

// ---------------------------------------------------------------------------
// Field sessions (tenant-scoped capture sessions).
// ---------------------------------------------------------------------------
export {
  FIELD_SESSION_SCHEMA_NAME,
  FieldSessionContentSchema,
  SealedFieldSessionSchema,
  openFieldSession,
  pauseFieldSession,
  resumeFieldSession,
  closeFieldSession,
  verifySealedFieldSession,
  sessionTenantGuard,
} from './session';
export type { FieldSessionContent, SealedFieldSession, OpenFieldSessionOptions } from './session';

// ---------------------------------------------------------------------------
// Capture envelopes (versioned, content-addressed, replay-safe).
// ---------------------------------------------------------------------------
export {
  FIELD_CAPTURE_SCHEMA_NAME,
  WorkPackageLinkInputSchema,
  ResolvedWorkPackageLinkSchema,
  CaptureContextSchema,
  FieldCaptureContentSchema,
  SealedFieldCaptureSchema,
  sealFieldCapture,
  verifySealedFieldCapture,
  toObservationRecord,
  captureTenantGuard,
  captureSessionGuard,
} from './capture';
export type {
  WorkPackageLinkInput,
  ResolvedWorkPackageLink,
  CaptureContext,
  FieldCaptureContent,
  SealedFieldCapture,
  SealFieldCaptureOptions,
  ToObservationOptions,
} from './capture';

// ---------------------------------------------------------------------------
// Review/approval surfaces (W003 proposals through the W022 seam).
// ---------------------------------------------------------------------------
export {
  GATEWAY_DECISION_RECORD_VERSION,
  GATEWAY_DENIAL_CODES,
  GatewayDenialCodeSchema,
  GatewayDenialSchema,
  ApproverScopeSchema,
  ApprovalDirectiveSchema,
  GatewayDecisionRecordSchema,
  FIELD_REVIEW_PROPOSAL_SCHEMA_NAME,
  ReviewSubjectSchema,
  FieldReviewProposalContentSchema,
  SealedFieldReviewProposalSchema,
  FIELD_REVIEW_ACTION_TYPE_ID,
  FIELD_REVIEW_ACTION_TYPE_VERSION,
  sealFieldReviewProposal,
  verifySealedFieldReviewProposal,
  buildReviewActionProposal,
  FIELD_REVIEW_SUBMISSION_SCHEMA_NAME,
  FieldReviewSubmissionSchema,
  buildFieldReviewSubmission,
  ReferenceFieldApprovalGateway,
  verifyGatewayDecisionRecord,
} from './approval';
export type {
  GatewayDenialCode,
  GatewayDenial,
  ApproverScope,
  ApprovalDirective,
  GatewayDecisionRecord,
  GatewayDecisionContent,
  ReviewSubject,
  FieldReviewProposalContent,
  SealedFieldReviewProposal,
  SealFieldReviewOptions,
  BuildReviewActionProposalOptions,
  FieldReviewSubmission,
  BuildFieldReviewSubmissionOptions,
  FieldApprovalGatewayPort,
  ReferenceDecisionDirective,
  ReferenceFieldApprovalGatewayOptions,
} from './approval';

// ---------------------------------------------------------------------------
// The offline queue (typed, content-addressed, idempotent).
// ---------------------------------------------------------------------------
export {
  FIELD_QUEUE_RECORD_SCHEMA_NAME,
  MAX_QUEUE_RECORDS,
  FieldQueueReplaySchema,
  FieldQueueRecordContentSchema,
  SealedFieldQueueRecordSchema,
  OfflineQueue,
  verifySealedFieldQueueRecord,
} from './queue';
export type {
  FieldQueueReplay,
  FieldQueueRecordContent,
  SealedFieldQueueRecord,
  EnqueueCaptureOptions,
  EnqueueApprovalOptions,
  DuplicateQueueOutcome,
  EnqueueResult,
} from './queue';

// ---------------------------------------------------------------------------
// The reference sync host (kernel-seam replay with provenance).
// ---------------------------------------------------------------------------
export {
  DEFAULT_SYNC_PROPOSAL_IDENTITY,
  FieldSyncHost,
} from './sync';
export type {
  SyncProposalIdentity,
  FieldSyncHostOptions,
  SyncReplayOutcome,
  SyncResult,
  SyncQueueOptions,
} from './sync';
