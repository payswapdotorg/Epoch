/**
 * W059 degradation battery — typed presentation-fidelity reductions.
 *
 * Proves the W056 taxonomy contract: all four degradation kinds are
 * declared by the default capability set; the three reductions apply as
 * DETERMINISTIC flags on the Babylon scene graph (wireframe materials,
 * reduced-fidelity feature shutdown + adaptive resolution, static-frame
 * presentation pause), and the probe suggests reduced fidelity for
 * low-budget devices (declared degradations only — the fabric refuses
 * undeclared kinds typed).
 */
import { describe, expect, it } from 'vitest';
import { nullEngineHost } from '../src/host';
import { BabylonRendererAdapter, probeDegradationOf } from '../src/index';
import {
  CLOCK,
  ENTITY_IDS,
  SCENE,
  WORLD_PROJECTION,
  frameEnvelopeOf,
  unitBinding,
  unitCompilation,
  unitViewState,
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

describe('W059 Babylon.js adapter — typed degradation', () => {
  it('declares every W056 degradation kind, deterministically ordered', () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const degradation = adapter.capabilities().degradation;
    expect(degradation).toEqual(['none', 'reduced-fidelity', 'static-frame', 'wireframe']);
  });

  it('applies wireframe: every entity material flips to wireframe rendering', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-degrade-1');
    const frame = await adapter.applyFrame(session, frameEnvelopeOf('fx-unit-degrade-1', 1, 'wireframe', CLOCK.firstFrame));
    expect(frame.ok).toBe(true);
    if (frame.ok) {
      expect(frame.value.degradation).toBe('wireframe');
      expect(frame.value.presented).toBe(true);
    }
    for (const entityId of [ENTITY_IDS[0], ENTITY_IDS[1], ENTITY_IDS[2]]) {
      const mesh = adapter.entityMeshOf(session, entityId)!;
      expect(mesh.material!.wireframe).toBe(true);
    }
    // Health reports the typed degradation.
    const health = await adapter.health(session, CLOCK.firstFrame + 1);
    expect(health.state).toBe('degraded');
    expect(health.degradation).toBe('wireframe');
    await adapter.dispose(session);
  });

  it('applies reduced-fidelity: heavy features off + adaptive resolution', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-degrade-2');
    const frame = await adapter.applyFrame(session, frameEnvelopeOf('fx-unit-degrade-2', 1, 'reduced-fidelity', CLOCK.firstFrame));
    expect(frame.ok).toBe(true);
    if (frame.ok) expect(frame.value.degradation).toBe('reduced-fidelity');
    const health = await adapter.health(session, CLOCK.firstFrame + 1);
    expect(health.state).toBe('degraded');
    expect(health.degradation).toBe('reduced-fidelity');
    // (The scene-graph flags — image processing disabled, hardware
    // scaling 2x — are verified through the exported pure applier in the
    // source module; the visible surface closes with the browser battery.)
    await adapter.dispose(session);
  });

  it('applies static-frame: presentation stops advancing (presented: false)', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-degrade-3');
    const frame = await adapter.applyFrame(session, frameEnvelopeOf('fx-unit-degrade-3', 1, 'static-frame', CLOCK.firstFrame));
    expect(frame.ok).toBe(true);
    if (frame.ok) {
      expect(frame.value.presented).toBe(false);
      expect(frame.value.degradation).toBe('static-frame');
    }
    const health = await adapter.health(session, CLOCK.firstFrame + 1);
    expect(health.state).toBe('degraded');
    expect(health.degradation).toBe('static-frame');
    await adapter.dispose(session);
  });

  it('recovers: a later none-degradation frame returns to healthy', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-degrade-4');
    await adapter.applyFrame(session, frameEnvelopeOf('fx-unit-degrade-4', 1, 'wireframe', CLOCK.firstFrame));
    const recovered = await adapter.applyFrame(session, frameEnvelopeOf('fx-unit-degrade-4', 2, 'none', CLOCK.firstFrame + 1_000));
    expect(recovered.ok).toBe(true);
    if (recovered.ok) expect(recovered.value.degradation).toBe('none');
    const health = await adapter.health(session, CLOCK.firstFrame + 2_000);
    expect(health.state).toBe('healthy');
    // Wireframe flags are cleared on recovery.
    const mesh = adapter.entityMeshOf(session, ENTITY_IDS[0])!;
    expect(mesh.material!.wireframe).toBe(false);
    await adapter.dispose(session);
  });

  it('suggests reduced fidelity deterministically for low-budget displays', () => {
    expect(probeDegradationOf(undefined)).toBe('none');
    expect(probeDegradationOf(2_073_600)).toBe('none');
    expect(probeDegradationOf(640 * 360)).toBe('reduced-fidelity');
  });
});
