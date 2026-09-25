// The renderer-envelope compiler (positive): scene -> W011 graphs + W013
// envelopes, digest chains, budget-respecting usage declarations, and
// compile determinism.
import { describe, expect, it } from 'vitest';
import {
  compileWorldScene,
  compileFrameAdvance,
  compileIntentSubmission,
  compilationDigestChain,
  compilationFingerprint,
} from '../src/compile';
import { createWorldScene, emptyWorldSceneStore } from '../src/scene';
import { applyWorldIntent } from '../src/reducer';
import { admitWorldIntent } from '../src/intent';
import {
  desktopDevice,
  referenceOntology,
  sceneContent,
  intentFixtures,
} from './fixtures';

function setup() {
  const created = createWorldScene(emptyWorldSceneStore(), sceneContent());
  if (!created.ok) {
    throw new Error(`fixture scene failed: ${created.error.message}`);
  }
  return created.value;
}

const INVOCATION = {
  invocationId: 'w016-mount-base',
  rendererSessionId: 'rs-world-alpha',
  atMs: 1000,
};

const CONTEXT = {
  ontology: referenceOntology(),
  device: desktopDevice(),
  invocation: INVOCATION,
};

function admitKind(kind: string) {
  const intent = intentFixtures().find((i) => i.kind === kind);
  if (intent === undefined) {
    throw new Error(`missing fixture intent for ${kind}`);
  }
  return admitWorldIntent(intent);
}

