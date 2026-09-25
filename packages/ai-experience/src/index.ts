/**
 * @epoch/ai-experience — public API (experience layer, Work Order W015).
 *
 * The typed AI-COLLABORATION DOMAIN MODEL over the event-sourced W010
 * substrate (spec/experience-architecture.md, binding):
 *
 * - TYPED SEMANTICS AS DATA: collaboration sessions (tenant-scoped
 *   descriptors with human/agent role grants), agent presence/focus
 *   states, the typed interaction-intent vocabulary (sixteen versioned
 *   subsets of the Universal interactions), takeover/release transitions
 *   with provenance, and Engineering Moment records (content-addressed,
 *   shareable/replayable). Never bespoke state machines — collaboration
 *   is event-sourced over the W010 shapes.
 * - HUMANS AND AGENTS ARE PEERS with typed roles: take-control and
 *   release-control are explicit typed transitions with provenance (who,
 *   when, on what authority); unauthorized takeover is a typed rejection
 *   recorded as history (`control.denied` — provenance never lost).
 * - ENGINEERING MOMENTS ARE FIRST-CLASS RECORDS: typed, evidence-bearing,
 *   shareable/replayable references (snapshot + states + timeline
 *   position + available actions). Producing one NEVER mutates engine
 *   state.
 * - THE DYNAMIC UI LAW: agents emit TYPED Experience Intents, never
 *   arbitrary executable UI code — executable payloads are typed
 *   `executable-ui-rejected` rejections; vendor/provider fields are typed
 *   `vendor-fields-rejected` rejections (lock rule 13).
 * - DETERMINISTIC PROJECTION: pure folds with sorted outputs (no
 *   insertion-order leaks); ZERO wall-clock reads and ZERO randomness in
 *   src — instants are producer-supplied payload data.
 * - TENANT ISOLATION (R12): sessions fix their tenant; cross-tenant
 *   intents, events, and references are typed `cross-tenant-denied`
 *   rejections.
 * - Provider-NEUTRAL (lock rule 13): no vendor SDKs, no model-provider
 *   references, no network — typed contracts + in-memory reference
 *   behavior only.
 *
 * Runtime dependency policy (W015 Tech Lead pin): @epoch/agent-protocol
 * (ids, digests, canonical JSON, version discriminators), @epoch/event-log
 * (W010 event shapes), and @epoch/experience-protocol (W011 experience
 * vocabulary) are the ONLY @epoch runtime dependencies. Compatibility
 * with @epoch/collaboration, @epoch/replay, @epoch/tenancy, and
 * @epoch/experience-compiler is pinned via devDependencies + compile-time
 * parity (src/kernel-parity.ts) and runtime parity tests — never runtime
 * deps. Layer note: the package declares the EXPERIENCE layer because
 * the pinned @epoch/experience-protocol runtime dependency is an
 * experience-layer package and the frozen boundary model forbids
 * kernel -> experience edges; the marker matches the W011/W012/W013
 * siblings the package composes.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/schema.ts), compile-time
 * parity (src/parity.ts + src/kernel-parity.ts), and the committed JSON
 * Schema projection under schemas/ pinned by test/contract-drift.test.ts.
 */

