/**
 * W059 picking + input-normalization battery — Babylon picking -> semantic
 * entity ids -> the EXISTING W016 intent vocabulary.
 *
 * Proves: every presented entity is reachable through real Babylon picking
 * (via the deterministic projection helper), picking is repeatable, misses
 * are typed no-targets (never failures), pointer-down normalizes to W016
 * select/inspect/isolate/hide/measure/annotate intents, wheel and zoom keys
 * normalize to W016 zoom intents, and unknown hints/keys are TYPED
 * refusals — never silent drops, never a parallel vocabulary.
 */
import { describe, expect, it } from 'vitest';
import { nullEngineHost } from '../src/host';
import { BabylonRendererAdapter } from '../src/index';
import type { RendererAdapterSession } from '@epoch/renderer-fabric';
import type { WorldInteractionIntent } from '@epoch/world-experience';
import {
  CLOCK,
  ENTITY_IDS,
  PRESENTED_ENTITY_IDS,
  SCENE,
  WORLD_PROJECTION,
  frameEnvelopeOf,
  keyInputOf,
  pointerInput,
  unitBinding,
  unitCompilation,
  unitViewState,
  wheelInputOf,
} from './helpers';

/** A mounted adapter session (shared fixture-per-test). */
async function mounted(adapter: BabylonRendererAdapter, fabricSessionId: string): Promise<RendererAdapterSession> {
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

describe('W059 Babylon.js adapter — semantic picking', () => {
  it('resolves every presented entity through real Babylon picking', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-pick-1');
    for (const entityId of PRESENTED_ENTITY_IDS) {
      const projected = adapter.projectedPositionOf(session, entityId);
      expect(projected).not.toBeNull();
      const hit = adapter.pickAt(session, projected!.x, projected!.y);
      expect(hit).toBe(entityId);
    }
    await adapter.dispose(session);
  });

  it('is deterministic: the same pointer always resolves the same entity', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-pick-2');
    const projected = adapter.projectedPositionOf(session, ENTITY_IDS[0])!;
    const first = adapter.pickAt(session, projected.x, projected.y);
    for (let i = 0; i < 5; i += 1) {
      expect(adapter.pickAt(session, projected.x, projected.y)).toBe(first);
    }
    await adapter.dispose(session);
  });

  it('reports a miss as a typed no-target translation, never a failure', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-pick-3');
    // The corner of the viewport points away from every entity.
    const translation = await adapter.translateInput(
      session,
      pointerInput('fx-unit-pick-3', 'rin-pick-miss-1', 'pointer-down', 0.001, 0.001, CLOCK.input),
    );
    expect(translation.ok).toBe(true);
    if (translation.ok) {
      expect(translation.value.intent).toBeUndefined();
      expect(translation.value.hitEntityId).toBeUndefined();
      expect(translation.value.reason).toBeDefined();
    }
    await adapter.dispose(session);
  });
});

