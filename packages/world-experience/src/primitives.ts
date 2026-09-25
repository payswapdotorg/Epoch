/**
 * Provider-neutral zod primitives of the world experience layer. Every
 * schema here is a JSON-representable data shape; no field encodes a
 * vendor, engine, renderer, or framework (architecture lock rule 13).
 *
 * Digest machinery (SHA-256, canonical JSON) and the shared grammar
 * primitives are REUSED from @epoch/agent-protocol, and the experience
 * vocabularies (tenant scopes, vectors, quaternions, property paths,
 * projected references, device descriptors) are REUSED from
 * @epoch/experience-protocol — the pinned runtime dependencies — never
 * re-implemented.
 *
 * Mirrored grammars (pinned by runtime parity tests, never re-defined
 * authoritatively here):
 * - `WORLD_ENTITY_ID` mirrors the canonical world-model EntityId grammar
 *   (@epoch/world-model, W002 — opaque caller-assigned identity); pinned
 *   by test/world-parity.test.ts which materializes real entities through
 *   the WorldModel API and flows them into scenes;
 * - `WorldRendererSessionId` mirrors the W013 RendererSessionId grammar
 *   (@epoch/renderer-runtime) — the sessions the emitted mount/advance/
 *   submit envelopes target; pinned by test/renderer-parity.test.ts;
 * - `WorldInvocationId` re-instantiates the shared message-id grammar the
 *   W013 InvocationId itself re-instantiates (the documented W013 mirror
 *   of @epoch/experience-runtime).
 */
import { z } from 'zod';
import { MESSAGE_ID_PATTERN } from '@epoch/agent-protocol';
import {
  ColorHexSchema,
  DeviceClassSchema,
  DeviceDescriptorSchema,
  DeviceDisplayCapabilitiesSchema,
  DeviceSpatialCapabilitiesSchema,
  ExperienceGraphIdSchema,
  ExperienceGraphKindSchema,
  ExperienceNodeIdSchema,
  InteractionModalitySchema,
  JsonValueSchema,
  OpaqueScopeIdSchema,
  PoseTrackingKindSchema,
  ProjectedAgentRefSchema,
  ProjectedEvidenceRefSchema,
  ProjectedWorldEntityRefSchema,
  QuaternionSchema,
  Sha256HexSchema,
  TenantScopeSchema,
  Vec3Schema,
  type ColorHex,
  type DeviceClass,
  type DeviceDescriptor,
  type DeviceDisplayCapabilities,
  type DeviceSpatialCapabilities,
  type ExperienceGraphId,
  type ExperienceGraphKind,
  type ExperienceNodeId,
  type InteractionModality,
  type JsonValue,
  type OpaqueScopeId,
  type PoseTrackingKind,
  type ProjectedAgentRef,
  type ProjectedEvidenceRef,
  type ProjectedWorldEntityRef,
  type Quaternion,
  type Sha256Hex,
  type TenantScope,
  type Vec3,
} from '@epoch/experience-protocol';

// Re-export the reused shared primitives for one-stop consumption.
export { JsonValueSchema, type JsonValue };
export { Sha256HexSchema, type Sha256Hex };
export { OpaqueScopeIdSchema, type OpaqueScopeId };
export { TenantScopeSchema, type TenantScope };
export { ColorHexSchema, type ColorHex };
export { Vec3Schema, type Vec3 };
export { QuaternionSchema, type Quaternion };
export { DeviceDescriptorSchema, type DeviceDescriptor };
export { DeviceClassSchema, type DeviceClass };
export { DeviceDisplayCapabilitiesSchema, type DeviceDisplayCapabilities };
export { DeviceSpatialCapabilitiesSchema, type DeviceSpatialCapabilities };
export { PoseTrackingKindSchema, type PoseTrackingKind };
export { InteractionModalitySchema, type InteractionModality };
export { ProjectedWorldEntityRefSchema, type ProjectedWorldEntityRef };
export { ProjectedAgentRefSchema, type ProjectedAgentRef };
export { ProjectedEvidenceRefSchema, type ProjectedEvidenceRef };
export { ExperienceGraphIdSchema, type ExperienceGraphId };
export { ExperienceGraphKindSchema, type ExperienceGraphKind };
export { ExperienceNodeIdSchema, type ExperienceNodeId };

/**
 * World-scene identifier: `wsc-` + lowercase kebab slug. Stable identity of
 * one interactive world scene; revisions are addressed by content digest.
 */
export const WORLD_SCENE_ID_PATTERN = /^wsc-[a-z0-9][a-z0-9-]{0,62}$/;

export const WorldSceneIdSchema = z.string().regex(WORLD_SCENE_ID_PATTERN).meta({
  id: 'WorldSceneId',
  title: 'WorldSceneId',
  description: 'World-scene identifier: "wsc-" followed by a lowercase slug.',
});

