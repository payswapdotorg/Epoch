/**
 * W059 disposal battery — safe disposal is TERMINAL.
 *
 * Proves (work-order requirement 9): dispose runs scene.dispose() AND
 * engine.dispose() (evidence: the engineDisposed flag + the emptied
 * presentation), a disposed session refuses EVERY subsequent operation with
 * typed `session-disposed` failures, health reports `unavailable`, the
 * evidence helper no longer resolves the session, and a second dispose is
 * an idempotent no-op.
 */
import { describe, expect, it } from 'vitest';
import { nullEngineHost } from '../src/host';
import { BabylonRendererAdapter } from '../src/index';
import {
  CLOCK,
  ENTITY_IDS,
  SCENE,
  WORLD_PROJECTION,
  frameEnvelopeOf,
  pointerInput,
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

describe('W059 Babylon.js adapter — safe disposal', () => {
  it('disposes the Babylon scene AND engine, terminal for the session', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-dispose-1');
    const disposed = await adapter.dispose(session);
    expect(disposed.ok).toBe(true);
    if (disposed.ok) {
      expect(disposed.value.disposed).toBe(true);
      expect(disposed.value.notes).toContain('engine disposed');
    }
    expect(adapter.engineDisposedOf(session)).toBe(true);
    // Nothing survives dispose: the evidence helper stops resolving.
    expect(adapter.adapterSessionOf('fx-unit-dispose-1')).toBeUndefined();
    await adapter.dispose(session); // idempotent
  });

  it('refuses every post-dispose operation with typed session-disposed failures', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-dispose-2');
    await adapter.dispose(session);

    const remount = await adapter.mountProjection(session, {
      scene: SCENE,
      compilation: unitCompilation(),
      admittedReceipts: [],
    });
    expect(remount.ok).toBe(false);
    if (!remount.ok) expect(remount.error.code).toBe('session-disposed');

    const frame = await adapter.applyFrame(session, frameEnvelopeOf('fx-unit-dispose-2', 2, 'none', CLOCK.firstFrame));
    expect(frame.ok).toBe(false);
    if (!frame.ok) expect(frame.error.code).toBe('session-disposed');

    const input = await adapter.translateInput(
      session,
      pointerInput('fx-unit-dispose-2', 'rin-dispose-1', 'pointer-down', 0.5, 0.5, CLOCK.input),
    );
    expect(input.ok).toBe(false);
    if (!input.ok) expect(input.error.code).toBe('session-disposed');

    const wheel = await adapter.translateInput(
      session,
      wheelInputOf('fx-unit-dispose-2', 'rin-dispose-2', -120, CLOCK.input),
    );
    expect(wheel.ok).toBe(false);
    if (!wheel.ok) expect(wheel.error.code).toBe('session-disposed');

    const snapshot = await adapter.captureSnapshot(session, {
      invocationCount: 1,
      switchCount: 0,
      atMs: CLOCK.snapshot,
    });
    expect(snapshot.ok).toBe(false);
    if (!snapshot.ok) expect(snapshot.error.code).toBe('session-disposed');

    const restored = await adapter.restoreViewState(session, unitViewState());
    expect(restored.ok).toBe(false);
    if (!restored.ok) expect(restored.error.code).toBe('session-disposed');
  });

  it('reports disposed health as unavailable with the typed last failure code', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-dispose-3');
    await adapter.dispose(session);
    const health = await adapter.health(session, CLOCK.snapshot);
    expect(health.state).toBe('unavailable');
    expect(health.lastFailureCode).toBe('session-disposed');
    expect(health.detail).toBe('disposed');
  });

  it('rejects untrusted and undeclared-kind asset bindings typed (trust discipline)', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-asset-1');
    const untrusted = await adapter.bindAsset(session, {
      schema: 'epoch.renderer-asset-binding',
      fabricProtocolVersion: '1.0.0',
      bindingId: 'rab-unit-1',
      fabricSessionId: 'fx-unit-asset-1',
      tenantScope: { tenantId: SCENE.tenantScope.tenantId },
      assetDigest: 'a'.repeat(64),
      assetKind: 'mesh',
      byteSize: 1024,
      trustState: 'untrusted',
      boundAtMs: CLOCK.input,
      digest: 'b'.repeat(64),
    });
    expect(untrusted.ok).toBe(false);
    if (!untrusted.ok) expect(untrusted.error.code).toBe('asset-rejected');

    const validated = await adapter.bindAsset(session, {
      schema: 'epoch.renderer-asset-binding',
      fabricProtocolVersion: '1.0.0',
      bindingId: 'rab-unit-2',
      fabricSessionId: 'fx-unit-asset-1',
      tenantScope: { tenantId: SCENE.tenantScope.tenantId },
      assetDigest: 'c'.repeat(64),
      assetKind: 'mesh',
      byteSize: 1024,
      trustState: 'validated',
      validatedAtMs: CLOCK.input,
      boundAtMs: CLOCK.input,
      digest: 'd'.repeat(64),
    });
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.value.bound).toBe(true);
      expect(adapter.boundAssetsOf(session).length).toBe(1);
    }
    await adapter.dispose(session);
    // Nothing survives dispose: bound assets are discarded.
    expect(adapter.boundAssetsOf(session).length).toBe(0);
  });

  it('probes device compatibility typed (default: headsets incompatible, low budgets degraded)', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const desktop = await adapter.probe({
      device: {
        deviceSessionId: 'ds-probe-1',
        tenantScope: { tenantId: 'tenant-babylonjs-unit' },
        device: {
          descriptorVersion: 1,
          deviceClass: 'desktop',
          interaction: ['keyboard', 'pointer'],
          display: { stereoscopic: false, maxPixels: 2_073_600, refreshHz: 60 },
          spatial: { poseTracking: 'none', worldAnchored: false },
        },
      },
      atMs: CLOCK.created,
    });
    expect(desktop.ok).toBe(true);
    if (desktop.ok) {
      expect(desktop.value.compatible).toBe(true);
      expect(desktop.value.degradation).toBe('none');
    }

    const headset = await adapter.probe({
      device: {
        deviceSessionId: 'ds-probe-2',
        tenantScope: { tenantId: 'tenant-babylonjs-unit' },
        device: {
          descriptorVersion: 1,
          deviceClass: 'headset',
          interaction: ['pointer'],
          display: { stereoscopic: true, maxPixels: 2_073_600, refreshHz: 90 },
          spatial: { poseTracking: '6dof', worldAnchored: true },
        },
      },
      atMs: CLOCK.created,
    });
    expect(headset.ok).toBe(true);
    if (headset.ok) {
      expect(headset.value.compatible).toBe(false);
      expect(headset.value.reason).toBeDefined();
    }
  });

  it('picks entities only while live (dispose empties the presentation)', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-dispose-4');
    const projected = adapter.projectedPositionOf(session, ENTITY_IDS[0]);
    expect(projected).not.toBeNull();
    await adapter.dispose(session);
    expect(adapter.projectedPositionOf(session, ENTITY_IDS[0])).toBeNull();
    expect(adapter.pickAt(session, 0.5, 0.5)).toBeNull();
    expect(adapter.presentedEntityIds(session)).toEqual([]);
  });
});
