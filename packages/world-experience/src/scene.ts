/**
 * The world scene/view descriptor — the tenant-scoped interactive-world
 * state record (Work Order W016's core surface): scene entities (opaque,
 * exact-revision world references plus presentation placement), focused
 * entities, the overlay library and its deterministic application order,
 * animation instructions, narrative/status blocks, the timeline/replay
 * position, presence participants, followable agents, declared evidence
 * references, and candidate/action controls — the Experience Graph
 * vocabulary as ONE typed record.
 *
 * Authority model (lock rules 8/16): the scene is a PROJECTION of world
 * state — entities are referenced opaquely (id + content digest, the W002
 * discipline), never embedded; mutating the scene (focus, overlays,
 * placement, camera) never mutates world state; the scene is sealed
 * (content-addressed) at every revision.
 *
 * Determinism: every collection is canonically ordered (sorted,
 * duplicate-free) so semantically equal scenes serialize to identical
 * bytes and their digests are stable.
 */
import { z } from 'zod';
import {
  ControlIntentSchema,
  ControlKindSchema,
  ParticipantReferenceSchema,
  ProjectedAgentRefSchema,
  ProjectedEvidenceRefSchema,
  QuaternionSchema,
  Sha256HexSchema,
  TenantScopeSchema,
  Vec3Schema,
  type ControlIntent,
  type ControlKind,
  type ParticipantReference,
  type ProjectedAgentRef,
  type ProjectedEvidenceRef,
  type Quaternion,
  type Sha256Hex,
  type TenantScope,
  type Vec3,
} from '@epoch/experience-protocol';
import {
  MAX_EVIDENCE_REFERENCES,
  MAX_FOCUSED_ENTITIES,
  MAX_SCENE_AGENTS,
  MAX_SCENE_CONTROLS,
  MAX_SCENE_ENTITIES,
  MAX_SCENE_PARTICIPANTS,
  WORLD_SCENE_SCHEMA_NAME,
  WORLD_EXPERIENCE_PROTOCOL_VERSION,
} from './version';
import {
  WorldEntityIdSchema,
  WorldOntologyRecordIdSchema,
  WorldSceneIdSchema,
  type WorldEntityId,
  type WorldOverlayId,
  type WorldSceneId,
} from './primitives';
import {
  AnimationInstructionSchema,
  validateAnimationInstructions,
  type AnimationInstruction,
} from './animation';
import {
  NarrativeStatusBlockSchema,
  validateNarrativeBlocks,
  type NarrativeStatusBlock,
} from './narrative';
import {
  SceneTimelineSchema,
  validateTimelinePosition,
  type SceneTimeline,
} from './timeline';
import { CameraStateSchema, type CameraState } from './camera';
import {
  OverlayApplicationSchema,
  VisualOverlaySchema,
  type OverlayApplication,
  type VisualOverlay,
} from './overlay';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  crossTenantDeniedError,
  malformedRecord,
  malformedRecordError,
  unknownOverlayReferenceError,
  unknownSceneReferenceError,
  versionUnsupportedError,
} from './issues';
import type { WorldExperienceResult } from './errors';

// ---------------------------------------------------------------------------
// Scene entities: opaque world references + presentation placement.
// ---------------------------------------------------------------------------

/** Bounded control-local identifier: lowercase kebab slug. */
export const SceneControlIdSchema = z
  .string()
  .regex(/^ctl-[a-z0-9][a-z0-9-]{0,62}$/)
  .meta({
    id: 'SceneControlId',
    title: 'SceneControlId',
    description: 'Scene candidate/action-control identifier: "ctl-" followed by a lowercase slug.',
  });

/** One scene-control identifier. */
export type SceneControlId = z.infer<typeof SceneControlIdSchema>;

/** The opaque entity-type key an entity carries (world vocabulary, opaque here). */
const EntityTypeKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/, "entity type keys are 'namespace:name' with lowercase segments (opaque world vocabulary)")
  .meta({
    id: 'SceneEntityTypeKey',
    title: 'SceneEntityTypeKey',
    description: "Opaque world entity-type key ('namespace:name') — owned by the world model; never interpreted here.",
  });

