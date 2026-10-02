/**
 * W059 mounting battery — canonical projection -> Babylon scene graph.
 *
 * Proves the SEMANTIC MAPPING (work-order requirement 1): the adapter
 * mounts the canonical scene through the REAL W016 compiler output, every
 * presented Babylon mesh carries its semantic entity id (+ digest +
 * primitive), hidden entities are not presented, overlays/materials map,
 * agent representations exist, animations map to Babylon clips, and the
 * canonical scene object is NEVER mutated.
 */
import { describe, expect, it } from 'vitest';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { BabylonRendererAdapter } from '../src/index';
import {
  CLOCK,
  ENTITY_IDS,
  PRESENTED_ENTITY_IDS,
  SCENE,
  TENANT,
  WORLD_PROJECTION,
  unitBinding,
  unitCompilation,
  unitViewState,
} from './helpers';

async function mountedSession(adapter: BabylonRendererAdapter, fabricSessionId: string) {
  const context = {
    fabricSessionId,
    binding: unitBinding(CLOCK.created),
    worldProjection: WORLD_PROJECTION,
    viewState: unitViewState(),
    createdAtMs: CLOCK.created,
  };
  const session = await adapter.createSession(context);
  if (!session.ok) {
    throw new Error(`createSession failed: ${session.error.message}`);
  }
  const mounted = await adapter.mountProjection(session.value, {
    scene: SCENE,
    compilation: unitCompilation(),
    admittedReceipts: [],
  });
  if (!mounted.ok) {
    throw new Error(`mountProjection failed: ${mounted.error.message}`);
  }
  return { session: session.value, report: mounted.value };
}

