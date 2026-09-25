/**
 * The world interaction reducer: how one admitted interaction intent
 * transitions the world scene (the Universal interactions made real as
 * typed state transitions).
 *
 * Authority split (binding):
 * - PRESENTATION intents (select, isolate, hide, show, filter, move,
 *   rotate, zoom, follow-agent, annotate, replay, pause, resume) mutate
 *   the scene's VIEW state — focus, visibility, placement, camera,
 *   overlays, timeline — never world state (lock rule 8);
 * - SEMANTIC intents (inspect, measure, compare, simulate, query, change,
 *   connect, disconnect, branch) NEVER mutate anything here: they produce
 *   typed request EFFECTS for the host to route through the proper
 *   authorities (the Action Gateway for change/connect/disconnect, the
 *   simulation fabric for simulate, the world model for queries and
 *   measurements) — this layer is a projection, not an executor.
 *
 * Every entity/agent/evidence reference an intent carries must resolve
 * within the scene (typed unknown-scene-reference /
 * unknown-evidence-reference rejections); replay/branch positions must be
 * within the timeline bounds (typed invalid-replay-position rejections).
 */
import { z } from 'zod';
import type { Vec3, Quaternion } from '@epoch/experience-protocol';
import { MAX_APPLIED_OVERLAYS } from './version';
import { WORLD_OVERLAY_ID_PATTERN, type WorldSceneId, type WorldOverlayId } from './primitives';
import { sha256Hex } from '@epoch/agent-protocol';
import { zoomCamera } from './camera';
import { seekTimelinePosition } from './timeline';
import type { OverlayApplication, VisualOverlay } from './overlay';
import type { WorldInteractionIntent } from './intent';
import type { CameraTransition } from './camera';
import {
  admitWorldSceneContent,
  getWorldScene,
  replaceWorldScene,
  sealWorldSceneContent,
  type SceneStoreOptions,
  type WorldScene,
  type WorldSceneContent,
  type WorldSceneStoreState,
} from './scene';
import {
  invalidReplayPositionError,
  unknownEvidenceReferenceError,
  unknownSceneReferenceError,
  malformedRecord,
} from './issues';
import type { WorldExperienceResult } from './errors';

// ---------------------------------------------------------------------------
// The typed host-side effect vocabulary (semantic intents).
// ---------------------------------------------------------------------------

/** One typed host-side effect produced by a semantic intent. */
export const WorldIntentEffectSchema = z
  .discriminatedUnion('effect', [
    z
      .strictObject({
        effect: z.literal('inspect-requested'),
        entityId: z.string().min(1).max(256),
      })
      .meta({ id: 'InspectRequestedEffect', title: 'InspectRequestedEffect' }),
    z
      .strictObject({
        effect: z.literal('measure-requested'),
        fromEntityId: z.string().min(1).max(256),
        toEntityId: z.string().min(1).max(256),
      })
      .meta({ id: 'MeasureRequestedEffect', title: 'MeasureRequestedEffect' }),
    z
      .strictObject({
        effect: z.literal('compare-requested'),
        leftEntityId: z.string().min(1).max(256),
        rightEntityId: z.string().min(1).max(256),
      })
      .meta({ id: 'CompareRequestedEffect', title: 'CompareRequestedEffect' }),
    z
      .strictObject({
        effect: z.literal('simulate-requested'),
        scenarioRef: z.string().min(1).max(128),
      })
      .meta({ id: 'SimulateRequestedEffect', title: 'SimulateRequestedEffect' }),
    z
      .strictObject({
        effect: z.literal('query-requested'),
        text: z.string().min(1).max(1024),
      })
      .meta({ id: 'QueryRequestedEffect', title: 'QueryRequestedEffect' }),
    z
      .strictObject({
        effect: z.literal('change-requested'),
        entityId: z.string().min(1).max(256),
        propertyPath: z.string().min(1).max(128),
      })
      .meta({ id: 'ChangeRequestedEffect', title: 'ChangeRequestedEffect' }),
    z
      .strictObject({
        effect: z.literal('connect-requested'),
        fromEntityId: z.string().min(1).max(256),
        toEntityId: z.string().min(1).max(256),
      })
      .meta({ id: 'ConnectRequestedEffect', title: 'ConnectRequestedEffect' }),
    z
      .strictObject({
        effect: z.literal('disconnect-requested'),
        fromEntityId: z.string().min(1).max(256),
        toEntityId: z.string().min(1).max(256),
      })
      .meta({ id: 'DisconnectRequestedEffect', title: 'DisconnectRequestedEffect' }),
    z
      .strictObject({
        effect: z.literal('branch-requested'),
        atMs: z.number().int().nonnegative(),
      })
      .meta({ id: 'BranchRequestedEffect', title: 'BranchRequestedEffect' }),
  ])
  .meta({
    id: 'WorldIntentEffect',
    title: 'WorldIntentEffect',
    description:
      'One typed host-side effect of a semantic world intent: the request this layer forwards to the proper authority (never executed here).',
  });

