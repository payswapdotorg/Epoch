/**
 * The renderer-envelope compiler — the output boundary of the interactive
 * world view (Work Order W016's seam to W013).
 *
 * Pure data producer: compiles one sealed world scene into
 * - W011 Experience Graphs (one per non-empty presentation aspect:
 *   the spatial scene [3d, or animation with clips], the narrative feed,
 *   the timeline/replay track with markers and the replay cursor, the
 *   presence seats plus the followed agent's cursor, and the
 *   candidate/action controls), each SEALED with its content digest;
 * - W013-shaped invocation envelopes — one mount-graph envelope per
 *   graph (referencing the graph by its sealed digest, carrying declared
 *   triangle/texture usage for the spatial graph), one advance-frame
 *   envelope for the scene's next frame, and (via
 *   {@link compileIntentSubmission}) one submit-intent envelope per
 *   admitted interaction intent.
 *
 * The envelope records are MIRRORED W013 shapes (canonical home:
 * @epoch/renderer-runtime; pinned member-for-member by the compile-time
 * parity assertions in src/parity.ts and by the runtime parity tests that
 * parse these envelopes against the real W013 schemas and admit them
 * against real W013 bindings — renderer-runtime is a devDependency, never
 * a runtime dependency: the W012 precedent).
 *
 * The compiler NEVER embeds a concrete engine and NEVER renders anything:
 * it produces typed data for the renderer hosting surface. Budgets (when
 * supplied) are enforced with typed `budget-exceeded` rejections — never
 * silent degradation.
 */
import { z } from 'zod';
import { canonicalDigest, sha256Hex, type JsonValue } from '@epoch/agent-protocol';
import {
  sealExperienceGraph,
  Sha256HexSchema,
  type DeviceDescriptor,
  type ExperienceGraph,
  type ExperienceGraphContent,
  type ExperienceGraphKind,
  type ExperienceNode,
  type InteractionModality,
  type ProjectedReference,
} from '@epoch/experience-protocol';
import { controlIntentOf, WorldInteractionIntentSchema } from './intent';
import type { WorldInteractionIntent } from './intent';
import type { WorldScene } from './scene';
import type { WorldOntology } from './ontology';
import { resolveOntologyRecordOfKind } from './ontology';
import {
  enforceGraphBudgets,
  enforceUsageBudgets,
  entityRenderUsage,
  type SceneRenderUsage,
  type WorldRenderBudgets,
} from './budget';
import { malformedRecord, malformedRecordError } from './issues';
import type { WorldExperienceResult } from './errors';
import {
  WorldInvocationIdSchema,
  WorldRendererSessionIdSchema,
  WorldVirtualTimeMsSchema,
  type WorldInvocationId,
  type WorldRendererSessionId,
} from './primitives';

// ---------------------------------------------------------------------------
// Mirrored W013 invocation-envelope discriminators (canonical home:
// @epoch/renderer-runtime version.ts; parity-pinned at runtime).
// ---------------------------------------------------------------------------

/** Schema-name discriminator of every emitted invocation envelope (W013 mirror). */
export const WORLD_RENDERER_INVOCATION_SCHEMA_NAME = 'epoch.renderer-invocation' as const;

/** Protocol version of every emitted invocation envelope (W013 mirror). */
export const WORLD_RENDERER_PROTOCOL_VERSION = '1.0.0' as const;

/** The interaction-modalities mirror (W011 closed vocabulary, sorted). */
export const WORLD_INTERACTION_MODALITIES = [
  'gamepad',
  'gaze',
  'gesture',
  'keyboard',
  'pointer',
  'touch',
  'voice',
] as const;

/**
 * The mount-graph invocation envelope — MIRRORED W013 shape: install or
 * replace the render-ready state referenced by content digest, with
 * optional declared resource usage.
 */
export const WorldMountGraphEnvelopeSchema = z
  .strictObject({
    schema: z.literal(WORLD_RENDERER_INVOCATION_SCHEMA_NAME),
    protocolVersion: z.literal(WORLD_RENDERER_PROTOCOL_VERSION),
    kind: z.literal('mount-graph'),
    invocationId: WorldInvocationIdSchema,
    rendererSessionId: WorldRendererSessionIdSchema,
    graphDigest: Sha256HexSchema,
    atMs: WorldVirtualTimeMsSchema,
    declaredTriangles: z.number().int().nonnegative().optional(),
    declaredTextureBytes: z.number().int().nonnegative().optional(),
  })
  .meta({
    id: 'WorldMountGraphEnvelope',
    title: 'WorldMountGraphEnvelope',
    description:
      'Mount-graph invocation envelope emitted by the world-experience compiler (mirrored W013 shape; content digest + declared usage).',
  });

/** One mount-graph envelope. */
export type WorldMountGraphEnvelope = z.infer<typeof WorldMountGraphEnvelopeSchema>;