// ---------------------------------------------------------------------------
// Versions + closed vocabularies.
// ---------------------------------------------------------------------------
export {
  AI_EXPERIENCE_CONTRACT_VERSION,
  AI_EXPERIENCE_RECORD_VERSION,
  AI_EXPERIENCE_ERROR_CODES,
  AI_EVENT_NAMESPACE,
  AGENT_PRESENCE_STATES,
  AGENT_PRESENCE_TRANSITIONS,
  AI_SESSION_STATES,
  AI_TENANT_ID_PATTERN,
  AI_PRINCIPAL_ID_PATTERN,
  AI_SESSION_ID_PATTERN,
  AI_AGENT_ID_PATTERN,
  AI_WORKSPACE_ID_PATTERN,
  AI_PROJECT_ID_PATTERN,
  SHA256_HEX_PATTERN,
  ACTION_PROPOSAL_ID_PATTERN,
  COLLABORATION_ADAPTER_KINDS,
  CONTROL_AUTHORITY_KINDS,
  CONTROL_DENIAL_REASONS,
  EXECUTABLE_FIELD_BLOCKLIST,
  EXECUTABLE_VALUE_PREFIXES,
  FOCUS_TARGET_KINDS,
  INTERACTION_INTENT_KINDS,
  INTENT_PAYLOAD_VERSION,
  MAX_BRANCH_LABEL_LENGTH,
  MAX_MOMENT_EVIDENCE,
  MAX_MOMENT_PARTICIPANTS,
  MAX_MOMENT_REFERENCES,
  MAX_NAME_LENGTH,
  MAX_OPEN_DATA_KEYS,
  MAX_ROLE_INTENTS,
  MAX_SCENARIO_REF_LENGTH,
  MAX_SESSION_ROLES,
  MAX_TEXT_LENGTH,
  PARTICIPANT_KINDS,
  PEER_PARTICIPANT_KINDS,
  VENDOR_FIELD_BLOCKLIST,
} from './version';
export type {
  AgentPresenceState,
  AiExperienceErrorCode,
  AiSessionState,
  AnyParticipantKind,
  ControlAuthorityKind,
  ControlDenialReason,
  FocusTargetKind,
  InteractionIntentKind,
  MirroredCollaborationEventKind,
  PeerParticipantKind,
} from './version';

// ---------------------------------------------------------------------------
// Published contract types.
// ---------------------------------------------------------------------------
export type {
  ActionProposalTarget,
  AgentFollow,
  AiCollaborationEvent,
  AiCollaborationEventKindValue,
  AiCollaborationEventRecord,
  AiCollaborationEventRegistration,
  AiExperienceError,
  AiExperienceIssue,
  AiPrincipalId,
  AiResult,
  AiSessionDescriptor,
  AiSessionId,
  AiSessionScope,
  AiTenantId,
  AnnotateIntent,
  ApproveIntent,
  BranchIntent,
  BranchPoint,
  CapturedMoment,
  CollaborationProjection,
  CompareIntent,
  ControlAuthority,
  ControlProvenance,
  ControlRejection,
  EngineeringMomentContent,
  EngineeringMomentRecord,
  ExecuteIntent,
  ExperienceGraphReference,
  FilterIntent,
  FollowAgentIntent,
  FocusTarget,
  InspectIntent,
  IntentGrant,
  InteractionIntent,
  MirroredCollaborationEventRecord,
  MomentParticipantState,
  ParticipantFocus,
  ParticipantPresence,
  ParticipantRoleDescriptor,
  PauseIntent,
  PlaybackState,
  PresenceCursorInput,
  PresenceSeatInput,
  QueryIntent,
  ReplayIntent,
  RejectIntent,
  ReleaseControlIntent,
  ResumeIntent,
  ScenarioReference,
  SelectIntent,
  StreamBound,
  TakeControlIntent,
  TimelinePosition,
  ViewAnnotation,
} from './types';

// ---------------------------------------------------------------------------
// Runtime validators.
// ---------------------------------------------------------------------------
export {
  ActionProposalTargetSchema,
  AiCollaborationEventKindSchema,
  AiCollaborationEventRecordSchema,
  AiCollaborationEventRegistrationSchema,
  AiCollaborationEventSchema,
  AiExperienceIssueSchema,
  AiExperienceRecordVersionSchema,
  AiPrincipalIdSchema,
  AiSessionDescriptorSchema,
  AiSessionIdSchema,
  AiSessionScopeSchema,
  AiSessionStateSchema,
  AiTenantIdSchema,
  AgentPresenceStateSchema,
  BranchPointSchema,
  ControlAuthorityKindSchema,
  ControlAuthoritySchema,
  ControlDenialReasonSchema,
  ControlProvenanceSchema,
  ControlRejectionSchema,
  EngineeringMomentContentSchema,
  EngineeringMomentRecordSchema,
  ExperienceGraphReferenceSchema,
  FocusTargetKindSchema,
  FocusTargetSchema,
  InteractionIntentKindSchema,
  InteractionIntentSchema,
  MirroredCollaborationEventKindSchema,
  MirroredCollaborationEventRecordSchema,
  MomentParticipantStateSchema,
  ParticipantRoleDescriptorSchema,
  PeerParticipantKindSchema,
  PlaybackStateSchema,
  ProjectedEvidenceRefSchema,
  ScenarioReferenceSchema,
  Sha256DigestSchema,
  StreamBoundSchema,
  TimelinePositionSchema,
} from './schema';