/** One typed host-side effect. */
export type WorldIntentEffect = z.infer<typeof WorldIntentEffectSchema>;

/** The outcome of applying one intent to a scene. */
export interface WorldIntentOutcome {
  /** The next sealed scene revision (unchanged when the intent is effect-only). */
  readonly scene: WorldScene;
  /** The typed host-side effects to route through the proper authorities. */
  readonly effects: readonly WorldIntentEffect[];
  /** The explicit camera transition, when the intent moved the camera. */
  readonly cameraTransition?: CameraTransition;
}

// ---------------------------------------------------------------------------
// Deterministic id derivation (no randomness — idempotent replays).
// ---------------------------------------------------------------------------

/**
 * Derive an annotation overlay id from the emitting intent's id
 * (deterministic: the same intent replayed produces the same overlay id,
 * so replays are idempotent).
 */
export function annotationOverlayIdOf(intentId: string): WorldOverlayId {
  const slug = intentId
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 45);
  const fingerprint = sha256Hex(intentId).slice(0, 8);
  return `ovl-annot-${slug || 'x'}-${fingerprint}`;
}

// ---------------------------------------------------------------------------
// The reducer.
// ---------------------------------------------------------------------------

/**
 * Apply one admitted interaction intent to a scene in the store (pure:
 * returns the next store state, the next sealed scene revision, and the
 * typed effects). Scene-level resolvability is enforced here (entity,
 * agent, and evidence references; timeline bounds).
 */