/**
 * One scene entity: an opaque, exact-revision world-entity reference plus
 * its presentation placement and view flags. The placement and flags are
 * PRESENTATION state (move/rotate/isolate/hide act here); the id and
 * digest address the world entity — never embedded world state.
 */
export const SceneEntitySchema = z
  .strictObject({
    entityId: WorldEntityIdSchema,
    contentDigest: Sha256HexSchema,
    entityType: EntityTypeKeySchema,
    representationRecordId: WorldOntologyRecordIdSchema,
    affordanceRecordId: WorldOntologyRecordIdSchema.optional(),
    label: z.string().min(1).max(256).optional(),
    position: Vec3Schema,
    orientation: QuaternionSchema.optional(),
    scale: Vec3Schema.optional(),
    visible: z.boolean(),
    isolated: z.boolean(),
  })
  .meta({
    id: 'SceneEntity',
    title: 'SceneEntity',
    description:
      'One scene entity: opaque exact-revision world reference, ontology binding, presentation placement, view flags.',
  });

/** One scene entity. */
export type SceneEntity = z.infer<typeof SceneEntitySchema>;

/**
 * One candidate/action control of the scene (the Experience Graph
 * "candidate/action controls" element): a neutral control role emitting a
 * typed intent (R30). The W011 ControlDescriptor discipline applies.
 */
export const SceneControlSchema = z
  .strictObject({
    controlId: SceneControlIdSchema,
    controlKind: ControlKindSchema,
    intent: ControlIntentSchema,
    label: z.string().min(1).max(256).optional(),
    options: z
      .array(z.string().min(1).max(128))
      .min(1)
      .max(64)
      .refine(
        (options) => options.every((o, i) => i === 0 || o > options[i - 1]),
        'selector options must be sorted ascending and duplicate-free (deterministic set semantics)',
      )
      .optional(),
  })
  .superRefine((control, ctx) => {
    if (control.controlKind === 'selector' && control.options === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a "selector" control requires sorted, non-empty options',
        path: ['options'],
      });
    }
    if (control.controlKind !== 'selector' && control.options !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'options are only valid on the "selector" control kind',
        path: ['options'],
      });
    }
  })
  .meta({
    id: 'SceneControl',
    title: 'SceneControl',
    description:
      'One candidate/action control: neutral control role, emitted typed intent, optional label and selector options.',
  });

/** One scene control. */
export type SceneControl = z.infer<typeof SceneControlSchema>;

// ---------------------------------------------------------------------------
// The world scene record.
// ---------------------------------------------------------------------------

/**
 * The content of a world scene envelope (everything except the digest).
 * Collections carry sorted/duplicate-free refinements — the
 * canonical-ordering half of deterministic serialization. The semantic
 * gates (tenant scoping, reference resolvability, replay bounds) run in
 * the total admission surface (src/parse.ts) as TYPED codes.
 */
