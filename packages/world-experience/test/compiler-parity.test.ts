// Experience-compiler parity (devDependency — NO runtime coupling): the
// W011 graphs this compiler emits are valid inputs to the REAL W012
// experience compiler (graph -> Render Plan), and the mirrored triangle
// estimates agree member-for-member. The compile-time half lives in
// src/parity.ts.
import { describe, expect, it } from 'vitest';
import { compileExperienceGraph } from '@epoch/experience-compiler';
import {
  PRIMITIVE_TRIANGLE_ESTIMATES,
  RENDER_PLAN_PROTOCOL_VERSION,
} from '@epoch/experience-compiler';
import { desktopDevice, referenceOntology, sceneContent } from './fixtures';
import { createWorldScene, emptyWorldSceneStore } from '../src/scene';
import { compileWorldScene, WORLD_PRIMITIVE_TRIANGLE_ESTIMATES } from '../src/index';

function compiledFixture() {
  const created = createWorldScene(emptyWorldSceneStore(), sceneContent());
  if (!created.ok) {
    throw new Error(`fixture scene failed: ${created.error.message}`);
  }
  const result = compileWorldScene(created.value.scene, {
    ontology: referenceOntology(),
    device: desktopDevice(),
    invocation: { invocationId: 'w016-compiler-parity', rendererSessionId: 'rs-world-alpha', atMs: 0 },
  });
  if (!result.ok) {
    throw new Error(`fixture compilation failed: ${result.error.message}`);
  }
  return result.value;
}

describe('experience-compiler parity (devDependency, sibling)', () => {
  it('every emitted graph compiles through the REAL W012 compiler into a Render Plan', () => {
    const compilation = compiledFixture();
    expect(compilation.graphs.length).toBeGreaterThan(0);
    for (const graph of compilation.graphs) {
      const plan = compileExperienceGraph({ envelope: graph, device: desktopDevice() });
      expect(plan.ok, JSON.stringify(plan)).toBe(true);
      if (!plan.ok) continue;
      expect(plan.value.protocolVersion).toBe(RENDER_PLAN_PROTOCOL_VERSION);
    }
  });

  it('the W012 plan usage of the animation graph equals this compiler\'s per-graph declared usage', () => {
    const compilation = compiledFixture();
    const animation = compilation.graphs.find((g) => g.graphKind === 'animation');
    if (!animation) throw new Error('missing animation graph');
    const mount = compilation.mountEnvelopes.find((envelope) => envelope.invocationId.endsWith('-animation'));
    if (!mount) throw new Error('missing animation mount envelope');
    const plan = compileExperienceGraph({ envelope: animation, device: desktopDevice() });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.usage.estimatedTriangles).toBe(mount.declaredTriangles);
    expect(plan.value.usage.assetBytes).toBe(mount.declaredTextureBytes);
  });

  it('the W012 triangle estimate of the 3d presentation graph equals this compiler\'s scene usage (mesh-byte accounting differs by design)', () => {
    const compilation = compiledFixture();
    const spatial = compilation.graphs.find((g) => g.graphKind === '3d');
    if (!spatial) throw new Error('missing 3d graph');
    const plan = compileExperienceGraph({ envelope: spatial, device: desktopDevice() });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.value.usage.estimatedTriangles).toBe(compilation.usage.estimatedTriangles);
    // This compiler's assetBytes also counts MATERIAL TEXTURE bytes (a
    // declared resource the renderer cannot introspect); the W012 plan
    // counts mesh-asset bytes from the graph content. Both are honest
    // declared usage for their own output boundary.
    expect(plan.value.usage.assetBytes).toBe(0);
    expect(compilation.usage.assetBytes).toBe(4096);
  });

  it('the mirrored triangle-estimate table equals the W012 table member-for-member', () => {
    expect({ ...WORLD_PRIMITIVE_TRIANGLE_ESTIMATES }).toEqual({ ...PRIMITIVE_TRIANGLE_ESTIMATES });
    for (const primitive of Object.keys(PRIMITIVE_TRIANGLE_ESTIMATES) as Array<
      keyof typeof PRIMITIVE_TRIANGLE_ESTIMATES
    >) {
      expect(WORLD_PRIMITIVE_TRIANGLE_ESTIMATES[primitive]).toBe(PRIMITIVE_TRIANGLE_ESTIMATES[primitive]);
    }
  });
});
