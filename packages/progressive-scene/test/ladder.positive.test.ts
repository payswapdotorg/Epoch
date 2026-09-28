// Positive battery: ladder derivation over the canonical stage table —
// explicit manifests, digest chaining, re-sealed W011 rungs, and budget
// fitting with honest typed rejections.
import { describe, expect, it } from 'vitest';
import { parseExperienceGraph } from '@epoch/experience-protocol';
import {
  deriveProgressiveLadder,
  rungGraphAt,
  fitGraphToLimits,
  estimateGraphUsage,
  CANONICAL_STAGE_ORDER,
} from '../src/index';
import {
  richAnimationGraph,
  presenceGraph,
  minimalGraph,
  timelineGraph,
  limitsOf,
  TENANT_A,
  TENANT_B,
} from './fixtures';

function ladder(graph: unknown, ladderId = 'psl-fixture-1') {
  const result = deriveProgressiveLadder({ ladderId, graph });
  if (!result.ok) {
    throw new Error(`fixture ladder failed: ${result.error.message}`);
  }
  return result.value;
}

describe('ladder derivation (positive)', () => {
  it('rung 0 is the source graph at full fidelity', () => {
    const graph = richAnimationGraph();
    const derived = ladder(graph);
    expect(derived.rungs[0]).toEqual({
      rungIndex: 0,
      stage: null,
      graphDigest: graph.digest,
      parentDigest: graph.digest,
      usage: estimateGraphUsage(graph),
      reduction: null,
    });
    expect(derived.sourceGraphDigest).toBe(graph.digest);
  });

  it('the canonical stage order applies: animation clips drop first', () => {
    const derived = ladder(richAnimationGraph());
    expect(derived.stages[0]).toBe('drop-animation-clips');
    const clipRung = derived.rungs[1];
    expect(clipRung?.stage).toBe('drop-animation-clips');
    expect(clipRung?.reduction?.prunedNodeIds).toEqual(['xn-clip-turntable']);
    expect(clipRung?.reduction?.droppedEdgeCount).toBe(2); // both animates edges
  });

  it('mesh assets are substituted by box proxies (asset bytes relieved)', () => {
    const derived = ladder(richAnimationGraph());
    const meshRung = derived.rungs.find((rung) => rung.stage === 'substitute-mesh-proxies');
    expect(meshRung).toBeDefined();
    expect(meshRung?.reduction?.substitutions).toEqual([
      { nodeId: 'xn-crane-mesh', fromPrimitive: 'mesh', toPrimitive: 'box' },
    ]);
    // The mesh binding carried 8 MiB of asset bytes; the proxy relieves them.
    expect(meshRung?.reduction?.usageBefore.assetBytes).toBe(8_388_608);
    expect(meshRung?.reduction?.usageAfter.assetBytes).toBe(0);
  });

  it('expensive primitives (spheres) downgrade to the box proxy', () => {
    const derived = ladder(richAnimationGraph());
    const downgradeRung = derived.rungs.find(
      (rung) => rung.stage === 'downgrade-expensive-primitives',
    );
    expect(downgradeRung).toBeDefined();
    expect(downgradeRung?.reduction?.substitutions).toEqual([
      { nodeId: 'xn-gantry', fromPrimitive: 'sphere', toPrimitive: 'box' },
    ]);
    // By downgrade time the mesh proxy already ran: the spatial nodes are
    // box(12) + sphere(1280) + box(12) = 1304 estimated triangles.
    expect(downgradeRung?.reduction?.usageBefore.estimatedTriangles).toBe(1_304);
    // After the downgrade: box(12) + box(12) + box(12) = 36.
    expect(downgradeRung?.reduction?.usageAfter.estimatedTriangles).toBe(36);
  });

  it('the 3D -> 2D fallback prunes every spatial node', () => {
    const derived = ladder(richAnimationGraph());
    const spatialRung = derived.rungs.find((rung) => rung.stage === 'prune-spatial-nodes');
    expect(spatialRung).toBeDefined();
    expect(spatialRung?.reduction?.usageAfter.estimatedTriangles).toBe(0);
  });

  it('the ladder terminates at the minimal core (exactly one node)', () => {
    const derived = ladder(richAnimationGraph());
    const last = derived.rungs[derived.rungs.length - 1];
    expect(last?.usage.nodes).toBe(1);
    // The rich graph's spatial content dies at prune-spatial-nodes, so
    // the terminal rung is the shape prune's fallback-keep (one shape
    // node survives; prune-to-minimal-core then skips: <= 1 node).
    expect(last?.stage).toBe('prune-shape-nodes');
  });

  it('every rung is a re-sealed W011 graph admitted by the REAL W011 surface', () => {
    const graph = richAnimationGraph();
    const derived = ladder(graph);
    for (const rung of derived.rungs) {
      const rederived = rungGraphAt({ ladderId: 'psl-fixture-1', graph }, rung.rungIndex);
      expect(rederived.ok, `rung ${rung.rungIndex}`).toBe(true);
      if (rederived.ok) {
        expect(rederived.value.digest).toBe(rung.graphDigest);
        // REAL W011 admission (digest + resolvability + ordering gates).
        const admitted = parseExperienceGraph(rederived.value);
        expect(admitted.ok, `rung ${rung.rungIndex} W011 admission`).toBe(true);
      }
    }
  });

  it('surviving nodes keep their tenant scope and graph identity (same semantics)', () => {
    const graph = richAnimationGraph();
    const derived = ladder(graph);
    const last = derived.rungs[derived.rungs.length - 1];
    expect(derived.tenantScope).toEqual(graph.tenantScope);
    expect(derived.graphId).toBe(graph.graphId);
    const minimal = rungGraphAt({ ladderId: 'psl-fixture-1', graph }, last ? last.rungIndex : 0);
    expect(minimal.ok).toBe(true);
    if (minimal.ok) {
      expect(minimal.value.tenantScope).toEqual(graph.tenantScope);
      expect(minimal.value.graphId).toBe(graph.graphId);
      expect(minimal.value.device).toEqual(graph.device);
    }
  });

  it('presence graphs reduce cursors before seats (canonical order)', () => {
    const derived = ladder(presenceGraph());
    // Cursor prune (3 -> 2 nodes), seat prune (2 -> 1 node via the
    // fallback-keep rule); prune-to-minimal-core then skips (<= 1 node).
    expect(derived.stages).toEqual(['prune-presence-cursors', 'prune-presence-seats']);
    expect(derived.rungs[derived.rungs.length - 1]?.usage.nodes).toBe(1);
  });

  it('timeline graphs reduce markers before tracks', () => {
    const derived = ladder(timelineGraph());
    // Marker prune (drops the contains edges with them), track prune via
    // the fallback-keep rule; the track is the minimal core.
    expect(derived.stages).toEqual(['prune-timeline-markers', 'prune-timeline-tracks']);
    expect(derived.rungs[derived.rungs.length - 1]?.usage.nodes).toBe(1);
    // Marker pruning drops the contains edges with them.
    const markerRung = derived.rungs[1];
    expect(markerRung?.reduction?.droppedEdgeCount).toBe(2);
  });

  it('an already-minimal graph yields a single-rung ladder with an empty stage sequence', () => {
    const derived = ladder(minimalGraph());
    expect(derived.rungs).toHaveLength(1);
    expect(derived.stages).toEqual([]);
  });

  it('the stage sequence equals the canonical order restricted to applicable stages', () => {
    const derived = ladder(richAnimationGraph());
    const canonicalIndices = derived.stages.map((stage) => CANONICAL_STAGE_ORDER.indexOf(stage));
    expect(canonicalIndices).toEqual([...canonicalIndices].sort((a, b) => a - b));
  });

  it('every reduction manifest records before/after usage (never silent)', () => {
    const derived = ladder(richAnimationGraph());
    for (const rung of derived.rungs.slice(1)) {
      expect(rung.reduction).not.toBeNull();
      if (rung.reduction) {
        expect(rung.reduction.usageBefore).toEqual(derived.rungs[rung.rungIndex - 1]?.usage);
        expect(rung.reduction.usageAfter).toEqual(rung.usage);
      }
    }
  });
});

