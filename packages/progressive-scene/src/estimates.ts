/**
 * Deterministic scene usage accounting (the W012 experience-compiler
 * usage discipline, mirrored — parity-pinned by devDependency tests,
 * never a runtime edge):
 *
 * - `nodes` / `edges` are exact counts of the admitted graph;
 * - `estimatedTriangles` sums the neutral per-primitive estimates
 *   ({@link PROGRESSIVE_PRIMITIVE_TRIANGLE_ESTIMATES} — conservative
 *   budget estimates, NOT render truth; opaque `mesh` assets contribute
 *   0 to the primitive estimate and are accounted in `assetBytes`);
 * - `assetBytes` is the exact sum of declared mesh-binding `byteSize`
 *   values (content-addressed asset bytes consume the texture budget).
 */
import type { ExperienceGraph, SpatialPrimitive } from '@epoch/experience-protocol';

/**
 * Neutral per-primitive triangle estimates — MIRRORED from the W012
 * experience compiler's PRIMITIVE_TRIANGLE_ESTIMATES (a devDependency
 * pinned by test/compiler-parity.test.ts; never a runtime dependency,
 * the W016 budget.ts precedent). Mesh primitives carry their own
 * content-addressed geometry, so their estimate is 0 (the mount
 * envelope's declared usage is the honest bound).
 */
export const PROGRESSIVE_PRIMITIVE_TRIANGLE_ESTIMATES: Readonly<Record<SpatialPrimitive, number>> = {
  box: 12,
  cone: 2,
  cylinder: 4,
  mesh: 0,
  plane: 2,
  sphere: 1280,
};

/** The estimated resource usage of one scene graph (deterministic). */
export interface SceneUsage {
  /** Exact node count. */
  readonly nodes: number;
  /** Exact edge count. */
  readonly edges: number;
  /** Deterministic per-primitive triangle estimate. */
  readonly estimatedTriangles: number;
  /** Exact sum of declared mesh-binding byte sizes (asset bytes). */
  readonly assetBytes: number;
}

/** Compute the deterministic resource usage of an admitted graph. */
export function estimateGraphUsage(graph: ExperienceGraph): SceneUsage {
  let estimatedTriangles = 0;
  let assetBytes = 0;
  for (const node of graph.nodes) {
    if (node.kind !== 'spatial-3d') continue;
    estimatedTriangles += PROGRESSIVE_PRIMITIVE_TRIANGLE_ESTIMATES[node.descriptor.primitive];
    if (node.descriptor.mesh !== undefined && node.descriptor.mesh.byteSize !== undefined) {
      assetBytes += node.descriptor.mesh.byteSize;
    }
  }
  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    estimatedTriangles,
    assetBytes,
  };
}

/** Whether a usage fits a budget envelope (pure comparison). */
export function usageFits(
  usage: SceneUsage,
  limits: { readonly maxGraphNodes: number; readonly maxGraphEdges: number; readonly maxTriangles?: number; readonly maxTextureBytes?: number },
): boolean {
  if (usage.nodes > limits.maxGraphNodes) return false;
  if (usage.edges > limits.maxGraphEdges) return false;
  if (limits.maxTriangles !== undefined && usage.estimatedTriangles > limits.maxTriangles) {
    return false;
  }
  if (limits.maxTextureBytes !== undefined && usage.assetBytes > limits.maxTextureBytes) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// The zod validator of the usage record (published contract surface).
// ---------------------------------------------------------------------------

/** The deterministic resource usage of one scene graph (zod). */
import { z } from 'zod';

export const SceneUsageSchema = z
  .strictObject({
    nodes: z.number().int().nonnegative(),
    edges: z.number().int().nonnegative(),
    estimatedTriangles: z.number().int().nonnegative(),
    assetBytes: z.number().int().nonnegative(),
  })
  .meta({
    id: 'SceneUsage',
    title: 'SceneUsage',
    description:
      'The deterministic resource usage of one scene graph: exact node/edge counts, per-primitive triangle estimate, and declared asset bytes.',
  });
