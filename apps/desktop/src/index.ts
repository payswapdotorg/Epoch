/**
 * @epoch/desktop — public API (W017).
 *
 * The typed reference implementation of the Epoch desktop client
 * (architecture.md "Clients" — binding): the shell architecture a native
 * wrapper embeds, with an in-memory reference host as the native-side
 * counterpart. The web experience stays web-native and canonical; the
 * desktop shares its semantic contracts and adds the desktop-specific
 * hosting surface.
 *
 * - COMPOSITION, NEVER AUTHORITY (lock rules 8/16): the shell mounts W011
 *   Experience Graph projections through W012 compiler artifacts and
 *   drives W013 renderer invocations (`InvocationEnvelope` in,
 *   `RendererReceipt` out) — ALWAYS through `admitInvocation`; bypass
 *   attempts are typed `authority-violation` rejections. The optional
 *   authoring surface is a PROJECTION: typed proposals through the
 *   kernel-seam shapes, zero shell authority (approval/execution are
 *   kernel-side).
 * - The host↔shell seam is the IPC contract a native backend carries:
 *   versioned, content-addressed, replay-safe envelopes (per-session
 *   channels, monotonic sequences, digest chains).
 * - Tenant isolation (R12): sessions are scoped through @epoch/tenancy;
 *   cross-tenant scopes, offers, documents, and cache reads are typed
 *   `cross-tenant-denied` rejections.
 * - DETERMINISM: zero wall-clock, zero randomness; identical host chains
 *   replay to byte-identical snapshots (test/determinism.test.ts).
 * - Provider-NEUTRAL (lock rule 13): zero engine/vendor/toolkit
 *   vocabulary in source; the reference host is engine-free
 *   (test/neutrality.test.ts).
 * - Runtime dependencies are exactly @epoch/experience-protocol,
 *   @epoch/renderer-runtime, @epoch/agent-protocol, @epoch/tenancy, and
 *   zod (the frozen W017 pin). @epoch/experience-compiler (the W012
 *   artifact shapes), @epoch/identity, and @epoch/authorization are
 *   devDependency parity pins, never runtime couplings (the W014 app
 *   pattern).
 */

// ---------------------------------------------------------------------------
// Versions + closed vocabularies.
// ---------------------------------------------------------------------------
export {
  DESKTOP_CONTRACT_VERSION,
  DESKTOP_PROTOCOL_VERSION,
  DESKTOP_RECORD_VERSION,
  DESKTOP_DOCUMENT_KINDS,
  WINDOW_STATES,
  WINDOW_EVENTS,
  WINDOW_TRANSITIONS,
  TERMINAL_WINDOW_STATES,
  SESSION_STATES,
  SESSION_EVENTS,
  SESSION_TRANSITIONS,
  HOST_SHELL_ENVELOPE_SCHEMA_NAME,
  ENVELOPE_DIRECTIONS,
  HOST_TO_SHELL_KINDS,
  SHELL_TO_HOST_KINDS,
  DIRECTION_KINDS,
  CACHE_INVALIDATION_REASONS,
  CACHE_ENTRY_KINDS,
  AUTHORING_PROPOSAL_SCHEMA_NAME,
  AUTHORING_PROPOSAL_STATUSES,
  AUTHORING_AUTHORITY_ATTEMPTS,
  ADMISSION_BYPASS_ATTEMPTS,
  ARTIFACT_ORIGINS,
  PRINCIPAL_ID_PATTERN,
  PRINCIPAL_KINDS,
  AUTHORING_DENIAL_CODES,
  DESKTOP_ERROR_CODES,
  NEUTRALITY_LOCKED_SEAMS,
} from './version';
export type {
  DesktopProtocolVersion,
  DesktopDocumentKind,
  WindowState,
  WindowEvent,
  SessionState,
  SessionEvent,
  EnvelopeDirection,
  HostToShellKind,
  ShellToHostKind,
  EnvelopeKind,
  CacheInvalidationReason,
  CacheEntryKind,
  AuthoringProposalStatus,
  AuthoringAuthorityAttempt,
  AdmissionBypassAttempt,
  ArtifactOrigin,
  PrincipalKind,
  AuthoringDenialCode,
  DesktopErrorCode,
} from './version';
export {
  DesktopProtocolVersionSchema,
  DesktopRecordVersionSchema,
  WindowStateSchema,
  WindowEventSchema,
  SessionStateSchema,
  SessionEventSchema,
  EnvelopeDirectionSchema,
  HostToShellKindSchema,
  ShellToHostKindSchema,
  CacheInvalidationReasonSchema,
  CacheEntryKindSchema,
  AuthoringProposalStatusSchema,
  AuthoringAuthorityAttemptSchema,
  AdmissionBypassAttemptSchema,
  ArtifactOriginSchema,
  DesktopErrorCodeSchema,
} from './version';