export function applyWorldIntent(
  state: WorldSceneStoreState,
  sceneId: WorldSceneId,
  intent: WorldInteractionIntent,
  options?: SceneStoreOptions,
): WorldExperienceResult<{ readonly state: WorldSceneStoreState; readonly outcome: WorldIntentOutcome }> {
  const found = getWorldScene(state, sceneId, options);
  if (!found.ok) {
    return found;
  }
  const scene = found.value;
  const entityIds = new Set(scene.entities.map((e) => e.entityId));
  const evidenceDigests = new Set(scene.evidenceReferences.map((e) => e.recordDigest));

  const requireEntity = (entityId: string): WorldExperienceResult<void> => {
    if (!entityIds.has(entityId)) {
      return {
        ok: false,
        error: unknownSceneReferenceError(['entities', entityId], entityId),
      };
    }
    return { ok: true, value: undefined };
  };

  const effects: WorldIntentEffect[] = [];
  let cameraTransition: CameraTransition | undefined;

  // Effect-only intents: never mutate the scene (authority discipline).
  switch (intent.kind) {
    case 'inspect': {
      const check = requireEntity(intent.entityId);
      if (!check.ok) return check;
      effects.push({ effect: 'inspect-requested', entityId: intent.entityId });
      return unchanged(state, scene, effects);
    }
    case 'measure': {
      const a = requireEntity(intent.fromEntityId);
      if (!a.ok) return a;
      const b = requireEntity(intent.toEntityId);
      if (!b.ok) return b;
      effects.push({
        effect: 'measure-requested',
        fromEntityId: intent.fromEntityId,
        toEntityId: intent.toEntityId,
      });
      return unchanged(state, scene, effects);
    }
    case 'compare': {
      const a = requireEntity(intent.leftEntityId);
      if (!a.ok) return a;
      const b = requireEntity(intent.rightEntityId);
      if (!b.ok) return b;
      effects.push({
        effect: 'compare-requested',
        leftEntityId: intent.leftEntityId,
        rightEntityId: intent.rightEntityId,
      });
      return unchanged(state, scene, effects);
    }
    case 'simulate':
      effects.push({ effect: 'simulate-requested', scenarioRef: intent.scenarioRef });
      return unchanged(state, scene, effects);
    case 'query':
      effects.push({ effect: 'query-requested', text: intent.text });
      return unchanged(state, scene, effects);
    case 'change': {
      const check = requireEntity(intent.entityId);
      if (!check.ok) return check;
      effects.push({
        effect: 'change-requested',
        entityId: intent.entityId,
        propertyPath: intent.propertyPath,
      });
      return unchanged(state, scene, effects);
    }
    case 'connect': {
      const a = requireEntity(intent.fromEntityId);
      if (!a.ok) return a;
      const b = requireEntity(intent.toEntityId);
      if (!b.ok) return b;
      effects.push({
        effect: 'connect-requested',
        fromEntityId: intent.fromEntityId,
        toEntityId: intent.toEntityId,
      });
      return unchanged(state, scene, effects);
    }
    case 'disconnect': {
      const a = requireEntity(intent.fromEntityId);
      if (!a.ok) return a;
      const b = requireEntity(intent.toEntityId);
      if (!b.ok) return b;
      effects.push({
        effect: 'disconnect-requested',
        fromEntityId: intent.fromEntityId,
        toEntityId: intent.toEntityId,
      });
      return unchanged(state, scene, effects);
    }
    case 'branch': {
      const end = timelineEndMsOf(scene);
      if (intent.atMs > end) {
        return {
          ok: false,
          error: invalidReplayPositionError(
            `the branch position ${intent.atMs}ms exceeds the timeline end (${end}ms)`,
            { boundMs: end, encounteredMs: intent.atMs },
          ),
        };
      }
      effects.push({ effect: 'branch-requested', atMs: intent.atMs });
      return unchanged(state, scene, effects);
    }
    default:
      break;
  }

  // Presentation intents: compute the next content.
  let content: WorldSceneContent = sceneContentOf(scene);
  switch (intent.kind) {
    case 'select': {
      const check = requireEntity(intent.entityId);
      if (!check.ok) return check;
      content = { ...content, focusedEntityIds: [intent.entityId] };
      break;
    }
    case 'isolate': {
      const check = requireEntity(intent.entityId);
      if (!check.ok) return check;
      content = {
        ...content,
        entities: content.entities.map((entity) => ({
          ...entity,
          isolated: entity.entityId === intent.entityId,
        })),
      };
      break;
    }
    case 'hide': {
      for (const entityId of intent.entityIds) {
        const check = requireEntity(entityId);
        if (!check.ok) return check;
      }
      content = {
        ...content,
        entities: content.entities.map((entity) =>
          intent.entityIds.includes(entity.entityId) ? { ...entity, visible: false } : entity,
        ),
      };
      break;
    }
    case 'show': {
      for (const entityId of intent.entityIds) {
        const check = requireEntity(entityId);
        if (!check.ok) return check;
      }
      content = {
        ...content,
        entities: content.entities.map((entity) =>
          intent.entityIds.includes(entity.entityId) ? { ...entity, visible: true } : entity,
        ),
      };
      break;
    }
    case 'filter': {
      for (const entityId of intent.includeEntityIds) {
        const check = requireEntity(entityId);
        if (!check.ok) return check;
      }
      const include = new Set(intent.includeEntityIds);
      content = {
        ...content,
        entities: content.entities.map((entity) => ({
          ...entity,
          visible: include.has(entity.entityId),
        })),
      };
      break;
    }
    case 'move': {
      const check = requireEntity(intent.entityId);
      if (!check.ok) return check;
      content = {
        ...content,
        entities: content.entities.map((entity) =>
          entity.entityId === intent.entityId
            ? { ...entity, position: addVec3(entity.position, intent.delta) }
            : entity,
        ),
      };
      break;
    }
    case 'rotate': {
      const check = requireEntity(intent.entityId);
      if (!check.ok) return check;
      content = {
        ...content,
        entities: content.entities.map((entity) =>
          entity.entityId === intent.entityId
            ? { ...entity, orientation: multiplyQuaternion(intent.delta, entity.orientation) }
            : entity,
        ),
      };
      break;
    }
    case 'zoom': {
      content = { ...content, camera: zoomCamera(content.camera, { factor: intent.factor }) };
      break;
    }
    case 'follow-agent': {
      const agent = content.agents.find((a) => a.agentId === intent.agentId);
      if (agent === undefined) {
        return {
          ok: false,
          error: unknownSceneReferenceError(['agents', intent.agentId], intent.agentId),
        };
      }
      cameraTransition = {
        transitionKind: 'cut',
        fromMode: content.camera.mode,
        toMode: 'follow-agent',
        atMs: content.timeline.position.atMs,
      };
      content = {
        ...content,
        camera: { mode: 'follow-agent', agentRef: agent },
      };
      break;
    }
    case 'annotate': {
      const check = requireEntity(intent.entityId);
      if (!check.ok) return check;
      for (const digest of intent.evidenceDigests ?? []) {
        if (!evidenceDigests.has(digest)) {
          return {
            ok: false,
            error: unknownEvidenceReferenceError(digest, ['evidenceReferences', digest]),
          };
        }
      }
      const overlayId = annotationOverlayIdOf(intent.intentId);
      const overlay: VisualOverlay = {
        overlayId,
        overlayKind: 'annotation',
        entityId: intent.entityId,
        text: intent.text,
        ...(intent.evidenceDigests !== undefined ? { evidenceDigests: intent.evidenceDigests } : {}),
      };
      const overlays = content.overlays.some((o) => o.overlayId === overlayId)
        ? content.overlays.map((o) => (o.overlayId === overlayId ? overlay : o))
        : [...content.overlays, overlay].sort((a, b) => (a.overlayId < b.overlayId ? -1 : 1));
      let applied: OverlayApplication[] = content.appliedOverlays;
      if (!applied.some((a) => a.overlayId === overlayId)) {
        if (applied.length >= MAX_APPLIED_OVERLAYS) {
          return {
            ok: false,
            error: malformedRecord([
              {
                path: 'appliedOverlays',
                message: `applied overlays are limited to ${MAX_APPLIED_OVERLAYS}`,
              },
            ]),
          };
        }
        const nextIndex = applied.reduce((max, a) => Math.max(max, a.orderIndex), -1) + 1;
        applied = [...applied, { overlayId, orderIndex: nextIndex }];
      }
      content = { ...content, overlays, appliedOverlays: applied };
      break;
    }
    case 'replay': {
      const next = seekTimelinePosition(content.timeline, intent.fromMs);
      if (!next.ok) {
        return next;
      }
      content = { ...content, timeline: { ...content.timeline, position: next.value } };
      break;
    }
    case 'pause': {
      content = {
        ...content,
        timeline: { ...content.timeline, position: { ...content.timeline.position, paused: true } },
      };
      break;
    }
    case 'resume': {
      content = {
        ...content,
        timeline: { ...content.timeline, position: { ...content.timeline.position, paused: false } },
      };
      break;
    }
  }

  // Re-admission (every produced revision is valid) + re-seal.
  const admitted = admitWorldSceneContent(content, options);
  if (!admitted.ok) {
    return admitted;
  }
  const nextScene = sealWorldSceneContent(admitted.value);
  return {
    ok: true,
    value: {
      state: replaceWorldScene(state, nextScene),
      outcome: {
        scene: nextScene,
        effects,
        ...(cameraTransition !== undefined ? { cameraTransition } : {}),
      },
    },
  };
}