describe('W059 Babylon.js adapter — input normalization into the W016 vocabulary', () => {
  it('normalizes an unhinted pointer-down on a hit entity to a W016 select intent', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-input-1');
    const projected = adapter.projectedPositionOf(session, ENTITY_IDS[0])!;
    const translation = await adapter.translateInput(
      session,
      pointerInput('fx-unit-input-1', 'rin-input-select-1', 'pointer-down', projected.x, projected.y, CLOCK.input),
    );
    expect(translation.ok).toBe(true);
    if (!translation.ok) return;
    expect(translation.value.hitEntityId).toBe(ENTITY_IDS[0]);
    const intent = translation.value.intent as WorldInteractionIntent;
    expect(intent).toEqual({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'select',
      intentId: 'wi-rin-input-select-1',
      entityId: ENTITY_IDS[0],
    });
    await adapter.dispose(session);
  });

  it('normalizes hinted pointer-downs to the hinted W016 intent kinds', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-input-2');
    const projected = adapter.projectedPositionOf(session, ENTITY_IDS[0])!;
    const hint = (id: string): { id: string; version: string } => ({ id, version: '1.0.0' });
    const cases: readonly [{ id: string; version: string }, Partial<WorldInteractionIntent>][] = [
      [hint('epoch.world.interaction.inspect'), { kind: 'inspect', entityId: ENTITY_IDS[0] }],
      [hint('epoch.world.interaction.isolate'), { kind: 'isolate', entityId: ENTITY_IDS[0] }],
      [hint('epoch.world.interaction.hide'), { kind: 'hide', entityIds: [ENTITY_IDS[0]] }],
    ];
    for (const [h, expected] of cases) {
      const translation = await adapter.translateInput(
        session,
        pointerInput('fx-unit-input-2', `rin-input-${expected.kind}-1`, 'pointer-down', projected.x, projected.y, CLOCK.input, h),
      );
      expect(translation.ok).toBe(true);
      if (!translation.ok) continue;
      expect(translation.value.intent).toMatchObject({
        schema: 'epoch.world-intent',
        intentVersion: 1,
        intentId: `wi-rin-input-${expected.kind}-1`,
        ...expected,
      });
    }
    await adapter.dispose(session);
  });

  it('normalizes measurement with the renderer-independent next-entity pairing', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-input-3');
    const projected = adapter.projectedPositionOf(session, ENTITY_IDS[0])!;
    const translation = await adapter.translateInput(
      session,
      pointerInput('fx-unit-input-3', 'rin-input-measure-1', 'pointer-down', projected.x, projected.y, CLOCK.input, {
        id: 'epoch.world.interaction.measure',
        version: '1.0.0',
      }),
    );
    expect(translation.ok).toBe(true);
    if (!translation.ok) return;
    expect(translation.value.intent).toEqual({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'measure',
      intentId: 'wi-rin-input-measure-1',
      fromEntityId: ENTITY_IDS[0],
      toEntityId: ENTITY_IDS[1], // the NEXT presented entity in sorted order
    });
    await adapter.dispose(session);
  });

  it('normalizes annotation to the W016 annotate intent (placeholder text policy)', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost(), annotationText: 'unit note' });
    const session = await mounted(adapter, 'fx-unit-input-4');
    const projected = adapter.projectedPositionOf(session, ENTITY_IDS[0])!;
    const translation = await adapter.translateInput(
      session,
      pointerInput('fx-unit-input-4', 'rin-input-annotate-1', 'pointer-down', projected.x, projected.y, CLOCK.input, {
        id: 'epoch.world.interaction.annotate',
        version: '1.0.0',
      }),
    );
    expect(translation.ok).toBe(true);
    if (!translation.ok) return;
    expect(translation.value.intent).toEqual({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'annotate',
      intentId: 'wi-rin-input-annotate-1',
      entityId: ENTITY_IDS[0],
      text: 'unit note',
    });
    await adapter.dispose(session);
  });

  it('refuses unknown hints and wrong hint versions with typed input-unsupported failures', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-input-5');
    const projected = adapter.projectedPositionOf(session, ENTITY_IDS[0])!;
    const unknownHint = await adapter.translateInput(
      session,
      pointerInput('fx-unit-input-5', 'rin-input-unknown-1', 'pointer-down', projected.x, projected.y, CLOCK.input, {
        id: 'epoch.world.interaction.simulate',
        version: '1.0.0',
      }),
    );
    expect(unknownHint.ok).toBe(false);
    if (!unknownHint.ok) expect(unknownHint.error.code).toBe('input-unsupported');
    const wrongVersion = await adapter.translateInput(
      session,
      pointerInput('fx-unit-input-5', 'rin-input-wrongver-1', 'pointer-down', projected.x, projected.y, CLOCK.input, {
        id: 'epoch.world.interaction.select',
        version: '2.0.0',
      }),
    );
    expect(wrongVersion.ok).toBe(false);
    if (!wrongVersion.ok) expect(wrongVersion.error.code).toBe('input-unsupported');
    await adapter.dispose(session);
  });

  it('normalizes wheel input to W016 zoom intents with deterministic factors', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-input-6');
    const zoomIn = await adapter.translateInput(
      session,
      wheelInputOf('fx-unit-input-6', 'rin-input-zoomin-1', -120, CLOCK.input),
    );
    expect(zoomIn.ok).toBe(true);
    if (zoomIn.ok) {
      expect(zoomIn.value.intent).toEqual({
        schema: 'epoch.world-intent',
        intentVersion: 1,
        kind: 'zoom',
        intentId: 'wi-rin-input-zoomin-1',
        factor: 1.25,
      });
    }
    const zoomOut = await adapter.translateInput(
      session,
      wheelInputOf('fx-unit-input-6', 'rin-input-zoomout-1', 120, CLOCK.input),
    );
    expect(zoomOut.ok).toBe(true);
    if (zoomOut.ok) {
      expect((zoomOut.value.intent as WorldInteractionIntent).kind).toBe('zoom');
      expect((zoomOut.value.intent as Extract<WorldInteractionIntent, { kind: 'zoom' }>).factor).toBe(0.8);
    }
    const noDelta = await adapter.translateInput(
      session,
      wheelInputOf('fx-unit-input-6', 'rin-input-wheel-0-1', 0, CLOCK.input),
    );
    expect(noDelta.ok).toBe(true);
    if (noDelta.ok) expect(noDelta.value.intent).toBeUndefined();
    await adapter.dispose(session);
  });

  it('normalizes zoom keys, treats camera keys as presentation-only, refuses unknown keys typed', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-input-7');
    const zoomKey = await adapter.translateInput(
      session,
      keyInputOf('fx-unit-input-7', 'rin-key-zoom-1', 'key-down', '+', [], CLOCK.input),
    );
    expect(zoomKey.ok).toBe(true);
    if (zoomKey.ok) {
      expect(zoomKey.value.intent).toMatchObject({
        kind: 'zoom',
        factor: 1.25,
      });
    }
    const cameraKey = await adapter.translateInput(
      session,
      keyInputOf('fx-unit-input-7', 'rin-key-camera-1', 'key-down', 'ArrowLeft', [], CLOCK.input),
    );
    expect(cameraKey.ok).toBe(true);
    if (cameraKey.ok) {
      expect(cameraKey.value.intent).toBeUndefined();
      expect(cameraKey.value.reason).toContain('presentation-only');
    }
    const unknownKey = await adapter.translateInput(
      session,
      keyInputOf('fx-unit-input-7', 'rin-key-unknown-1', 'key-down', 'x', [], CLOCK.input),
    );
    expect(unknownKey.ok).toBe(false);
    if (!unknownKey.ok) expect(unknownKey.error.code).toBe('input-unsupported');
    const modifiedKey = await adapter.translateInput(
      session,
      keyInputOf('fx-unit-input-7', 'rin-key-mod-1', 'key-down', '+', ['shift'], CLOCK.input),
    );
    expect(modifiedKey.ok).toBe(false);
    if (!modifiedKey.ok) expect(modifiedKey.error.code).toBe('input-unsupported');
    await adapter.dispose(session);
  });

  it('treats pointer-move/pointer-up as non-activating (no intent)', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-input-8');
    const move = await adapter.translateInput(
      session,
      pointerInput('fx-unit-input-8', 'rin-move-1', 'pointer-move', 0.5, 0.5, CLOCK.input),
    );
    expect(move.ok).toBe(true);
    if (move.ok) expect(move.value.intent).toBeUndefined();
    const up = await adapter.translateInput(
      session,
      pointerInput('fx-unit-input-8', 'rin-up-1', 'pointer-up', 0.5, 0.5, CLOCK.input),
    );
    expect(up.ok).toBe(true);
    if (up.ok) expect(up.value.intent).toBeUndefined();
    await adapter.dispose(session);
  });

  it('refuses measurement typed when the adapter does not declare it (narrow capability set)', async () => {
    const narrow = new BabylonRendererAdapter({
      host: nullEngineHost(),
      capabilities: {
        capabilityVersion: 1,
        rendererId: 'rr-babylonjs-embedded',
        hitTesting: true,
        measurement: false,
        annotation: true,
        frameCapture: true,
        sessionSwitching: true,
        snapshotCapture: true,
        degradation: ['none', 'static-frame'],
        portableViewState: ['focused-entities', 'layer-visibility', 'timeline-position'],
        assetKinds: [],
      },
    });
    const session = await mounted(narrow, 'fx-unit-input-9');
    const projected = narrow.projectedPositionOf(session, ENTITY_IDS[0])!;
    const refused = await narrow.translateInput(
      session,
      pointerInput('fx-unit-input-9', 'rin-narrow-measure-1', 'pointer-down', projected.x, projected.y, CLOCK.input, {
        id: 'epoch.world.interaction.measure',
        version: '1.0.0',
      }),
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok && refused.error.code === 'input-unsupported') {
      expect(refused.error.reason).toContain('measurement');
    }
    await narrow.dispose(session);
  });

  it('applies admitted frame envelopes and keeps presenting them', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const session = await mounted(adapter, 'fx-unit-frame-1');
    const frame = await adapter.applyFrame(session, frameEnvelopeOf('fx-unit-frame-1', 1, 'none', CLOCK.firstFrame));
    expect(frame.ok).toBe(true);
    if (frame.ok) {
      expect(frame.value.presented).toBe(true);
      expect(frame.value.degradation).toBe('none');
      expect(frame.value.frameIndex).toBe(1);
    }
    await adapter.dispose(session);
  });
});
