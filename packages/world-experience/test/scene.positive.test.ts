// Scene lifecycle + tenant scoping (positive battery): creation, focus,
// overlay application, listing, and usage accounting over the pure
// in-memory store.
import { describe, expect, it } from 'vitest';
import {
  applySceneOverlay,
  createWorldScene,
  emptyWorldSceneStore,
  focusSceneEntity,
  getWorldScene,
  listWorldScenes,
  computeSceneUsage,
  removeSceneOverlay,
} from '../src/scene';
import { TENANT_A, TENANT_B, deepClone, expectFailure, sceneContent } from './fixtures';

describe('world scene lifecycle (positive)', () => {
  it('creates a scene, seals it with a content digest, and lists it', () => {
    const store = emptyWorldSceneStore();
    const created = createWorldScene(store, sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.scene.sceneId).toBe('wsc-tower-a-site');
    expect(created.value.scene.digest).toMatch(/^[0-9a-f]{64}$/);
    const listed = listWorldScenes(created.value.state);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.sceneId).toBe('wsc-tower-a-site');
  });

  it('creates scenes in deterministic sceneId order', () => {
    let store = emptyWorldSceneStore();
    const second = deepClone(sceneContent());
    second.sceneId = 'wsc-aaa-first';
    const first = createWorldScene(store, second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    store = first.value.state;
    const created = createWorldScene(store, sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(listWorldScenes(created.value.state).map((s) => s.sceneId)).toEqual([
      'wsc-aaa-first',
      'wsc-tower-a-site',
    ]);
  });

  it('rejects duplicate scene ids with a typed malformed-record error', () => {
    const store = emptyWorldSceneStore();
    const first = createWorldScene(store, sceneContent());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const duplicate = createWorldScene(first.value.state, sceneContent());
    const failure = expectFailure(duplicate, 'malformed-record');
    expect(failure.issues[0]?.path).toBe('sceneId');
  });

  it('focuses an entity (select semantics) and re-seals the revision', () => {
    const store = emptyWorldSceneStore();
    const created = createWorldScene(store, sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const focused = focusSceneEntity(created.value.state, 'wsc-tower-a-site', 'wall-south-2');
    expect(focused.ok).toBe(true);
    if (!focused.ok) return;
    expect(focused.value.scene.focusedEntityIds).toEqual(['wall-south-2']);
    expect(focused.value.scene.digest).not.toBe(created.value.scene.digest);
    // The prior revision is untouched (pure transitions).
    expect(created.value.scene.focusedEntityIds).toEqual(['wall-north-1']);
  });

  it('applies and removes a declared overlay deterministically', () => {
    const store = emptyWorldSceneStore();
    const created = createWorldScene(store, sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const state = created.value.state;
    const applied = applySceneOverlay(state, 'wsc-tower-a-site', 'ovl-state-damaged');
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.scene.appliedOverlays).toEqual([
      { overlayId: 'ovl-highlight-north', orderIndex: 0 },
      { overlayId: 'ovl-measure-span', orderIndex: 1 },
      { overlayId: 'ovl-state-damaged', orderIndex: 2 },
    ]);
    const removed = removeSceneOverlay(applied.value.state, 'wsc-tower-a-site', 'ovl-measure-span');
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.value.scene.appliedOverlays.map((a) => a.overlayId)).toEqual([
      'ovl-highlight-north',
      'ovl-state-damaged',
    ]);
  });

  it('applying an already-applied overlay is idempotent', () => {
    const store = emptyWorldSceneStore();
    const created = createWorldScene(store, sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const applied = applySceneOverlay(created.value.state, 'wsc-tower-a-site', 'ovl-highlight-north');
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.scene.appliedOverlays).toEqual([
      { overlayId: 'ovl-highlight-north', orderIndex: 0 },
      { overlayId: 'ovl-measure-span', orderIndex: 1 },
    ]);
    expect(applied.value.scene.digest).toBe(created.value.scene.digest);
  });

  it('computes the scene usage record', () => {
    const store = emptyWorldSceneStore();
    const created = createWorldScene(store, sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const usage = computeSceneUsage(created.value.scene);
    expect(usage).toEqual({
      entityCount: 2,
      focusedCount: 1,
      overlayLibraryCount: 3,
      appliedOverlayCount: 2,
      animationInstructionCount: 1,
      narrativeBlockCount: 2,
      markerCount: 3,
      participantCount: 2,
      agentCount: 1,
      evidenceReferenceCount: 2,
      controlCount: 2,
    });
  });
});

describe('world scene tenant scoping (positive)', () => {
  it('getWorldScene with the owning tenant succeeds', () => {
    const store = emptyWorldSceneStore();
    const created = createWorldScene(store, sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const found = getWorldScene(created.value.state, 'wsc-tower-a-site', {
      expectedTenantId: TENANT_A,
    });
    expect(found.ok).toBe(true);
  });

  it('listWorldScenes filters by tenant', () => {
    const store = emptyWorldSceneStore();
    const created = createWorldScene(store, sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(listWorldScenes(created.value.state, { expectedTenantId: TENANT_A })).toHaveLength(1);
    expect(listWorldScenes(created.value.state, { expectedTenantId: TENANT_B })).toHaveLength(0);
  });

  it('creation with a mismatched expected tenant is denied', () => {
    const store = emptyWorldSceneStore();
    const denied = createWorldScene(store, sceneContent(), { expectedTenantId: TENANT_B });
    const failure = expectFailure(denied, 'cross-tenant-denied');
    expect(failure.expectedTenantId).toBe(TENANT_B);
    expect(failure.encounteredTenantId).toBe(TENANT_A);
  });
});
