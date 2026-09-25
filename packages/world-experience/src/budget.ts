/**
 * Renderer-budget respect: the world scene's visual states carry and
 * respect the W013 renderer descriptor budgets. This module owns the
 * MIRRORED W013 budget/limit grammar (the canonical home is
 * `@epoch/renderer-runtime`; renderer-runtime is a devDependency pinned by
 * the compile-time parity assertions in src/parity.ts and the runtime
 * parity tests — never a runtime dependency, the W012 precedent) plus the
 * scene usage accounting that feeds the mount envelopes' declared usage.
 *
 * Anything over budget is a typed `budget-exceeded` rejection — never a
 * silent degradation and never a silent clamp.
 */
import { z } from 'zod';
import type { SpatialPrimitive } from '@epoch/experience-protocol';
import type { WorldScene } from './scene';
import {
  resolveOntologyRecordOfKind,
  type MaterialRecord,
  type Representation3dRecord,
  type WorldOntology,
} from './ontology';
import { budgetExceededError } from './issues';
import type { WorldExperienceResult } from './errors';

// ---------------------------------------------------------------------------
// Mirrored W013 bounds (canonical home: @epoch/renderer-runtime version.ts).
// ---------------------------------------------------------------------------

/** Ceiling on a renderer's declared per-graph node budget (W013 mirror). */
export const WORLD_MAX_RENDERER_GRAPH_NODES = 65_536;

/** Ceiling on a renderer's declared per-graph edge budget (W013 mirror). */
export const WORLD_MAX_RENDERER_GRAPH_EDGES = 131_072;

/** Ceiling on a renderer's declared per-frame triangle budget (W013 mirror). */
export const WORLD_MAX_RENDERER_TRIANGLES = 100_000_000;

/** Ceiling on a renderer's declared texture-memory budget (W013 mirror). */
export const WORLD_MAX_RENDERER_TEXTURE_BYTES = 1_099_511_627_776;

/**
 * The renderer budgets a compilation enforces — MIRRORED shared record
 * (canonical home: @epoch/renderer-runtime RendererBudgets). Hosts pass
 * the W013 binding's effective budget subset; member-for-member pinned by
 * the compile-time parity assertion (src/parity.ts) and the runtime parity
 * test (test/renderer-parity.test.ts).
 */
export const WorldRenderBudgetsSchema = z
  .strictObject({
    /** Maximum nodes per hosted graph (required: always enforced). */
    maxGraphNodes: z.number().int().min(1).max(WORLD_MAX_RENDERER_GRAPH_NODES),
    /** Maximum edges per hosted graph (required: always enforced; 0 = no edges). */
    maxGraphEdges: z.number().int().min(0).max(WORLD_MAX_RENDERER_GRAPH_EDGES),
    /** Maximum declared triangles per mounted 3D/animation state. */
    maxTriangles: z
      .number()
      .int()
      .positive()
      .max(WORLD_MAX_RENDERER_TRIANGLES)
      .optional(),
    /** Maximum declared texture-memory usage per mounted state, in bytes. */
    maxTextureBytes: z
      .number()
      .int()
      .positive()
      .max(WORLD_MAX_RENDERER_TEXTURE_BYTES)
      .optional(),
  })
  .meta({
    id: 'WorldRenderBudgets',
    title: 'WorldRenderBudgets',
    description:
      'Renderer budgets a world-scene compilation enforces (mirrored shared record; canonical home @epoch/renderer-runtime).',
  });

/** One renderer-budget record (mirrored W013 grammar). */
export type WorldRenderBudgets = z.infer<typeof WorldRenderBudgetsSchema>;

// ---------------------------------------------------------------------------
// Triangle estimation (mirrored W012 estimates, parity-pinned).
// ---------------------------------------------------------------------------

/**
 * Neutral per-primitive triangle estimates — MIRRORED from the W012
 * experience compiler's PRIMITIVE_TRIANGLE_ESTIMATES (a devDependency
 * pinned by test/compiler-parity.test.ts; never a runtime dependency).
 * Mesh primitives carry their own content-addressed geometry, so their
 * estimate here is 0 (the mount envelope's declared usage is the honest
 * bound).
 */
export const WORLD_PRIMITIVE_TRIANGLE_ESTIMATES: Readonly<Record<SpatialPrimitive, number>> = {
  box: 12,
  cone: 2,
  cylinder: 4,
  mesh: 0,
  plane: 2,
  sphere: 1280,
};

// ---------------------------------------------------------------------------
// Scene usage accounting.
// ---------------------------------------------------------------------------

