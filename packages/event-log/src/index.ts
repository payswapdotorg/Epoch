/**
 * @epoch/event-log — public API (kernel layer, Work Order W010).
 *
 * The AUTHORITATIVE CHANGE HISTORY (architecture.md, binding):
 * "The event log is the authoritative change history: append-only,
 * totally-ordered per stream, typed events carrying actor/tenant scoping,
 * causal references, and content digests. Events are FACTS (immutable);
 * corrections are new events, never mutations."
 *
 * - Append-only by construction: there is no mutation, rewrite, or
 *   deletion API. Admission is total (errors are values, never
 *   exceptions) with a fixed precedence: version -> schema -> digest ->
 *   kernel payload -> tenant -> sequence -> causal.
 * - Sequence integrity: per-stream sequences are strictly contiguous from
 *   1; gaps, duplicates, and out-of-order appends are typed rejections.
 * - Digest discipline: every event is content-addressed (SHA-256 over
 *   canonical JSON via @epoch/agent-protocol); a claimed digest that does
 *   not match the content is rejected (tamper detection).
 * - Tenant isolation (R12): the log may be tenant-scoped; every stream
 *   fixes its tenant at the first append; cross-tenant appends are typed
 *   `cross-tenant-denied` rejections.
 * - Determinism: ZERO wall-clock reads and ZERO randomness in src —
 *   occurrence instants are PRODUCER-SUPPLIED payload data; every read
 *   path sorts (no insertion-order leaks).
 * - Provider-NEUTRAL (lock rule 13): opaque kind-prefixed ids and
 *   namespaced discriminators; strict objects reject unknown (vendor)
 *   fields. Durable persistence and event distribution are future
 *   adapters, never this contract.
 *
 * Runtime dependency policy (W010 Tech Lead pin): @epoch/agent-protocol
 * (canonical JSON + SHA-256 digests + timestamp/JSON primitives),
 * @epoch/world-model (EntityId vocabulary for world-subject payloads),
 * and @epoch/action-protocol (ProposalReference/ActionTypeReference
 * vocabulary for action-derived events) are the ONLY @epoch runtime
 * dependencies. Compatibility with @epoch/tenancy (tenant-scoping
 * shapes) and @epoch/identity (principal-id shapes) is pinned via
 * devDependencies + compile-time parity (src/kernel-parity.ts) and
 * runtime parity tests — never runtime deps.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/schema.ts), compile-time
 * parity (src/parity.ts + src/kernel-parity.ts), and the committed JSON
 * Schema projection under schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies (id patterns mirror tenancy/identity; the action
// phase vocabulary mirrors the action protocol lifecycle).
export {
  ACTION_EVENT_PHASES,
  EVENT_ACTOR_PATTERN,
  EVENT_KIND_DISCRIMINATOR_PATTERN,
  EVENT_LOG_CONTRACT_VERSION,
  EVENT_LOG_RECORD_VERSION,
  EVENT_STREAM_ID_PATTERN,
  EVENT_SUBJECT_KINDS,
  EVENT_TENANT_ID_PATTERN,
  RESERVED_EVENT_NAMESPACES,
  namespaceOf,
} from './version';
export type {
  ActionEventPhase,
  EventSubjectKind,
  ReservedEventNamespace,
} from './version';

// Published contract types.
export type {
  ActionLifecycleEventData,
  CausalEventReference,
  EventActor,
  EventContent,
  EventKindDiscriminator,
  EventLogError,
  EventLogIssue,
  EventLogResult,
  EventLogSnapshot,
  EventPayload,
  EventRecord,
  EventRegistration,
  EventSequence,
  EventStreamId,
  EventSubject,
  EventTenantId,
  ReadStreamOptions,
  RestoreOptions,
  StreamInfo,
  WorldSubjectsEventData,
} from './types';
export type { EventLogOptions } from './types';

// Runtime validators.
export {
  SHA256_HEX_PATTERN,
  WORLD_RELATION_ID_PATTERN,
  ActionLifecycleEventDataSchema,
  CausalEventReferenceSchema,
  EventActorSchema,
  EventDataSchema,
  EventKindDiscriminatorSchema,
  EventLogIssueSchema,
  EventLogRecordVersionSchema,
  EventLogSnapshotSchema,
  EventPayloadSchema,
  EventRecordSchema,
  EventRegistrationSchema,
  EventSequenceSchema,
  EventStreamIdSchema,
  EventSubjectSchema,
  EventTenantIdSchema,
  Sha256DigestSchema,
  StreamInfoSchema,
  WorldSubjectsEventDataSchema,
} from './schema';

// Digest discipline (content addressing + tamper-checked sealing).
export { computeEventDigest, eventRecordFor, sealEvent, verifyEventDigest } from './digest';

// Kernel payload contracts (world/action vocabulary composition).
export {
  ACTION_LIFECYCLE_EVENT_KIND,
  WORLD_SUBJECTS_EVENT_KIND,
  kernelPayloadViolation,
  parseActionLifecycleEventData,
  parseWorldSubjectsEventData,
} from './subjects';

// The reference in-memory log: append machinery + cursor/read primitives.
export { EventLog, canonicalStreamOrder } from './event-log';
export type { AppendEventInput } from './event-log';

// Total admission of serialized documents.
export { parseEventLogSnapshot, parseEventRecord } from './parse';

// Issue helpers (zod -> typed issues; the W006/W007 style).
export { flattenZodIssues, validationError } from './issues';

// Schema surface registry + deterministic contract emission.
export { renderEventLogContractFiles, EVENT_LOG_CONTRACT_DIR, typeToKebabCase } from './contract-emission';
export { EVENT_LOG_SCHEMA_SURFACE } from './surface';
export type { SchemaSurfaceEntry } from './surface';

// Compile-time parity assertions (compiled by tsc --noEmit; never a
// runtime import for downstream consumers).
export type {
  EventLogSchemaSync,
  EventLogContentSync,
  EventLogResultSync,
} from './parity';