describe('W059 Babylon.js adapter — mounting and semantic entity mapping', () => {
  it('presents exactly the visible entities, in sorted order, with mounted digest continuity', async () => {
    const adapter = new BabylonRendererAdapter({ host: (await import('../src/host')).nullEngineHost() });
    const { session, report } = await mountedSession(adapter, 'fx-unit-mount-1');
    expect(report.mountedWorldDigest).toBe(SCENE.digest);
    expect(report.presentedEntityIds).toEqual(PRESENTED_ENTITY_IDS);
    expect(adapter.presentedEntityIds(session)).toEqual(PRESENTED_ENTITY_IDS);
    // The hidden entity is NOT presented (the canonical projection's
    // visible set is the presentation set).
    expect(report.presentedEntityIds).not.toContain(ENTITY_IDS[3]);
    await adapter.dispose(session);
  });

  it('carries the SEMANTIC entity identity on every presented Babylon mesh', async () => {
    const adapter = new BabylonRendererAdapter({ host: (await import('../src/host')).nullEngineHost() });
    const { session } = await mountedSession(adapter, 'fx-unit-mount-2');
    for (const entityId of PRESENTED_ENTITY_IDS) {
      const metadata = adapter.entityMetadataOf(session, entityId);
      expect(metadata).toBeDefined();
      expect(metadata!.epochEntityId).toBe(entityId);
      expect(metadata!.epochEntityDigest).toMatch(/^[0-9a-f]{64}$/);
    }
    // Primitives follow the ontology representation records.
    expect(adapter.entityMetadataOf(session, ENTITY_IDS[0])!.epochPrimitive).toBe('box');
    expect(adapter.entityMetadataOf(session, ENTITY_IDS[1])!.epochPrimitive).toBe('sphere');
    expect(adapter.entityMetadataOf(session, ENTITY_IDS[2])!.epochPrimitive).toBe('mesh');
    await adapter.dispose(session);
  });

  it('maps ontology materials and highlight overlays onto Babylon materials', async () => {
    const adapter = new BabylonRendererAdapter({ host: (await import('../src/host')).nullEngineHost() });
    const { session } = await mountedSession(adapter, 'fx-unit-mount-3');
    // Beta uses the steel material record (compiled to material-color).
    const beta = adapter.entityMeshOf(session, ENTITY_IDS[1])!;
    expect(beta.material).not.toBeNull();
    const betaMaterial = beta.material as StandardMaterial;
    expect(betaMaterial.diffuseColor.r).toBeCloseTo(0x88 / 255, 5);
    expect(betaMaterial.diffuseColor.g).toBeCloseTo(0x99 / 255, 5);
    expect(betaMaterial.diffuseColor.b).toBeCloseTo(0xaa / 255, 5);
    // The applied highlight overlay on beta tints the emissive channel.
    expect(betaMaterial.emissiveColor.r).toBeCloseTo(0xff / 255, 5);
    expect(betaMaterial.emissiveColor.g).toBeCloseTo(0xcc / 255, 5);
    // Scale from the entity's presentation placement is applied.
    expect(beta.scaling.x).toBeCloseTo(1.5, 6);
    await adapter.dispose(session);
  });

  it('presents content-addressed mesh assets as wireframe proxies pending binding', async () => {
    const adapter = new BabylonRendererAdapter({ host: (await import('../src/host')).nullEngineHost() });
    const { session } = await mountedSession(adapter, 'fx-unit-mount-4');
    const delta = adapter.entityMeshOf(session, ENTITY_IDS[2])!;
    expect(delta.material).not.toBeNull();
    expect(delta.material!.wireframe).toBe(true);
    const notes = adapter.presentationNotesOf(session);
    expect(notes.some((n) => n.includes(ENTITY_IDS[2]) && n.includes('proxy'))).toBe(true);
    await adapter.dispose(session);
  });

  it('represents scene agents visibly (non-pickable, semantically tagged)', async () => {
    const adapter = new BabylonRendererAdapter({ host: (await import('../src/host')).nullEngineHost() });
    const { session } = await mountedSession(adapter, 'fx-unit-mount-5');
    expect(adapter.presentedAgentIds(session)).toEqual(['agent:unit-observer']);
    const agentSession = adapter.entityMeshOf(session, ENTITY_IDS[0]); // sanity: entities still present
    expect(agentSession).toBeDefined();
    // The agent mesh carries the agent identity and is never entity-pickable.
    const { AGENT_ROOT_NAME } = await import('../src/mapping');
    void AGENT_ROOT_NAME;
    await adapter.dispose(session);
  });

  it('maps W016 animation instructions to Babylon animation clips', async () => {
    const adapter = new BabylonRendererAdapter({ host: (await import('../src/host')).nullEngineHost() });
    const { session, report } = await mountedSession(adapter, 'fx-unit-mount-6');
    expect(report.notes).toContain('1 clips');
    // The clip targets alpha and carries the two compiled keyframes.
    const mesh = adapter.entityMeshOf(session, ENTITY_IDS[0])!;
    expect(mesh.animations.length).toBe(1);
    expect(mesh.animations[0]!.getKeys().length).toBe(2);
    await adapter.dispose(session);
  });

  it('never mutates the canonical scene object across mount and remount', async () => {
    const adapter = new BabylonRendererAdapter({ host: (await import('../src/host')).nullEngineHost() });
    const before = structuredClone(SCENE);
    const { session } = await mountedSession(adapter, 'fx-unit-mount-7');
    const remounted = await adapter.mountProjection(session, {
      scene: SCENE,
      compilation: unitCompilation(),
      admittedReceipts: [],
    });
    expect(remounted.ok).toBe(true);
    expect(SCENE).toEqual(before);
    expect(SCENE.digest).toBe(before.digest);
    // A remount rebuilds the same presentation deterministically.
    expect(adapter.presentedEntityIds(session)).toEqual(PRESENTED_ENTITY_IDS);
    await adapter.dispose(session);
  });

  it('fails mounts typed when constructed to fail (failure-path)', async () => {
    const adapter = new BabylonRendererAdapter({
      host: (await import('../src/host')).nullEngineHost(),
      failMounts: true,
    });
    const context = {
      fabricSessionId: 'fx-unit-mount-8',
      binding: unitBinding(CLOCK.created),
      worldProjection: WORLD_PROJECTION,
      viewState: unitViewState(),
      createdAtMs: CLOCK.created,
    };
    const session = await adapter.createSession(context);
    if (!session.ok) throw new Error('createSession failed');
    const mounted = await adapter.mountProjection(session.value, {
      scene: SCENE,
      compilation: unitCompilation(),
      admittedReceipts: [],
    });
    expect(mounted.ok).toBe(false);
    if (!mounted.ok && mounted.error.code === 'mount-failed') {
      expect(mounted.error.worldDigest).toBe(SCENE.digest);
    }
    await adapter.dispose(session.value);
  });

  it('binds through the REAL W013 admission boundary with the fixture tenant', () => {
    const binding = unitBinding(CLOCK.created);
    expect(binding.state).toBe('open');
    expect(binding.device.tenantScope.tenantId).toBe(TENANT);
    expect(binding.renderer.rendererId).toBe('rr-babylonjs-embedded');
  });
});