export const WorldSceneContentSchema = z
  .strictObject({
    schema: z.literal(WORLD_SCENE_SCHEMA_NAME),
    protocolVersion: z.literal(WORLD_EXPERIENCE_PROTOCOL_VERSION),
    sceneId: WorldSceneIdSchema,
    tenantScope: TenantScopeSchema,
    name: z.string().min(1).max(256),
    entities: z.array(SceneEntitySchema).min(1).max(MAX_SCENE_ENTITIES),
    focusedEntityIds: z.array(WorldEntityIdSchema).max(MAX_FOCUSED_ENTITIES),
    overlays: z.array(VisualOverlaySchema).max(256),
    appliedOverlays: z.array(OverlayApplicationSchema).max(64),
    animations: z.array(AnimationInstructionSchema).max(128),
    narrativeBlocks: z.array(NarrativeStatusBlockSchema).max(256),
    timeline: SceneTimelineSchema,
    camera: CameraStateSchema,
    participants: z.array(ParticipantReferenceSchema).max(MAX_SCENE_PARTICIPANTS),
    agents: z.array(ProjectedAgentRefSchema).max(MAX_SCENE_AGENTS),
    evidenceReferences: z.array(ProjectedEvidenceRefSchema).max(MAX_EVIDENCE_REFERENCES),
    controls: z.array(SceneControlSchema).max(MAX_SCENE_CONTROLS),
  })
  .superRefine((scene, ctx) => {
    // Entities: sorted, unique.
    for (let i = 1; i < scene.entities.length; i += 1) {
      if (scene.entities[i].entityId <= scene.entities[i - 1].entityId) {
        ctx.addIssue({
          code: 'custom',
          message:
            'entities must be sorted by entityId ascending and duplicate-free (deterministic serialization)',
          path: ['entities'],
        });
        return;
      }
    }
    // Focus: sorted, unique.
    for (let i = 1; i < scene.focusedEntityIds.length; i += 1) {
      if (scene.focusedEntityIds[i] <= scene.focusedEntityIds[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          message:
            'focusedEntityIds must be sorted ascending and duplicate-free (deterministic serialization)',
          path: ['focusedEntityIds'],
        });
        return;
      }
    }
    // Overlay library: sorted by overlayId, unique.
    for (let i = 1; i < scene.overlays.length; i += 1) {
      if (scene.overlays[i].overlayId <= scene.overlays[i - 1].overlayId) {
        ctx.addIssue({
          code: 'custom',
          message:
            'the overlay library must be sorted by overlayId ascending and duplicate-free (deterministic serialization)',
          path: ['overlays'],
        });
        return;
      }
    }
    // Applied overlays: sorted by (orderIndex, overlayId), unique.
    const appliedKeys = scene.appliedOverlays.map((a) => `${a.orderIndex}\u0000${a.overlayId}`);
    for (let i = 1; i < appliedKeys.length; i += 1) {
      if (appliedKeys[i] <= appliedKeys[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          message:
            'appliedOverlays must be sorted by (orderIndex, overlayId) ascending and duplicate-free (deterministic application order)',
          path: ['appliedOverlays'],
        });
        return;
      }
    }
    // Participants: sorted by participantId, unique.
    for (let i = 1; i < scene.participants.length; i += 1) {
      if (scene.participants[i].participantId <= scene.participants[i - 1].participantId) {
        ctx.addIssue({
          code: 'custom',
          message:
            'participants must be sorted by participantId ascending and duplicate-free (deterministic serialization)',
          path: ['participants'],
        });
        return;
      }
    }
    // Agents: sorted by agentId, unique.
    for (let i = 1; i < scene.agents.length; i += 1) {
      if (scene.agents[i].agentId <= scene.agents[i - 1].agentId) {
        ctx.addIssue({
          code: 'custom',
          message:
            'agents must be sorted by agentId ascending and duplicate-free (deterministic serialization)',
          path: ['agents'],
        });
        return;
      }
    }
    // Evidence references: sorted by recordDigest, unique.
    for (let i = 1; i < scene.evidenceReferences.length; i += 1) {
      if (
        scene.evidenceReferences[i].recordDigest <= scene.evidenceReferences[i - 1].recordDigest
      ) {
        ctx.addIssue({
          code: 'custom',
          message:
            'evidenceReferences must be sorted by recordDigest ascending and duplicate-free (deterministic serialization)',
          path: ['evidenceReferences'],
        });
        return;
      }
    }
    // Controls: sorted by controlId, unique.
    for (let i = 1; i < scene.controls.length; i += 1) {
      if (scene.controls[i].controlId <= scene.controls[i - 1].controlId) {
        ctx.addIssue({
          code: 'custom',
          message:
            'controls must be sorted by controlId ascending and duplicate-free (deterministic serialization)',
          path: ['controls'],
        });
        return;
      }
    }
    // NOTE: the timeline/replay POSITION bound is deliberately NOT a
    // structural refinement — it is the typed `invalid-replay-position`
    // semantic gate (runSceneSemanticGates), so out-of-bounds positions
    // are distinguishable from generic malformation.
  })
  .meta({
    id: 'WorldSceneContent',
    title: 'WorldSceneContent',
    description:
      'The content of a world scene envelope: the full Experience Graph vocabulary as one canonically ordered, tenant-scoped typed record.',
  });

