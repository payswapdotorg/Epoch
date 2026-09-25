// Positive compile battery: every graph kind compiles into the staged,
// sorted, device-shaped, content-addressed Render Plan; opaque references
// survive verbatim; usage accounting is exact; constraints mirror the
// target device; the digest chain holds; plans round-trip through
// serialization and admission.
import { describe, expect, it } from 'vitest';
import { sealExperienceGraph } from '@epoch/experience-protocol';
import {
  PRIMITIVE_TRIANGLE_ESTIMATES,
  compileExperienceGraph,
  parseRenderPlan,
  planDigestChain,
  serializeRenderPlan,
} from '../src/index';
import { canonicalJsonStringify } from '@epoch/agent-protocol';
import {
  budgetedHeadsetDevice,
  compiledPlan,
  desktopDevice,
  expectFailure,
  graphContent,
  phoneDevice,
  sealedGraph,
  TENANT_A,
} from './fixtures';

describe('compile (positive)', () => {
  it('compiles every graph kind into a sealed plan', () => {
    for (const kind of [
      '2d',
      '3d',
      'animation',
      'narrative',
      'timeline-replay',
      'presence',
      'controls',
    ] as const) {
      const plan = compiledPlan(kind);
      expect(plan.schema).toBe('epoch.render-plan');
      expect(plan.protocolVersion).toBe('1.0.0');
      expect(plan.sourceGraphKind).toBe(kind);
      expect(plan.digest).toMatch(/^[0-9a-f]{64}$/);
      expect(plan.stages.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('compiles the 2d graph into relate + draw-2d stages with compiled draw order', () => {
    const plan = compiledPlan('2d');
    expect(plan.stages.map((stage) => stage.stage)).toEqual(['relate', 'draw-2d']);
    const draw = plan.stages.find((stage) => stage.stage === 'draw-2d');
    if (draw === undefined || draw.stage !== 'draw-2d') throw new Error('fixture stage');
    // The shape (zIndex 2) draws AFTER the label (implicit z 0) — the
    // compiled z-order, not the envelope's id order (label id sorts first).
    expect(draw.draws.map((d) => [d.op, d.nodeId])).toEqual([
      ['draw-label', 'xn-label-1'],
      ['draw-shape', 'xn-shape-1'],
    ]);
    const label = draw.draws[0];
    if (label.op !== 'draw-label') throw new Error('fixture draw');
    // Offset resolved to its default? No — authored offset preserved; the
    // anchor targets compiled from the anchors edge.
    expect(label.offset2d).toEqual({ x: 8, y: -12 });
    expect(label.anchorNodeIds).toEqual(['xn-shape-1']);
    expect(label.attributes).toEqual({ 'display-hint': 'primary' });
    const shape = draw.draws[1];
    if (shape.op !== 'draw-shape') throw new Error('fixture draw');
    expect(shape.geometry).toEqual({ form: 'rect', x: 0, y: 0, width: 100, height: 50 });
    expect(shape.zIndex).toBe(2);
  });

  it('compiles the 3d graph into relate + place-3d stages with label anchoring', () => {
    const plan = compiledPlan('3d');
    expect(plan.stages.map((stage) => stage.stage)).toEqual(['relate', 'place-3d']);
    const place = plan.stages.find((stage) => stage.stage === 'place-3d');
    if (place === undefined || place.stage !== 'place-3d') throw new Error('fixture stage');
    expect(place.placements.map((p) => [p.op, p.nodeId])).toEqual([
      ['place-label', 'xn-label-1'],
      ['place-spatial', 'xn-mesh-1'],
      ['place-spatial', 'xn-shape-3d-1'],
    ]);
    const label = place.placements[0];
    if (label.op !== 'place-label') throw new Error('fixture placement');
    expect(label.offset3d).toEqual([1, 1, 1]);
    expect(label.anchorNodeIds).toEqual(['xn-mesh-1']);
    const mesh = place.placements[1];
    if (mesh.op !== 'place-spatial') throw new Error('fixture placement');
    expect(mesh.primitive).toBe('mesh');
    expect(mesh.mesh?.byteSize).toBe(4096);
  });

  it('compiles the animation graph into relate + place-3d + animate stages (flattened bindings)', () => {
    const plan = compiledPlan('animation');
    expect(plan.stages.map((stage) => stage.stage)).toEqual([
      'relate',
      'place-3d',
      'animate',
    ]);
    const animate = plan.stages.find((stage) => stage.stage === 'animate');
    if (animate === undefined || animate.stage !== 'animate') throw new Error('fixture stage');
    expect(animate.bindings).toHaveLength(1);
    const binding = animate.bindings[0];
    expect(binding.clipNodeId).toBe('xn-clip-1');
    expect(binding.targetNodeId).toBe('xn-box-1');
    expect(binding.propertyPath).toBe('scale');
    expect(binding.durationMs).toBe(2000);
    expect(binding.keyframes).toHaveLength(3);
  });

  it('compiles the narrative graph into presentation order (follows chain, deterministic)', () => {
    const plan = compiledPlan('narrative');
    expect(plan.stages.map((stage) => stage.stage)).toEqual(['relate', 'narrate']);
    const narrate = plan.stages.find((stage) => stage.stage === 'narrate');
    if (narrate === undefined || narrate.stage !== 'narrate') throw new Error('fixture stage');
    // beats compile into follows order, not node-id order (beat-2 < beat-3 by id, order matches chain).
    expect(narrate.beats.map((b) => [b.sequence, b.nodeId])).toEqual([
      [0, 'xn-beat-1'],
      [1, 'xn-beat-2'],
      [2, 'xn-beat-3'],
    ]);
  });

  it('compiles the timeline graph into compiled time order', () => {
    const plan = compiledPlan('timeline-replay');
    expect(plan.stages.map((stage) => stage.stage)).toEqual(['relate', 'timeline']);
    const timeline = plan.stages.find((stage) => stage.stage === 'timeline');
    if (timeline === undefined || timeline.stage !== 'timeline') throw new Error('fixture stage');
    // The envelope stores nodes sorted by id (marker-1 before marker-2);
    // the plan stores markers sorted by time (marker-2 at 0ms first).
    expect(timeline.markers.map((m) => [m.atMs, m.nodeId])).toEqual([
      [0, 'xn-marker-2'],
      [500, 'xn-marker-1'],
    ]);
    expect(timeline.tracks.map((t) => t.startMs)).toEqual([0]);
  });

  it('compiles the presence and controls graphs into their stages', () => {
    const presence = compiledPlan('presence');
    expect(presence.stages.map((stage) => stage.stage)).toEqual(['relate', 'presence']);
    const controls = compiledPlan('controls');
    expect(controls.stages.map((stage) => stage.stage)).toEqual(['relate', 'controls']);
    const controlsStage = controls.stages.find((stage) => stage.stage === 'controls');
    if (controlsStage === undefined || controlsStage.stage !== 'controls') {
      throw new Error('fixture stage');
    }
    expect(controlsStage.controls.map((c) => c.controlKind)).toEqual(['button', 'selector']);
    expect(controlsStage.controls[1].options).toEqual(['isometric', 'top-down', 'walkthrough']);
  });

  it('preserves the envelope tenant scope and projected references verbatim (never embeds kernel state)', () => {
    for (const kind of [
      '2d',
      '3d',
      'animation',
      'narrative',
      'timeline-replay',
      'presence',
      'controls',
    ] as const) {
      const graph = sealedGraph(kind);
      const plan = compiledPlan(kind);
      expect(plan.tenantScope).toEqual(graph.tenantScope);
      expect(plan.sourceRefs).toEqual(graph.projectedFrom);
      expect(plan.sourceEnvelopeDigest).toBe(graph.digest);
      // Node-level refs survive onto the ops that compiled them.
      const draw = plan.stages.find((stage) => stage.stage === 'draw-2d');
      if (draw !== undefined && draw.stage === 'draw-2d') {
        const withRef = draw.draws.find((d) => d.ref !== undefined);
        expect(withRef?.ref).toBeDefined();
      }
    }
  });

  it('accounts usage exactly (node/edge counts, triangle estimates, asset bytes)', () => {
    const plan3d = compiledPlan('3d');
    expect(plan3d.usage).toEqual({
      nodes: 3,
      edges: 2,
      estimatedTriangles: PRIMITIVE_TRIANGLE_ESTIMATES.box, // mesh contributes 0
      assetBytes: 4096,
    });
    const plan2d = compiledPlan('2d');
    expect(plan2d.usage).toEqual({ nodes: 2, edges: 1, estimatedTriangles: 0, assetBytes: 0 });
  });

  it('shapes constraints from the TARGET device (device-aware, as data)', () => {
    const plan = compiledPlan('2d', budgetedHeadsetDevice());
    expect(plan.target.deviceClass).toBe('headset');
    expect(plan.constraints).toEqual({
      stereoscopic: true,
      poseTracking: '6dof',
      worldAnchored: true,
      interaction: ['gaze', 'gesture', 'voice'],
      maxPixels: 4_147_840,
      refreshHz: 90,
      maxTriangles: 2000,
      maxTextureBytes: 1_048_576,
    });
    // Compiling the SAME envelope for a different device yields that
    // device's constraints (the envelope's own device is not the target).
    const phone = compiledPlan('2d', phoneDevice());
    expect(phone.constraints.interaction).toEqual(['touch', 'voice']);
    expect(phone.constraints.stereoscopic).toBe(false);
  });

  it('carries the envelope digest -> plan digest chain', () => {
    const graph = sealedGraph('presence');
    const plan = compiledPlan('presence');
    expect(planDigestChain(plan)).toEqual({
      sourceEnvelopeDigest: graph.digest,
      planDigest: plan.digest,
    });
    // The chain is total: the source digest is inside the digested content,
    // so any envelope change changes the plan digest.
    const content = JSON.parse(serializeRenderPlan(plan));
    delete content.digest;
    expect(canonicalJsonStringify(content)).toContain(graph.digest);
  });

  it('round-trips through serialization and plan admission', () => {
    for (const kind of [
      '2d',
      '3d',
      'animation',
      'narrative',
      'timeline-replay',
      'presence',
      'controls',
    ] as const) {
      const plan = compiledPlan(kind);
      const serialized = serializeRenderPlan(plan);
      const admitted = parseRenderPlan(JSON.parse(serialized));
      expect(admitted.ok, `${kind} plan must admit`).toBe(true);
      if (admitted.ok) {
        expect(serializeRenderPlan(admitted.value)).toBe(serialized);
        expect(admitted.value.digest).toBe(plan.digest);
      }
    }
  });

  it('admits a compiled plan for the owning tenant and rejects compile for a foreign tenant', () => {
    const plan = compiledPlan('2d');
    expect(
      parseRenderPlan(JSON.parse(serializeRenderPlan(plan)), {
        expectedTenantId: TENANT_A,
      }).ok,
    ).toBe(true);
    const denied = expectFailure(
      compileExperienceGraph({
        envelope: sealedGraph('2d'),
        device: desktopDevice(),
        expectedTenantId: 'tenant-beta',
      }),
      'cross-tenant-denied',
    );
    expect(denied.expectedTenantId).toBe('tenant-beta');
    expect(denied.encounteredTenantId).toBe(TENANT_A);
  });

  it('compiles an edge-free graph without a relate stage (stage presence is content-driven)', () => {
    const content = JSON.parse(JSON.stringify(graphContent('2d')));
    content.edges = [];
    // Seal (digest computed over the changed content).
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const compiled = compileExperienceGraph({ envelope: sealed.value, device: desktopDevice() });
    expect(compiled.ok).toBe(true);
    if (compiled.ok) {
      expect(compiled.value.stages.map((stage) => stage.stage)).toEqual(['draw-2d']);
      expect(compiled.value.usage.edges).toBe(0);
    }
  });
});
