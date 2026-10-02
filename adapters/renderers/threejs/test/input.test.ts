/**
 * W058 unit battery — input normalization into the EXISTING W016 intent
 * vocabulary (hit-test -> semantic entity id -> typed intent; never a
 * parallel vocabulary, never a durable write).
 *
 * Proves (headless): pointer activations (with and without hints), the
 * REAL two-click measurement affordance, annotation, wheel zoom (semantic
 * intent + presentation-only dolly), key normalization (pause/resume/
 * replay), presentation-only camera controls (drag orbit, arrow orbit/
 * pan), no-target behavior, and typed refusals for the unrecognized.
 */
import { describe, expect, it } from 'vitest';
import {
  ThreeJsRendererAdapter,
  ZOOM_IN_FACTOR,
  projectedPointerOf,
} from '../src/index';
import type { PortableCameraState } from '@epoch/renderer-runtime';
import type { WorldInteractionIntent } from '@epoch/world-experience';
import { admitWorldIntent } from '@epoch/world-experience';
import {
  UNIT_ENTITY_IDS,
  keyInput,
  mountUnitSession,
  parseEnvelope,
  pointerInput,
  wheelEnvelope,
} from './helpers';

/** Translate one raw envelope and expect a normalized, W016-ADMISSIBLE intent. */
async function normalizedIntent(
  adapter: ThreeJsRendererAdapter,
  fabricSessionId: string,
  envelope: Record<string, unknown>,
): Promise<{ hitEntityId?: string; intent: WorldInteractionIntent; reason?: string }> {
  const session = adapter.adapterSessionOf(fabricSessionId)!;
  const translated = await adapter.translateInput(session, parseEnvelope(envelope));
  expect(translated.ok).toBe(true);
  if (!translated.ok) {
    throw new Error(translated.error.message);
  }
  expect(translated.value.intent).toBeDefined();
  const intent = translated.value.intent!;
  // The Dynamic UI law, from the adapter side: every emitted intent passes
  // the REAL W016 total admission (the fabric re-admits it anyway).
  const admitted = admitWorldIntent(intent);
  expect(admitted.ok).toBe(true);
  return { hitEntityId: translated.value.hitEntityId, intent, reason: translated.value.reason };
}

/** Narrow a portable camera to its orbit member (readable failures otherwise). */
function orbitOf(camera: PortableCameraState | undefined): Extract<PortableCameraState, { mode: 'orbit' }> {
  if (camera === undefined || camera.mode !== 'orbit') {
    throw new Error(`expected an orbit portable camera, got mode "${camera?.mode ?? 'none'}"`);
  }
  return camera;
}

