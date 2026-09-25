// The world interaction reducer: presentation intents transition the
// scene view state; semantic intents produce typed host-side effects and
// never mutate anything (the authority discipline).
import { describe, expect, it } from 'vitest';
import { createWorldScene, emptyWorldSceneStore } from '../src/scene';
import { applyWorldIntent } from '../src/reducer';
import { admitWorldIntent } from '../src/intent';
import { expectFailure, intentFixtures, sceneContent } from './fixtures';

function setup() {
  const created = createWorldScene(emptyWorldSceneStore(), sceneContent());
  if (!created.ok) {
    throw new Error(`fixture scene failed: ${created.error.message}`);
  }
  return created.value;
}

function admit(kind: string): ReturnType<typeof admitWorldIntent> {
  const intent = intentFixtures().find((i) => i.kind === kind);
  if (intent === undefined) {
    throw new Error(`missing fixture intent for ${kind}`);
  }
  return admitWorldIntent(intent);
}

describe('presentation intents (scene view transitions)', () => {
  it('select focuses the target entity', () => {
    const { state } = setup();
    const admitted = admit('select');
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', admitted.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.outcome.scene.focusedEntityIds).toEqual(['wall-north-1']);
    expect(applied.value.outcome.effects).toEqual([]);
  });

  it('isolate marks exactly one entity isolated', () => {
    const { state } = setup();
    const admitted = admit('isolate');
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', admitted.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const scene = applied.value.outcome.scene;
    expect(scene.entities.find((e) => e.entityId === 'wall-south-2')?.isolated).toBe(true);
    expect(scene.entities.find((e) => e.entityId === 'wall-north-1')?.isolated).toBe(false);
  });

  it('hide and show toggle visibility', () => {
    const { state } = setup();
    const hidden = admit('hide');
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    const afterHide = applyWorldIntent(state, 'wsc-tower-a-site', hidden.value);
    expect(afterHide.ok).toBe(true);
    if (!afterHide.ok) return;
    expect(afterHide.value.outcome.scene.entities.find((e) => e.entityId === 'wall-south-2')?.visible).toBe(false);
    const shown = admit('show');
    expect(shown.ok).toBe(true);
    if (!shown.ok) return;
    const afterShow = applyWorldIntent(afterHide.value.state, 'wsc-tower-a-site', shown.value);
    expect(afterShow.ok).toBe(true);
    if (!afterShow.ok) return;
    expect(afterShow.value.outcome.scene.entities.find((e) => e.entityId === 'wall-south-2')?.visible).toBe(true);
  });

  it('filter sets visibility to the include set', () => {
    const { state } = setup();
    const filtered = admit('filter');
    expect(filtered.ok).toBe(true);
    if (!filtered.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', filtered.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const scene = applied.value.outcome.scene;
    expect(scene.entities.find((e) => e.entityId === 'wall-north-1')?.visible).toBe(true);
    expect(scene.entities.find((e) => e.entityId === 'wall-south-2')?.visible).toBe(false);
  });

  it('move translates the entity presentation placement (world state untouched)', () => {
    const { state, scene } = setup();
    const moved = admit('move');
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', moved.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.outcome.scene.entities.find((e) => e.entityId === 'wall-north-1')?.position).toEqual([1, 0, 0]);
    // The exact-revision world reference is unchanged: presentation move,
    // never a world mutation.
    expect(applied.value.outcome.scene.entities.find((e) => e.entityId === 'wall-north-1')?.contentDigest).toBe(
      scene.entities.find((e) => e.entityId === 'wall-north-1')?.contentDigest,
    );
  });

  it('rotate sets the entity orientation (delta applies to identity)', () => {
    const { state } = setup();
    const rotated = admit('rotate');
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', rotated.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.outcome.scene.entities.find((e) => e.entityId === 'wall-north-1')?.orientation).toEqual([0, 0, 0, 1]);
  });

  it('zoom transitions the camera without an explicit transition record', () => {
    const { state } = setup();
    const zoomed = admit('zoom');
    expect(zoomed.ok).toBe(true);
    if (!zoomed.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', zoomed.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    const camera = applied.value.outcome.scene.camera;
    if (camera.mode !== 'orbit') throw new Error('expected orbit camera');
    // factor 1.5 moves the position 1.5x away from the anchor [0,0,10]:
    // x 0+(30-0)*1.5, y 0+(20-0)*1.5, z 10+(30-10)*1.5.
    expect(camera.position).toEqual([45, 30, 40]);
    expect(applied.value.outcome.cameraTransition).toBeUndefined();
  });

  it('follow-agent transitions the camera with an explicit cut transition', () => {
    const { state } = setup();
    const followed = admit('follow-agent');
    expect(followed.ok).toBe(true);
    if (!followed.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', followed.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.outcome.scene.camera.mode).toBe('follow-agent');
    expect(applied.value.outcome.cameraTransition).toEqual({
      transitionKind: 'cut',
      fromMode: 'orbit',
      toMode: 'follow-agent',
      atMs: 0,
    });
  });

  it('follow-agent on an undeclared agent is a typed unknown-scene-reference', () => {
    const { state } = setup();
    const admitted = admitWorldIntent({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'follow-agent',
      intentId: 'intent-follow-ghost',
      agentId: 'agent:ghost-9',
    });
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const failure = expectFailure(
      applyWorldIntent(state, 'wsc-tower-a-site', admitted.value),
      'unknown-scene-reference',
    );
    expect(failure.encountered).toBe('agent:ghost-9');
  });

  it('annotate creates + applies an annotation overlay deterministically (idempotent replay)', () => {
    const { state } = setup();
    const annotate = admit('annotate');
    expect(annotate.ok).toBe(true);
    if (!annotate.ok) return;
    const first = applyWorldIntent(state, 'wsc-tower-a-site', annotate.value);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const scene = first.value.outcome.scene;
    // The library stays sorted by overlayId: the annotation lands at its
    // canonical position (ovl-annot-* sorts before ovl-highlight-*).
    const overlayId = scene.overlays.find((o) => o.overlayId.startsWith('ovl-annot-'))?.overlayId;
    expect(overlayId).toMatch(/^ovl-annot-/);
    expect(scene.appliedOverlays.map((a) => a.overlayId)).toContain(overlayId);
    // Replaying the same intent (same intentId) is idempotent: the same
    // derived overlay id already exists.
    const second = applyWorldIntent(first.value.state, 'wsc-tower-a-site', annotate.value);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.outcome.scene.overlays).toHaveLength(scene.overlays.length);
    expect(second.value.outcome.scene.digest).toBe(scene.digest);
  });

  it('annotate citing undeclared evidence is a typed unknown-evidence-reference', () => {
    const { state } = setup();
    const admitted = admitWorldIntent({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'annotate',
      intentId: 'intent-annotate-bad-evidence',
      entityId: 'wall-north-1',
      text: 'note',
      evidenceDigests: ['9'.repeat(64)],
    });
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    expectFailure(applyWorldIntent(state, 'wsc-tower-a-site', admitted.value), 'unknown-evidence-reference');
  });

  it('replay seeks within bounds and advances the frame index', () => {
    const { state } = setup();
    const replay = admit('replay');
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', replay.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.outcome.scene.timeline.position).toEqual({
      atMs: 100,
      frameIndex: 1,
      paused: false,
    });
  });

  it('replay beyond the timeline end is a typed invalid-replay-position', () => {
    const { state } = setup();
    const admitted = admitWorldIntent({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'replay',
      intentId: 'intent-replay-too-far',
      fromMs: 5000,
    });
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const failure = expectFailure(
      applyWorldIntent(state, 'wsc-tower-a-site', admitted.value),
      'invalid-replay-position',
    );
    expect(failure.encounteredMs).toBe(5000);
    expect(failure.boundMs).toBe(900);
  });

  it('pause and resume toggle the paused flag', () => {
    const { state } = setup();
    const pause = admit('pause');
    expect(pause.ok).toBe(true);
    if (!pause.ok) return;
    const paused = applyWorldIntent(state, 'wsc-tower-a-site', pause.value);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(paused.value.outcome.scene.timeline.position.paused).toBe(true);
    const resume = admit('resume');
    expect(resume.ok).toBe(true);
    if (!resume.ok) return;
    const resumed = applyWorldIntent(paused.value.state, 'wsc-tower-a-site', resume.value);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.value.outcome.scene.timeline.position.paused).toBe(false);
  });
});