/** The content of a world scene envelope. */
export type WorldSceneContent = z.infer<typeof WorldSceneContentSchema>;

/**
 * The sealed world scene envelope: content plus its SHA-256 digest over
 * the canonical JSON of the content (the digest field excluded). The
 * digest addresses the exact scene revision.
 */
export const WorldSceneSchema = z
  .strictObject({
    schema: z.literal(WORLD_SCENE_SCHEMA_NAME),
    protocolVersion: z.literal(WORLD_EXPERIENCE_PROTOCOL_VERSION),
    sceneId: WorldSceneIdSchema,
    tenantScope: TenantScopeSchema,
    name: z.string().min(1).max(256),
    entities: z.array(SceneEntitySchema).min(1).max(MAX_SCENE_ENTITIES),
    focusedEntityIds: z.array(WorldEntityIdSchema).max(MAX_FOCUSED_ENTITIES),
    overlays: z.array(VisualOverlaySchema).max(256),
    appliedOverlays: z.array(OverlayApplicationSchema).max(64),
    animations: z.array(AnimationInstructionSchema).max(128),
    narrativeBlocks: z.array(NarrativeStatusBlockSchema).max(256),
    timeline: SceneTimelineSchema,
    camera: CameraStateSchema,
    participants: z.array(ParticipantReferenceSchema).max(MAX_SCENE_PARTICIPANTS),
    agents: z.array(ProjectedAgentRefSchema).max(MAX_SCENE_AGENTS),
    evidenceReferences: z.array(ProjectedEvidenceRefSchema).max(MAX_EVIDENCE_REFERENCES),
    controls: z.array(SceneControlSchema).max(MAX_SCENE_CONTROLS),
    digest: Sha256HexSchema,
  })
  .meta({
    id: 'WorldScene',
    title: 'WorldScene',
    description:
      'The sealed world scene envelope: canonically ordered content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed world scene. */
export type WorldScene = z.infer<typeof WorldSceneSchema>;

// ---------------------------------------------------------------------------
// The in-memory scene store (pure functions over an immutable state).
// ---------------------------------------------------------------------------

/** The in-memory store state: scenes sorted by sceneId (deterministic). */
export interface WorldSceneStoreState {
  readonly scenes: readonly WorldScene[];
}

/** The empty store state. */
export function emptyWorldSceneStore(): WorldSceneStoreState {
  return { scenes: [] };
}

/** Options shared by the store surface (tenant gate, R12). */
export interface SceneStoreOptions {
  /** The tenant the caller is operating FOR (R12 cross-tenant gate). */
  readonly expectedTenantId?: string;
}

/**
 * The semantic admission gates that run after the structural schema gate:
 * tenant scoping of every projected reference, focus/overlay/animation
 * resolvability, overlay-library resolution, and narrative evidence
 * citations. Each failure is its own typed code.
 */
export function runSceneSemanticGates(
  content: WorldSceneContent,
): WorldExperienceResult<void> {
  const tenantId = content.tenantScope.tenantId;

  // Agent references must belong to the scene's tenant.
  for (const agent of content.agents) {
    if (agent.tenantId !== tenantId) {
      return {
        ok: false,
        error: crossTenantDeniedError(['agents', agent.agentId], tenantId, agent.tenantId),
      };
    }
  }
  // Evidence references must belong to the scene's tenant.
  for (const evidence of content.evidenceReferences) {
    if (evidence.tenantId !== tenantId) {
      return {
        ok: false,
        error: crossTenantDeniedError(
          ['evidenceReferences', evidence.recordDigest],
          tenantId,
          evidence.tenantId,
        ),
      };
    }
  }
  // Follow-agent camera must reference an agent of the scene's tenant.
  if (content.camera.mode === 'follow-agent' && content.camera.agentRef.tenantId !== tenantId) {
    return {
      ok: false,
      error: crossTenantDeniedError(
        ['camera', 'agentRef', 'tenantId'],
        tenantId,
        content.camera.agentRef.tenantId,
      ),
    };
  }

  const entityIds = new Set(content.entities.map((e) => e.entityId));

  // Focus targets must resolve.
  for (const entityId of content.focusedEntityIds) {
    if (!entityIds.has(entityId)) {
      return {
        ok: false,
        error: unknownSceneReferenceError(['focusedEntityIds', entityId], entityId),
      };
    }
  }

  // Overlay entity targets must resolve; applied overlays must be declared.
  for (const overlay of content.overlays) {
    const targets: readonly string[] =
      overlay.overlayKind === 'measurement'
        ? [overlay.fromEntityId, overlay.toEntityId]
        : [overlay.entityId];
    for (const target of targets) {
      if (!entityIds.has(target)) {
        return {
          ok: false,
          error: unknownSceneReferenceError(['overlays', overlay.overlayId], target),
        };
      }
    }
  }
  const overlayIds = new Set(content.overlays.map((o) => o.overlayId));
  for (const applied of content.appliedOverlays) {
    if (!overlayIds.has(applied.overlayId)) {
      return { ok: false, error: unknownOverlayReferenceError(applied.overlayId, ['appliedOverlays', applied.overlayId]) };
    }
  }

  // Animation targets must resolve.
  const animations = validateAnimationInstructions(content.animations, entityIds);
  if (!animations.ok) {
    return animations;
  }

  // Narrative evidence citations must resolve.
  const evidenceDigests = new Set(content.evidenceReferences.map((e) => e.recordDigest));
  const narrative = validateNarrativeBlocks(content.narrativeBlocks, evidenceDigests);
  if (!narrative.ok) {
    return narrative;
  }

  // Follow-agent camera must target a declared agent.
  if (content.camera.mode === 'follow-agent') {
    const followed = content.camera.agentRef.agentId;
    if (!content.agents.some((a) => a.agentId === followed)) {
      return {
        ok: false,
        error: unknownSceneReferenceError(['camera', 'agentRef', 'agentId'], followed),
      };
    }
  }

  // Timeline position within bounds (typed replay-position gate).
  const position = validateTimelinePosition(content.timeline, content.timeline.position);
  if (!position.ok) {
    return position;
  }

  return { ok: true, value: undefined };
}

/**
 * The total scene admission: structural schema gate → semantic gates
 * (typed codes). Used by the store and by parse admission.
 */
export function admitWorldSceneContent(
  input: unknown,
  options?: SceneStoreOptions,
): WorldExperienceResult<WorldSceneContent> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      ok: false,
      error: malformedRecord([{ path: '$', message: 'expected a JSON object at the scene root' }]),
    };
  }
  const encountered = (input as Record<string, unknown>).protocolVersion;
  if (typeof encountered === 'string' && encountered !== WORLD_EXPERIENCE_PROTOCOL_VERSION) {
    return {
      ok: false,
      error: versionUnsupportedError(WORLD_EXPERIENCE_PROTOCOL_VERSION, encountered),
    };
  }
  const parsed = WorldSceneContentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  if (options?.expectedTenantId !== undefined && parsed.data.tenantScope.tenantId !== options.expectedTenantId) {
    return {
      ok: false,
      error: crossTenantDeniedError(
        ['tenantScope', 'tenantId'],
        options.expectedTenantId,
        parsed.data.tenantScope.tenantId,
      ),
    };
  }
  const semantic = runSceneSemanticGates(parsed.data);
  if (!semantic.ok) {
    return semantic;
  }
  return { ok: true, value: parsed.data };
}