describe('W058 three.js adapter — input normalization', () => {
  it('normalizes a pointer-down into a select intent on the REAL hit entity', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const pointer = projectedPointerOf(presentation, UNIT_ENTITY_IDS[1])!;
    const { hitEntityId, intent } = await normalizedIntent(
      adapter,
      'fx-threejs-unit-1',
      pointerInput('fx-threejs-unit-1', 'rin-unit-select-1', pointer.x, pointer.y, 3_000),
    );
    expect(hitEntityId).toBe(UNIT_ENTITY_IDS[1]);
    expect(intent).toEqual({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'select',
      intentId: 'wi-rin-unit-select-1',
      entityId: UNIT_ENTITY_IDS[1],
    });
  });

  it('normalizes the hinted activations (inspect / isolate / hide)', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const pointer = projectedPointerOf(presentation, UNIT_ENTITY_IDS[2])!;
    const hint = (id: string) => ({ id, version: '1.0.0' });

    const inspect = await normalizedIntent(
      adapter,
      'fx-threejs-unit-1',
      pointerInput('fx-threejs-unit-1', 'rin-unit-inspect-1', pointer.x, pointer.y, 3_000, hint('epoch.world.interaction.inspect')),
    );
    expect(inspect.intent.kind).toBe('inspect');
    expect(inspect.intent).toMatchObject({ entityId: UNIT_ENTITY_IDS[2] });

    const isolate = await normalizedIntent(
      adapter,
      'fx-threejs-unit-1',
      pointerInput('fx-threejs-unit-1', 'rin-unit-isolate-1', pointer.x, pointer.y, 3_000, hint('epoch.world.interaction.isolate')),
    );
    expect(isolate.intent.kind).toBe('isolate');

    const hide = await normalizedIntent(
      adapter,
      'fx-threejs-unit-1',
      pointerInput('fx-threejs-unit-1', 'rin-unit-hide-1', pointer.x, pointer.y, 3_000, hint('epoch.world.interaction.hide')),
    );
    expect(hide.intent.kind).toBe('hide');
    expect(hide.intent).toMatchObject({ entityIds: [UNIT_ENTITY_IDS[2]] });
  });

  it('normalizes the REAL two-click measurement affordance into a measure intent', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const fromPointer = projectedPointerOf(presentation, UNIT_ENTITY_IDS[0])!;
    const toPointer = projectedPointerOf(presentation, UNIT_ENTITY_IDS[1])!;
    const hint = { id: 'epoch.world.interaction.measure', version: '1.0.0' };

    // First hinted click: the ANCHOR (a typed no-target — no intent yet).
    const session = adapter.adapterSessionOf('fx-threejs-unit-1')!;
    const anchored = await adapter.translateInput(
      session,
      parseEnvelope(pointerInput('fx-threejs-unit-1', 'rin-unit-measure-1', fromPointer.x, fromPointer.y, 3_000, hint)),
    );
    expect(anchored.ok).toBe(true);
    if (anchored.ok) {
      expect(anchored.value.intent).toBeUndefined();
      expect(anchored.value.hitEntityId).toBe(UNIT_ENTITY_IDS[0]);
    }

    // Second hinted click on a DIFFERENT entity: the completed measurement.
    const { intent } = await normalizedIntent(
      adapter,
      'fx-threejs-unit-1',
      pointerInput('fx-threejs-unit-1', 'rin-unit-measure-2', toPointer.x, toPointer.y, 3_100, hint),
    );
    expect(intent).toEqual({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'measure',
      intentId: 'wi-rin-unit-measure-2',
      fromEntityId: UNIT_ENTITY_IDS[0],
      toEntityId: UNIT_ENTITY_IDS[1],
    });

    // The anchor is consumed: a third hinted click re-anchors (no intent).
    const reanchored = await adapter.translateInput(
      session,
      parseEnvelope(pointerInput('fx-threejs-unit-1', 'rin-unit-measure-3', fromPointer.x, fromPointer.y, 3_200, hint)),
    );
    expect(reanchored.ok).toBe(true);
    if (reanchored.ok) {
      expect(reanchored.value.intent).toBeUndefined();
    }
  });

  it('normalizes annotation with a presentation-authored text', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const pointer = projectedPointerOf(presentation, UNIT_ENTITY_IDS[0])!;
    const { intent } = await normalizedIntent(
      adapter,
      'fx-threejs-unit-1',
      pointerInput('fx-threejs-unit-1', 'rin-unit-annotate-1', pointer.x, pointer.y, 3_000, {
        id: 'epoch.world.interaction.annotate',
        version: '1.0.0',
      }),
    );
    expect(intent.kind).toBe('annotate');
    expect(intent).toMatchObject({ entityId: UNIT_ENTITY_IDS[0], text: 'annotation: Foundation slab' });
  });

  it('normalizes an agent-marker hit into a follow-agent intent', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const agent = presentation.agentNodes.values().next().value!;
    const camera = presentation.controls.camera;
    camera.updateMatrixWorld(true);
    const projected = agent.position.clone().project(camera);
    const { intent } = await normalizedIntent(
      adapter,
      'fx-threejs-unit-1',
      pointerInput('fx-threejs-unit-1', 'rin-unit-follow-1', (projected.x + 1) / 2, (1 - projected.y) / 2, 3_000),
    );
    expect(intent).toEqual({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'follow-agent',
      intentId: 'wi-rin-unit-follow-1',
      agentId: 'agent:unit-observer',
    });
  });

  it('normalizes wheel input into a zoom intent AND dollies the presentation camera', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const before = presentation.controls.toPortableCamera();
    const { intent } = await normalizedIntent(
      adapter,
      'fx-threejs-unit-1',
      wheelEnvelope('fx-threejs-unit-1', 'rin-unit-zoom-1', -120, 3_000),
    );
    expect(intent).toMatchObject({ kind: 'zoom', factor: ZOOM_IN_FACTOR });
    // The presentation camera dollied in (presentation-only state).
    const after = presentation.controls.toPortableCamera();
    const beforeCam = orbitOf(before);
    const afterCam = orbitOf(after);
    const distanceBefore = Math.hypot(
      beforeCam.position[0] - (beforeCam.target?.[0] ?? 0),
      beforeCam.position[1] - (beforeCam.target?.[1] ?? 0),
      beforeCam.position[2] - (beforeCam.target?.[2] ?? 0),
    );
    const distanceAfter = Math.hypot(
      afterCam.position[0] - (afterCam.target?.[0] ?? 0),
      afterCam.position[1] - (afterCam.target?.[1] ?? 0),
      afterCam.position[2] - (afterCam.target?.[2] ?? 0),
    );
    expect(distanceAfter).toBeLessThan(distanceBefore);
  });

  it('normalizes keys: space toggles pause/resume, r replays from the track start', async () => {
    const { adapter } = await mountUnitSession();
    // The unit fixture timeline is playing (paused: false) -> space pauses.
    const pause = await normalizedIntent(
      adapter,
      'fx-threejs-unit-1',
      keyInput('fx-threejs-unit-1', 'rin-unit-space-1', ' '),
    );
    expect(pause.intent).toMatchObject({ kind: 'pause' });
    // After the pause intent the presentation timeline flag flips only via
    // a portable restore — the adapter itself never mutates the canonical
    // timeline; a restored paused state turns space into resume.
    const session = adapter.adapterSessionOf('fx-threejs-unit-1')!;
    const restored = await adapter.restoreViewState(session, {
      ...(await import('./helpers')).unitViewState(),
      timelinePosition: { atMs: 2_000, frameIndex: 60, paused: true },
    });
    expect(restored.ok).toBe(true);
    const resume = await normalizedIntent(
      adapter,
      'fx-threejs-unit-1',
      keyInput('fx-threejs-unit-1', 'rin-unit-space-2', ' '),
    );
    expect(resume.intent).toMatchObject({ kind: 'resume' });
    // Replay normalizes with the track start as the virtual from-time.
    const replay = await normalizedIntent(
      adapter,
      'fx-threejs-unit-1',
      keyInput('fx-threejs-unit-1', 'rin-unit-replay-1', 'r'),
    );
    expect(replay.intent).toMatchObject({ kind: 'replay', fromMs: 0 });
  });

  it('treats arrow keys as PRESENTATION-ONLY camera controls (no intent, real orbit/pan)', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const before = presentation.controls.toPortableCamera();
    const session = adapter.adapterSessionOf('fx-threejs-unit-1')!;
    const orbit = await adapter.translateInput(
      session,
      parseEnvelope(keyInput('fx-threejs-unit-1', 'rin-unit-left-1', 'arrow-left')),
    );
    expect(orbit.ok).toBe(true);
    if (orbit.ok) {
      expect(orbit.value.intent).toBeUndefined();
      expect(orbit.value.reason).toContain('presentation-only');
    }
    const after = presentation.controls.toPortableCamera();
    expect(orbitOf(after).position).not.toEqual(orbitOf(before).position);
    // Shift+arrow pans instead (also presentation-only).
    const pan = await adapter.translateInput(
      session,
      parseEnvelope(keyInput('fx-threejs-unit-1', 'rin-unit-shift-left-1', 'arrow-left', ['shift'])),
    );
    expect(pan.ok).toBe(true);
    if (pan.ok) {
      expect(pan.value.intent).toBeUndefined();
    }
  });

  it('orbits the presentation camera on pointer drag (pointer-down -> pointer-move -> pointer-up)', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const before = presentation.controls.toPortableCamera();
    const session = adapter.adapterSessionOf('fx-threejs-unit-1')!;
    // Down (on an entity — the select intent was the activation; the drag
    // anchor is armed as presentation state)...
    const down = await adapter.translateInput(
      session,
      parseEnvelope(pointerInput('fx-threejs-unit-1', 'rin-unit-drag-1', 0.5, 0.5, 3_000)),
    );
    expect(down.ok).toBe(true);
    // ...move (the orbit happens, no intent)...
    const move = await adapter.translateInput(
      session,
      parseEnvelope({
        ...pointerInput('fx-threejs-unit-1', 'rin-unit-drag-2', 0.6, 0.55, 3_050),
        inputKind: 'pointer-move',
      }),
    );
    expect(move.ok).toBe(true);
    if (move.ok) {
      expect(move.value.intent).toBeUndefined();
      expect(move.value.reason).toContain('orbit');
    }
    const after = presentation.controls.toPortableCamera();
    expect(orbitOf(after).position).not.toEqual(orbitOf(before).position);
    // ...up (the drag releases).
    const up = await adapter.translateInput(
      session,
      parseEnvelope({
        ...pointerInput('fx-threejs-unit-1', 'rin-unit-drag-3', 0.6, 0.55, 3_100),
        inputKind: 'pointer-up',
      }),
    );
    expect(up.ok).toBe(true);
    // A subsequent move without an anchor is non-activating.
    const hover = await adapter.translateInput(
      session,
      parseEnvelope({
        ...pointerInput('fx-threejs-unit-1', 'rin-unit-drag-4', 0.7, 0.6, 3_150),
        inputKind: 'pointer-move',
      }),
    );
    expect(hover.ok).toBe(true);
    if (hover.ok) {
      expect(hover.value.intent).toBeUndefined();
      expect(hover.value.reason).toContain('non-activating');
    }
  });

  it('returns typed no-target for misses and refuses the unrecognized', async () => {
    const { adapter } = await mountUnitSession();
    const session = adapter.adapterSessionOf('fx-threejs-unit-1')!;
    // A wheel with no vertical delta is a no-target.
    const idle = await adapter.translateInput(
      session,
      parseEnvelope(wheelEnvelope('fx-threejs-unit-1', 'rin-unit-idle-1', 0, 3_000)),
    );
    expect(idle.ok).toBe(true);
    if (idle.ok) {
      expect(idle.value.intent).toBeUndefined();
    }
    // An unrecognized key is a TYPED refusal (never a silent drop).
    const refused = await adapter.translateInput(
      session,
      parseEnvelope(keyInput('fx-threejs-unit-1', 'rin-unit-badkey-1', 'key-zzz')),
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.error.code).toBe('input-unsupported');
    }
    // An unsupported intent hint is likewise typed (aimed at a REAL entity
    // so the hint policy — not the hit-test — decides).
    const badHintPointer = projectedPointerOf(
      adapter.presentationOf('fx-threejs-unit-1')!,
      UNIT_ENTITY_IDS[0],
    )!;
    const badHint = await adapter.translateInput(
      session,
      parseEnvelope(
        pointerInput('fx-threejs-unit-1', 'rin-unit-badhint-1', badHintPointer.x, badHintPointer.y, 3_000, {
          id: 'epoch.world.interaction.simulate',
          version: '1.0.0',
        }),
      ),
    );
    expect(badHint.ok).toBe(false);
    if (!badHint.ok) {
      expect(badHint.error.code).toBe('input-unsupported');
    }
  });
});
