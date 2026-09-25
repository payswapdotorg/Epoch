/**
 * Device-aware plan shaping: deterministic resource accounting of an
 * admitted W011 Experience Graph, and typed budget enforcement against
 * the TARGET device descriptor.
 *
 * Policy (typed rejections, never silent degradation — R29):
 * - `nodes` / `edges` are exact counts of the admitted graph;
 * - `estimatedTriangles` is the deterministic per-primitive estimate
 *   (PRIMITIVE_TRIANGLE_ESTIMATES; conservative budget estimates, NOT
 *   render truth — opaque `mesh` assets contribute 0 to the primitive
 *   estimate and are accounted in `assetBytes` instead);
 * - `assetBytes` is the exact sum of declared mesh-binding `byteSize`
 *   values (content-addressed asset bytes consume the device's 3D
 *   content memory budget);
 * - when the target device DECLARES `maxTriangles`, the estimated
 *   triangle total must fit, else `device-budget-exceeded`;
 * - when the target device DECLARES `maxTextureBytes`, every mesh asset
 *   must declare its byte size (accountability: opaque content under a
 *   declared budget is a typed `malformed-descriptor` rejection — the
 *   descriptor lacks the field the budget requires) and the total must
 *   fit, else `device-budget-exceeded`;
 * - fidelity capabilities the compiler cannot count deterministically
 *   (pixels, refresh, color depth, latency, stereoscopy, pose tracking,
 *   modalities) are NOT guessed at: they are carried into the plan's
 *   typed `constraints` for the downstream presenter (W019 adapts), so
 *   nothing is silently degraded and nothing is silently invented.
 */
import type { DeviceDescriptor, ExperienceGraph } from '@epoch/experience-protocol';
import { PRIMITIVE_TRIANGLE_ESTIMATES } from './version';
import type { CompilerError } from './errors';
import type { PlanConstraints, RenderPlanUsage } from './plan';

/** Compute the deterministic resource usage of an admitted graph. */
export function computePlanUsage(graph: ExperienceGraph): RenderPlanUsage {
  let estimatedTriangles = 0;
  let assetBytes = 0;
  for (const node of graph.nodes) {
    if (node.kind !== 'spatial-3d') continue;
    estimatedTriangles += PRIMITIVE_TRIANGLE_ESTIMATES[node.descriptor.primitive];
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

/**
 * Enforce the target device's declared budgets over the graph and its
 * computed usage. Total: violations surface as typed errors (never bare
 * throws, never silent degradation).
 *
 * The accountability rule runs FIRST (an unaccountable mesh under a
 * declared memory budget is a descriptor deficiency with a precise
 * path), then the countable totals are enforced.
 */
export function enforceDeviceBudgets(
  graph: ExperienceGraph,
  usage: RenderPlanUsage,
  device: DeviceDescriptor,
): CompilerError | null {
  const maxTextureBytes = device.spatial.maxTextureBytes;
  if (maxTextureBytes !== undefined) {
    // Accountability: opaque mesh assets under a declared memory budget
    // must declare their byte size.
    for (let i = 0; i < graph.nodes.length; i += 1) {
      const node = graph.nodes[i];
      if (node.kind !== 'spatial-3d') continue;
      const mesh = node.descriptor.mesh;
      if (mesh !== undefined && mesh.byteSize === undefined) {
        return {
          code: 'malformed-descriptor',
          message:
            `mesh binding on node "${node.id}" lacks byteSize, which is required for ` +
            `texture-memory budget accounting on a device that declares maxTextureBytes ` +
            `(${maxTextureBytes}) — opaque content under a declared budget must be accountable`,
          issues: [
            {
              path: `nodes.${i}.descriptor.mesh.byteSize`,
              message: 'byteSize is required when the target device declares maxTextureBytes',
            },
          ],
        };
      }
    }
    if (usage.assetBytes > maxTextureBytes) {
      return {
        code: 'device-budget-exceeded',
        message:
          `the compiled content's mesh-asset bytes (${usage.assetBytes}) exceed the target device's ` +
          `3D content memory budget (${maxTextureBytes}) — device-aware plan shaping rejects instead of degrading`,
        path: ['usage', 'assetBytes'],
        limit: 'maxTextureBytes',
        expected: maxTextureBytes,
        encountered: usage.assetBytes,
      };
    }
  }

  const maxTriangles = device.spatial.maxTriangles;
  if (maxTriangles !== undefined && usage.estimatedTriangles > maxTriangles) {
    return {
      code: 'device-budget-exceeded',
      message:
        `the compiled content's estimated triangle usage (${usage.estimatedTriangles}) exceeds the ` +
        `target device's triangle budget (${maxTriangles}) — device-aware plan shaping rejects instead of degrading`,
      path: ['usage', 'estimatedTriangles'],
      limit: 'maxTriangles',
      expected: maxTriangles,
      encountered: usage.estimatedTriangles,
    };
  }

  return null;
}

/** Derive the typed plan constraints from the target device (as data). */
export function constraintsOf(device: DeviceDescriptor): PlanConstraints {
  return {
    stereoscopic: device.display.stereoscopic,
    poseTracking: device.spatial.poseTracking,
    worldAnchored: device.spatial.worldAnchored,
    interaction: [...device.interaction],
    maxPixels: device.display.maxPixels,
    refreshHz: device.display.refreshHz,
    colorDepthBits: device.display.colorDepthBits,
    maxTriangles: device.spatial.maxTriangles,
    maxTextureBytes: device.spatial.maxTextureBytes,
    latencyBudgetMs: device.latencyBudgetMs,
  };
}