/** Seal valid scene content into a scene envelope (content + digest). */
export function sealWorldSceneContent(content: WorldSceneContent): WorldScene {
  return { ...content, digest: canonicalDigest(content as unknown as JsonValue) };
}

/**
 * Create a scene in the store (pure): admission runs first; the sealed
 * scene is inserted in sceneId order. Duplicate scene ids are typed
 * malformed-record rejections.
 */
export function createWorldScene(
  state: WorldSceneStoreState,
  input: unknown,
  options?: SceneStoreOptions,
): WorldExperienceResult<{ readonly state: WorldSceneStoreState; readonly scene: WorldScene }> {
  const admitted = admitWorldSceneContent(input, options);
  if (!admitted.ok) {
    return admitted;
  }
  const scene = sealWorldSceneContent(admitted.value);
  if (state.scenes.some((s) => s.sceneId === scene.sceneId)) {
    return {
      ok: false,
      error: malformedRecord([
        {
          path: 'sceneId',
          message: `a scene with id "${scene.sceneId}" already exists in the store`,
        },
      ]),
    };
  }
  const scenes = [...state.scenes, scene].sort((a, b) => (a.sceneId < b.sceneId ? -1 : 1));
  return { ok: true, value: { state: { scenes }, scene } };
}

/** Look up one scene (tenant-gated; unknown ids are typed rejections). */
export function getWorldScene(
  state: WorldSceneStoreState,
  sceneId: WorldSceneId,
  options?: SceneStoreOptions,
): WorldExperienceResult<WorldScene> {
  const scene = state.scenes.find((s) => s.sceneId === sceneId);
  if (scene === undefined) {
    return {
      ok: false,
      error: unknownSceneReferenceError(['sceneId'], sceneId),
    };
  }
  if (options?.expectedTenantId !== undefined && scene.tenantScope.tenantId !== options.expectedTenantId) {
    return {
      ok: false,
      error: crossTenantDeniedError(
        ['tenantScope', 'tenantId'],
        options.expectedTenantId,
        scene.tenantScope.tenantId,
      ),
    };
  }
  return { ok: true, value: scene };
}

