// Determinism evidence: identical inputs produce byte-identical outputs
// across every deterministic surface (scene sealing, intent admission,
// fidelity projection, compilation, contract emission) — the house
// discipline (sorted iteration, no insertion-order leaks, no clocks, no
// randomness in src).
import { describe, expect, it } from 'vitest';
import {
  createWorldScene,
  emptyWorldSceneStore,
  listWorldScenes,
} from '../src/scene';
import { admitWorldIntent } from '../src/intent';
import { applyWorldIntent } from '../src/reducer';
import { projectWorldScene } from '../src/fidelity';
import { compileWorldScene, compilationFingerprint } from '../src/compile';
import { renderWorldExperienceContractFiles } from '../src/contract-emission';
import { serializeWorldScene } from '../src/serialize';
import { registerOntologyRecords, emptyOntology } from '../src/ontology';
import { desktopDevice, referenceOntology, sceneContent, intentFixtures } from './fixtures';

describe('determinism', () => {
  it('scene sealing is stable across runs (canonical serialization)', () => {
    const first = createWorldScene(emptyWorldSceneStore(), sceneContent());
    const second = createWorldScene(emptyWorldSceneStore(), sceneContent());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(serializeWorldScene(first.value.scene)).toBe(serializeWorldScene(second.value.scene));
    expect(first.value.scene.digest).toBe(second.value.scene.digest);
  });

  it('key-order permutation of the same scene content produces the same digest', () => {
    const content = sceneContent() as unknown as Record<string, unknown>;
    // Permute top-level key order (insertion order must not leak).
    const permuted: Record<string, unknown> = {};
    for (const key of Object.keys(content).reverse()) {
      permuted[key] = content[key];
    }
    const first = createWorldScene(emptyWorldSceneStore(), sceneContent());
    const second = createWorldScene(emptyWorldSceneStore(), permuted);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.scene.digest).toBe(first.value.scene.digest);
  });

  it('the store listing is sceneId-sorted regardless of insertion order', () => {
    const a = sceneContent();
    const b = sceneContent();
    b.sceneId = 'wsc-zzz-last';
    let state = emptyWorldSceneStore();
    const first = createWorldScene(state, a);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = first.value.state;
    const second = createWorldScene(state, b);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(listWorldScenes(second.value.state).map((s) => s.sceneId)).toEqual([
      'wsc-tower-a-site',
      'wsc-zzz-last',
    ]);
  });

  it('intent admission and application are deterministic', () => {
    const run = () => {
      const created = createWorldScene(emptyWorldSceneStore(), sceneContent());
      if (!created.ok) throw new Error('fixture failed');
      let state = created.value.state;
      for (const intent of intentFixtures()) {
        const admitted = admitWorldIntent(intent);
        if (!admitted.ok) throw new Error(`admission failed for ${intent.kind}`);
        const applied = applyWorldIntent(state, 'wsc-tower-a-site', admitted.value);
        if (applied.ok) {
          state = applied.value.state;
        }
      }
      return JSON.stringify(state.scenes.find((s) => s.sceneId === 'wsc-tower-a-site'));
    };
    expect(run()).toBe(run());
  });

  it('fidelity projection and compilation fingerprints are stable', () => {
    const created = createWorldScene(emptyWorldSceneStore(), sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const scene = created.value.scene;
    const first = projectWorldScene(scene, 'mobile');
    const second = projectWorldScene(scene, 'mobile');
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    const context = {
      ontology: referenceOntology(),
      device: desktopDevice(),
      invocation: { invocationId: 'w016-det', rendererSessionId: 'rs-world-alpha', atMs: 7 },
    };
    const c1 = compileWorldScene(scene, context);
    const c2 = compileWorldScene(scene, context);
    expect(JSON.stringify(c1)).toBe(JSON.stringify(c2));
    if (!c1.ok || !c2.ok) return;
    expect(compilationFingerprint(c1.value)).toBe(compilationFingerprint(c2.value));
  });

  it('ontology registration iterates records in recordId order (no insertion-order leaks)', () => {
    const ontologyA = referenceOntology();
    // Register in REVERSE order into a fresh ontology.
    const reversed = [...referenceOntology().records].reverse();
    const registered = registerOntologyRecords(emptyOntology(), reversed);
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    expect(registered.value.records.map((r) => r.recordId)).toEqual(
      ontologyA.records.map((r) => r.recordId),
    );
    expect(JSON.stringify(registered.value)).toBe(JSON.stringify(ontologyA));
  });

  it('contract emission is deterministic (two renders are byte-identical)', () => {
    expect(renderWorldExperienceContractFiles()).toEqual(renderWorldExperienceContractFiles());
  });
});