describe('budget fitting (positive)', () => {
  it('a fitting source returns rung 0 with no reductions', () => {
    const graph = richAnimationGraph();
    const fit = fitGraphToLimits({
      ladderId: 'psl-fit-1',
      graph,
      limits: limitsOf({ maxTriangles: 100_000, maxTextureBytes: 16_777_216 }),
    });
    expect(fit.ok).toBe(true);
    if (fit.ok) {
      expect(fit.value.rungIndex).toBe(0);
      expect(fit.value.rungGraphDigest).toBe(graph.digest);
      expect(fit.value.reductions).toEqual([]);
      expect(fit.value.declaredUsage.declaredTriangles).toBe(
        estimateGraphUsage(graph).estimatedTriangles,
      );
      expect(fit.value.declaredUsage.declaredTextureBytes).toBe(
        estimateGraphUsage(graph).assetBytes,
      );
    }
  });

  it('a tight texture budget fits only after mesh proxies substitute', () => {
    const graph = richAnimationGraph();
    const fit = fitGraphToLimits({
      ladderId: 'psl-fit-2',
      graph,
      limits: limitsOf({ maxTextureBytes: 1_048_576 }),
    });
    expect(fit.ok).toBe(true);
    if (fit.ok) {
      expect(fit.value.rungIndex).toBeGreaterThan(0);
      expect(fit.value.usage.assetBytes).toBe(0);
      expect(fit.value.declaredUsage.declaredTextureBytes).toBe(0);
      expect(fit.value.reductions.some((r) => r.stage === 'substitute-mesh-proxies')).toBe(true);
    }
  });

  it('a tight node budget fits at the minimal core', () => {
    const graph = richAnimationGraph();
    const fit = fitGraphToLimits({
      ladderId: 'psl-fit-3',
      graph,
      limits: limitsOf({ maxGraphNodes: 1, maxGraphEdges: 0 }),
    });
    expect(fit.ok).toBe(true);
    if (fit.ok) {
      expect(fit.value.usage.nodes).toBe(1);
      expect(fit.value.usage.edges).toBe(0);
      expect(fit.value.reductions.length).toBeGreaterThan(0);
    }
  });

  it('a tight triangle budget walks to the 2D fallback when needed', () => {
    const graph = richAnimationGraph();
    // Triangle budgets are positive per W013: a 6-triangle budget is
    // below even one box proxy (12), so the fit must walk to the 2D
    // fallback (0 triangles) via prune-spatial-nodes.
    const fit = fitGraphToLimits({
      ladderId: 'psl-fit-4',
      graph,
      limits: limitsOf({ maxTriangles: 6 }),
    });
    expect(fit.ok).toBe(true);
    if (fit.ok) {
      expect(fit.value.usage.estimatedTriangles).toBe(0);
      expect(fit.value.reductions.some((r) => r.stage === 'prune-spatial-nodes')).toBe(true);
    }
  });

  it('the fit verdict is content-addressed and deterministic', () => {
    const graph = richAnimationGraph();
    const first = fitGraphToLimits({ ladderId: 'psl-fit-5', graph, limits: limitsOf({ maxGraphNodes: 3 }) });
    const second = fitGraphToLimits({ ladderId: 'psl-fit-5', graph, limits: limitsOf({ maxGraphNodes: 3 }) });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.digest).toBe(second.value.digest);
    }
  });
});

describe('tenant isolation (R12)', () => {
  it('cross-tenant derivation is a typed cross-tenant-denied rejection', () => {
    const result = deriveProgressiveLadder(
      { ladderId: 'psl-tenant-1', graph: richAnimationGraph() },
      { expectedTenantId: TENANT_B },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('cross-tenant-denied');
      if (result.error.code === 'cross-tenant-denied') {
        expect(result.error.expectedTenantId).toBe(TENANT_B);
        expect(result.error.encounteredTenantId).toBe(TENANT_A);
      }
    }
  });

  it('cross-tenant fitting is a typed cross-tenant-denied rejection', () => {
    const result = fitGraphToLimits(
      { ladderId: 'psl-tenant-2', graph: richAnimationGraph(), limits: limitsOf({}) },
      { expectedTenantId: TENANT_B },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('cross-tenant-denied');
    }
  });

  it('same-tenant derivation succeeds', () => {
    const result = deriveProgressiveLadder(
      { ladderId: 'psl-tenant-3', graph: richAnimationGraph() },
      { expectedTenantId: TENANT_A },
    );
    expect(result.ok).toBe(true);
  });
});
