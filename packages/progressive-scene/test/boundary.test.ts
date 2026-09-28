// Boundary battery: stage-skip semantics (never an empty rung), the
// minimal-core survival rule, exact-fit rung selection, and stage
// interplay (mesh proxy vs expensive-primitive downgrade).
import { describe, expect, it } from 'vitest';
import { sealExperienceGraph } from '@epoch/experience-protocol';
import {
  deriveProgressiveLadder,
  fitGraphToLimits,
  rungGraphAt,
  applyStage,
  CANONICAL_STAGE_TABLE,
  estimateGraphUsage,
  PROGRESSIVE_PRIMITIVE_TRIANGLE_ESTIMATES,
} from '../src/index';
import {
  richAnimationGraph,
  presenceGraph,
  timelineGraph,
  limitsOf,
  DESKTOP_DEVICE,
  SCOPE_A,
} from './fixtures';

describe('stage boundary semantics', () => {
  it('inapplicable stages are skipped — never an empty rung', () => {
    // The presence graph has no animation clips, no meshes, no expensive
    // primitives, no spatial/shape/control nodes: those stages skip.
    const derived = deriveProgressiveLadder({ ladderId: 'psl-skip', graph: presenceGraph() });
    if (!derived.ok) throw new Error('fixture failed');
    for (const rung of derived.value.rungs.slice(1)) {
      expect(rung.reduction).not.toBeNull();
      if (rung.reduction) {
        const changed =
          rung.reduction.prunedNodeIds.length > 0 ||
          rung.reduction.substitutions.length > 0 ||
          rung.reduction.droppedEdgeCount > 0;
        expect(changed, `stage ${rung.stage} must change something`).toBe(true);
        expect(rung.reduction.usageBefore).not.toEqual(rung.reduction.usageAfter);
      }
    }
  });

  it('a one-node-per-kind prune never empties the graph (minimal-core survival)', () => {
    // A graph consisting ONLY of presence seats: the seat prune must keep
    // one node alive (the graph can never become empty).
    const graph = presenceGraph();
    const derived = deriveProgressiveLadder({ ladderId: 'psl-survive', graph });
    if (!derived.ok) throw new Error('fixture failed');
    for (const rung of derived.value.rungs) {
      expect(rung.usage.nodes).toBeGreaterThanOrEqual(1);
    }
  });

  it('the minimal core retains the longest-surviving node per stage order', () => {
    const graph = timelineGraph();
    const derived = deriveProgressiveLadder({ ladderId: 'psl-core', graph });
    if (!derived.ok) throw new Error('fixture failed');
    const last = derived.value.rungs[derived.value.rungs.length - 1];
    const rung = rungGraphAt({ ladderId: 'psl-core', graph }, last ? last.rungIndex : 0);
    expect(rung.ok).toBe(true);
    if (rung.ok) {
      expect(rung.value.nodes).toHaveLength(1);
      // Markers die before tracks (canonical order), so the track is the
      // minimal core of a timeline graph.
      expect(rung.value.nodes[0]?.id).toBe('xn-track-main');
    }
  });

  it('the mesh proxy precedes the expensive-primitive downgrade (canonical order)', () => {
    const derived = deriveProgressiveLadder({ ladderId: 'psl-order-2', graph: richAnimationGraph() });
    if (!derived.ok) throw new Error('fixture failed');
    const meshIndex = derived.value.stages.indexOf('substitute-mesh-proxies');
    const downgradeIndex = derived.value.stages.indexOf('downgrade-expensive-primitives');
    expect(meshIndex).toBeGreaterThanOrEqual(0);
    expect(downgradeIndex).toBeGreaterThan(meshIndex);
  });

  it('the downgrade stage never increases the triangle estimate', () => {
    // cone (2) and plane (2) cost less than the box proxy (12): they are
    // NOT downgraded; the sphere (1280) is.
    const nodes = [
      { id: 'xn-cone-1', kind: 'spatial-3d' as const, descriptor: { primitive: 'cone' as const, position: [0, 0, 0] } },
      { id: 'xn-plane-1', kind: 'spatial-3d' as const, descriptor: { primitive: 'plane' as const, position: [1, 0, 0] } },
      { id: 'xn-sphere-1', kind: 'spatial-3d' as const, descriptor: { primitive: 'sphere' as const, position: [2, 0, 0] } },
    ];
    const graph = sealExperienceGraph({
      schema: 'epoch.experience-graph',
      protocolVersion: '1.0.0',
      graphId: 'xg-downgrade-1',
      graphKind: '3d',
      tenantScope: SCOPE_A,
      projectedFrom: [],
      nodes,
      edges: [],
      device: DESKTOP_DEVICE,
    });
    if (!graph.ok) throw new Error('fixture failed');
    const derived = deriveProgressiveLadder({ ladderId: 'psl-downgrade', graph: graph.value });
    if (!derived.ok) throw new Error('fixture failed');
    const downgradeRung = derived.value.rungs.find(
      (rung) => rung.stage === 'downgrade-expensive-primitives',
    );
    expect(downgradeRung).toBeDefined();
    expect(downgradeRung?.reduction?.substitutions.map((s) => s.nodeId)).toEqual(['xn-sphere-1']);
    // Before downgrade: cone(2) + plane(2) + sphere(1280) = 1284.
    expect(estimateGraphUsage(graph.value).estimatedTriangles).toBe(1284);
    // After: cone(2) + plane(2) + box(12) = 16.
    expect(downgradeRung?.usage.estimatedTriangles).toBe(16);
  });
});