/** One world-scene identifier. */
export type WorldSceneId = z.infer<typeof WorldSceneIdSchema>;

/**
 * Visual-overlay identifier: `ovl-` + lowercase kebab slug. Identity of one
 * overlay in a scene's overlay library.
 */
export const WORLD_OVERLAY_ID_PATTERN = /^ovl-[a-z0-9][a-z0-9-]{0,62}$/;

export const WorldOverlayIdSchema = z.string().regex(WORLD_OVERLAY_ID_PATTERN).meta({
  id: 'WorldOverlayId',
  title: 'WorldOverlayId',
  description: 'Visual-overlay identifier: "ovl-" followed by a lowercase slug.',
});

/** One visual-overlay identifier. */
export type WorldOverlayId = z.infer<typeof WorldOverlayIdSchema>;

/**
 * Ontology-record identifier: `ont-` + lowercase kebab slug. Identity of
 * one pack-contributed domain visual ontology record.
 */
export const WORLD_ONTOLOGY_RECORD_ID_PATTERN = /^ont-[a-z0-9][a-z0-9-]{0,62}$/;

export const WorldOntologyRecordIdSchema = z
  .string()
  .regex(WORLD_ONTOLOGY_RECORD_ID_PATTERN)
  .meta({
    id: 'WorldOntologyRecordId',
    title: 'WorldOntologyRecordId',
    description: 'Ontology-record identifier: "ont-" followed by a lowercase slug.',
  });

/** One ontology-record identifier. */
export type WorldOntologyRecordId = z.infer<typeof WorldOntologyRecordIdSchema>;

/**
 * Scene-entity identifier — MIRRORED shared grammar (canonical home:
 * @epoch/world-model W002 EntityId: opaque caller-assigned identity,
 * 1..256 chars). Pinned member-for-member by the runtime parity test that
 * materializes real world-model entities into scenes.
 */
export const WorldEntityIdSchema = z
  .string()
  .min(1)
  .max(256)
  .meta({
    id: 'WorldEntityId',
    title: 'WorldEntityId',
    description:
      'Opaque world-entity identity (mirrored shared grammar; canonical home @epoch/world-model): 1..256 chars, caller-assigned.',
  });

/** One scene-entity identifier (mirrored world-model grammar). */
export type WorldEntityId = z.infer<typeof WorldEntityIdSchema>;

/**
 * Renderer-session identifier — MIRRORED shared grammar (canonical home:
 * @epoch/renderer-runtime W013: `rs-` + lowercase kebab slug). The
 * renderer sessions the emitted invocation envelopes target. Pinned by the
 * renderer parity test against the real W013 schema.
 */
export const WORLD_RENDERER_SESSION_ID_PATTERN = /^rs-[a-z0-9][a-z0-9-]{0,62}$/;

export const WorldRendererSessionIdSchema = z
  .string()
  .regex(WORLD_RENDERER_SESSION_ID_PATTERN)
  .meta({
    id: 'WorldRendererSessionId',
    title: 'WorldRendererSessionId',
    description:
      'Renderer-session identifier (mirrored shared grammar; canonical home @epoch/renderer-runtime): "rs-" + lowercase slug.',
  });

/** One renderer-session identifier (mirrored W013 grammar). */
export type WorldRendererSessionId = z.infer<typeof WorldRendererSessionIdSchema>;

/**
 * Invocation identifier — the shared message-id grammar, re-instantiated
 * (the same mirror @epoch/renderer-runtime performs for its InvocationId;
 * re-instantiated so the shared schema instance is never mutated).
 * Caller-scoped: replays of one invocation produce identical envelopes.
 */
export const WorldInvocationIdSchema = z.string().regex(MESSAGE_ID_PATTERN).meta({
  id: 'WorldInvocationId',
  title: 'WorldInvocationId',
  description:
    'Opaque invocation identifier (shared message-id grammar), unique within the caller scope.',
});

/** One invocation identifier. */
export type WorldInvocationId = z.infer<typeof WorldInvocationIdSchema>;

/**
 * Bounded non-negative integer milliseconds (virtual time). The world
 * experience layer consumes caller-supplied virtual times only; it never
 * reads a wall clock (determinism).
 */
export const WorldVirtualTimeMsSchema = z.number().int().nonnegative().meta({
  id: 'WorldVirtualTimeMs',
  title: 'WorldVirtualTimeMs',
  description: 'Virtual time in non-negative integer milliseconds (caller-supplied; never a wall clock).',
});

/** One virtual-time value. */
export type WorldVirtualTimeMs = z.infer<typeof WorldVirtualTimeMsSchema>;