/** List scenes (sorted by sceneId; tenant-filtered when gated). */
export function listWorldScenes(
  state: WorldSceneStoreState,
  options?: SceneStoreOptions,
): readonly WorldScene[] {
  const scenes = [...state.scenes].sort((a, b) => (a.sceneId < b.sceneId ? -1 : 1));
  if (options?.expectedTenantId === undefined) {
    return scenes;
  }
  return scenes.filter((s) => s.tenantScope.tenantId === options.expectedTenantId);
}

/** Replace one scene in the store state (pure; re-sorted, re-sealed). */
export function replaceWorldScene(
  state: WorldSceneStoreState,
  scene: WorldScene,
): WorldSceneStoreState {
  const scenes = state.scenes.filter((s) => s.sceneId !== scene.sceneId);
  scenes.push(scene);
  scenes.sort((a, b) => (a.sceneId < b.sceneId ? -1 : 1));
  return { scenes };
}

/** Focus one entity (select semantics): replaces the focused set. */
export function focusSceneEntity(
  state: WorldSceneStoreState,
  sceneId: WorldSceneId,
  entityId: WorldEntityId,
  options?: SceneStoreOptions,
): WorldExperienceResult<{ readonly state: WorldSceneStoreState; readonly scene: WorldScene }> {
  return mutateScene(state, sceneId, options, (scene) => {
    if (!scene.entities.some((e) => e.entityId === entityId)) {
      return {
        ok: false,
        error: unknownSceneReferenceError(['focusedEntityIds', entityId], entityId),
      } as WorldExperienceResult<WorldSceneContent>;
    }
    return { ok: true, value: { ...scene, focusedEntityIds: [entityId] } };
  });
}

/** Apply one declared overlay to a scene (deterministic order append). */
export function applySceneOverlay(
  state: WorldSceneStoreState,
  sceneId: WorldSceneId,
  overlayId: WorldOverlayId,
  options?: SceneStoreOptions,
): WorldExperienceResult<{ readonly state: WorldSceneStoreState; readonly scene: WorldScene }> {
  return mutateScene(state, sceneId, options, (scene) => {
    if (!scene.overlays.some((o) => o.overlayId === overlayId)) {
      return {
        ok: false,
        error: unknownOverlayReferenceError(overlayId, ['appliedOverlays', overlayId]),
      };
    }
    if (scene.appliedOverlays.some((a) => a.overlayId === overlayId)) {
      return { ok: true, value: scene };
    }
    const nextIndex = scene.appliedOverlays.reduce((max, a) => Math.max(max, a.orderIndex), -1) + 1;
    const applied: OverlayApplication[] = [...scene.appliedOverlays, { overlayId, orderIndex: nextIndex }];
    return { ok: true, value: { ...scene, appliedOverlays: applied } };
  });
}

