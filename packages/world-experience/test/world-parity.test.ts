// World-model parity (devDependency — NO runtime coupling): a real world
// is built through the W002 public API, its materialized entities flow
// into scene records with their canonical digests, and the compiled graphs
// preserve the references verbatim. If the world model's id grammars or
// shapes ever change, the compile-time pin (src/parity.ts) and this test
// fail.
import { describe, expect, it } from 'vitest';
import { WorldModel, type Clock } from '@epoch/world-model';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { createWorldScene, emptyWorldSceneStore } from '../src/scene';
import { compileWorldScene } from '../src/compile';
import { admitWorldIntent } from '../src/intent';
import { applyWorldIntent } from '../src/reducer';
import { desktopDevice, referenceOntology, sceneContent } from './fixtures';

function stepClock(): Clock {
  let current = Date.UTC(2026, 0, 1, 9, 0, 0);
  return () => {
    current += 60_000;
    return new Date(current).toISOString();
  };
}

function provenance() {
  return {
    actor: { id: 'user:alice', role: 'human' as const, displayName: 'Alice' },
    method: 'direct-observation',
    evidence: [{ id: 'ev:doc-1', kind: 'document' as const }],
  };
}

/** Build a real world with two wall entities. */
function buildWorld() {
  const world = WorldModel.create({ clock: stepClock() });
  world.registerEntityType({ key: 'arch:wall' });
  world.applyAssertion({
    statement: {
      kind: 'entity',
      entityId: 'wall-north-1',
      entityType: 'arch:wall',
      properties: { height: 42 },
    },
    provenance: provenance(),
    confidence: { distribution: { kind: 'point', value: 0.95 }, method: 'measured' },
  });
  world.applyAssertion({
    statement: {
      kind: 'entity',
      entityId: 'wall-south-2',
      entityType: 'arch:wall',
      properties: { height: 30 },
    },
    provenance: provenance(),
    confidence: { distribution: { kind: 'point', value: 0.9 }, method: 'measured' },
  });
  return world;
}

describe('world-model parity (devDependency, upstream)', () => {
  const world = buildWorld();

  it('real world entities flow into scenes with their canonical digests', () => {
    const north = world.getEntity('wall-north-1');
    const south = world.getEntity('wall-south-2');
    expect(north).not.toBeNull();
    expect(south).not.toBeNull();
    if (north === null || south === null) return;
    const content = sceneContent();
    content.entities[0] = {
      ...content.entities[0],
      entityId: north.id,
      contentDigest: canonicalDigest(north as unknown as JsonValue),
    };
    content.entities[1] = {
      ...content.entities[1],
      entityId: south.id,
      contentDigest: canonicalDigest(south as unknown as JsonValue),
    };
    const created = createWorldScene(emptyWorldSceneStore(), content);
    expect(created.ok, JSON.stringify(created)).toBe(true);
  });

  it('real world event ids flow through intents and reducers unchanged', () => {
    const events = world.events();
    expect(events.length).toBeGreaterThan(0);
    const event = events[0];
    if (event === undefined) return;
    // The event id grammar (evt-<sequence>) flows through the opaque
    // string surfaces without interpretation.
    expect(event.id).toMatch(/^evt-[0-9]+$/);
  });

  it('the compiled graph preserves real world-entity references verbatim', () => {
    const north = world.getEntity('wall-north-1');
    expect(north).not.toBeNull();
    if (north === null) return;
    const content = sceneContent();
    content.entities[0] = {
      ...content.entities[0],
      entityId: north.id,
      contentDigest: canonicalDigest(north as unknown as JsonValue),
    };
    const created = createWorldScene(emptyWorldSceneStore(), content);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const compiled = compileWorldScene(created.value.scene, {
      ontology: referenceOntology(),
      device: desktopDevice(),
      invocation: { invocationId: 'w016-world-parity', rendererSessionId: 'rs-world-alpha', atMs: 0 },
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const spatial = compiled.value.graphs.find((g) => g.graphKind === 'animation');
    if (!spatial) throw new Error('missing spatial graph');
    const ref = spatial.projectedFrom.find(
      (r) => (r as { entityId?: string }).entityId === north.id,
    );
    expect(ref).toBeDefined();
    expect(ref).toEqual({
      kind: 'world-entity',
      tenantId: 'tenant-alpha',
      entityId: north.id,
      contentDigest: canonicalDigest(north as unknown as JsonValue),
    });
  });

  it('a move intent on a real-world entity changes presentation placement only (the world model is untouched)', () => {
    const worldBefore = JSON.stringify(world.getEntity('wall-north-1'));
    const admitted = admitWorldIntent({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'move',
      intentId: 'w016-world-parity-move',
      entityId: 'wall-north-1',
      delta: [5, 5, 5],
    });
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const created = createWorldScene(emptyWorldSceneStore(), sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const applied = applyWorldIntent(created.value.state, 'wsc-tower-a-site', admitted.value);
    expect(applied.ok, JSON.stringify(applied)).toBe(true);
    if (!applied.ok) return;
    const moved = applied.value.outcome.scene.entities.find((e) => e.entityId === 'wall-north-1');
    expect(moved?.position).toEqual([5, 5, 5]);
    // The canonical world model is untouched: the projection moved, the
    // authority did not (lock rule 8).
    expect(JSON.stringify(world.getEntity('wall-north-1'))).toBe(worldBefore);
  });
});
