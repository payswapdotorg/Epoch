/**
 * @epoch/experience-runtime — public API (experience layer, Work Order
 * W013).
 *
 * The runtime HOST model of the Epoch Experience layer
 * (architecture.md "Experience Runtime" — binding): tenant-scoped device
 * sessions over the W011 device-descriptor vocabulary (typed
 * capabilities/limits; the abstract slot W019 fills — adaptation is NOT
 * this package's surface), a deterministic virtual-time frame/tick
 * scheduling model (testable without real clocks), typed runtime events
 * (frame, state, lifecycle), session lifecycle transitions, and a typed
 * session-error taxonomy.
 *
 * - PROJECTION, NEVER AUTHORITY (lock rules 8/16): the host model hosts
 *   presentation sessions; it never interprets kernel state and never
 *   becomes a second semantic store. Mounted render states are opaque
 *   content digests.
 * - Provider-NEUTRAL by construction (lock rule 13): zero concrete
 *   renderers, zero engine/vendor/framework vocabulary, zero UI-framework
 *   dependencies; strict objects reject unknown (vendor) fields. Concrete
 *   engines are future adapters (@epoch/renderer-runtime hosts them as
 *   abstract descriptors; W019 adapts).
 * - DETERMINISTIC VIRTUAL TIME: zero wall-clock, zero randomness in src —
 *   time advances only through explicit caller-supplied deltas, so two
 *   sessions fed identical schedules produce identical event traces.
 * - Tenant isolation (R12): every session is tenant-scoped; cross-tenant
 *   operations and admissions are rejected with typed
 *   `cross-tenant-denied` errors.
 * - Runtime dependencies are exactly @epoch/agent-protocol (canonical
 *   digest machinery, shared primitives) and @epoch/experience-protocol
 *   (the consumed device-descriptor vocabulary — genuine runtime
 *   composition per the W013 pin).
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/*.ts), and the committed JSON
 * Schema projection under packages/experience-runtime/schemas/ pinned by
 * test/contract-drift.test.ts (the W007/W008/W009 in-package convention).
 */

// ---------------------------------------------------------------------------
// Versions + closed vocabularies.
// ---------------------------------------------------------------------------
export {
  EXPERIENCE_RUNTIME_CONTRACT_VERSION,
  EXPERIENCE_RUNTIME_PROTOCOL_VERSION,
  EXPERIENCE_RUNTIME_DOCUMENT_KINDS,
  DEVICE_SESSION_SCHEMA_NAME,
  RUNTIME_EVENT_TRACE_SCHEMA_NAME,
  DEVICE_SESSION_STATES,
  RUNTIME_EVENT_KINDS,
  EXPERIENCE_RUNTIME_ERROR_CODES,
  MAX_ADVANCE_MS,
  MAX_FRAME_DURATION_MS,
  MAX_TICK_CADENCE,
  MAX_TRACE_EVENTS,
} from './version';
export type {
  ExperienceRuntimeProtocolVersion,
  ExperienceRuntimeDocumentKind,
  DeviceSessionState,
  RuntimeEventKind,
  ExperienceRuntimeErrorCode,
} from './version';
export {
  ExperienceRuntimeProtocolVersionSchema,
  DeviceSessionStateSchema,
  RuntimeEventKindSchema,
  ExperienceRuntimeErrorCodeSchema,
} from './version';

// ---------------------------------------------------------------------------
// Neutral primitives (reused shared vocabularies + protocol-owned ids).
// ---------------------------------------------------------------------------
export {
  DEVICE_SESSION_ID_PATTERN,
  DeviceSessionIdSchema,
  VirtualTimeMsSchema,
  FrameIndexSchema,
  TickIndexSchema,
  EventSequenceSchema,
  // Reused shared primitives (canonical homes: contracts/agent,
  // contracts/experience).
  JsonValueSchema,
  Sha256HexSchema,
  OpaqueScopeIdSchema,
  TenantScopeSchema,
  DeviceDescriptorSchema,
} from './primitives';
export type {
  DeviceSessionId,
  VirtualTimeMs,
  FrameIndex,
  TickIndex,
  EventSequence,
  JsonValue,
  Sha256Hex,
  OpaqueScopeId,
  TenantScope,
  DeviceDescriptor,
} from './primitives';

// ---------------------------------------------------------------------------
// Deterministic virtual-time frame/tick scheduling model.
// ---------------------------------------------------------------------------
export {
  FRAME_SCHEDULE_VERSION,
  FrameScheduleSchema,
  frameStartMs,
  tickStartMs,
  isTickBoundary,
  tickIndexForFrame,
  frameIndexAt,
  tickIndexAt,
  framesStartedInWindow,
} from './schedule';
export type { FrameSchedule } from './schedule';

// ---------------------------------------------------------------------------
// Typed runtime events + sealed event traces.
// ---------------------------------------------------------------------------
export {
  RuntimeEventSchema,
  RuntimeEventTraceContentSchema,
  RuntimeEventTraceSchema,
} from './events';
export type {
  RuntimeEvent,
  RuntimeEventTraceContent,
  RuntimeEventTrace,
} from './events';

// ---------------------------------------------------------------------------
// Device sessions (sealed, content-addressed records).
// ---------------------------------------------------------------------------
export {
  DeviceSessionContentSchema,
  DeviceSessionRecordSchema,
} from './session';
export type {
  DeviceSessionContent,
  DeviceSessionRecord,
} from './session';

// ---------------------------------------------------------------------------
// Typed session-error taxonomy.
// ---------------------------------------------------------------------------
export { ExperienceRuntimeIssueSchema, ExperienceRuntimeErrorSchema } from './errors';
export type {
  ExperienceRuntimeIssue,
  ExperienceRuntimeError,
  ExperienceRuntimeResult,
} from './errors';

// ---------------------------------------------------------------------------
// Session lifecycle (pure deterministic transitions).
// ---------------------------------------------------------------------------
export {
  OpenDeviceSessionInputSchema,
  openDeviceSession,
  pauseDeviceSession,
  resumeDeviceSession,
  closeDeviceSession,
  mountRenderState,
  advanceVirtualTime,
} from './lifecycle';
export type {
  OpenDeviceSessionInput,
  SessionTransition,
  LifecycleOptions,
} from './lifecycle';

// ---------------------------------------------------------------------------
// Total admission surface.
// ---------------------------------------------------------------------------
export {
  parseDeviceSessionRecord,
  parseRuntimeEventTrace,
  validateFrameSchedule,
} from './parse';
export type { AdmissionOptions } from './parse';

// ---------------------------------------------------------------------------
// Digest discipline (canonical SHA-256 content addressing + tamper detection).
// ---------------------------------------------------------------------------
export {
  serializeDeviceSessionRecord,
  serializeRuntimeEventTrace,
  computeDeviceSessionDigest,
  computeRuntimeEventTraceDigest,
  sealDeviceSession,
  sealRuntimeEventTrace,
  verifyDeviceSessionDigest,
  verifyRuntimeEventTraceDigest,
} from './serialize';

// ---------------------------------------------------------------------------
// Published schema surface + in-package contract emission.
// ---------------------------------------------------------------------------
export { EXPERIENCE_RUNTIME_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  EXPERIENCE_RUNTIME_CONTRACT_DIR,
  renderExperienceRuntimeContractFiles,
  typeToKebabCase,
} from './contract-emission';

// Type-level helpers (compile-time parity discipline).
export type { Equals, Expect } from './type-utils';