describe('semantic intents (typed effects, never mutations)', () => {
  const effectKinds = [
    ['inspect', 'inspect-requested'],
    ['measure', 'measure-requested'],
    ['compare', 'compare-requested'],
    ['simulate', 'simulate-requested'],
    ['query', 'query-requested'],
    ['change', 'change-requested'],
    ['connect', 'connect-requested'],
    ['disconnect', 'disconnect-requested'],
    ['branch', 'branch-requested'],
  ] as const;

  it.each(effectKinds)('%s produces a typed %s effect and leaves the scene unchanged', (kind, effect) => {
    const { state, scene } = setup();
    const admitted = admit(kind);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', admitted.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.outcome.scene.digest).toBe(scene.digest);
    expect(applied.value.outcome.effects).toHaveLength(1);
    expect(applied.value.outcome.effects[0]?.effect).toBe(effect);
  });

  it('the measure effect carries both endpoints', () => {
    const { state } = setup();
    const admitted = admit('measure');
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const applied = applyWorldIntent(state, 'wsc-tower-a-site', admitted.value);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.outcome.effects[0]).toEqual({
      effect: 'measure-requested',
      fromEntityId: 'wall-north-1',
      toEntityId: 'wall-south-2',
    });
  });

  it('entity-targeting semantic intents validate resolvability', () => {
    const { state } = setup();
    const admitted = admitWorldIntent({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'inspect',
      intentId: 'intent-inspect-missing',
      entityId: 'wall-east-missing',
    });
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    expectFailure(applyWorldIntent(state, 'wsc-tower-a-site', admitted.value), 'unknown-scene-reference');
  });

  it('branch beyond the timeline end is a typed invalid-replay-position', () => {
    const { state } = setup();
    const admitted = admitWorldIntent({
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'branch',
      intentId: 'intent-branch-too-far',
      atMs: 9999,
    });
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    expectFailure(applyWorldIntent(state, 'wsc-tower-a-site', admitted.value), 'invalid-replay-position');
  });
});

describe('reducer determinism', () => {
  it('the same intent sequence produces byte-identical scene revisions', () => {
    const run = () => {
      const { state } = setup();
      const sequence = ['select', 'hide', 'move', 'zoom', 'pause'] as const;
      let current = state;
      for (const kind of sequence) {
        const admitted = admit(kind);
        if (!admitted.ok) throw new Error(`admission failed for ${kind}`);
        const applied = applyWorldIntent(current, 'wsc-tower-a-site', admitted.value);
        if (!applied.ok) throw new Error(`apply failed for ${kind}: ${applied.error.message}`);
        current = applied.value.state;
      }
      const scene = current.scenes.find((s) => s.sceneId === 'wsc-tower-a-site');
      if (scene === undefined) throw new Error('scene vanished');
      return JSON.stringify(scene);
    };
    expect(run()).toBe(run());
  });
});