function unchanged(
  state: WorldSceneStoreState,
  scene: WorldScene,
  effects: readonly WorldIntentEffect[],
): WorldExperienceResult<{ readonly state: WorldSceneStoreState; readonly outcome: WorldIntentOutcome }> {
  return {
    ok: true,
    value: {
      state,
      outcome: { scene, effects },
    },
  };
}

function sceneContentOf(scene: WorldScene): WorldSceneContent {
  const { digest: _sealed, ...content } = scene;
  void _sealed;
  return content;
}

function timelineEndMsOf(scene: WorldScene): number {
  const markers = scene.timeline.markers;
  const last = markers.length > 0 ? markers[markers.length - 1] : null;
  return last !== null ? Math.min(last.atMs, scene.timeline.trackEndMs) : scene.timeline.trackEndMs;
}

function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** Hamilton product a*b (neutral quaternion math, presentation only). */
function multiplyQuaternion(a: Quaternion, b: Quaternion | undefined): Quaternion {
  if (b === undefined) {
    return a;
  }
  return [
    a[0] * b[3] + a[3] * b[0] + a[1] * b[2] - a[2] * b[1],
    a[1] * b[3] + a[3] * b[1] + a[2] * b[0] - a[0] * b[2],
    a[2] * b[3] + a[3] * b[2] + a[0] * b[1] - a[1] * b[0],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

/** The overlay-id grammar, re-exported for reducer consumers. */
export const REDUCER_OVERLAY_ID_PATTERN = WORLD_OVERLAY_ID_PATTERN;