/** The advance-frame invocation envelope — MIRRORED W013 shape. */
export const WorldAdvanceFrameEnvelopeSchema = z
  .strictObject({
    schema: z.literal(WORLD_RENDERER_INVOCATION_SCHEMA_NAME),
    protocolVersion: z.literal(WORLD_RENDERER_PROTOCOL_VERSION),
    kind: z.literal('advance-frame'),
    invocationId: WorldInvocationIdSchema,
    rendererSessionId: WorldRendererSessionIdSchema,
    frameIndex: z.number().int().nonnegative(),
    atMs: WorldVirtualTimeMsSchema,
  })
  .meta({
    id: 'WorldAdvanceFrameEnvelope',
    title: 'WorldAdvanceFrameEnvelope',
    description:
      'Advance-frame invocation envelope emitted by the world-experience compiler (mirrored W013 shape; monotonic frame index).',
  });

/** One advance-frame envelope. */
export type WorldAdvanceFrameEnvelope = z.infer<typeof WorldAdvanceFrameEnvelopeSchema>;

/** The submit-intent invocation envelope — MIRRORED W013 shape. */
export const WorldSubmitIntentEnvelopeSchema = z
  .strictObject({
    schema: z.literal(WORLD_RENDERER_INVOCATION_SCHEMA_NAME),
    protocolVersion: z.literal(WORLD_RENDERER_PROTOCOL_VERSION),
    kind: z.literal('submit-intent'),
    invocationId: WorldInvocationIdSchema,
    rendererSessionId: WorldRendererSessionIdSchema,
    modality: z.enum(WORLD_INTERACTION_MODALITIES),
    intent: z.strictObject({
      id: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
      version: z.string().regex(/^\d+\.\d+\.\d+$/),
    }),
  })
  .meta({
    id: 'WorldSubmitIntentEnvelope',
    title: 'WorldSubmitIntentEnvelope',
    description:
      'Submit-intent invocation envelope emitted by the world-experience compiler (mirrored W013 shape; typed control intent from a declared modality).',
  });

/** One submit-intent envelope. */
export type WorldSubmitIntentEnvelope = z.infer<typeof WorldSubmitIntentEnvelopeSchema>;

/** The invocation-envelope union (discriminated on `kind`; W013 mirror). */
export const WorldInvocationEnvelopeSchema = z.discriminatedUnion('kind', [
  WorldMountGraphEnvelopeSchema,
  WorldAdvanceFrameEnvelopeSchema,
  WorldSubmitIntentEnvelopeSchema,
]);

/** One emitted invocation envelope. */
export type WorldInvocationEnvelope = z.infer<typeof WorldInvocationEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Deterministic node-id derivation.
// ---------------------------------------------------------------------------

/**
 * Derive an Experience Graph node id from a scene-local key
 * (deterministic; the 8-hex fingerprint of the original key guarantees
 * collision-freedom across sanitized collisions).
 */
function sceneNodeIdOf(
  prefix: 'a' | 'c' | 'ctl' | 'e' | 'l' | 'm' | 'n' | 's' | 't',
  key: string,
): string {
  const sanitized = key
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const fingerprint = sha256Hex(`${prefix}:${key}`).slice(0, 8);
  return `xn-${prefix}-${sanitized || 'x'}-${fingerprint}`;
}

// ---------------------------------------------------------------------------
// The compilation context and output.
// ---------------------------------------------------------------------------

/** The invocation coordinates one compilation emits envelopes for. */
export interface SceneInvocationCoordinates {
  /** Caller-scoped invocation id base (per-envelope suffixes are appended). */
  readonly invocationId: WorldInvocationId;
  /** The renderer session the envelopes target (W013 binding identity). */
  readonly rendererSessionId: WorldRendererSessionId;
  /** The virtual time of the mount. */
  readonly atMs: number;
}

/** The context of one scene compilation. */
export interface SceneCompilationContext {
  /** The ontology that resolves the scene's representation/material records. */
  readonly ontology: WorldOntology;
  /** The device the graphs are produced for (the W011 device slot, R29). */
  readonly device: DeviceDescriptor;
  /** The invocation coordinates (session, caller-scoped ids, virtual time). */
  readonly invocation: SceneInvocationCoordinates;
  /** Optional W013 renderer budgets; supplied = enforced (typed rejections). */
  readonly budgets?: WorldRenderBudgets;
}

/** The output of one scene compilation (pure data, deterministically ordered). */
export interface SceneCompilation {
  /** The digest of the source scene revision (the exact compiled revision). */
  readonly sceneDigest: string;
  /** The sealed W011 Experience Graphs, sorted by graphKind. */
  readonly graphs: readonly ExperienceGraph[];
  /** One mount-graph envelope per graph (same order). */
  readonly mountEnvelopes: readonly WorldMountGraphEnvelope[];
  /** The advance-frame envelope for the scene's next frame. */
  readonly advanceEnvelope: WorldAdvanceFrameEnvelope;
  /** The declared resource usage of the compiled spatial content. */
  readonly usage: SceneRenderUsage;
}

