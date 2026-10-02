/**
 * The PORTABLE VIEW STATE of a renderer session (W056) — the subset of
 * presentation state that survives a renderer switch because it is
 * represented by existing Epoch contracts (the switching invariant of
 * spec/renderer-fabric-architecture.md):
 *
 * - semantic focus (which entities are focused);
 * - semantic layer visibility (which semantic layers are shown/hidden);
 * - the timeline/replay position (where portable);
 * - the camera viewpoint (best effort — presentation-only, an existing
 *   W016 contract shape).
 *
 * Everything else a renderer holds (provider-native scene graphs, caches,
 * handles, local camera interpolation) is DISPOSABLE presentation state.
 * A switch recreates presentation from the canonical Epoch projection and
 * restores exactly this portable subset.
 *
 * The camera and timeline shapes are MIRRORED W016 grammars (canonical
 * home: @epoch/world-experience — CameraState and SceneTimelinePosition),
 * built from the shared W011 primitives (Vec3, Quaternion,
 * ProjectedAgentRef, ReplayWindow) this package already consumes at
 * runtime. The mirrors are pinned member-for-member by compile-time and
 * runtime parity tests in @epoch/renderer-fabric (which genuinely depends
 * on both packages — the W011 kernel-parity devDependency pattern).
 */
import { z } from 'zod';
import {
  ProjectedAgentRefSchema,
  QuaternionSchema,
  ReplayWindowSchema,
  Vec3Schema,
} from '@epoch/experience-protocol';
import {
  MAX_PORTABLE_ENTITY_IDS,
  MAX_PORTABLE_FOCUSED_ENTITIES,
  MAX_PORTABLE_LAYERS,
} from './version';
import {
  SemanticLayerIdSchema,
  WorldEntityIdMirrorSchema,
} from './fabric-primitives';

// ---------------------------------------------------------------------------
// Mirrored W016 camera grammar (canonical home: @epoch/world-experience).
// ---------------------------------------------------------------------------

/** Mirrored W016 follow-cursor state (canonical home: world-experience). */
export const PortableFollowCursorStateSchema = z
  .strictObject({
    position2d: z
      .strictObject({
        x: z.number().finite(),
        y: z.number().finite(),
      })
      .optional(),
    position3d: Vec3Schema.optional(),
    atMs: z.number().int().nonnegative().optional(),
  })
  .superRefine((cursor, ctx) => {
    if (cursor.position2d === undefined && cursor.position3d === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a follow cursor must carry position2d or position3d',
        path: [],
      });
    }
  })
  .meta({
    id: 'PortableFollowCursorState',
    title: 'PortableFollowCursorState',
    description:
      'The followed agent cursor state (mirrored W016 grammar): a 2D or 3D position at a virtual time.',
  });

/** One mirrored follow-cursor state. */
export type PortableFollowCursorState = z.infer<typeof PortableFollowCursorStateSchema>;

/** Mirrored W016 orbit camera (canonical home: world-experience). */
export const PortableOrbitCameraSchema = z
  .strictObject({
    mode: z.literal('orbit'),
    position: Vec3Schema,
    orientation: QuaternionSchema.optional(),
    target: Vec3Schema.optional(),
    fovRadians: z.number().finite().positive().max(Math.PI).optional(),
  })
  .meta({
    id: 'PortableOrbitCamera',
    title: 'PortableOrbitCamera',
    description:
      'The orbit camera state (mirrored W016 grammar): viewpoint, optional target and FOV.',
  });

/** One mirrored orbit camera. */
export type PortableOrbitCamera = z.infer<typeof PortableOrbitCameraSchema>;

/** Mirrored W016 free camera (canonical home: world-experience). */
export const PortableFreeCameraSchema = z
  .strictObject({
    mode: z.literal('free'),
    position: Vec3Schema,
    orientation: QuaternionSchema.optional(),
  })
  .meta({
    id: 'PortableFreeCamera',
    title: 'PortableFreeCamera',
    description: 'The free camera state (mirrored W016 grammar): an unconstrained viewpoint.',
  });

/** One mirrored free camera. */
export type PortableFreeCamera = z.infer<typeof PortableFreeCameraSchema>;

/** Mirrored W016 follow-agent camera (canonical home: world-experience). */
export const PortableFollowAgentCameraSchema = z
  .strictObject({
    mode: z.literal('follow-agent'),
    agentRef: ProjectedAgentRefSchema,
    followDistance: z.number().finite().positive().optional(),
    cursor: PortableFollowCursorStateSchema.optional(),
  })
  .meta({
    id: 'PortableFollowAgentCamera',
    title: 'PortableFollowAgentCamera',
    description:
      'The follow-agent camera state (mirrored W016 grammar): the view rides a projected agent.',
  });

/** One mirrored follow-agent camera. */
export type PortableFollowAgentCamera = z.infer<typeof PortableFollowAgentCameraSchema>;

