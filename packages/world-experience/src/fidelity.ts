/**
 * Typed fidelity projections for device adaptation
 * (spec/experience-architecture "Device adaptation" — binding): same
 * semantics, different fidelity — desktop = full, web = normal, mobile =
 * field, low = 2D/reduced, remote = optional remote rendering.
 *
 * Fidelity is a typed PROJECTION concern: {@link projectWorldScene} is a
 * pure function that shapes one scene's presented aspects to a profile's
 * declared limits. The semantics (which entities, which evidence, which
 * narrative) never change — only the presented aspect counts do, and every
 * reduction is recorded explicitly in the projection record
 * ({@link FidelityReduction}) so fidelity shaping is never SILENT
 * degradation (the W012 device-budget discipline applied to projection:
 * the deltas are typed data, deterministically truncated in canonical
 * order).
 */
import { z } from 'zod';
import {
  TenantScopeSchema,
  type TenantScope,
} from '@epoch/experience-protocol';
import {
  WORLD_FIDELITY_SCHEMA_NAME,
  WorldFidelityLevelSchema,
  type WorldFidelityLevel,
} from './version';
import {
  WorldSceneIdSchema,
  WorldVirtualTimeMsSchema,
  type WorldSceneId,
} from './primitives';
import { CameraStateSchema, type CameraState } from './camera';
import { malformedRecordError } from './issues';
import type { WorldExperienceResult } from './errors';
import type { WorldScene } from './scene';

// ---------------------------------------------------------------------------
// The fidelity profile table (the binding device-adaptation semantics).
// ---------------------------------------------------------------------------

/** How much presence detail a fidelity level presents. */
export type PresenceDetail = 'full' | 'none' | 'seats';

/** How much narrative detail a fidelity level presents. */
export type NarrativeDetail = 'full' | 'headlines' | 'none';

/** The typed capability envelope of one fidelity level. */
export interface WorldFidelityProfile {
  /** The fidelity level this profile declares. */
  readonly fidelity: WorldFidelityLevel;
  /** Whether 3D spatial presentation is requested (low = 2D/reduced). */
  readonly spatial: boolean;
  /** Maximum applied overlays presented at this fidelity. */
  readonly maxAppliedOverlays: number;
  /** Maximum animation instructions presented at this fidelity. */
  readonly maxAnimationInstructions: number;
  /** Maximum timeline markers presented at this fidelity. */
  readonly maxMarkers: number;
  /** Presence presentation detail. */
  readonly presenceDetail: PresenceDetail;
  /** Narrative presentation detail. */
  readonly narrativeDetail: NarrativeDetail;
  /** Whether remote rendering is requested (optional). */
  readonly remoteRendering: boolean;
}

/**
 * The canonical fidelity profile table — the typed device-adaptation
 * semantics (desktop=full, web=normal, mobile=field, low=2D/reduced,
 * remote=optional). Frozen data, never environment-sniffed: the HOST
 * chooses the level; this layer projects.
 */
export const WORLD_FIDELITY_PROFILES: Readonly<
  Record<WorldFidelityLevel, WorldFidelityProfile>
> = {
  desktop: {
    fidelity: 'desktop',
    spatial: true,
    maxAppliedOverlays: 64,
    maxAnimationInstructions: 128,
    maxMarkers: 512,
    presenceDetail: 'full',
    narrativeDetail: 'full',
    remoteRendering: false,
  },
  web: {
    fidelity: 'web',
    spatial: true,
    maxAppliedOverlays: 16,
    maxAnimationInstructions: 32,
    maxMarkers: 256,
    presenceDetail: 'seats',
    narrativeDetail: 'full',
    remoteRendering: false,
  },
  mobile: {
    fidelity: 'mobile',
    spatial: true,
    maxAppliedOverlays: 8,
    maxAnimationInstructions: 8,
    maxMarkers: 128,
    presenceDetail: 'seats',
    narrativeDetail: 'headlines',
    remoteRendering: false,
  },
  low: {
    fidelity: 'low',
    spatial: false,
    maxAppliedOverlays: 4,
    maxAnimationInstructions: 0,
    maxMarkers: 64,
    presenceDetail: 'none',
    narrativeDetail: 'headlines',
    remoteRendering: false,
  },
  remote: {
    fidelity: 'remote',
    spatial: true,
    maxAppliedOverlays: 64,
    maxAnimationInstructions: 128,
    maxMarkers: 512,
    presenceDetail: 'full',
    narrativeDetail: 'full',
    remoteRendering: true,
  },
};

/** The canonical profile of one fidelity level (pure lookup). */
export function fidelityProfileOf(level: WorldFidelityLevel): WorldFidelityProfile {
  return WORLD_FIDELITY_PROFILES[level];
}