describe('scene compilation (positive)', () => {
  it('compiles the fixture scene into graphs + envelopes', () => {
    const { scene } = setup();
    const compiled = compileWorldScene(scene, CONTEXT);
    expect(compiled.ok, JSON.stringify(compiled)).toBe(true);
    if (!compiled.ok) return;
    const value = compiled.value;
    // Graph kinds emitted: the '3d' presentation graph (labels +
    // annotations + overlay attributes), the 'animation' clips graph (the
    // scene has one instruction), narrative, timeline, presence, controls.
    expect(value.graphs.map((g) => g.graphKind)).toEqual([
      '3d',
      'animation',
      'controls',
      'narrative',
      'presence',
      'timeline-replay',
    ]);
    // One mount envelope per graph, in the same deterministic order.
    expect(value.mountEnvelopes).toHaveLength(value.graphs.length);
    // The advance envelope targets the next frame.
    expect(value.advanceEnvelope).toEqual({
      schema: 'epoch.renderer-invocation',
      protocolVersion: '1.0.0',
      kind: 'advance-frame',
      invocationId: 'w016-mount-base-advance',
      rendererSessionId: 'rs-world-alpha',
      frameIndex: 1,
      atMs: 1000,
    });
    // Declared usage (the presented scene): one box (12) + one sphere
    // (1280) = 1292 triangles; the sphere's material texture = 4096 bytes.
    expect(value.usage).toEqual({ estimatedTriangles: 1292, assetBytes: 4096 });
  });

  it('every mount envelope references its graph by the SEALED digest (the digest chain)', () => {
    const { scene } = setup();
    const compiled = compileWorldScene(scene, CONTEXT);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    for (let i = 0; i < compiled.value.graphs.length; i += 1) {
      expect(compiled.value.mountEnvelopes[i]?.graphDigest).toBe(compiled.value.graphs[i]?.digest);
    }
    const chain = compilationDigestChain(compiled.value);
    expect(chain.sceneDigest).toBe(scene.digest);
    expect(chain.graphDigests).toEqual(compiled.value.graphs.map((g) => g.digest));
  });

  it('declared usage is carried only by the spatial graph envelope (the W013 admission rule)', () => {
    const { scene } = setup();
    const compiled = compileWorldScene(scene, CONTEXT);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const mountById = new Map(
      compiled.value.mountEnvelopes.map((envelope) => [envelope.invocationId, envelope]),
    );
    // The 3d presentation graph declares the full presented usage.
    const spatial = mountById.get('w016-mount-base-3d');
    expect(spatial?.declaredTriangles).toBe(1292);
    expect(spatial?.declaredTextureBytes).toBe(4096);
    // The animation clips graph (north box only) declares its own usage.
    const animation = mountById.get('w016-mount-base-animation');
    expect(animation?.declaredTriangles).toBe(12);
    expect(animation?.declaredTextureBytes).toBe(0);
    // Non-spatial graphs carry no declared usage.
    for (const envelope of compiled.value.mountEnvelopes) {
      if (!envelope.invocationId.endsWith('-animation') && !envelope.invocationId.endsWith('-3d')) {
        expect(envelope.declaredTriangles).toBeUndefined();
        expect(envelope.declaredTextureBytes).toBeUndefined();
      }
    }
  });

  it('the compiled graphs preserve the opaque exact-revision entity references verbatim', () => {
    const { scene } = setup();
    const compiled = compileWorldScene(scene, CONTEXT);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const spatial = compiled.value.graphs.find((g) => g.graphKind === '3d');
    expect(spatial).toBeDefined();
    if (!spatial) return;
    expect(spatial.projectedFrom).toEqual([
      { kind: 'world-entity', tenantId: 'tenant-alpha', entityId: 'wall-north-1', contentDigest: 'a'.repeat(64) },
      { kind: 'world-entity', tenantId: 'tenant-alpha', entityId: 'wall-south-2', contentDigest: 'b'.repeat(64) },
    ]);
    expect(spatial.tenantScope).toEqual(scene.tenantScope);
  });

  it('compilation is deterministic (two runs are byte-identical)', () => {
    const { scene } = setup();
    const first = compileWorldScene(scene, CONTEXT);
    const second = compileWorldScene(scene, CONTEXT);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    if (!first.ok || !second.ok) return;
    expect(compilationFingerprint(first.value)).toBe(compilationFingerprint(second.value));
  });

  it('hidden entities are excluded from the compiled spatial graph (hide/show drive compilation)', () => {
    const { state } = setup();
    const hide = admitKind('hide');
    expect(hide.ok).toBe(true);
    if (!hide.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', hide.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const compiled = compileWorldScene(applied.value.outcome.scene, CONTEXT);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const spatial = compiled.value.graphs.find((g) => g.graphKind === '3d');
    expect(spatial).toBeDefined();
    if (!spatial) return;
    expect(spatial.projectedFrom).toHaveLength(1);
    expect((spatial.projectedFrom[0] as { entityId: string }).entityId).toBe('wall-north-1');
    // Usage drops to one box: 12 triangles, no texture.
    expect(compiled.value.usage).toEqual({ estimatedTriangles: 12, assetBytes: 0 });
  });

  it('isolation compiles ONLY the isolated entity', () => {
    const { state } = setup();
    const isolate = admitWorldIntent({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'isolate',
      intentId: 'intent-isolate-south',
      entityId: 'wall-south-2',
    });
    expect(isolate.ok).toBe(true);
    if (!isolate.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', isolate.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const compiled = compileWorldScene(applied.value.outcome.scene, CONTEXT);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const spatial = compiled.value.graphs.find((g) => g.graphKind === '3d');
    if (!spatial) throw new Error('missing spatial graph');
    expect(spatial.projectedFrom.map((r) => (r as { entityId: string }).entityId)).toEqual(['wall-south-2']);
    // Isolation: the isolated sphere only — 1280 triangles, 4096 texture bytes.
    expect(compiled.value.usage).toEqual({ estimatedTriangles: 1280, assetBytes: 4096 });
  });

  it('compiling a scene without animations produces a plain 3d spatial graph', () => {
    const content = sceneContent();
    content.animations = [];
    const created = createWorldScene(emptyWorldSceneStore(), content);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const compiled = compileWorldScene(created.value.scene, CONTEXT);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.value.graphs.map((g) => g.graphKind)).toEqual([
      '3d',
      'controls',
      'narrative',
      'presence',
      'timeline-replay',
    ]);
  });

  it('an animation targeting only hidden entities still emits the 3d presentation graph', () => {
    const content = sceneContent();
    // Hide the north wall (the only animation target).
    content.entities[0] = { ...content.entities[0], visible: false };
    const created = createWorldScene(emptyWorldSceneStore(), content);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const compiled = compileWorldScene(created.value.scene, CONTEXT);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.value.graphs.map((g) => g.graphKind)).not.toContain('animation');
    expect(compiled.value.graphs.map((g) => g.graphKind)).toContain('3d');
  });

  it('compileFrameAdvance produces strictly increasing frame indices', () => {
    const first = compileFrameAdvance({
      invocationId: 'w016-frame-1',
      rendererSessionId: 'rs-world-alpha',
      lastFrameIndex: -1,
      atMs: 0,
    });
    expect(first.frameIndex).toBe(0);
    const second = compileFrameAdvance({
      invocationId: 'w016-frame-2',
      rendererSessionId: 'rs-world-alpha',
      lastFrameIndex: 41,
      atMs: 500,
    });
    expect(second.frameIndex).toBe(42);
    expect(second.kind).toBe('advance-frame');
    expect(second.schema).toBe('epoch.renderer-invocation');
  });

  it('compileIntentSubmission bridges every world intent kind to its typed ControlIntent', () => {
    for (const intent of intentFixtures()) {
      const envelope = compileIntentSubmission(intent, {
        modality: 'pointer',
        invocationId: `w016-intent-${intent.kind}`,
        rendererSessionId: 'rs-world-alpha',
      });
      expect(envelope).toEqual({
        schema: 'epoch.renderer-invocation',
        protocolVersion: '1.0.0',
        kind: 'submit-intent',
        invocationId: `w016-intent-${intent.kind}`,
        rendererSessionId: 'rs-world-alpha',
        modality: 'pointer',
        intent: { id: `epoch.world.interaction.${intent.kind}`, version: '1.0.0' },
      });
    }
  });

  it('the compiled timeline graph carries the replay cursor at the scene position', () => {
    const { scene } = setup();
    const compiled = compileWorldScene(scene, CONTEXT);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const timeline = compiled.value.graphs.find((g) => g.graphKind === 'timeline-replay');
    if (!timeline) throw new Error('missing timeline graph');
    const cursors = timeline.nodes.filter(
      (node) => node.kind === 'timeline-marker' && node.descriptor.markerKind === 'replay-cursor',
    );
    expect(cursors).toHaveLength(1);
    const descriptor = cursors[0]?.descriptor as { atMs: number };
    expect(descriptor.atMs).toBe(0);
  });

  it('the compiled presence graph carries seats and the controls graph the control intents', () => {
    const { scene } = setup();
    const compiled = compileWorldScene(scene, CONTEXT);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const presence = compiled.value.graphs.find((g) => g.graphKind === 'presence');
    if (!presence) throw new Error('missing presence graph');
    expect(presence.nodes).toHaveLength(2); // two participant seats
    const controls = compiled.value.graphs.find((g) => g.graphKind === 'controls');
    if (!controls) throw new Error('missing controls graph');
    expect(controls.nodes).toHaveLength(2);
  });
});