// ---------------------------------------------------------------------------
// Neutral primitives (shared vocabularies + shell-owned ids).
// ---------------------------------------------------------------------------
export {
  JsonValueSchema,
  MessageIdSchema,
  Sha256HexSchema,
  TenantScopeSchema,
  OpaqueScopeIdSchema,
  DeviceSessionIdSchema,
  RendererSessionIdSchema,
  WINDOW_ID_PATTERN,
  DESKTOP_SESSION_ID_PATTERN,
  ENVELOPE_ID_PATTERN,
  WindowIdSchema,
  DesktopSessionIdSchema,
  EnvelopeIdSchema,
  PrincipalIdSchema,
  VirtualTimeMsSchema,
  SequenceNumberSchema,
  WindowBoundsSchema,
  ProvenanceSchema,
  ProtocolVersionField,
  RecordVersionField,
  ActionTypeReferenceSchema,
} from './primitives';
export type {
  Sha256Hex,
  TenantScope,
  JsonValue,
  WindowId,
  DesktopSessionId,
  EnvelopeId,
  PrincipalId,
  VirtualTimeMs,
  SequenceNumber,
  WindowBounds,
  Provenance,
  ActionTypeReference,
} from './primitives';

// ---------------------------------------------------------------------------
// Typed error taxonomy + total results.
// ---------------------------------------------------------------------------
export {
  DesktopIssueSchema,
  AuthorityViolationRecordSchema,
  DesktopShellErrorSchema,
  desktopOk,
  desktopFail,
  versionUnsupportedError,
  malformedRecordError,
  digestMismatchError,
  crossTenantDeniedError,
  authorityViolationError,
  unknownWindowError,
  unknownSessionError,
  invalidTransitionError,
  replayViolationError,
  deviceMismatchError,
  cacheViolationError,
  invocationRejectedError,
} from './errors';
export type {
  DesktopIssue,
  AuthorityViolationRecord,
  DesktopShellError,
  DesktopResult,
} from './errors';

// ---------------------------------------------------------------------------
// The full-fidelity desktop device descriptor (W011 slot; ladder rung).
// ---------------------------------------------------------------------------
export {
  DESKTOP_DEVICE,
  DESKTOP_SERVICEABLE_MODALITIES,
  FULL_FIDELITY_GRAPH_KINDS,
  KIND_COMPLETE_RENDERER,
  DESKTOP_FIDELITY,
  MAX_RENDERER_TEXTURE_BYTES,
  MAX_RENDERER_TRIANGLES,
  assessDesktopFidelity,
  admitDeviceDescriptor,
} from './device';
export type { FidelityAssessment } from './device';

// ---------------------------------------------------------------------------
// Session-scoped tenants (@epoch/tenancy, the runtime pin).
// ---------------------------------------------------------------------------
export {
  resolveSessionScope,
  tenantScopeOf,
  isWithinTenant,
} from './tenancy';
export type { SessionScopeInput, DesktopSessionScope } from './tenancy';

// ---------------------------------------------------------------------------
// The typed window model.
// ---------------------------------------------------------------------------
export {
  WINDOW_RECORD_SCHEMA_NAME,
  rendererSessionIdOf,
  deviceSessionIdOf,
  isLegalWindowTransition,
  nextWindowState,
  WindowRecordContentSchema,
  WindowRecordSchema,
  sealWindowRecord,
  verifyWindowRecord,
  parseWindowRecord,
  applyWindowEvent,
  bindWindowRenderer,
} from './window';
export type { WindowRecordContent, WindowRecord } from './window';

