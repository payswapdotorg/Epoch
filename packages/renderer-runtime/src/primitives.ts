/**
 * Provider-neutral zod primitives of the renderer hosting surface. Every
 * schema here is a JSON-representable data shape; no field encodes a
 * vendor, engine, renderer, or framework (architecture lock rule 13).
 *
 * Digest machinery (SHA-256, canonical JSON) and the invocation-id
 * grammar are REUSED from @epoch/agent-protocol; the tenant-scope,
 * device-descriptor, graph-kind, interaction-modality, and control-intent
 * vocabularies are REUSED from @epoch/experience-protocol (the consumed
 * W011 vocabulary — genuine runtime consumption, never re-implemented).
 *
 * The device-session id grammar is a MIRRORED shared primitive whose
 * canonical home is @epoch/experience-runtime (W013 host model); the
 * mirror is pinned member-for-member by compile-time and runtime parity
 * tests (src/host-parity.ts, test/host-parity.test.ts — the W011
 * kernel-parity devDependency pattern).
 */
import { z } from 'zod';
import { JsonValueSchema, MESSAGE_ID_PATTERN } from '@epoch/agent-protocol';
import {
  ControlIntentSchema,
  DeviceClassSchema,
  DeviceDescriptorSchema,
  DeviceDisplayCapabilitiesSchema,
  DeviceSpatialCapabilitiesSchema,
  ExperienceGraphKindSchema,
  ExperienceIssueSchema,
  ExperienceProtocolErrorSchema,
  InteractionModalitySchema,
  OpaqueScopeIdSchema,
  PoseTrackingKindSchema,
  Sha256HexSchema,
  TenantScopeSchema,
  type ControlIntent,
  type DeviceClass,
  type DeviceDescriptor,
  type DeviceDisplayCapabilities,
  type DeviceSpatialCapabilities,
  type ExperienceGraphKind,
  type ExperienceIssue,
  type ExperienceProtocolError,
  type InteractionModality,
  type JsonValue,
  type OpaqueScopeId,
  type PoseTrackingKind,
  type Sha256Hex,
  type TenantScope,
} from '@epoch/experience-protocol';

// Re-export the reused shared primitives for one-stop consumption.
export { JsonValueSchema, type JsonValue };
export { Sha256HexSchema, type Sha256Hex };
export { OpaqueScopeIdSchema, type OpaqueScopeId };
export { TenantScopeSchema, type TenantScope };
export { DeviceDescriptorSchema, type DeviceDescriptor };
export { DeviceClassSchema, type DeviceClass };
export { DeviceDisplayCapabilitiesSchema, type DeviceDisplayCapabilities };
export { DeviceSpatialCapabilitiesSchema, type DeviceSpatialCapabilities };
export { PoseTrackingKindSchema, type PoseTrackingKind };
export { ExperienceGraphKindSchema, type ExperienceGraphKind };
export { ExperienceIssueSchema, type ExperienceIssue };
export { ExperienceProtocolErrorSchema, type ExperienceProtocolError };
export { InteractionModalitySchema, type InteractionModality };
export { ControlIntentSchema, type ControlIntent };
export { MessageIdSchema, type MessageId } from '@epoch/agent-protocol';

/**
 * Renderer identifier: `rr-` + lowercase kebab slug. Names an abstract
 * renderer DESCRIPTOR identity (never a vendor product): the same neutral
 * identity across revisions of one renderer's capability declaration.
 */
export const RENDERER_ID_PATTERN = /^rr-[a-z0-9][a-z0-9-]{0,62}$/;

export const RendererIdSchema = z.string().regex(RENDERER_ID_PATTERN).meta({
  id: 'RendererId',
  title: 'RendererId',
  description: 'Renderer-descriptor identifier: "rr-" followed by a lowercase slug (never a vendor product).',
});

/** One renderer identifier. */
export type RendererId = z.infer<typeof RendererIdSchema>;

/**
 * Renderer-session identifier: `rs-` + lowercase kebab slug. The identity
 * of one renderer session binding (descriptor x device session).
 */
export const RENDERER_SESSION_ID_PATTERN = /^rs-[a-z0-9][a-z0-9-]{0,62}$/;

export const RendererSessionIdSchema = z.string().regex(RENDERER_SESSION_ID_PATTERN).meta({
  id: 'RendererSessionId',
  title: 'RendererSessionId',
  description: 'Renderer-session identifier: "rs-" followed by a lowercase slug.',
});

/** One renderer-session identifier. */
export type RendererSessionId = z.infer<typeof RendererSessionIdSchema>;

/**
 * Device-session identifier: `ds-` + lowercase kebab slug — MIRRORED
 * shared primitive (canonical home: @epoch/experience-runtime, W013 host
 * model). Pinned by parity tests; see the module docs.
 */
export const DEVICE_SESSION_ID_PATTERN = /^ds-[a-z0-9][a-z0-9-]{0,62}$/;

export const DeviceSessionIdSchema = z.string().regex(DEVICE_SESSION_ID_PATTERN).meta({
  id: 'DeviceSessionId',
  title: 'DeviceSessionId',
  description:
    'Device-session identifier (mirrored shared primitive; canonical home @epoch/experience-runtime): "ds-" + lowercase slug.',
});

/** One device-session identifier (mirrored shared primitive). */
export type DeviceSessionId = z.infer<typeof DeviceSessionIdSchema>;

/**
 * Invocation identifier: an opaque bounded id (the shared message-id
 * grammar, re-instantiated so the shared schema instance is never
 * mutated). Invocation ids are caller-scoped: replays of the same
 * invocation produce identical receipts (idempotent, content-addressed
 * execution evidence).
 */
export const InvocationIdSchema = z.string().regex(MESSAGE_ID_PATTERN).meta({
  id: 'InvocationId',
  title: 'InvocationId',
  description: 'Opaque invocation identifier (shared message-id grammar), unique within the caller scope.',
});

/** One invocation identifier. */
export type InvocationId = z.infer<typeof InvocationIdSchema>;

/**
 * Virtual time in integer milliseconds — MIRRORED shared primitive
 * (canonical home: @epoch/experience-runtime, W013 host model). The
 * hosting surface consumes caller-supplied virtual times only; it never
 * reads a wall clock.
 */
export const VirtualTimeMsSchema = z.number().int().nonnegative().meta({
  id: 'VirtualTimeMs',
  title: 'VirtualTimeMs',
  description:
    'Virtual time in non-negative integer milliseconds (mirrored shared primitive; canonical home @epoch/experience-runtime).',
});

/** One virtual-time value. */
export type VirtualTimeMs = z.infer<typeof VirtualTimeMsSchema>;