// ---------------------------------------------------------------------------
// The fidelity projection record.
// ---------------------------------------------------------------------------

/** Which aspects of a scene the fidelity projection can reduce. */
export const FIDELITY_ASPECTS = [
  'animation-instructions',
  'applied-overlays',
  'narrative-blocks',
  'presence-participants',
  'spatial-presentation',
  'timeline-markers',
] as const;

/** One presentable aspect. */
export type FidelityAspect = (typeof FIDELITY_ASPECTS)[number];

/** Why one aspect was reduced (typed reason vocabulary). */
export const FIDELITY_REDUCTION_REASONS = [
  'fidelity-max-animation-instructions',
  'fidelity-max-applied-overlays',
  'fidelity-max-timeline-markers',
  'fidelity-narrative-detail',
  'fidelity-presence-detail',
  'fidelity-spatial-disabled',
] as const;

/** One reduction reason. */
export type FidelityReductionReason = (typeof FIDELITY_REDUCTION_REASONS)[number];

/**
 * One explicit fidelity reduction: which aspect shrank, from how many to
 * how many, and the typed reason. Reductions are never silent.
 */
export const FidelityReductionSchema = z
  .strictObject({
    aspect: z.enum(FIDELITY_ASPECTS),
    reason: z.enum(FIDELITY_REDUCTION_REASONS),
    encountered: z.number().int().nonnegative(),
    retained: z.number().int().nonnegative(),
  })
  .meta({
    id: 'FidelityReduction',
    title: 'FidelityReduction',
    description:
      'One explicit fidelity reduction: aspect, typed reason, encountered vs retained counts (never silent degradation).',
  });

/** One fidelity reduction. */
export type FidelityReduction = z.infer<typeof FidelityReductionSchema>;

/** The fidelity projection of one world scene (typed, deterministic). */
export const WorldSceneFidelityProjectionSchema = z
  .strictObject({
    schema: z.literal(WORLD_FIDELITY_SCHEMA_NAME),
    protocolVersion: z.literal('1.0.0'),
    sceneId: WorldSceneIdSchema,
    tenantScope: TenantScopeSchema,
    fidelity: WorldFidelityLevelSchema,
    spatial: z.boolean(),
    remoteRendering: z.boolean(),
    entityIds: z.array(z.string().min(1).max(256)),
    focusedEntityIds: z.array(z.string().min(1).max(256)),
    appliedOverlayIds: z.array(z.string().regex(/^ovl-[a-z0-9][a-z0-9-]{0,62}$/)),
    animationInstructionIds: z.array(z.string().regex(/^ani-[a-z0-9][a-z0-9-]{0,62}$/)),
    markerIds: z.array(z.string().regex(/^mrk-[a-z0-9][a-z0-9-]{0,62}$/)),
    narrativeBlockIds: z.array(z.string().regex(/^nrb-[a-z0-9][a-z0-9-]{0,62}$/)),
    presenceParticipantIds: z.array(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/)),
    camera: CameraStateSchema,
    positionAtMs: WorldVirtualTimeMsSchema,
    paused: z.boolean(),
    reductions: z.array(FidelityReductionSchema),
  })
  .meta({
    id: 'WorldSceneFidelityProjection',
    title: 'WorldSceneFidelityProjection',
    description:
      'The typed fidelity projection of one world scene: same semantics, explicit aspect reductions, deterministic truncation in canonical order.',
  });

/** One fidelity projection. */
export type WorldSceneFidelityProjection = z.infer<typeof WorldSceneFidelityProjectionSchema>;

/** The typed truncation helper: keep the first `limit` in canonical order. */
function truncate<T>(items: readonly T[], limit: number): { readonly retained: readonly T[] } {
  return { retained: limit >= items.length ? items : items.slice(0, limit) };
}

/**
 * Project one world scene to a fidelity level (pure, deterministic).
 * Truncations keep the FIRST entries in the scene's canonical (sorted)
 * order; every reduction is recorded explicitly in the projection record.
 * The projection never mutates the scene and never changes its semantics.
 */
