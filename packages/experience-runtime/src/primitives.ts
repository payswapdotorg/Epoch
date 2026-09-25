/**
 * Provider-neutral zod primitives of the experience runtime. Every schema
 * here is a JSON-representable data shape; no field encodes a vendor,
 * engine, renderer, or framework (architecture lock rule 13).
 *
 * Digest machinery (SHA-256, canonical JSON) and the shared protocol
 * primitives are REUSED from @epoch/agent-protocol; the tenant-scope and
 * device-descriptor vocabularies are REUSED from @epoch/experience-protocol
 * (the W011 device vocabulary — genuine runtime consumption, never
 * re-implemented).
 */
import { z } from 'zod';
import { JsonValueSchema, type JsonValue } from '@epoch/agent-protocol';
import {
  DeviceDescriptorSchema,
  OpaqueScopeIdSchema,
  Sha256HexSchema,
  TenantScopeSchema,
  type DeviceDescriptor,
  type OpaqueScopeId,
  type Sha256Hex,
  type TenantScope,
} from '@epoch/experience-protocol';

// Re-export the reused shared primitives for one-stop consumption.
export { JsonValueSchema, type JsonValue };
export { Sha256HexSchema, type Sha256Hex };
export { OpaqueScopeIdSchema, type OpaqueScopeId };
export { TenantScopeSchema, type TenantScope };
export { DeviceDescriptorSchema, type DeviceDescriptor };

/**
 * Device-session identifier: `ds-` + lowercase kebab slug. The identity of
 * one host device session; owned here (the host model) and mirrored as a
 * shared primitive by the renderer hosting surface
 * (@epoch/renderer-runtime), which pins the mirror with compile-time and
 * runtime parity tests.
 */
export const DEVICE_SESSION_ID_PATTERN = /^ds-[a-z0-9][a-z0-9-]{0,62}$/;

export const DeviceSessionIdSchema = z.string().regex(DEVICE_SESSION_ID_PATTERN).meta({
  id: 'DeviceSessionId',
  title: 'DeviceSessionId',
  description: 'Device-session identifier: "ds-" followed by a lowercase slug.',
});

/** One device-session identifier. */
export type DeviceSessionId = z.infer<typeof DeviceSessionIdSchema>;

/**
 * Virtual time in integer milliseconds since the session origin.
 * Deterministic by construction: the runtime NEVER reads a wall clock —
 * virtual time advances only through explicit, caller-supplied deltas.
 */
export const VirtualTimeMsSchema = z.number().int().nonnegative().meta({
  id: 'VirtualTimeMs',
  title: 'VirtualTimeMs',
  description: 'Virtual time in non-negative integer milliseconds since the session origin.',
});

/** One virtual-time value. */
export type VirtualTimeMs = z.infer<typeof VirtualTimeMsSchema>;

/** Frame index within a scheduled device session (0-based). */
export const FrameIndexSchema = z.number().int().nonnegative().meta({
  id: 'FrameIndex',
  title: 'FrameIndex',
  description: '0-based index of a frame within a scheduled device session.',
});

/** One frame index. */
export type FrameIndex = z.infer<typeof FrameIndexSchema>;

/** Tick index within a scheduled device session (0-based). */
export const TickIndexSchema = z.number().int().nonnegative().meta({
  id: 'TickIndex',
  title: 'TickIndex',
  description: '0-based index of a tick within a scheduled device session.',
});

/** One tick index. */
export type TickIndex = z.infer<typeof TickIndexSchema>;

/**
 * Per-session event sequence number (1-based, contiguous, monotonic): the
 * total order of a session's runtime events.
 */
export const EventSequenceSchema = z.number().int().positive().meta({
  id: 'EventSequence',
  title: 'EventSequence',
  description: '1-based contiguous per-session sequence number of a runtime event.',
});

/** One event sequence number. */
export type EventSequence = z.infer<typeof EventSequenceSchema>;