/** Remove one applied overlay from a scene. */
export function removeSceneOverlay(
  state: WorldSceneStoreState,
  sceneId: WorldSceneId,
  overlayId: WorldOverlayId,
  options?: SceneStoreOptions,
): WorldExperienceResult<{ readonly state: WorldSceneStoreState; readonly scene: WorldScene }> {
  return mutateScene(state, sceneId, options, (scene) => {
    if (!scene.overlays.some((o) => o.overlayId === overlayId)) {
      return {
        ok: false,
        error: unknownOverlayReferenceError(overlayId, ['overlays', overlayId]),
      };
    }
    return { ok: true, value: { ...scene, appliedOverlays: scene.appliedOverlays.filter((a) => a.overlayId !== overlayId) } };
  });
}

/**
 * The shared mutation pipeline: lookup (tenant-gated) → pure content
 * mutation → re-admission (semantic gates re-run — every revision is
 * valid) → re-seal → state replace.
 */
function mutateScene(
  state: WorldSceneStoreState,
  sceneId: WorldSceneId,
  options: SceneStoreOptions | undefined,
  mutate: (scene: WorldSceneContent) => WorldExperienceResult<WorldSceneContent>,
): WorldExperienceResult<{ readonly state: WorldSceneStoreState; readonly scene: WorldScene }> {
  const found = getWorldScene(state, sceneId, options);
  if (!found.ok) {
    return found;
  }
  const { digest: _sealed, ...content } = found.value;
  void _sealed;
  const mutated = mutate(content);
  if (!mutated.ok) {
    return mutated;
  }
  const admitted = admitWorldSceneContent(mutated.value, options);
  if (!admitted.ok) {
    return admitted;
  }
  const scene = sealWorldSceneContent(admitted.value);
  return { ok: true, value: { state: replaceWorldScene(state, scene), scene } };
}

/** Scene usage accounting (pure): counts for evidence and telemetry. */
export interface SceneUsage {
  readonly entityCount: number;
  readonly focusedCount: number;
  readonly overlayLibraryCount: number;
  readonly appliedOverlayCount: number;
  readonly animationInstructionCount: number;
  readonly narrativeBlockCount: number;
  readonly markerCount: number;
  readonly participantCount: number;
  readonly agentCount: number;
  readonly evidenceReferenceCount: number;
  readonly controlCount: number;
}

/** Compute the usage record of a scene. */
export function computeSceneUsage(scene: WorldScene): SceneUsage {
  return {
    entityCount: scene.entities.length,
    focusedCount: scene.focusedEntityIds.length,
    overlayLibraryCount: scene.overlays.length,
    appliedOverlayCount: scene.appliedOverlays.length,
    animationInstructionCount: scene.animations.length,
    narrativeBlockCount: scene.narrativeBlocks.length,
    markerCount: scene.timeline.markers.length,
    participantCount: scene.participants.length,
    agentCount: scene.agents.length,
    evidenceReferenceCount: scene.evidenceReferences.length,
    controlCount: scene.controls.length,
  };
}

/** Exported for the schema surface registry (type-level only). */
export type SceneVec3 = Vec3;
export type SceneQuaternion = Quaternion;
export type SceneDigest = Sha256Hex;
export type SceneTenantScope = TenantScope;
export type SceneParticipant = ParticipantReference;
export type SceneAgentRef = ProjectedAgentRef;
export type SceneEvidenceRef = ProjectedEvidenceRef;
export type SceneControlKind = ControlKind;
export type SceneControlIntent = ControlIntent;
export type SceneOverlay = VisualOverlay;
export type SceneOverlayApplication = OverlayApplication;
export type SceneAnimation = AnimationInstruction;
export type SceneNarrativeBlock = NarrativeStatusBlock;
export type SceneTimelineRecord = SceneTimeline;
export type SceneCameraState = CameraState;