// ---------------------------------------------------------------------------
// Shared upstream primitives (runtime reuse, re-exported for consumers).
// ---------------------------------------------------------------------------
export {
  MessageIdSchema,
  TimestampSchema,
} from './schema';

// ---------------------------------------------------------------------------
// Issue helpers (zod -> typed issues; the W006/W007/W010 style).
// ---------------------------------------------------------------------------
export { flattenZodIssues, validationError, validationMessage } from './issues';

// ---------------------------------------------------------------------------
// Digest discipline (content addressing + tamper-checked sealing + the
// neutrality scans).
// ---------------------------------------------------------------------------
export {
  aiEventRecordFor,
  computeAiEventDigest,
  computeMomentDigest,
  intentNeutralityFailure,
  scanExecutableUiViolations,
  scanVendorFieldViolations,
  sealAiEvent,
  sealMoment,
  serializeAiEvent,
  serializeMoment,
  verifyAiEventDigest,
  verifyMomentDigest,
} from './digest';
export type { NeutralityViolation } from './digest';

// ---------------------------------------------------------------------------
// Intent admission (the total gate; takeover/release transitions with
// provenance; typed takeover denials).
// ---------------------------------------------------------------------------
export {
  admitIntent,
  presenceTransitionFailure,
  validateSessionDescriptor,
  validateTimelinePosition,
} from './admission';
export type {
  AdmitIntentOptions,
  ControlStateSnapshot,
  IntentEnvelope,
} from './admission';

// ---------------------------------------------------------------------------
// Engineering Moments (the shareable/replayable record constructor).
// ---------------------------------------------------------------------------
export { captureEngineeringMoment, deriveAvailableActions } from './moment';
export type { CaptureMomentInput } from './moment';

// ---------------------------------------------------------------------------
// The deterministic collaboration projection (pure fold).
// ---------------------------------------------------------------------------
export { projectCollaboration } from './projection';
export type { ProjectCollaborationOptions } from './projection';

// ---------------------------------------------------------------------------
// W010 substrate adapters (event-log emission/adaptation; mirrored
// collaboration journal adaptation).
// ---------------------------------------------------------------------------
export {
  buildEventLogContent,
  eventLogDiscriminatorOf,
  fromCollaborationEventRecord,
  fromEventLogRecord,
  toEventLogPayload,
} from './adapters';
export type { EventLogCoordinates } from './adapters';

// ---------------------------------------------------------------------------
// W011 presence-graph emission (typed projection helpers).
// ---------------------------------------------------------------------------
export {
  buildPresenceGraphContent,
  presenceCursorNode,
  presenceCursorNodeId,
  presenceGraphNodes,
  presenceSeatNode,
  presenceSeatNodeId,
} from './graph';
export type { PresenceGraphInput } from './graph';

// ---------------------------------------------------------------------------
// Published schema surface + deterministic contract emission.
// ---------------------------------------------------------------------------
export { AI_EXPERIENCE_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  AI_EXPERIENCE_CONTRACT_DIR,
  renderAiExperienceContractFiles,
  typeToKebabCase,
} from './contract-emission';

// Compile-time parity assertions (compiled by tsc --noEmit; never a
// runtime import for downstream consumers).
export type { AiSchemaSync } from './parity';
