/**
 * @epoch/collaboration — public API (kernel layer, Work Order W010).
 *
 * SESSION-BASED PRESENCE/COORDINATION OVER THE SHARED MODEL
 * (architecture.md, binding): "Collaboration is session-based
 * presence/coordination over the shared model: typed collaboration
 * sessions (participants as opaque principal ids from W009 identity),
 * membership, and session-scoped coordination events. It is NOT a second
 * authority: collaboration does not mutate the world model; it
 * coordinates actors whose actions still flow through the action
 * gateway."
 *
 * - Typed session lifecycle: sealed session records (tenant-scoped,
 *   optionally workspace/project-narrowed) + the terminal
 *   `session.closed` journal event.
 * - Participant membership: opaque principal ids (W009 grammar);
 *   join/leave facts in the journal; presence with a typed transition
 *   table (heartbeats re-assert; `left` is membership-only and
 *   terminal).
 * - Session-scoped coordination envelopes: a closed kind vocabulary
 *   (membership, presence, subject focus, notes, close) with strict
 *   per-session sequence discipline (contiguous from 1 — the event-log
 *   discipline applied to the session scope) and content digests.
 * - Coordination subjects REFERENCE the shared model opaquely (world
 *   entities, action proposals at exact revisions) — never embed, never
 *   mutate.
 * - Tenant isolation (R12): hubs may be tenant-scoped; sessions fix
 *   their tenant; cross-tenant create/append/JOIN(read) attempts are
 *   typed `cross-tenant-denied` rejections.
 * - Provider-NEUTRAL (lock rule 13): opaque kind-prefixed ids; strict
 *   objects reject unknown (vendor) fields; real-time transports are
 *   future adapters. ZERO wall-clock reads and ZERO randomness in src.
 *
 * Runtime dependency policy (W010 Tech Lead pin): @epoch/agent-protocol
 * (canonical JSON + SHA-256 digests + timestamp/JSON primitives),
 * @epoch/world-model (EntityId vocabulary for world-entity subjects),
 * and @epoch/action-protocol (ProposalReference vocabulary for
 * action-proposal subjects) are the ONLY @epoch runtime dependencies.
 * Compatibility with @epoch/tenancy (tenant-scoping shapes) and
 * @epoch/identity (principal-id shapes) is pinned via devDependencies +
 * compile-time parity (src/kernel-parity.ts) and runtime parity tests.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/schema.ts), compile-time
 * parity (src/parity.ts + src/kernel-parity.ts), and the committed JSON
 * Schema projection under schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies (id patterns mirror tenancy/identity; parity-pinned).
export {
  COLLABORATION_CONTRACT_VERSION,
  COLLABORATION_EVENT_KINDS,
  COLLABORATION_PRINCIPAL_ID_PATTERN,
  COLLABORATION_PROJECT_ID_PATTERN,
  COLLABORATION_RECORD_VERSION,
  COLLABORATION_SESSION_ID_PATTERN,
  COLLABORATION_SUBJECT_KINDS,
  COLLABORATION_TENANT_ID_PATTERN,
  COLLABORATION_WORKSPACE_ID_PATTERN,
  PRESENCE_STATES,
  PRESENCE_TRANSITIONS,
  SESSION_STATES,
} from './version';
export type {
  CollaborationEventKind,
  CollaborationSubjectKind,
  PresenceState,
  SessionState,
} from './version';

// Published contract types.
export type {
  CollaborationError,
  CollaborationEvent,
  CollaborationEventRecord,
  CollaborationEventRegistration,
  CollaborationHubOptions,
  CollaborationIssue,
  CollaborationResult,
  CollaborationSession,
  CollaborationSessionId,
  CollaborationSessionRecord,
  CollaborationSnapshot,
  CollaborationSubject,
  CollaborationTenantId,
  ParticipantPresence,
  ParticipantPrincipalId,
  ReadJournalOptions,
  ReadOptions,
  SessionRegistration,
  SessionScope,
  SessionStateInfo,
} from './types';

// Runtime validators.
export {
  SHA256_HEX_PATTERN,
  CollaborationEventKindSchema,
  CollaborationEventRecordSchema,
  CollaborationEventSchema,
  CollaborationIssueSchema,
  CollaborationRecordVersionSchema,
  CollaborationSessionIdSchema,
  CollaborationSessionRecordSchema,
  CollaborationSessionSchema,
  CollaborationSnapshotSchema,
  CollaborationSubjectKindSchema,
  CollaborationSubjectSchema,
  CollaborationTenantIdSchema,
  CoordinationDataSchema,
  ParticipantPresenceSchema,
  ParticipantPrincipalIdSchema,
  PresenceStateSchema,
  SessionRegistrationSchema,
  SessionScopeSchema,
  SessionStateInfoSchema,
  SessionStateSchema,
  Sha256DigestSchema,
} from './schema';

// Digest discipline (content addressing + tamper-checked sealing).
export {
  computeEventDigest,
  computeSessionDigest,
  eventRecordFor,
  sealEvent,
  sealSession,
  sessionRecordFor,
  verifyEventDigest,
  verifySessionDigest,
} from './digest';

// The reference in-memory hub: sessions, membership, presence, journals.
export { CollaborationHub } from './hub';

// Total admission of serialized documents.
export {
  parseCollaborationEventRecord,
  parseCollaborationSession,
  parseCollaborationSnapshot,
} from './parse';

// Issue helpers (zod -> typed issues; the W006/W007 style).
export { flattenZodIssues, validationError } from './issues';

// Schema surface registry + deterministic contract emission.
export {
  renderCollaborationContractFiles,
  COLLABORATION_CONTRACT_DIR,
  typeToKebabCase,
} from './contract-emission';
export { COLLABORATION_SCHEMA_SURFACE } from './surface';
export type { SchemaSurfaceEntry } from './surface';

// Compile-time parity assertions (compiled by tsc --noEmit).
export type { CollaborationSchemaSync, CollaborationResultSync } from './parity';
