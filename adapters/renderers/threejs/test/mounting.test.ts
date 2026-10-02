/**
 * W058 unit battery — scene mounting & semantic entity mapping.
 *
 * Proves (headless): the canonical envelope mounts into a real Three.js
 * scene graph; every presented Object3D carries its semantic entity id;
 * the presented set equals the ADMITTED compilation's presented set; the
 * canonical scene is never mutated; ontology-driven materials/primitives/
 * placement arrive through the admitted graph; overlays, labels, agent
 * representations, and presence markers mount; remount replaces the
 * presentation.
 */
import { describe, expect, it } from 'vitest';
import { Mesh } from 'three';
import {
  SEMANTIC_AGENT_KEY,
  SEMANTIC_ENTITY_KEY,
  ThreeJsRendererAdapter,
  countSemanticEntityNodes,
  materialColorOf,
  worldPositionOf,
} from '../src/index';
import {
  UNIT_AGENT_ID,
  UNIT_ENTITY_IDS,
  UNIT_PARTICIPANT_ID,
  UNIT_SCENE,
  mountUnitSession,
  unitCompilation,
} from './helpers';

describe('W058 three.js adapter — mounting & semantic mapping', () => {
  it('mounts the canonical projection into a real Three.js scene graph', async () => {
    const { mount, adapter } = await mountUnitSession();
    expect(mount.mountedWorldDigest).toBe(UNIT_SCENE.digest);
    // The presented set is the ADMITTED graph's set: the five visible
    // entities (gamma is hidden and never crosses the seam).
    expect(mount.presentedEntityIds).toEqual([
      UNIT_ENTITY_IDS[0],
      UNIT_ENTITY_IDS[1],
      UNIT_ENTITY_IDS[2],
      UNIT_ENTITY_IDS[3],
      UNIT_ENTITY_IDS[5],
    ]);
    const presentation = adapter.presentationOf('fx-threejs-unit-1');
    expect(presentation).toBeDefined();
    expect(presentation!.presentedEntityIds).toEqual(mount.presentedEntityIds);
    // The root is a real Three.js Scene with world + presence groups.
    expect(presentation!.root.type).toBe('Scene');
    expect(presentation!.worldGroup.children.length).toBeGreaterThanOrEqual(5);
  });

  it('carries a semantic entity id on EVERY presented world node', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    expect(countSemanticEntityNodes(presentation.root)).toBe(
      presentation.presentedEntityIds.length + 1, // + the measurement line (marked with its source entity)
    );
    for (const entityId of presentation.presentedEntityIds) {
      const node = presentation.entityNodes.get(entityId);
      expect(node).toBeDefined();
      expect(node!.userData[SEMANTIC_ENTITY_KEY]).toBe(entityId);
    }
  });

  it('maps ontology presentation through the ADMITTED graph (primitives, placement, material)', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    // Placement comes from the canonical entities (via the graph descriptors).
    expect(worldPositionOf(presentation, UNIT_ENTITY_IDS[0])).toEqual([0, 0, 0]);
    expect(worldPositionOf(presentation, UNIT_ENTITY_IDS[1])).toEqual([10, 0, 0]);
    // The ontology recipe's default scale (box recipe) is applied.
    const alpha = presentation.entityNodes.get(UNIT_ENTITY_IDS[0])!;
    expect([alpha.scale.x, alpha.scale.y, alpha.scale.z]).toEqual([2, 2, 2]);
    // The material recipe (color) rides the admitted graph attributes.
    expect(materialColorOf(presentation, UNIT_ENTITY_IDS[2])).toBe('#4060a0');
    // The sphere primitive mounts a real sphere geometry.
    const delta = presentation.entityNodes.get(UNIT_ENTITY_IDS[2])!;
    expect(delta.geometry.type).toBe('SphereGeometry');
  });

  it('mounts overlays, labels, agent representations, and presence markers', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    // Highlight overlay: a translucent child shell under the highlighted entity.
    const beta = presentation.entityNodes.get(UNIT_ENTITY_IDS[1])!;
    expect(beta.children.some((child) => child instanceof Mesh && child !== beta)).toBe(true);
    // State overlay: emissive tint + presentation badge.
    const delta = presentation.entityNodes.get(UNIT_ENTITY_IDS[2])!;
    expect((delta.material as { emissive?: { getHexString(): string } }).emissive?.getHexString()).toBe('2fae62');
    expect(delta.userData['epochBadge']).toBe('commissioned');
    // Measurement overlay: a line between alpha and beta, marked with alpha's id.
    const measurement = presentation.worldGroup.children.find(
      (child) => child.userData['epochMeasurementOf'] === UNIT_ENTITY_IDS[0],
    );
    expect(measurement).toBeDefined();
    // Labels ride userData (the host chrome owns text rendering).
    expect(presentation.entityLabels.get(UNIT_ENTITY_IDS[0])).toBe('Foundation slab');
    // The agent representation and the presence seat mount with their ids.
    const agent = presentation.agentNodes.get(UNIT_AGENT_ID);
    expect(agent).toBeDefined();
    expect(agent!.userData[SEMANTIC_AGENT_KEY]).toBe(UNIT_AGENT_ID);
    expect(presentation.participantNodes.get(UNIT_PARTICIPANT_ID)).toBeDefined();
  });

  it('never mutates the canonical scene (mount is pure with respect to it)', async () => {
    const before = structuredClone(UNIT_SCENE);
    await mountUnitSession();
    expect(UNIT_SCENE).toEqual(before);
    expect(UNIT_SCENE.digest).toBe(before.digest);
  });

  it('replaces the presentation on remount (renderer-native state is disposable)', async () => {
    const { adapter, session } = await mountUnitSession();
    const first = adapter.presentationOf('fx-threejs-unit-1')!;
    const remounted = await adapter.mountProjection(session, {
      scene: UNIT_SCENE,
      compilation: unitCompilation(3_000),
      admittedReceipts: [],
    });
    expect(remounted.ok).toBe(true);
    const second = adapter.presentationOf('fx-threejs-unit-1')!;
    expect(second).not.toBe(first);
    expect(second.presentedEntityIds).toEqual(first.presentedEntityIds);
  });

  it('derives the presentation camera from the canonical W016 camera', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const camera = presentation.controls.camera;
    expect([camera.position.x, camera.position.y, camera.position.z]).toEqual([26, 20, 26]);
    expect(presentation.controls.targetVector()).toEqual([8, 6, 0]);
  });

  it('presents a scene with no visible entities as an empty (but valid) graph', async () => {
    // A minimal canonical scene whose only entity is invisible: the W016
    // compiler produces no 3d graph; the adapter mounts an empty presentation.
    const { UNIT_DEVICE, UNIT_ONTOLOGY, unitBinding, unitViewState } = await import('./helpers');
    const { admitWorldScene, compileWorldScene, sealWorldSceneContent } =
      await import('@epoch/world-experience');
    const lonelyId = 'we-unit-lonely';
    const admitted = admitWorldScene(
      {
        schema: 'epoch.world-scene',
        protocolVersion: '1.0.0',
        sceneId: 'wsc-threejs-empty-1',
        tenantScope: { tenantId: 'tenant-threejs-unit' },
        name: 'Empty Fixture World',
        entities: [
          {
            entityId: lonelyId,
            contentDigest: UNIT_SCENE.entities[0]!.contentDigest,
            entityType: 'unit:structure',
            representationRecordId: 'ont-rep-box',
            position: [0, 0, 0],
            visible: false,
            isolated: false,
          },
        ],
        focusedEntityIds: [],
        overlays: [],
        appliedOverlays: [],
        animations: [],
        narrativeBlocks: [],
        timeline: {
          markers: [],
          trackLabel: 'Empty track',
          trackStartMs: 0,
          trackEndMs: 1_000,
          position: { atMs: 0, frameIndex: 0, paused: true },
        },
        camera: { mode: 'orbit', position: [10, 10, 10], target: [0, 0, 0] },
        participants: [],
        agents: [],
        evidenceReferences: [],
        controls: [],
      },
      { expectedTenantId: 'tenant-threejs-unit' },
    );
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const scene = sealWorldSceneContent(admitted.value);
    const adapter = new ThreeJsRendererAdapter();
    const created = await adapter.createSession({
      fabricSessionId: 'fx-threejs-empty-1',
      binding: unitBinding(),
      worldProjection: {
        sceneId: scene.sceneId,
        worldDigest: scene.digest,
        tenantScope: scene.tenantScope,
      },
      viewState: unitViewState(),
      createdAtMs: 1_000,
    });
    expect(created.ok).toBe(true);
    const compiled = compileWorldScene(scene, {
      ontology: UNIT_ONTOLOGY,
      device: UNIT_DEVICE.device,
      invocation: { invocationId: 'wi-empty-1', rendererSessionId: 'rs-threejs-unit-1', atMs: 2_000 },
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok || !created.ok) return;
    expect(compiled.value.graphs.map((g) => g.graphKind)).not.toContain('3d');
    const mounted = await adapter.mountProjection(created.value, {
      scene,
      compilation: compiled.value,
      admittedReceipts: [],
    });
    expect(mounted.ok).toBe(true);
    if (mounted.ok) {
      expect(mounted.value.presentedEntityIds).toEqual([]);
    }
  });
});