/** The declared resource usage of one compiled world scene. */
export interface SceneRenderUsage {
  /** Estimated triangles of the compiled spatial content. */
  readonly estimatedTriangles: number;
  /** Estimated texture-memory bytes of the compiled spatial content. */
  readonly assetBytes: number;
}

/**
 * The per-entity declared resource usage (the unit of scene/graph usage
 * accounting): the ontology representation's primitive estimate, plus the
 * mesh binding's byte size, plus the material texture's byte size. Pure
 * and deterministic. Unresolvable ontology references are typed
 * `unknown-ontology-record` rejections.
 */
export function entityRenderUsage(
  entity: import('./scene').SceneEntity,
  ontology: WorldOntology,
): WorldExperienceResult<SceneRenderUsage> {
  const representation = resolveOntologyRecordOfKind(
    ontology,
    entity.representationRecordId,
    'representation-3d',
  );
  if (!representation.ok) {
    return representation;
  }
  const estimatedTriangles = WORLD_PRIMITIVE_TRIANGLE_ESTIMATES[representation.value.primitive];
  let assetBytes = representation.value.mesh?.byteSize ?? 0;
  const material = resolveMaterial(ontology, representation.value);
  if (!material.ok) {
    return material;
  }
  if (material.value !== undefined && material.value.texture !== undefined) {
    assetBytes += material.value.texture.byteSize;
  }
  return { ok: true, value: { estimatedTriangles, assetBytes } };
}

/**
 * Compute the declared resource usage of a scene's PRESENTED spatial
 * content (visible entities, isolation applied): the sum of the per-entity
 * usage. Pure and deterministic.
 */
export function computeSceneRenderUsage(
  scene: WorldScene,
  ontology: WorldOntology,
): WorldExperienceResult<SceneRenderUsage> {
  let estimatedTriangles = 0;
  let assetBytes = 0;
  const isolated = scene.entities.filter((entity) => entity.isolated);
  const presented = isolated.length > 0 ? isolated : scene.entities.filter((e) => e.visible);
  for (const entity of presented) {
    const usage = entityRenderUsage(entity, ontology);
    if (!usage.ok) {
      return usage;
    }
    estimatedTriangles += usage.value.estimatedTriangles;
    assetBytes += usage.value.assetBytes;
  }
  return { ok: true, value: { estimatedTriangles, assetBytes } };
}

function resolveMaterial(
  ontology: WorldOntology,
  representation: Representation3dRecord,
): WorldExperienceResult<MaterialRecord | undefined> {
  if (representation.materialRecordId === undefined) {
    return { ok: true, value: undefined };
  }
  return resolveOntologyRecordOfKind(ontology, representation.materialRecordId, 'material');
}

/**
 * Enforce graph-level budgets against compiled graph shapes (node/edge
 * counts). Pure; violations are typed `budget-exceeded` rejections.
 */
export function enforceGraphBudgets(
  graphs: readonly { readonly graphKind: string; readonly nodeCount: number; readonly edgeCount: number }[],
  budgets: WorldRenderBudgets,
): WorldExperienceResult<void> {
  for (const graph of graphs) {
    if (graph.nodeCount > budgets.maxGraphNodes) {
      return {
        ok: false,
        error: budgetExceededError(
          ['graphs', graph.graphKind, 'nodes'],
          'graph-nodes',
          budgets.maxGraphNodes,
          graph.nodeCount,
        ),
      };
    }
    if (graph.edgeCount > budgets.maxGraphEdges) {
      return {
        ok: false,
        error: budgetExceededError(
          ['graphs', graph.graphKind, 'edges'],
          'graph-edges',
          budgets.maxGraphEdges,
          graph.edgeCount,
        ),
      };
    }
  }
  return { ok: true, value: undefined };
}

/**
 * Enforce declared-usage budgets (triangles, texture bytes). Pure;
 * violations are typed `budget-exceeded` rejections.
 */
export function enforceUsageBudgets(
  usage: SceneRenderUsage,
  budgets: WorldRenderBudgets,
): WorldExperienceResult<void> {
  if (budgets.maxTriangles !== undefined && usage.estimatedTriangles > budgets.maxTriangles) {
    return {
      ok: false,
      error: budgetExceededError(
        ['usage', 'estimatedTriangles'],
        'triangles',
        budgets.maxTriangles,
        usage.estimatedTriangles,
      ),
    };
  }
  if (budgets.maxTextureBytes !== undefined && usage.assetBytes > budgets.maxTextureBytes) {
    return {
      ok: false,
      error: budgetExceededError(
        ['usage', 'assetBytes'],
        'texture-bytes',
        budgets.maxTextureBytes,
        usage.assetBytes,
      ),
    };
  }
  return { ok: true, value: undefined };
}