export function projectWorldScene(
  scene: WorldScene,
  level: WorldFidelityLevel,
): WorldExperienceResult<WorldSceneFidelityProjection> {
  const profile = fidelityProfileOf(level);
  const reductions: FidelityReduction[] = [];

  const overlays = truncate(
    scene.appliedOverlays.map((a) => a.overlayId),
    profile.maxAppliedOverlays,
  );
  if (overlays.retained.length < scene.appliedOverlays.length) {
    reductions.push({
      aspect: 'applied-overlays',
      reason: 'fidelity-max-applied-overlays',
      encountered: scene.appliedOverlays.length,
      retained: overlays.retained.length,
    });
  }

  const animations = truncate(
    scene.animations.map((a) => a.instructionId),
    profile.maxAnimationInstructions,
  );
  if (animations.retained.length < scene.animations.length) {
    reductions.push({
      aspect: 'animation-instructions',
      reason: 'fidelity-max-animation-instructions',
      encountered: scene.animations.length,
      retained: animations.retained.length,
    });
  }

  const markers = truncate(
    scene.timeline.markers.map((m) => m.markerId),
    profile.maxMarkers,
  );
  if (markers.retained.length < scene.timeline.markers.length) {
    reductions.push({
      aspect: 'timeline-markers',
      reason: 'fidelity-max-timeline-markers',
      encountered: scene.timeline.markers.length,
      retained: markers.retained.length,
    });
  }

  let narrativeBlockIds = scene.narrativeBlocks.map((b) => b.blockId);
  if (profile.narrativeDetail === 'headlines') {
    const titlesOnly = scene.narrativeBlocks.filter((b) => b.body === undefined).map((b) => b.blockId);
    if (titlesOnly.length !== narrativeBlockIds.length) {
      reductions.push({
        aspect: 'narrative-blocks',
        reason: 'fidelity-narrative-detail',
        encountered: narrativeBlockIds.length,
        retained: titlesOnly.length,
      });
      narrativeBlockIds = titlesOnly;
    }
  } else if (profile.narrativeDetail === 'none') {
    if (narrativeBlockIds.length > 0) {
      reductions.push({
        aspect: 'narrative-blocks',
        reason: 'fidelity-narrative-detail',
        encountered: narrativeBlockIds.length,
        retained: 0,
      });
      narrativeBlockIds = [];
    }
  }

  let presenceParticipantIds = scene.participants.map((p) => p.participantId);
  // Presence items presented at this detail: participant seats plus the
  // followed agent's live cursor (when the camera follows an agent).
  const followedCamera = scene.camera.mode === 'follow-agent' ? scene.camera : null;
  const followedCursor = followedCamera !== null && followedCamera.cursor !== undefined ? 1 : 0;
  const presenceEncountered = presenceParticipantIds.length + followedCursor;
  let presenceRetained = presenceEncountered;
  let camera: CameraState = scene.camera;
  if (followedCamera !== null && followedCamera.cursor !== undefined) {
    if (profile.presenceDetail === 'seats') {
      // Seats-only detail: keep the seats, drop live cursor activity.
      const { cursor: _dropped, ...rest } = followedCamera;
      void _dropped;
      camera = rest;
      presenceRetained -= 1;
    } else if (profile.presenceDetail === 'none') {
      const { cursor: _dropped, ...rest } = followedCamera;
      void _dropped;
      camera = rest;
    }
  }
  if (profile.presenceDetail === 'none' && presenceEncountered > 0) {
    presenceParticipantIds = [];
    presenceRetained = 0;
  }
  if (presenceRetained < presenceEncountered) {
    reductions.push({
      aspect: 'presence-participants',
      reason: 'fidelity-presence-detail',
      encountered: presenceEncountered,
      retained: presenceRetained,
    });
  }

  if (!profile.spatial && scene.entities.length > 0) {
    reductions.push({
      aspect: 'spatial-presentation',
      reason: 'fidelity-spatial-disabled',
      encountered: scene.entities.length,
      retained: scene.entities.length,
    });
  }

  const projection: WorldSceneFidelityProjection = {
    schema: WORLD_FIDELITY_SCHEMA_NAME,
    protocolVersion: '1.0.0',
    sceneId: scene.sceneId,
    tenantScope: scene.tenantScope,
    fidelity: level,
    spatial: profile.spatial,
    remoteRendering: profile.remoteRendering,
    entityIds: scene.entities.map((e) => e.entityId),
    focusedEntityIds: [...scene.focusedEntityIds],
    appliedOverlayIds: [...overlays.retained],
    animationInstructionIds: [...animations.retained],
    markerIds: [...markers.retained],
    narrativeBlockIds,
    presenceParticipantIds,
    camera,
    positionAtMs: scene.timeline.position.atMs,
    paused: scene.timeline.position.paused,
    reductions,
  };
  const checked = WorldSceneFidelityProjectionSchema.safeParse(projection);
  if (!checked.success) {
    return { ok: false, error: malformedRecordError(checked.error) };
  }
  return { ok: true, value: checked.data };
}

/** Validate a fidelity level string against the closed vocabulary. */
export function isWorldFidelityLevel(value: unknown): value is WorldFidelityLevel {
  return WorldFidelityLevelSchema.safeParse(value).success;
}

/** Exported for the schema surface registry (type-level only). */
export type FidelityTenantScope = TenantScope;
export type FidelitySceneId = WorldSceneId;
export type FidelityCamera = CameraState;
