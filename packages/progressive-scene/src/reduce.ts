/**
 * The deterministic reduction engine — one pure applicator per
 * {@link ReductionStageKind} (the canonical ladder stages).
 *
 * Every applicator is a TOTAL pure function over a sealed W011 graph:
 * it returns the next sealed graph plus the explicit
 * {@link RungReduction} manifest (which nodes were pruned, which
 * primitives were substituted, how many edges dropped, and the usage
 * before/after) — reduction is NEVER silent (the W016 fidelity
 * discipline). Applicators never mutate their inputs; surviving nodes
 * keep their projected kernel references and the graph keeps its
 * tenant scope, graph id, projected inputs, and device slot verbatim
 * (same semantics, different fidelity).
 */
import { z } from 'zod';
import type { ExperienceGraph, ExperienceNode } from '@epoch/experience-protocol';
import { sealExperienceGraph } from '@epoch/experience-protocol';
import { PROGRESSIVE_PRIMITIVE_TRIANGLE_ESTIMATES, estimateGraphUsage } from './estimates';
import { PROXY_PRIMITIVE, type ReductionStageKind } from './version';

/** One primitive substitution record (the geometry LOD step). */
export const PrimitiveSubstitutionSchema = z
  .strictObject({
    nodeId: z.string().min(1),
    fromPrimitive: z.enum(['box', 'cone', 'cylinder', 'mesh', 'plane', 'sphere']),
    toPrimitive: z.enum(['box', 'cone', 'cylinder', 'mesh', 'plane', 'sphere']),
  })
  .meta({
    id: 'PrimitiveSubstitution',
    title: 'PrimitiveSubstitution',
    description: 'One explicit primitive substitution: node id, source primitive, proxy primitive.',
  });

/** One primitive substitution. */
export type PrimitiveSubstitution = z.infer<typeof PrimitiveSubstitutionSchema>;

/** The explicit reduction manifest of one ladder rung. */
export const RungReductionSchema = z
  .strictObject({
    stage: z.enum([
      'downgrade-expensive-primitives',
      'drop-animation-clips',
      'prune-control-nodes',
      'prune-presence-cursors',
      'prune-presence-seats',
      'prune-shape-nodes',
      'prune-spatial-nodes',
      'prune-timeline-markers',
      'prune-timeline-tracks',
      'prune-to-minimal-core',
      'substitute-mesh-proxies',
    ]),
    /** Sorted ids of the nodes this rung pruned (empty for substitutions). */
    prunedNodeIds: z.array(z.string().min(1)),
    /** The explicit primitive substitutions this rung applied. */
    substitutions: z.array(PrimitiveSubstitutionSchema),
    /** How many edges dropped with the pruned/substituted content. */
    droppedEdgeCount: z.number().int().nonnegative(),
    /** Usage of the rung BEFORE this reduction. */
    usageBefore: z
      .strictObject({
        nodes: z.number().int().nonnegative(),
        edges: z.number().int().nonnegative(),
        estimatedTriangles: z.number().int().nonnegative(),
        assetBytes: z.number().int().nonnegative(),
      })
      .readonly(),
    /** Usage of the rung AFTER this reduction. */
    usageAfter: z
      .strictObject({
        nodes: z.number().int().nonnegative(),
        edges: z.number().int().nonnegative(),
        estimatedTriangles: z.number().int().nonnegative(),
        assetBytes: z.number().int().nonnegative(),
      })
      .readonly(),
  })
  .meta({
    id: 'RungReduction',
    title: 'RungReduction',
    description:
      'The explicit reduction manifest of one progressive-scene rung: stage, pruned nodes, substitutions, dropped edges, and usage before/after (never silent).',
  });

/** One rung reduction manifest. */
export type RungReduction = z.infer<typeof RungReductionSchema>;

/** The outcome of one applied stage: next sealed graph + manifest. */
export interface StageOutcome {
  readonly graph: ExperienceGraph;
  readonly reduction: RungReduction;
}

/** Node-kind selectors per prune stage (deterministic, closed). */
const PRUNE_STAGE_KINDS: Readonly<Record<string, readonly string[]>> = {
  'prune-presence-cursors': ['presence-cursor'],
  'prune-presence-seats': ['presence-seat'],
  'prune-timeline-markers': ['timeline-marker'],
  'prune-timeline-tracks': ['timeline-track'],
  'prune-spatial-nodes': ['spatial-3d'],
  'prune-shape-nodes': ['shape-2d'],
  'prune-control-nodes': ['control'],
};

/** The stage kinds whose applicator is a node-kind prune. */
export const PRUNE_STAGES = [
  'prune-presence-cursors',
  'prune-presence-seats',
  'prune-timeline-markers',
  'prune-timeline-tracks',
  'prune-spatial-nodes',
  'prune-shape-nodes',
  'prune-control-nodes',
] as const;

/** One prune-stage kind. */
export type PruneStageKind = (typeof PRUNE_STAGES)[number];

/** The node kinds a prune stage removes (pure lookup). */
export function pruneStageKinds(stage: PruneStageKind): readonly string[] {
  return PRUNE_STAGE_KINDS[stage] ?? [];
}