// ---------------------------------------------------------------------------
// The compiler.
// ---------------------------------------------------------------------------

/**
 * Compile one sealed world scene into W011 Experience Graphs plus W013
 * mount/advance invocation envelopes (pure, deterministic). Budgets, when
 * supplied in the context, are enforced with typed `budget-exceeded`
 * rejections. Unresolvable ontology references are typed
 * `unknown-ontology-record` rejections.
 */
export function compileWorldScene(
  scene: WorldScene,
  context: SceneCompilationContext,
): WorldExperienceResult<SceneCompilation> {
  const graphs: ExperienceGraphContent[] = [];

  const spatial = buildSpatialGraphs(scene, context);
  if (!spatial.ok) {
    return spatial;
  }
  let spatialUsage: SceneRenderUsage = { estimatedTriangles: 0, assetBytes: 0 };
  const graphUsages = new Map<string, SceneRenderUsage>();
  if (spatial.value !== null) {
    graphs.push(spatial.value.presentation.content);
    spatialUsage = spatial.value.presentation.usage;
    graphUsages.set('3d', spatialUsage);
    if (spatial.value.animation !== null) {
      graphs.push(spatial.value.animation.content);
      graphUsages.set('animation', spatial.value.animation.usage);
    }
  }
  const narrative = buildNarrativeGraph(scene, context.device);
  if (narrative !== null) {
    graphs.push(narrative);
  }
  const timeline = buildTimelineGraph(scene, context.device);
  if (timeline !== null) {
    graphs.push(timeline);
  }
  const presence = buildPresenceGraph(scene, context.device);
  if (presence !== null) {
    graphs.push(presence);
  }
  const controls = buildControlsGraph(scene, context.device);
  if (controls !== null) {
    graphs.push(controls);
  }
  graphs.sort((a, b) => (a.graphKind < b.graphKind ? -1 : 1));

  // Usage budget enforcement (the scene's full presented usage).
  if (context.budgets !== undefined) {
    const enforced = enforceUsageBudgets(spatialUsage, context.budgets);
    if (!enforced.ok) {
      return enforced;
    }
  }

  // Graph-level budget enforcement (node/edge counts).
  if (context.budgets !== undefined) {
    const enforced = enforceGraphBudgets(
      graphs.map((graph) => ({
        graphKind: graph.graphKind,
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
      })),
      context.budgets,
    );
    if (!enforced.ok) {
      return enforced;
    }
  }

  // Seal every graph (W011 admission embedded — the compiler's output is
  // always a valid W011 envelope; a seal failure is a typed error).
  const sealed: ExperienceGraph[] = [];
  for (const content of graphs) {
    const result = sealExperienceGraph(content as unknown as Record<string, unknown>);
    if (!result.ok) {
      const detail =
        result.error.code === 'malformed-descriptor'
          ? result.error.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ')
          : result.error.message;
      return {
        ok: false,
        error: malformedRecord([
          {
            path: `graphs.${content.graphKind}`,
            message: `the compiled graph failed W011 admission (${result.error.code}): ${detail}`,
          },
        ]),
      };
    }
    sealed.push(result.value);
  }

  // Mount envelopes: one per graph, derived invocation ids, declared usage
  // on the spatial graph only (the only kind whose content consumes those
  // resources — the W013 admission rule).
  const mountEnvelopes: WorldMountGraphEnvelope[] = [];
  for (const graph of sealed) {
    const invocationId = deriveInvocationId(context.invocation.invocationId, graph.graphKind);
    if (!invocationId.ok) {
      return invocationId;
    }
    const spatialKind = graph.graphKind === '3d' || graph.graphKind === 'animation';
    const graphUsage = graphUsages.get(graph.graphKind) ?? {
      estimatedTriangles: 0,
      assetBytes: 0,
    };
    const envelope: WorldMountGraphEnvelope = {
      schema: WORLD_RENDERER_INVOCATION_SCHEMA_NAME,
      protocolVersion: WORLD_RENDERER_PROTOCOL_VERSION,
      kind: 'mount-graph',
      invocationId: invocationId.value,
      rendererSessionId: context.invocation.rendererSessionId,
      graphDigest: graph.digest,
      atMs: context.invocation.atMs,
      ...(spatialKind ? { declaredTriangles: graphUsage.estimatedTriangles } : {}),
      ...(spatialKind ? { declaredTextureBytes: graphUsage.assetBytes } : {}),
    };
    const checked = WorldMountGraphEnvelopeSchema.safeParse(envelope);
    if (!checked.success) {
      return { ok: false, error: malformedRecordError(checked.error) };
    }
    mountEnvelopes.push(checked.data);
  }

  const advanceId = deriveInvocationId(context.invocation.invocationId, 'advance');
  if (!advanceId.ok) {
    return advanceId;
  }
  const advanceEnvelope: WorldAdvanceFrameEnvelope = {
    schema: WORLD_RENDERER_INVOCATION_SCHEMA_NAME,
    protocolVersion: WORLD_RENDERER_PROTOCOL_VERSION,
    kind: 'advance-frame',
    invocationId: advanceId.value,
    rendererSessionId: context.invocation.rendererSessionId,
    frameIndex: scene.timeline.position.frameIndex + 1,
    atMs: context.invocation.atMs,
  };
  const advanceChecked = WorldAdvanceFrameEnvelopeSchema.safeParse(advanceEnvelope);
  if (!advanceChecked.success) {
    return { ok: false, error: malformedRecordError(advanceChecked.error) };
  }

  return {
    ok: true,
    value: {
      sceneDigest: scene.digest,
      graphs: sealed,
      mountEnvelopes,
      advanceEnvelope: advanceChecked.data,
      usage: spatialUsage,
    },
  };
}

