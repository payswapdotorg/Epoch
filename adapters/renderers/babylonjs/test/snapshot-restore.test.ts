/**
 * W059 snapshot/restore battery — portable view-state capture + restore
 * (the switching invariant's save/restore steps at the adapter seam).
 *
 * Proves: the sealed snapshot addresses the session's world (digest
 * continuity anchor), the camera is captured from the LIVE Babylon camera
 * (including presentation-only zooms), restore applies exactly the
 * DECLARED portable fields (all four by default; a narrow capability set
 * SKIPS undeclared fields — typed, never silent), free-camera states map
 * to the Babylon FreeCamera, and layer visibility applies onto meshes
 * through the injected pure classifier.
 */
import { describe, expect, it } from 'vitest';
import { nullEngineHost } from '../src/host';
import { BabylonRendererAdapter } from '../src/index';
import {
  CLOCK,
  ENTITY_IDS,
  LAYER_PRIMARY,
  LAYER_SECONDARY,
  SCENE,
  WORLD_PROJECTION,
  unitBinding,
  unitCompilation,
  unitViewState,
  wheelInputOf,
} from './helpers';

async function mounted(adapter: BabylonRendererAdapter, fabricSessionId: string) {
  const session = await adapter.createSession({
    fabricSessionId,
    binding: unitBinding(CLOCK.created),
    worldProjection: WORLD_PROJECTION,
    viewState: unitViewState(),
    createdAtMs: CLOCK.created,
  });
  if (!session.ok) throw new Error(`createSession failed: ${session.error.message}`);
  const mounted = await adapter.mountProjection(session.value, {
    scene: SCENE,
    compilation: unitCompilation(),
    admittedReceipts: [],
  });
  if (!mounted.ok) throw new Error(`mountProjection failed: ${mounted.error.message}`);
  return session.value;
}

describe('W059 Babylon.js adapter — portable snapshot capture', () => {
  it('captures a sealed snapshot of the session world (digest continuity anchor)', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-snap-1');
    const snapshot = await adapter.captureSnapshot(session, {
      invocationCount: 3,
      switchCount: 0,
      atMs: CLOCK.snapshot,
    });
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.value.schema).toBe('epoch.renderer-session-snapshot');
    expect(snapshot.value.worldProjection.worldDigest).toBe(SCENE.digest);
    expect(snapshot.value.capturedFromRendererId).toBe('rr-babylonjs-embedded');
    expect(snapshot.value.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.value.viewState.focusedEntityIds).toEqual([ENTITY_IDS[0]]);
    await adapter.dispose(session);
  });

  it('captures the LIVE camera (including presentation-only zooms)', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-snap-2');
    // One presentation-side zoom reaction (wheel in = camera radius shrinks).
    await adapter.translateInput(session, wheelInputOf('fx-unit-snap-2', 'rin-snap-zoom-1', -120, CLOCK.input));
    const snapshot = await adapter.captureSnapshot(session, {
      invocationCount: 4,
      switchCount: 0,
      atMs: CLOCK.snapshot,
    });
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    const camera = snapshot.value.viewState.camera;
    expect(camera?.mode).toBe('orbit');
    if (camera?.mode === 'orbit') {
      // The pre-zoom orbit camera sat at radius |(32,22,32)-(6,6,0)|; the
      // zoom-in step (factor 1.25) must have REDUCED the radius.
      const target = camera.target ?? [0, 0, 0];
      const radius = Math.hypot(
        camera.position[0] - target[0],
        camera.position[1] - target[1],
        camera.position[2] - target[2],
      );
      const before = Math.hypot(32 - 6, 22 - 6, 32 - 0);
      expect(radius).toBeLessThan(before);
    }
    await adapter.dispose(session);
  });
});

describe('W059 Babylon.js adapter — portable view-state restore', () => {
  it('restores all four declared portable fields from a snapshot view state', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-restore-1');
    const viewState = unitViewState();
    const restored = await adapter.restoreViewState(session, {
      ...viewState,
      focusedEntityIds: [ENTITY_IDS[1]],
      timelinePosition: { atMs: 2_000, frameIndex: 120, paused: true },
    });
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.appliedFields).toEqual(['camera', 'focused-entities', 'layer-visibility', 'timeline-position']);
    expect(restored.value.skippedFields).toEqual([]);
    expect(adapter.viewStateOf(session).focusedEntityIds).toEqual([ENTITY_IDS[1]]);
    expect(adapter.viewStateOf(session).timelinePosition.paused).toBe(true);
    expect(adapter.cameraModeOf(session)).toBe('orbit');
    await adapter.dispose(session);
  });

  it('maps a portable FREE camera to the Babylon FreeCamera', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-restore-2');
    const restored = await adapter.restoreViewState(session, {
      ...unitViewState(),
      camera: { mode: 'free', position: [5, 5, 5], orientation: [0, 0, 0, 1] },
    });
    expect(restored.ok).toBe(true);
    if (restored.ok) expect(restored.value.appliedFields).toContain('camera');
    expect(adapter.cameraModeOf(session)).toBe('free');
    await adapter.dispose(session);
  });

  it('SKIPS undeclared portable fields typed (narrow capability set)', async () => {
    const narrow = new BabylonRendererAdapter({
      host: nullEngineHost(),
      capabilities: {
        capabilityVersion: 1,
        rendererId: 'rr-babylonjs-embedded',
        hitTesting: true,
        measurement: true,
        annotation: true,
        frameCapture: false,
        sessionSwitching: true,
        snapshotCapture: true,
        degradation: ['none'],
        portableViewState: ['focused-entities', 'layer-visibility', 'timeline-position'],
        assetKinds: [],
      },
    });
    const session = await mounted(narrow, 'fx-unit-restore-3');
    const restored = await narrow.restoreViewState(session, unitViewState());
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.appliedFields).toEqual(['focused-entities', 'layer-visibility', 'timeline-position']);
    expect(restored.value.skippedFields).toEqual(['camera']);
    // The camera is the one OPTIONAL field: skipped means never carried.
    expect(narrow.viewStateOf(session).camera).toBeUndefined();
    await narrow.dispose(session);
  });

  it('applies layer visibility onto meshes through the pure classifier', async () => {
    const layerOf = (entityId: string): string | undefined => {
      if (entityId === ENTITY_IDS[0]) return LAYER_PRIMARY;
      if (entityId === ENTITY_IDS[1]) return LAYER_SECONDARY;
      return undefined;
    };
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost(), layerOfEntity: layerOf });
    const session = await mounted(adapter, 'fx-unit-restore-4');
    // The unit view state hides LAYER_SECONDARY: beta's mesh disables.
    const restored = await adapter.restoreViewState(session, unitViewState());
    expect(restored.ok).toBe(true);
    expect(adapter.entityMeshOf(session, ENTITY_IDS[1])!.isEnabled()).toBe(false);
    expect(adapter.entityMeshOf(session, ENTITY_IDS[0])!.isEnabled()).toBe(true);
    // Revealing the layer re-enables the mesh (presentation-only).
    const revealed = await adapter.restoreViewState(session, {
      ...unitViewState(),
      layerVisibility: [
        { layerId: LAYER_PRIMARY, visible: true },
        { layerId: LAYER_SECONDARY, visible: true },
      ],
    });
    expect(revealed.ok).toBe(true);
    expect(adapter.entityMeshOf(session, ENTITY_IDS[1])!.isEnabled()).toBe(true);
    await adapter.dispose(session);
  });
});