/** Drop every edge that touches a removed node id (deterministic filter). */
function edgesWithout(
  graph: ExperienceGraph,
  removed: ReadonlySet<string>,
): ExperienceGraph['edges'] {
  return graph.edges.filter(
    (edge) => !removed.has(edge.from) && !removed.has(edge.to),
  );
}

/** Build the stage outcome with before/after usage accounting. */
function outcome(
  stage: ReductionStageKind,
  before: ExperienceGraph,
  afterNodes: readonly ExperienceNode[],
  afterEdges: ExperienceGraph['edges'],
  prunedNodeIds: readonly string[],
  substitutions: readonly PrimitiveSubstitution[],
): StageOutcome {
  const usageBefore = estimateGraphUsage(before);
  // Reseal with the after-content (edges replaced where provided).
  const sealed = sealExperienceGraph({
    schema: before.schema,
    protocolVersion: before.protocolVersion,
    graphId: before.graphId,
    graphKind: before.graphKind,
    tenantScope: before.tenantScope,
    projectedFrom: before.projectedFrom,
    nodes: [...afterNodes],
    edges: afterEdges,
    device: before.device,
  });
  if (!sealed.ok) {
    throw new Error(
      `derived rung failed to reseal (internal invariant): ${sealed.error.message}`,
    );
  }
  const usageAfter = estimateGraphUsage(sealed.value);
  return {
    graph: sealed.value,
    reduction: {
      stage,
      prunedNodeIds: [...prunedNodeIds].sort(),
      substitutions: [...substitutions],
      droppedEdgeCount: before.edges.length - afterEdges.length,
      usageBefore,
      usageAfter,
    },
  };
}

// ---------------------------------------------------------------------------
// Stage applicators.
// ---------------------------------------------------------------------------

/** Stage 1: drop every animation-clip node (and its edges). */
export function dropAnimationClips(graph: ExperienceGraph): StageOutcome | null {
  const kept = graph.nodes.filter((node) => node.kind !== 'animation-clip');
  if (kept.length === graph.nodes.length) {
    return null; // nothing to drop — stage skipped
  }
  const removed = new Set(
    graph.nodes.filter((node) => node.kind === 'animation-clip').map((node) => node.id),
  );
  const pruned = [...removed].sort();
  const edges = edgesWithout(graph, removed);
  // Animation clips target spatial nodes via 'animates' edges; those edges
  // drop with the clips. Surviving spatial nodes keep their refs.
  return outcome(
    'drop-animation-clips',
    graph,
    kept,
    edges,
    pruned,
    [],
  );
}

/** Stage 2: substitute mesh primitives with neutral box proxies (drops asset bytes). */
export function substituteMeshProxies(graph: ExperienceGraph): StageOutcome | null {
  const substitutions: PrimitiveSubstitution[] = [];
  let changed = false;
  const nodes = graph.nodes.map((node) => {
    if (node.kind === 'spatial-3d' && node.descriptor.primitive === 'mesh') {
      changed = true;
      substitutions.push({
        nodeId: node.id,
        fromPrimitive: 'mesh',
        toPrimitive: PROXY_PRIMITIVE,
      });
      const { mesh: _mesh, ...descriptor } = node.descriptor;
      void _mesh;
      return { ...node, descriptor: { ...descriptor, primitive: PROXY_PRIMITIVE } };
    }
    return node;
  });
  if (!changed) {
    return null;
  }
  return outcome('substitute-mesh-proxies', graph, nodes, graph.edges, [], substitutions);
}

/** Stage 3: downgrade expensive primitives (sphere) to the box proxy. */
export function downgradeExpensivePrimitives(graph: ExperienceGraph): StageOutcome | null {
  const proxyCost = PROGRESSIVE_PRIMITIVE_TRIANGLE_ESTIMATES.box;
  const substitutions: PrimitiveSubstitution[] = [];
  let changed = false;
  const nodes = graph.nodes.map((node) => {
    if (node.kind !== 'spatial-3d') return node;
    const cost = PROGRESSIVE_PRIMITIVE_TRIANGLE_ESTIMATES[node.descriptor.primitive];
    if (node.descriptor.primitive === 'mesh' || cost <= proxyCost) {
      return node;
    }
    changed = true;
    substitutions.push({
      nodeId: node.id,
      fromPrimitive: node.descriptor.primitive,
      toPrimitive: PROXY_PRIMITIVE,
    });
    const { mesh: _mesh, ...descriptor } = node.descriptor;
    void _mesh;
    return { ...node, descriptor: { ...descriptor, primitive: PROXY_PRIMITIVE } };
  });
  if (!changed) {
    return null;
  }
  return outcome(
    'downgrade-expensive-primitives',
    graph,
    nodes,
    graph.edges,
    [],
    substitutions,
  );
}

