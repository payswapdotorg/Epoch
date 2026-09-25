/**
 * @epoch/experience-runtime — contract versions and closed vocabularies.
 *
 * Versioning policy (v1, mirrors the agent-protocol / experience-protocol
 * discipline): a serialized runtime document (device-session record or
 * event trace) is admitted only when its `protocolVersion` equals
 * {@link EXPERIENCE_RUNTIME_PROTOCOL_VERSION} exactly; skew surfaces as a
 * typed `version-unsupported` admission error (checked before any schema
 * validation, so version skew is always distinguishable from malformed
 * payloads). {@link EXPERIENCE_RUNTIME_CONTRACT_VERSION} versions the
 * in-package contract surface published under
 * `packages/experience-runtime/schemas` (the W007/W008/W009 in-package
 * convention).
 *
 * Provider neutrality (architecture lock rule 13): every vocabulary below
 * names a ROLE, SURFACE, or BOUNDARY — never a vendor, engine, renderer,
 * framework, or API. The host model is typed data only: device sessions
 * carry the W011 device-descriptor vocabulary; the frame/tick scheduling
 * model is integer virtual time (deterministic, testable without real
 * clocks); concrete renderers are future adapters behind the W013
 * renderer-runtime / W019 adaptation boundary.
 */
import { z } from 'zod';

/** Version of the in-package experience-runtime contract surface (packages/experience-runtime/schemas). */
export const EXPERIENCE_RUNTIME_CONTRACT_VERSION = '1.0.0' as const;

/** Protocol version carried by every serialized experience-runtime document. */
export const EXPERIENCE_RUNTIME_PROTOCOL_VERSION = '1.0.0' as const;

/** The protocol version literal type. */
export type ExperienceRuntimeProtocolVersion = typeof EXPERIENCE_RUNTIME_PROTOCOL_VERSION;

export const ExperienceRuntimeProtocolVersionSchema = z
  .literal(EXPERIENCE_RUNTIME_PROTOCOL_VERSION)
  .meta({
    id: 'ExperienceRuntimeProtocolVersion',
    title: 'ExperienceRuntimeProtocolVersion',
    description: 'Exact experience-runtime protocol version admitted by this release ("1.0.0").',
  });

/** Schema-name discriminator carried by every device-session record. */
export const DEVICE_SESSION_SCHEMA_NAME = 'epoch.experience-runtime.device-session' as const;

/** Schema-name discriminator carried by every runtime event trace. */
export const RUNTIME_EVENT_TRACE_SCHEMA_NAME = 'epoch.experience-runtime.event-trace' as const;

/**
 * The document kinds of experience-runtime v1 (manifest inventory; each kind
 * is a distinct serialized document with its own schema discriminator).
 */
export const EXPERIENCE_RUNTIME_DOCUMENT_KINDS = [
  'experience-runtime.device-session',
  'experience-runtime.event-trace',
] as const;

/** One experience-runtime document kind. */
export type ExperienceRuntimeDocumentKind = (typeof EXPERIENCE_RUNTIME_DOCUMENT_KINDS)[number];

/**
 * The lifecycle states of a device session. `active` is the only state in
 * which virtual time advances and render state mounts; `paused` freezes the
 * virtual clock; `closed` is terminal.
 */
export const DEVICE_SESSION_STATES = ['active', 'paused', 'closed'] as const;

/** One device-session lifecycle state. */
export type DeviceSessionState = (typeof DEVICE_SESSION_STATES)[number];

export const DeviceSessionStateSchema = z.enum(DEVICE_SESSION_STATES).meta({
  id: 'DeviceSessionState',
  title: 'DeviceSessionState',
  description: 'Lifecycle state of a device session: active, paused, or closed (terminal).',
});

/**
 * The typed runtime-event kinds, grouped by category (architecture.md
 * "Experience Runtime"): lifecycle events (`session-opened`,
 * `session-paused`, `session-resumed`, `session-closed`), frame events
 * (`frame-started`), tick events (`tick-advanced`), and state events
 * (`state-mounted`).
 */
export const RUNTIME_EVENT_KINDS = [
  'frame-started',
  'session-closed',
  'session-opened',
  'session-paused',
  'session-resumed',
  'state-mounted',
  'tick-advanced',
] as const;

/** One runtime-event kind. */
export type RuntimeEventKind = (typeof RUNTIME_EVENT_KINDS)[number];

export const RuntimeEventKindSchema = z.enum(RUNTIME_EVENT_KINDS).meta({
  id: 'RuntimeEventKind',
  title: 'RuntimeEventKind',
  description:
    'Typed runtime-event kind: frame, tick, state, or lifecycle event of a device session.',
});

/**
 * The typed session-error taxonomy of the experience runtime. Every
 * admission or transition failure is one of these codes (never a bare
 * throw):
 * - `cross-tenant-denied` — session, trace, or operation outside the
 *   owning tenant (R12);
 * - `digest-mismatch` — a sealed record whose claimed SHA-256 digest does
 *   not match its content (tamper detection);
 * - `invalid-transition` — a lifecycle or virtual-time transition applied
 *   in a state that does not admit it (pause a paused session, advance a
 *   closed session, non-positive or oversized delta, ...);
 * - `malformed-record` — schema violations with precise dotted paths
 *   (strict objects also reject unknown/vendor fields here);
 * - `version-unsupported` — protocolVersion skew, checked first.
 */
export const EXPERIENCE_RUNTIME_ERROR_CODES = [
  'cross-tenant-denied',
  'digest-mismatch',
  'invalid-transition',
  'malformed-record',
  'version-unsupported',
] as const;

/** One typed session-error code. */
export type ExperienceRuntimeErrorCode = (typeof EXPERIENCE_RUNTIME_ERROR_CODES)[number];

export const ExperienceRuntimeErrorCodeSchema = z.enum(EXPERIENCE_RUNTIME_ERROR_CODES).meta({
  id: 'ExperienceRuntimeErrorCode',
  title: 'ExperienceRuntimeErrorCode',
  description: 'Typed session-error code of the experience runtime.',
});

// ---------------------------------------------------------------------------
// Determinism bounds (DoS discipline; all limits are integers).
// ---------------------------------------------------------------------------

/** Upper bound on a single virtual-time advance, in virtual milliseconds. */
export const MAX_ADVANCE_MS = 60_000;

/** Upper bound on the frame duration of a frame schedule, in milliseconds. */
export const MAX_FRAME_DURATION_MS = 60_000;

/** Upper bound on the tick cadence (frames per tick) of a frame schedule. */
export const MAX_TICK_CADENCE = 1_000;

/** Upper bound on events per event trace. */
export const MAX_TRACE_EVENTS = 65_536;