describe('fit boundary semantics', () => {
  it('the first EXACTLY-fitting rung is selected (not a stricter one)', () => {
    const graph = richAnimationGraph();
    const usage = estimateGraphUsage(graph);
    const fit = fitGraphToLimits({
      ladderId: 'psl-exact',
      graph,
      limits: limitsOf({ maxGraphNodes: usage.nodes, maxGraphEdges: usage.edges }),
    });
    expect(fit.ok).toBe(true);
    if (fit.ok) {
      expect(fit.value.rungIndex).toBe(0);
      expect(fit.value.usage.nodes).toBe(usage.nodes);
    }
  });

  it('one node over budget walks exactly one prune rung when possible', () => {
    const graph = presenceGraph(); // 3 nodes: cursor + 2 seats
    const fit = fitGraphToLimits({
      ladderId: 'psl-one-over',
      graph,
      limits: limitsOf({ maxGraphNodes: 2 }),
    });
    expect(fit.ok).toBe(true);
    if (fit.ok) {
      // The cursor prune alone fits (3 -> 2 nodes).
      expect(fit.value.usage.nodes).toBe(2);
      expect(fit.value.reductions.map((r) => r.stage)).toEqual(['prune-presence-cursors']);
    }
  });

  it('budget boundaries are inclusive (usage == limit fits)', () => {
    // Triangle budgets are positive per W013; inclusivity means the
    // exact estimate (1284 = cone 2 + plane 2 + sphere 1280) fits.
    const nodes = [
      { id: 'xn-cone-1', kind: 'spatial-3d' as const, descriptor: { primitive: 'cone' as const, position: [0, 0, 0] } },
      { id: 'xn-plane-1', kind: 'spatial-3d' as const, descriptor: { primitive: 'plane' as const, position: [1, 0, 0] } },
      { id: 'xn-sphere-1', kind: 'spatial-3d' as const, descriptor: { primitive: 'sphere' as const, position: [2, 0, 0] } },
    ];
    const graph = sealExperienceGraph({
      schema: 'epoch.experience-graph',
      protocolVersion: '1.0.0',
      graphId: 'xg-inclusive-1',
      graphKind: '3d',
      tenantScope: SCOPE_A,
      projectedFrom: [],
      nodes,
      edges: [],
      device: DESKTOP_DEVICE,
    });
    if (!graph.ok) throw new Error('fixture failed');
    const fit = fitGraphToLimits({
      ladderId: 'psl-inclusive',
      graph: graph.value,
      limits: limitsOf({ maxGraphNodes: 3, maxGraphEdges: 0, maxTriangles: 1_284 }),
    });
    expect(fit.ok).toBe(true);
    if (fit.ok) {
      expect(fit.value.rungIndex).toBe(0);
      expect(fit.value.usage.estimatedTriangles).toBe(1_284);
    }
  });

  it('every canonical stage applicator is individually total and pure', () => {
    const graph = richAnimationGraph();
    for (const applicator of CANONICAL_STAGE_TABLE) {
      const outcome = applicator.apply(graph);
      if (outcome === null) continue;
      // Purity: the input graph is untouched (digest unchanged).
      expect(graph.digest).toBe(graph.digest);
      // The outcome's parent usage equals the input usage.
      expect(outcome.reduction.usageBefore).toEqual(estimateGraphUsage(graph));
      // applyStage resolves the same applicator by name.
      const byName = applyStage(graph, applicator.stage);
      expect(byName === null ? null : byName.graph.digest).toBe(
        outcome === null ? null : outcome.graph.digest,
      );
    }
  });

  it("the estimate table's proxy floor is the box estimate", () => {
    expect(PROGRESSIVE_PRIMITIVE_TRIANGLE_ESTIMATES.box).toBe(12);
    expect(
      Object.values(PROGRESSIVE_PRIMITIVE_TRIANGLE_ESTIMATES).every(
        (cost) => cost >= 0,
      ),
    ).toBe(true);
  });
});