/** Generic node-kind prune stage (the supplementary/geometry/control stages). */
function pruneKind(
  stage: ReductionStageKind,
  graph: ExperienceGraph,
  kinds: readonly string[],
): StageOutcome | null {
  const remove = new Set(kinds);
  const targets = graph.nodes.filter((node) => remove.has(node.kind));
  if (targets.length === 0) {
    return null;
  }
  // A prune stage never empties the graph: if every node would go, keep
  // the first node in canonical order (the minimal core survives).
  const kept = graph.nodes.filter((node) => !remove.has(node.kind));
  const retainedFallback = kept.length === 0 ? [graph.nodes[0]] : kept;
  const removedIds = new Set(targets.map((node) => node.id));
  if (retainedFallback.length !== kept.length) {
    // The fallback retained node was among the targets: un-remove it.
    removedIds.delete(retainedFallback[0].id);
  }
  const edges = edgesWithout(graph, removedIds);
  const pruned = [...removedIds].sort();
  return outcome(stage, graph, retainedFallback, edges, pruned, []);
}

/** Stage 4: prune presence-cursor nodes. */
export function prunePresenceCursors(graph: ExperienceGraph): StageOutcome | null {
  return pruneKind('prune-presence-cursors', graph, PRUNE_STAGE_KINDS['prune-presence-cursors']!);
}

/** Stage 5: prune presence-seat nodes. */
export function prunePresenceSeats(graph: ExperienceGraph): StageOutcome | null {
  return pruneKind('prune-presence-seats', graph, PRUNE_STAGE_KINDS['prune-presence-seats']!);
}

/** Stage 6: prune timeline-marker nodes. */
export function pruneTimelineMarkers(graph: ExperienceGraph): StageOutcome | null {
  return pruneKind('prune-timeline-markers', graph, PRUNE_STAGE_KINDS['prune-timeline-markers']!);
}

/** Stage 7: prune timeline-track nodes. */
export function pruneTimelineTracks(graph: ExperienceGraph): StageOutcome | null {
  return pruneKind('prune-timeline-tracks', graph, PRUNE_STAGE_KINDS['prune-timeline-tracks']!);
}

/** Stage 8: prune spatial-3d nodes (the 3D -> 2D fallback). */
export function pruneSpatialNodes(graph: ExperienceGraph): StageOutcome | null {
  return pruneKind('prune-spatial-nodes', graph, PRUNE_STAGE_KINDS['prune-spatial-nodes']!);
}

/** Stage 9: prune shape-2d nodes. */
export function pruneShapeNodes(graph: ExperienceGraph): StageOutcome | null {
  return pruneKind('prune-shape-nodes', graph, PRUNE_STAGE_KINDS['prune-shape-nodes']!);
}

/** Stage 10: prune control nodes. */
export function pruneControlNodes(graph: ExperienceGraph): StageOutcome | null {
  return pruneKind('prune-control-nodes', graph, PRUNE_STAGE_KINDS['prune-control-nodes']!);
}

/** Stage 11: prune nodes (canonical ascending id) until exactly one remains. */
export function pruneToMinimalCore(graph: ExperienceGraph): StageOutcome | null {
  if (graph.nodes.length <= 1) {
    return null;
  }
  const survivors = [graph.nodes[0]];
  const removedIds = new Set(graph.nodes.slice(1).map((node) => node.id));
  const edges = edgesWithout(graph, removedIds);
  const pruned = [...removedIds].sort();
  return outcome('prune-to-minimal-core', graph, survivors, edges, pruned, []);
}

// ---------------------------------------------------------------------------
// The canonical stage table.
// ---------------------------------------------------------------------------

/** One stage applicator entry of the canonical table. */
export interface StageApplicator {
  readonly stage: ReductionStageKind;
  readonly apply: (graph: ExperienceGraph) => StageOutcome | null;
}

/** The canonical stage table (the ladder derivation sequence). */
export const CANONICAL_STAGE_TABLE: readonly StageApplicator[] = [
  { stage: 'drop-animation-clips', apply: dropAnimationClips },
  { stage: 'substitute-mesh-proxies', apply: substituteMeshProxies },
  { stage: 'downgrade-expensive-primitives', apply: downgradeExpensivePrimitives },
  { stage: 'prune-presence-cursors', apply: prunePresenceCursors },
  { stage: 'prune-presence-seats', apply: prunePresenceSeats },
  { stage: 'prune-timeline-markers', apply: pruneTimelineMarkers },
  { stage: 'prune-timeline-tracks', apply: pruneTimelineTracks },
  { stage: 'prune-spatial-nodes', apply: pruneSpatialNodes },
  { stage: 'prune-shape-nodes', apply: pruneShapeNodes },
  { stage: 'prune-control-nodes', apply: pruneControlNodes },
  { stage: 'prune-to-minimal-core', apply: pruneToMinimalCore },
];

/** Apply one named stage (pure; returns null when inapplicable). */
export function applyStage(
  graph: ExperienceGraph,
  stage: ReductionStageKind,
): StageOutcome | null {
  const entry = CANONICAL_STAGE_TABLE.find((candidate) => candidate.stage === stage);
  if (entry === undefined) {
    return null;
  }
  return entry.apply(graph);
}