/** The spatial graphs build output (content + per-graph declared usage). */
interface SpatialGraphBuild {
  readonly presentation: { readonly content: ExperienceGraphContent; readonly usage: SceneRenderUsage };
  readonly animation: { readonly content: ExperienceGraphContent; readonly usage: SceneRenderUsage } | null;
}

// ---------------------------------------------------------------------------
// Graph builders (one per presentation aspect).
// ---------------------------------------------------------------------------

interface GraphBase {
  readonly schema: 'epoch.experience-graph';
  readonly protocolVersion: '1.0.0';
  readonly graphId: string;
  readonly graphKind: ExperienceGraphKind;
  readonly tenantScope: WorldScene['tenantScope'];
  readonly projectedFrom: ProjectedReference[];
  readonly device: DeviceDescriptor;
}

function graphBase(
  scene: WorldScene,
  device: DeviceDescriptor,
  graphKind: ExperienceGraphKind,
  graphIdSuffix: string,
): GraphBase {
  return {
    schema: 'epoch.experience-graph',
    protocolVersion: '1.0.0',
    graphId: `xg-world-${graphIdSuffix}`,
    graphKind,
    tenantScope: scene.tenantScope,
    projectedFrom: [],
    device,
  };
}

/** Sort nodes by id (the W011 canonical node ordering). */
function sortNodes(nodes: ExperienceNode[]): ExperienceNode[] {
  return nodes.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Sort edges by (from, to, kind) (the W011 canonical edge ordering). */
function sortEdges<K extends string, N extends { readonly kind: K; readonly from: string; readonly to: string }>(
  edges: N[],
): N[] {
  return edges.sort((a, b) => {
    if (a.from !== b.from) return a.from < b.from ? -1 : 1;
    if (a.to !== b.to) return a.to < b.to ? -1 : 1;
    return a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0;
  });
}

/** The applied overlays in deterministic application order. */
function appliedOverlaysInOrder(scene: WorldScene) {
  return scene.appliedOverlays
    .map((application) => ({
      orderIndex: application.orderIndex,
      overlay: scene.overlays.find((o) => o.overlayId === application.overlayId),
    }))
    .filter(
      (entry): entry is {
        orderIndex: number;
        overlay: NonNullable<(typeof scene.overlays)[number]>;
      } => entry.overlay !== undefined,
    )
    .sort((a, b) =>
      a.orderIndex === b.orderIndex
        ? a.overlay.overlayId < b.overlay.overlayId
          ? -1
          : 1
        : a.orderIndex - b.orderIndex,
    );
}

/** The spatial scene graphs: the '3d' presentation graph plus, when
 * instructions exist, the 'animation' clips graph (the W011 semantics:
 * an animation graph is a scene-with-clips projection carrying the
 * animatable spatial nodes and the clips — labels belong to the 3d
 * presentation graph).
 */
function buildSpatialGraphs(
  scene: WorldScene,
  context: SceneCompilationContext,
): WorldExperienceResult<SpatialGraphBuild | null> {
  const isolated = scene.entities.filter((entity) => entity.isolated);
  const presented = isolated.length > 0 ? isolated : scene.entities.filter((entity) => entity.visible);
  if (presented.length === 0) {
    return { ok: true, value: null };
  }
  const nodes: ExperienceNode[] = [];
  const edges: Array<{ kind: 'anchors'; from: string; to: string }> = [];
  const entityRefs: Array<{
    kind: 'world-entity';
    tenantId: string;
    entityId: string;
    contentDigest: string;
  }> = presented.map((entity) => ({
    kind: 'world-entity' as const,
    tenantId: scene.tenantScope.tenantId,
    entityId: entity.entityId,
    contentDigest: entity.contentDigest,
  }));
  entityRefs.sort((a, b) => (a.entityId < b.entityId ? -1 : 1));
  const projectedFrom: ProjectedReference[] = entityRefs;

  const applied = appliedOverlaysInOrder(scene);

  for (const entity of presented) {
    const representation = resolveOntologyRecordOfKind(
      context.ontology,
      entity.representationRecordId,
      'representation-3d',
    );
    if (!representation.ok) {
      return representation;
    }
    const nodeId = sceneNodeIdOf('e', entity.entityId);
    const attributes: Record<string, JsonValue> = {};
    if (representation.value.materialRecordId !== undefined) {
      const material = resolveOntologyRecordOfKind(
        context.ontology,
        representation.value.materialRecordId,
        'material',
      );
      if (!material.ok) {
        return material;
      }
      if (material.value.color !== undefined) {
        attributes['material-color'] = material.value.color;
      }
      if (material.value.opacity !== undefined) {
        attributes['material-opacity'] = material.value.opacity;
      }
    }
    // Applied overlays render as node attributes (deterministic
    // first-applied-wins merge; bounded key set).
    for (const { overlay } of applied) {
      if (overlay.overlayKind === 'highlight' && overlay.entityId === entity.entityId) {
        attributes['overlay-highlight-color'] ??= overlay.color;
      }
      if (overlay.overlayKind === 'state' && overlay.entityId === entity.entityId) {
        attributes['overlay-state-key'] ??= overlay.stateKey;
        if (overlay.tint !== undefined) {
          attributes['overlay-state-tint'] ??= overlay.tint;
        }
      }
      if (overlay.overlayKind === 'measurement' && overlay.fromEntityId === entity.entityId) {
        attributes['overlay-measure-to'] ??= overlay.toEntityId;
        if (overlay.label !== undefined) {
          attributes['overlay-measure-label'] ??= overlay.label;
        }
      }
    }
    nodes.push({
      id: nodeId,
      kind: 'spatial-3d',
      ref: {
        kind: 'world-entity',
        tenantId: scene.tenantScope.tenantId,
        entityId: entity.entityId,
        contentDigest: entity.contentDigest,
      },
      descriptor: {
        primitive: representation.value.primitive,
        position: entity.position,
        ...(entity.orientation !== undefined ? { orientation: entity.orientation } : {}),
        ...(representation.value.mesh !== undefined ? { mesh: representation.value.mesh } : {}),
        // The ontology recipe's scale is the default; the entity's own
        // presentation scale (set by hosts/zoom intents) wins.
        ...(entity.scale !== undefined
          ? { scale: entity.scale }
          : representation.value.scale !== undefined
            ? { scale: representation.value.scale }
            : {}),
      },
      ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
    });
    if (entity.label !== undefined) {
      const labelId = sceneNodeIdOf('l', entity.entityId);
      nodes.push({
        id: labelId,
        kind: 'label',
        descriptor: { text: entity.label, offset3d: [1, 1, 1] },
      });
      edges.push({ kind: 'anchors', from: labelId, to: nodeId });
    }
    // Applied annotation overlays render as anchored label nodes.
    for (const { overlay } of applied) {
      if (overlay.overlayKind === 'annotation' && overlay.entityId === entity.entityId) {
        const annotationId = sceneNodeIdOf('a', overlay.overlayId);
        const annotationAttributes: Record<string, JsonValue> = {
          'overlay-kind': 'annotation',
          'overlay-id': overlay.overlayId,
        };
        if (overlay.evidenceDigests !== undefined) {
          annotationAttributes['evidence-digests'] = overlay.evidenceDigests;
        }
        nodes.push({
          id: annotationId,
          kind: 'label',
          ref: {
            kind: 'world-entity',
            tenantId: scene.tenantScope.tenantId,
            entityId: entity.entityId,
            contentDigest: entity.contentDigest,
          },
          descriptor: { text: overlay.text, offset3d: [0, 1, 0] },
          attributes: annotationAttributes,
        });
        edges.push({ kind: 'anchors', from: annotationId, to: nodeId });
      }
    }
  }

  const presentation: ExperienceGraphContent = {
    ...graphBase(scene, context.device, '3d', 'spatial'),
    projectedFrom,
    nodes: sortNodes(nodes),
    edges: sortEdges(edges),
  };
  const presentationUsage = sumEntityUsage(presented, context.ontology);
  if (!presentationUsage.ok) {
    return presentationUsage;
  }

  // The animation clips graph (only when at least one instruction targets
  // a presented entity): the animatable spatial nodes + the clips.
  const animation = buildAnimationGraph(scene, context, presented);
  if (!animation.ok) {
    return animation;
  }
  return {
    ok: true,
    value: {
      presentation: { content: presentation, usage: presentationUsage.value },
      animation:
        animation.value !== null
          ? {
              content: animation.value.content,
              usage: animation.value.usage,
            }
          : null,
    },
  };
}

/** Sum the per-entity declared usage of an entity list (deterministic). */
function sumEntityUsage(
  entities: readonly import('./scene').SceneEntity[],
  ontology: import('./ontology').WorldOntology,
): WorldExperienceResult<SceneRenderUsage> {
  let estimatedTriangles = 0;
  let assetBytes = 0;
  for (const entity of entities) {
    const usage = entityRenderUsage(entity, ontology);
    if (!usage.ok) {
      return usage;
    }
    estimatedTriangles += usage.value.estimatedTriangles;
    assetBytes += usage.value.assetBytes;
  }
  return { ok: true, value: { estimatedTriangles, assetBytes } };
}

/** The 'animation' clips graph: presented animatable targets + clip nodes. */
function buildAnimationGraph(
  scene: WorldScene,
  context: SceneCompilationContext,
  presented: readonly import('./scene').SceneEntity[],
): WorldExperienceResult<{ content: ExperienceGraphContent; usage: SceneRenderUsage } | null> {
  const presentedIds = new Set(presented.map((entity) => entity.entityId));
  const animatedInstructions = scene.animations.filter((instruction) =>
    presentedIds.has(instruction.targetEntityId),
  );
  if (animatedInstructions.length === 0) {
    return { ok: true, value: null };
  }
  const animatedTargets = presented.filter((entity) =>
    animatedInstructions.some((instruction) => instruction.targetEntityId === entity.entityId),
  );
  const nodes: ExperienceNode[] = [];
  for (const entity of animatedTargets) {
    const representation = resolveOntologyRecordOfKind(
      context.ontology,
      entity.representationRecordId,
      'representation-3d',
    );
    if (!representation.ok) {
      return representation;
    }
    nodes.push({
      id: sceneNodeIdOf('e', entity.entityId),
      kind: 'spatial-3d',
      ref: {
        kind: 'world-entity',
        tenantId: scene.tenantScope.tenantId,
        entityId: entity.entityId,
        contentDigest: entity.contentDigest,
      },
      descriptor: {
        primitive: representation.value.primitive,
        position: entity.position,
        ...(entity.orientation !== undefined ? { orientation: entity.orientation } : {}),
        ...(representation.value.mesh !== undefined ? { mesh: representation.value.mesh } : {}),
        ...(entity.scale !== undefined
          ? { scale: entity.scale }
          : representation.value.scale !== undefined
            ? { scale: representation.value.scale }
            : {}),
      },
    });
  }
  for (const instruction of animatedInstructions) {
    const tracks = [
      {
        targetNodeId: sceneNodeIdOf('e', instruction.targetEntityId),
        propertyPath: instruction.propertyPath,
        keyframes: instruction.keyframes.map((keyframe) => ({
          atMs: keyframe.atMs,
          value: keyframe.value,
          easing: keyframe.easing ?? instruction.easing,
        })),
      },
    ];
    tracks.sort((a, b) =>
      a.targetNodeId === b.targetNodeId
        ? a.propertyPath < b.propertyPath
          ? -1
          : 1
        : a.targetNodeId < b.targetNodeId
          ? -1
          : 1,
    );
    nodes.push({
      id: sceneNodeIdOf('a', `clip-${instruction.instructionId}`),
      kind: 'animation-clip',
      descriptor: {
        durationMs: instruction.durationMs,
        tracks,
      },
    });
  }
  const entityRefs: Array<{
    kind: 'world-entity';
    tenantId: string;
    entityId: string;
    contentDigest: string;
  }> = animatedTargets.map((entity) => ({
    kind: 'world-entity' as const,
    tenantId: scene.tenantScope.tenantId,
    entityId: entity.entityId,
    contentDigest: entity.contentDigest,
  }));
  entityRefs.sort((a, b) => (a.entityId < b.entityId ? -1 : 1));
  const usage = sumEntityUsage(animatedTargets, context.ontology);
  if (!usage.ok) {
    return usage;
  }
  return {
    ok: true,
    value: {
      content: {
        ...graphBase(scene, context.device, 'animation', 'anim'),
        projectedFrom: entityRefs,
        nodes: sortNodes(nodes),
        edges: [],
      },
      usage: usage.value,
    },
  };
}

/** The narrative feed graph: one beat per narrative/status block. */
function buildNarrativeGraph(
  scene: WorldScene,
  device: DeviceDescriptor,
): ExperienceGraphContent | null {
  if (scene.narrativeBlocks.length === 0) {
    return null;
  }
  const cited = new Set<string>();
  for (const block of scene.narrativeBlocks) {
    for (const digest of block.evidenceDigests ?? []) {
      cited.add(digest);
    }
  }
  const evidenceRefs: Array<{
    kind: 'evidence-record';
    tenantId: string;
    recordDigest: string;
  }> = scene.evidenceReferences
    .filter((ref) => cited.has(ref.recordDigest))
    .map((ref) => ({
      kind: 'evidence-record' as const,
      tenantId: ref.tenantId,
      recordDigest: ref.recordDigest,
    }));
  evidenceRefs.sort((a, b) => (a.recordDigest < b.recordDigest ? -1 : 1));
  const projectedFrom: ProjectedReference[] = evidenceRefs;
  const nodes: ExperienceNode[] = scene.narrativeBlocks.map((block) => {
    const attributes: Record<string, JsonValue> = {};
    if (block.statusKey !== undefined) {
      attributes['status-key'] = block.statusKey;
    }
    if (block.evidenceDigests !== undefined) {
      attributes['evidence-digests'] = block.evidenceDigests;
    }
    return {
      id: sceneNodeIdOf('n', block.blockId),
      kind: 'narrative-beat',
      ...(block.evidenceDigests !== undefined && block.evidenceDigests.length === 1
        ? {
            ref: {
              kind: 'evidence-record' as const,
              tenantId: scene.tenantScope.tenantId,
              recordDigest: block.evidenceDigests[0],
            },
          }
        : {}),
      descriptor: {
        title: block.title,
        ...(block.body !== undefined ? { body: block.body } : {}),
        ...(block.tone !== undefined ? { tone: block.tone } : {}),
      },
      ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
    };
  });
  return {
    ...graphBase(scene, device, 'narrative', 'narrative'),
    projectedFrom,
    nodes: sortNodes(nodes),
    edges: [],
  };
}

/** The timeline/replay graph: one track, its markers, and the replay cursor. */
function buildTimelineGraph(scene: WorldScene, device: DeviceDescriptor): ExperienceGraphContent {
  const trackNodeId = sceneNodeIdOf('t', scene.sceneId);
  const nodes: ExperienceNode[] = [
    {
      id: trackNodeId,
      kind: 'timeline-track',
      descriptor: {
        label: scene.timeline.trackLabel,
        startMs: scene.timeline.trackStartMs,
        endMs: scene.timeline.trackEndMs,
      },
    },
  ];
  const edges: Array<{ kind: 'contains'; from: string; to: string }> = [];
  for (const marker of scene.timeline.markers) {
    const markerNodeId = sceneNodeIdOf('m', marker.markerId);
    nodes.push({
      id: markerNodeId,
      kind: 'timeline-marker',
      descriptor: {
        atMs: marker.atMs,
        ...(marker.label !== undefined ? { label: marker.label } : {}),
        markerKind: marker.markerKind,
      },
    });
    edges.push({ kind: 'contains', from: trackNodeId, to: markerNodeId });
  }
  const cursorNodeId = sceneNodeIdOf('c', `cursor-${scene.sceneId}`);
  nodes.push({
    id: cursorNodeId,
    kind: 'timeline-marker',
    descriptor: {
      atMs: scene.timeline.position.atMs,
      markerKind: 'replay-cursor',
    },
  });
  edges.push({ kind: 'contains', from: trackNodeId, to: cursorNodeId });
  return {
    ...graphBase(scene, device, 'timeline-replay', 'timeline'),
    nodes: sortNodes(nodes),
    edges: sortEdges(edges),
  };
}

/** The presence graph: seats per participant plus the followed agent cursor. */
function buildPresenceGraph(scene: WorldScene, device: DeviceDescriptor): ExperienceGraphContent | null {
  const nodes: ExperienceNode[] = scene.participants.map((participant) => ({
    id: sceneNodeIdOf('s', participant.participantId),
    kind: 'presence-seat',
    descriptor: { participant },
  }));
  const projectedFrom: ProjectedReference[] = [];
  if (scene.camera.mode === 'follow-agent') {
    projectedFrom.push({
      kind: 'agent',
      tenantId: scene.camera.agentRef.tenantId,
      agentId: scene.camera.agentRef.agentId,
      contentDigest: scene.camera.agentRef.contentDigest,
    });
    if (scene.camera.cursor !== undefined) {
      nodes.push({
        id: sceneNodeIdOf('c', `agent-${scene.camera.agentRef.agentId}`),
        kind: 'presence-cursor',
        descriptor: {
          participant: {
            participantId: scene.camera.agentRef.agentId,
            participantKind: 'agent',
          },
          ...(scene.camera.cursor.position2d !== undefined
            ? { position2d: scene.camera.cursor.position2d }
            : {}),
          ...(scene.camera.cursor.position3d !== undefined
            ? { position3d: scene.camera.cursor.position3d }
            : {}),
          ...(scene.camera.cursor.atMs !== undefined ? { atMs: scene.camera.cursor.atMs } : {}),
        },
      });
    }
  }
  if (nodes.length === 0) {
    return null;
  }
  return {
    ...graphBase(scene, device, 'presence', 'presence'),
    projectedFrom,
    nodes: sortNodes(nodes),
    edges: [],
  };
}

/** The controls graph: one control node per candidate/action control. */
function buildControlsGraph(scene: WorldScene, device: DeviceDescriptor): ExperienceGraphContent | null {
  if (scene.controls.length === 0) {
    return null;
  }
  const nodes: ExperienceNode[] = scene.controls.map((control) => ({
    id: sceneNodeIdOf('ctl', control.controlId),
    kind: 'control',
    descriptor: {
      controlKind: control.controlKind,
      intent: control.intent,
      ...(control.label !== undefined ? { label: control.label } : {}),
      ...(control.options !== undefined ? { options: control.options } : {}),
    },
  }));
  return {
    ...graphBase(scene, device, 'controls', 'controls'),
    nodes: sortNodes(nodes),
    edges: [],
  };
}

// ---------------------------------------------------------------------------
// Advance-frame and submit-intent compilation.
// ---------------------------------------------------------------------------

/**
 * Compile the next advance-frame envelope for a session that has executed
 * `lastFrameIndex` (pure: the next index is lastFrameIndex + 1 — the W013
 * monotonic execution order).
 */
export function compileFrameAdvance(input: {
  readonly invocationId: WorldInvocationId;
  readonly rendererSessionId: WorldRendererSessionId;
  readonly lastFrameIndex: number;
  readonly atMs: number;
}): WorldAdvanceFrameEnvelope {
  const envelope: WorldAdvanceFrameEnvelope = {
    schema: WORLD_RENDERER_INVOCATION_SCHEMA_NAME,
    protocolVersion: WORLD_RENDERER_PROTOCOL_VERSION,
    kind: 'advance-frame',
    invocationId: input.invocationId,
    rendererSessionId: input.rendererSessionId,
    frameIndex: Math.max(-1, input.lastFrameIndex) + 1,
    atMs: input.atMs,
  };
  return WorldAdvanceFrameEnvelopeSchema.parse(envelope);
}

/**
 * Compile one admitted world interaction intent into a W013 submit-intent
 * envelope (pure): the intent bridges to its typed ControlIntent
 * (R30 — shape-identical to the action-protocol ActionTypeReference) and
 * is emitted from the declared interaction modality.
 */
export function compileIntentSubmission(
  intent: WorldInteractionIntent,
  input: {
    readonly modality: InteractionModality;
    readonly invocationId: WorldInvocationId;
    readonly rendererSessionId: WorldRendererSessionId;
  },
): WorldSubmitIntentEnvelope {
  const envelope: WorldSubmitIntentEnvelope = {
    schema: WORLD_RENDERER_INVOCATION_SCHEMA_NAME,
    protocolVersion: WORLD_RENDERER_PROTOCOL_VERSION,
    kind: 'submit-intent',
    invocationId: input.invocationId,
    rendererSessionId: input.rendererSessionId,
    modality: input.modality,
    intent: controlIntentOf(intent),
  };
  return WorldSubmitIntentEnvelopeSchema.parse(envelope);
}

/** Validate a raw intent and compile its submit-intent envelope in one step. */
export function admitAndCompileIntentSubmission(
  input: unknown,
  coordinates: {
    readonly modality: InteractionModality;
    readonly invocationId: WorldInvocationId;
    readonly rendererSessionId: WorldRendererSessionId;
  },
): WorldExperienceResult<WorldSubmitIntentEnvelope> {
  const admitted = WorldInteractionIntentSchema.safeParse(input);
  if (!admitted.success) {
    return { ok: false, error: malformedRecordError(admitted.error) };
  }
  return { ok: true, value: compileIntentSubmission(admitted.data, coordinates) };
}

// ---------------------------------------------------------------------------
// Deterministic invocation-id derivation + digest chain.
// ---------------------------------------------------------------------------

function deriveInvocationId(
  base: WorldInvocationId,
  suffix: string,
): WorldExperienceResult<WorldInvocationId> {
  const derived = `${base}-${suffix}`;
  const checked = WorldInvocationIdSchema.safeParse(derived);
  if (!checked.success) {
    return {
      ok: false,
      error: malformedRecord([
        {
          path: 'invocationId',
          message: `the derived invocation id "${derived}" exceeds the shared message-id grammar — use a shorter invocation id base`,
        },
      ]),
    };
  }
  return { ok: true, value: checked.data };
}

/** The digest chain of a compilation: scene -> graphs -> mount envelopes. */
export function compilationDigestChain(
  compilation: SceneCompilation,
): Readonly<{ readonly sceneDigest: string; readonly graphDigests: readonly string[] }> {
  return {
    sceneDigest: compilation.sceneDigest,
    graphDigests: compilation.graphs.map((graph) => graph.digest),
  };
}

/** The canonical fingerprint of a compilation (content-addressed output). */
export function compilationFingerprint(compilation: SceneCompilation): string {
  return canonicalDigest({
    sceneDigest: compilation.sceneDigest,
    graphDigests: compilation.graphs.map((graph) => graph.digest),
    mountInvocationIds: compilation.mountEnvelopes.map((envelope) => envelope.invocationId),
    advanceInvocationId: compilation.advanceEnvelope.invocationId,
  } as unknown as JsonValue);
}