// ---------------------------------------------------------------------------
// The host↔shell envelope seam (the IPC contract).
// ---------------------------------------------------------------------------
export {
  GENESIS_DIGEST,
  EnvelopeBodySchema,
  HostShellEnvelopeContentSchema,
  HostShellEnvelopeSchema,
  sealHostShellEnvelope,
  verifyHostShellEnvelope,
  openChannel,
  nextChainPosition,
  appendEnvelope,
  parseHostShellEnvelope,
  admitEnvelope,
  verifyEnvelopeChain,
  Sha256HexPattern,
} from './envelopes';
export type {
  EnvelopeBody,
  EnvelopeBodyKind,
  HostShellEnvelopeContent,
  HostShellEnvelope,
  SeamChannel,
  EnvelopeAppendInput,
} from './envelopes';

// ---------------------------------------------------------------------------
// Compiled-plan artifacts (the W012 consumption surface).
// ---------------------------------------------------------------------------
export {
  RENDER_PLAN_SCHEMA_NAME,
  RENDER_PLAN_PROTOCOL_VERSION,
  PlanUsageSchema,
  PlanArtifactSchema,
  projectPlanArtifact,
  verifyPlanDocument,
  planDigestChain,
} from './plan';
export type { PlanUsage, PlanArtifact } from './plan';

// ---------------------------------------------------------------------------
// Experience mounting (W011 admission -> chain gates -> W013 invocation).
// ---------------------------------------------------------------------------
export {
  admitExperienceOffer,
  experienceGraphAddress,
  mountExperience,
  advanceFrame,
  submitIntent,
  rejectAdmissionBypass,
  receiptDigest,
  asRendererRuntimeError,
} from './mounting';
export type {
  MountableExperience,
  OfferAdmissionContext,
  AdmissionBypassAttemptInput,
} from './mounting';

// ---------------------------------------------------------------------------
// The authoring projection surface (typed proposals, zero authority).
// ---------------------------------------------------------------------------
export {
  AuthoringProposalContentSchema,
  AuthoringProposalSchema,
  sealAuthoringProposal,
  verifyAuthoringProposal,
  parseAuthoringProposal,
  proposeAuthoring,
  rejectAuthoringAuthority,
  admitProposalForTenant,
  recordAuthoringDenial,
} from './authoring';
export type {
  AuthoringProposalContent,
  AuthoringProposal,
  AuthoringProposalInput,
  AuthoringAuthorityAttemptInput,
  AuthoringDenialRecord,
} from './authoring';

// ---------------------------------------------------------------------------
// Offline/session cache + session-state snapshots.
// ---------------------------------------------------------------------------
export {
  CACHE_ENTRY_SCHEMA_NAME,
  SESSION_SNAPSHOT_SCHEMA_NAME,
  CacheFreshnessSchema,
  CacheEntryContentSchema,
  CacheEntrySchema,
  sealCacheEntry,
  verifyCacheEntry,
  contentAddressOf,
  createExperienceCache,
  SnapshotWindowSchema,
  SnapshotReceiptSchema,
  SnapshotCacheAddressSchema,
  SnapshotChannelsSchema,
  SessionSnapshotContentSchema,
  SessionSnapshotSchema,
  sealSessionSnapshot,
  verifySessionSnapshot,
  parseSessionSnapshot,
  snapshotDigest,
} from './cache';
export type {
  CacheFreshness,
  CacheEntryContent,
  CacheEntry,
  StoredCacheRecord,
  CacheResolveOptions,
  ExperienceCache,
  SnapshotWindow,
  SnapshotReceipt,
  SnapshotCacheAddress,
  SnapshotChannels,
  SessionSnapshotContent,
  SessionSnapshot,
} from './cache';

// ---------------------------------------------------------------------------
// The desktop shell (the composition layer) + session replay.
// ---------------------------------------------------------------------------
export {
  isLegalSessionTransition,
  nextSessionState,
  createDesktopShell,
  replayDesktopSession,
} from './shell';
export type {
  DesktopShellOptions,
  ReceiptLogEntry,
  ShellSessionState,
  HostEnvelopeOutcome,
  DesktopShell,
} from './shell';

// ---------------------------------------------------------------------------
// The in-memory reference host (the native-side counterpart).
// ---------------------------------------------------------------------------
export { createReferenceHost } from './host';
export type {
  ReferenceHostOptions,
  HostLedgerEntry,
  ReferenceHost,
} from './host';