/** Mirrored W016 camera-state union (discriminated on `mode`). */
export const PortableCameraStateSchema = z
  .discriminatedUnion('mode', [
    PortableFollowAgentCameraSchema,
    PortableFreeCameraSchema,
    PortableOrbitCameraSchema,
  ])
  .meta({
    id: 'PortableCameraState',
    title: 'PortableCameraState',
    description:
      'The portable camera state (mirrored W016 grammar): orbit, free, or follow-agent.',
  });

/** One portable camera state. */
export type PortableCameraState = z.infer<typeof PortableCameraStateSchema>;

// ---------------------------------------------------------------------------
// Mirrored W016 timeline-position grammar (canonical home:
// @epoch/world-experience).
// ---------------------------------------------------------------------------

/** Mirrored W016 scene timeline/replay position (canonical home: world-experience). */
export const PortableTimelinePositionSchema = z
  .strictObject({
    atMs: z.number().int().nonnegative(),
    frameIndex: z.number().int().nonnegative(),
    paused: z.boolean(),
    replayWindow: ReplayWindowSchema.optional(),
  })
  .meta({
    id: 'PortableTimelinePosition',
    title: 'PortableTimelinePosition',
    description:
      'The portable timeline/replay position (mirrored W016 grammar): virtual time, frame index, paused flag, optional replay window.',
  });

/** One portable timeline position. */
export type PortableTimelinePosition = z.infer<typeof PortableTimelinePositionSchema>;

// ---------------------------------------------------------------------------
// Semantic layer visibility (fabric-owned portable vocabulary).
// ---------------------------------------------------------------------------

/** The visibility of one semantic layer of the world experience projection. */
export const SemanticLayerVisibilitySchema = z
  .strictObject({
    layerId: SemanticLayerIdSchema,
    visible: z.boolean(),
  })
  .meta({
    id: 'SemanticLayerVisibility',
    title: 'SemanticLayerVisibility',
    description:
      'The visibility of one semantic layer (vocabulary owned by the world experience projection).',
  });

/** One semantic-layer visibility record. */
export type SemanticLayerVisibility = z.infer<typeof SemanticLayerVisibilitySchema>;

// ---------------------------------------------------------------------------
// The portable view state.
// ---------------------------------------------------------------------------

/**
 * The portable view state of a renderer session: semantic focus, semantic
 * layer visibility, the timeline/replay position, and the best-effort
 * camera viewpoint — the presentation subset represented by existing Epoch
 * contracts that survives a renderer switch. Every collection is sorted and
 * duplicate-free (deterministic serialization, stable digests).
 */
export const PortableViewStateSchema = z
  .strictObject({
    /** Semantic focus: sorted, duplicate-free focused entity ids. */
    focusedEntityIds: z
      .array(WorldEntityIdMirrorSchema)
      .max(MAX_PORTABLE_FOCUSED_ENTITIES)
      .refine(
        (ids) => ids.every((id, i) => i === 0 || id > ids[i - 1]),
        'focusedEntityIds must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    /** Semantic layer visibility, sorted by layerId (deterministic). */
    layerVisibility: z
      .array(SemanticLayerVisibilitySchema)
      .max(MAX_PORTABLE_LAYERS)
      .refine(
        (layers) => layers.every((l, i) => i === 0 || l.layerId > layers[i - 1].layerId),
        'layerVisibility must be sorted by layerId ascending and duplicate-free (deterministic set semantics)',
      ),
    /** The timeline/replay position (portable where the track allows). */
    timelinePosition: PortableTimelinePositionSchema,
    /** The best-effort camera viewpoint (presentation-only, mirrored W016 grammar). */
    camera: PortableCameraStateSchema.optional(),
    /**
     * Entity ids hidden by presentation-side view filters, sorted
     * duplicate-free (isolate/hide presentation state — never semantic).
     */
    hiddenEntityIds: z
      .array(WorldEntityIdMirrorSchema)
      .max(MAX_PORTABLE_ENTITY_IDS)
      .refine(
        (ids) => ids.every((id, i) => i === 0 || id > ids[i - 1]),
        'hiddenEntityIds must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
  })
  .superRefine((state, ctx) => {
    // Focus and hidden are disjoint presentation sets (an entity is either
    // presented or hidden — a record claiming both is inconsistent).
    const hidden = new Set<string>(state.hiddenEntityIds);
    for (const id of state.focusedEntityIds) {
      if (hidden.has(id)) {
        ctx.addIssue({
          code: 'custom',
          message: `entity "${id}" is both focused and hidden — inconsistent portable view state`,
          path: ['focusedEntityIds'],
        });
        return;
      }
    }
  })
  .meta({
    id: 'PortableViewState',
    title: 'PortableViewState',
    description:
      'The portable view state of a renderer session: semantic focus, semantic layer visibility, timeline position, hidden set, and best-effort camera — the presentation subset that survives a renderer switch.',
  });

/** One portable view state. */
export type PortableViewState = z.infer<typeof PortableViewStateSchema>;

/** The empty portable view state (no focus, no layers, paused at frame 0). */
export function emptyPortableViewState(atMs: number): PortableViewState {
  return {
    focusedEntityIds: [],
    layerVisibility: [],
    timelinePosition: { atMs, frameIndex: 0, paused: true },
    hiddenEntityIds: [],
  };
}
