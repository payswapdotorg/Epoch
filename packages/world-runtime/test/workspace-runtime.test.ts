// W057 — the workspace runtime end-to-end over the REAL fabric with the
// contract-only reference renderers: mount, semantic picking through the
// seam, layers, measurement/annotation, presence/follow, timeline,
// renderer switching + fallback, the host loop, and the no-mutation
// invariants. (The full user-facing journey over the WEB feature
// components lives in qa/world-experience.)
import { describe, expect, it } from 'vitest';
import { WorldWorkspaceRuntime } from '../src/workspace';
import { ManualFrameScheduler } from '../src/clock';
import {
  FULL_RENDERER_ID,
  REDUCED_RENDERER_ID,
  FixtureClock,
  SCENE,
  SCENE_ID,
  hitEntityOf,
  workspaceInputs,
} from './fixtures';

async function openWorkspace() {
  const clock = new FixtureClock();
  const scheduler = new ManualFrameScheduler();
  const runtime = new WorldWorkspaceRuntime(workspaceInputs(clock, scheduler));
  const opened = await runtime.open();
  if (!opened.ok) {
    throw new Error(`workspace failed to open: ${opened.error.message}`);
  }
  return { clock, scheduler, runtime, session: opened.value };
}

describe('the workspace runtime — mount', () => {
  it('opens an active session presenting the canonical fixture revision', async () => {
    const { runtime, session } = await openWorkspace();
    expect(session.state).toBe('active');
    expect(session.mountedWorldDigest).toBe(SCENE.digest);
    expect(session.worldProjection.sceneId).toBe(SCENE_ID);
    expect(session.worldProjection.worldDigest).toBe(SCENE.digest);
    expect(runtime.session()?.rendererId).toBe(FULL_RENDERER_ID);
    await runtime.close();
  });

  it('the view model projects the canonical scene (viewport is the primary surface)', async () => {
    const { runtime } = await openWorkspace();
    const viewModel = runtime.viewModel();
    expect(viewModel.viewport.worldDigest).toBe(SCENE.digest);
    expect(viewModel.viewport.entities.map((entity) => entity.entityId)).toEqual(
      SCENE.entities.map((entity) => entity.entityId),
    );
    expect(viewModel.viewport.agents.map((agent) => agent.agentId)).toEqual([
      'agent:workspace-surveyor',
    ]);
    expect(viewModel.layers.map((layer) => layer.layerId)).toEqual(['lyr-mep', 'lyr-site']);
    expect(viewModel.renderers.choices.length).toBe(2);
    expect(viewModel.renderers.activeRendererId).toBe(FULL_RENDERER_ID);
    expect(viewModel.renderers.health.state).toBe('healthy');
    await runtime.close();
  });

  it('open fails typed when no preferred renderer resolves', async () => {
    const clock = new FixtureClock();
    const scheduler = new ManualFrameScheduler();
    const inputs = workspaceInputs(clock, scheduler);
    const runtime = new WorldWorkspaceRuntime({ ...inputs, rendererPreference: ['rr-nope'] });
    const opened = await runtime.open();
    expect(opened.ok).toBe(false);
    if (!opened.ok) {
      expect(opened.error.code).toBe('adapter-unavailable');
    }
  });
});

describe('the workspace runtime — semantic picking through the fabric seam', () => {
  it('a pointer pick resolves the CANONICAL semantic entity and focuses it', async () => {
    const { runtime } = await openWorkspace();
    const hit = hitEntityOf(0.5); // the middle presented entity (canonical id)
    const picked = await runtime.dispatchPointerDown({ x: 0.5, y: 0.5 });
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    expect(picked.value.receipt.hitEntityId).toBe(hit);
    expect(picked.value.receipt.outcome).toBe('normalized');
    expect(picked.value.receipt.intent?.id).toBe('epoch.world.interaction.select');
    expect(picked.value.applied).toBe(true);
    // The canonical scene revision now focuses the picked entity.
    expect(runtime.currentScene().focusedEntityIds).toEqual([hit]);
    // The pick surfaced through the view model (inspect + viewport focus).
    expect(runtime.viewModel().inspect.entityId).toBe(hit);
    expect(
      runtime.viewModel().viewport.entities.find((entity) => entity.entityId === hit)?.focused,
    ).toBe(true);
    // And the focused revision is presented by a FRESH session (digest continuity).
    const session = runtime.session();
    expect(session?.state).toBe('active');
    expect(session?.worldProjection.worldDigest).toBe(runtime.currentScene().digest);
    await runtime.close();
  });

  it('the inspect tool surfaces the inspect-requested effect (authority routing, never executed)', async () => {
    const { runtime } = await openWorkspace();
    runtime.setTool('inspect');
    const effects: string[] = [];
    runtime.setEffectObserver((effect) => effects.push(effect.effect));
    const picked = await runtime.dispatchPointerDown({ x: 0.5, y: 0.5 });
    expect(picked.ok).toBe(true);
    expect(effects).toContain('inspect-requested');
    const surfaced = runtime.viewModel().effects.map((entry) => entry.effect.effect);
    expect(surfaced).toContain('inspect-requested');
    await runtime.close();
  });

  it('a miss is a typed no-target receipt (never a failure, nothing applied)', async () => {
    const { runtime } = await openWorkspace();
    // An empty presentation cannot miss here (every visible entity is
    // presented), so prove the no-target class through the journal on a
    // zero-delta wheel input instead (the documented no-target policy).
    const wheeled = await runtime.dispatchWheel({ x: 0, y: 0 });
    expect(wheeled.ok).toBe(true);
    if (!wheeled.ok) return;
    expect(wheeled.value.receipt.outcome).toBe('no-target');
    expect(wheeled.value.applied).toBe(false);
    expect(runtime.viewModel().journal.at(-1)?.outcome).toBe('no-target');
    await runtime.close();
  });

  it('wheel zoom goes through the seam and applies the typed zoom intent', async () => {
    const { runtime } = await openWorkspace();
    const before = runtime.currentScene().camera;
    const wheeled = await runtime.dispatchWheel({ x: 0, y: -120 });
    expect(wheeled.ok).toBe(true);
    if (!wheeled.ok) return;
    expect(wheeled.value.receipt.outcome).toBe('normalized');
    expect(wheeled.value.receipt.intent?.id).toBe('epoch.world.interaction.zoom');
    expect(wheeled.value.applied).toBe(true);
    const after = runtime.currentScene().camera;
    if (before.mode === 'orbit' && after.mode === 'orbit') {
      const distanceBefore = Math.hypot(
        before.position[0] - (before.target?.[0] ?? 0),
        before.position[1] - (before.target?.[1] ?? 0),
        before.position[2] - (before.target?.[2] ?? 0),
      );
      const distanceAfter = Math.hypot(
        after.position[0] - (after.target?.[0] ?? 0),
        after.position[1] - (after.target?.[1] ?? 0),
        after.position[2] - (after.target?.[2] ?? 0),
      );
      expect(distanceAfter).toBeGreaterThan(distanceBefore); // zoomed IN
    }
    await runtime.close();
  });
});

describe('the workspace runtime — layer isolation/reveal', () => {
  it('toggling a layer hides then reveals its entities (typed hide/show intents)', async () => {
    const { runtime } = await openWorkspace();
    const hidden = await runtime.toggleLayer('lyr-site');
    expect(hidden.ok).toBe(true);
    const sceneHidden = runtime.currentScene();
    expect(
      sceneHidden.entities
        .filter((entity) => entity.entityType.startsWith('site:'))
        .every((entity) => !entity.visible),
    ).toBe(true);
    const revealed = await runtime.toggleLayer('lyr-site');
    expect(revealed.ok).toBe(true);
    expect(
      runtime
        .currentScene()
        .entities.filter((entity) => entity.entityType.startsWith('site:'))
        .every((entity) => entity.visible),
    ).toBe(true);
    const kinds = runtime.viewModel().journal.map((entry) => entry.intentKind);
    expect(kinds).toContain('hide');
    expect(kinds).toContain('show');
    await runtime.close();
  });

  it('isolating a layer keeps ONLY its entities visible (the filter intent)', async () => {
    const { runtime } = await openWorkspace();
    const isolated = await runtime.isolateLayer('lyr-mep');
    expect(isolated.ok).toBe(true);
    const scene = runtime.currentScene();
    expect(scene.entities.find((entity) => entity.entityId === 'we-site-slab')?.visible).toBe(false);
    expect(scene.entities.find((entity) => entity.entityId === 'we-mep-panel')?.visible).toBe(true);
    const all = await runtime.revealAllLayers();
    expect(all.ok).toBe(true);
    expect(runtime.currentScene().entities.every((entity) => entity.visible)).toBe(true);
    await runtime.close();
  });

  it('an unknown layer id is a typed rejection', async () => {
    const { runtime } = await openWorkspace();
    const result = await runtime.toggleLayer('lyr-void');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unknown-layer');
    }
    await runtime.close();
  });

  it('hiding the layer of the FOCUSED entity keeps the session live (portable focus/hidden disjointness)', async () => {
    // Regression (found by the qa/world-experience journey): the canonical
    // W016 projection permits a focused entity to become hidden (a layer
    // toggle does not clear focus), but the W056 portable view state
    // requires the two presentation sets to be DISJOINT. The workspace's
    // portable projection carries the focus MINUS the hidden set, so the
    // re-presentation after the hide stays a lawful fabric session.
    const { runtime } = await openWorkspace();
    const hidden = await runtime.toggleLayer('lyr-site'); // the focused slab is in this layer
    expect(hidden.ok).toBe(true);
    expect(runtime.session()?.state).toBe('active');
    expect(runtime.viewModel().renderers.lastFailure).toBeNull();
    // The CANONICAL focus is untouched (only the portable projection drops it).
    expect(runtime.currentScene().focusedEntityIds).toEqual(['we-site-slab']);
    await runtime.close();
  });
});

describe('the workspace runtime — measurement and annotation', () => {
  it('two picks with the measure tool compose the typed measure intent and surface the effect', async () => {
    const { runtime } = await openWorkspace();
    runtime.setTool('measure');
    const effects: string[] = [];
    runtime.setEffectObserver((effect) => effects.push(effect.effect));
    const from = await runtime.dispatchPointerDown({ x: 0.0, y: 0.5 }); // arms (we-site-slab)
    expect(from.ok).toBe(true);
    if (!from.ok) return;
    expect(from.value.applied).toBe(false); // armed, not applied
    const to = await runtime.dispatchPointerDown({ x: 0.9, y: 0.5 }); // composes (we-mep-panel)
    expect(to.ok).toBe(true);
    expect(effects).toContain('measure-requested');
    // The declared measurement overlay of the pair is now APPLIED (visible).
    const viewModel = runtime.viewModel();
    expect(viewModel.viewport.overlays.map((overlay) => overlay.overlayId)).toContain(
      'ovl-measure-panel-slab',
    );
    // The journal proves both the seam receipts and the applied intent.
    const measureEntries = viewModel.journal.filter((entry) => entry.intentKind === 'measure');
    expect(measureEntries.length).toBeGreaterThanOrEqual(2);
    await runtime.close();
  });

  it('the annotate intent adds the annotation overlay to the canonical revision', async () => {
    const { runtime } = await openWorkspace();
    const annotated = await runtime.composeAnnotation('Verify the slab thickness here');
    expect(annotated.ok).toBe(true);
    const scene = runtime.currentScene();
    expect(scene.overlays.some((overlay) => overlay.overlayKind === 'annotation')).toBe(true);
    expect(scene.appliedOverlays.length).toBeGreaterThan(SCENE.appliedOverlays.length);
    const viewModel = runtime.viewModel();
    const annotation = viewModel.viewport.overlays.find(
      (overlay) => overlay.overlayKind === 'annotation',
    );
    expect(annotation?.text).toBe('Verify the slab thickness here');
    await runtime.close();
  });

  it('the hide tool issues the typed hide intent for the picked entity', async () => {
    const { runtime } = await openWorkspace();
    runtime.setTool('hide');
    const picked = await runtime.dispatchPointerDown({ x: 0.0, y: 0.5 });
    expect(picked.ok).toBe(true);
    expect(
      runtime.currentScene().entities.find((entity) => entity.entityId === 'we-mep-panel')?.visible,
    ).toBe(false);
    await runtime.close();
  });
});

describe('the workspace runtime — agent presence and follow', () => {
  it('following an agent switches the canonical camera to follow-agent mode', async () => {
    const { runtime } = await openWorkspace();
    const followed = await runtime.followAgent('agent:workspace-surveyor');
    expect(followed.ok).toBe(true);
    const camera = runtime.currentScene().camera;
    expect(camera.mode).toBe('follow-agent');
    if (camera.mode !== 'follow-agent') return;
    expect(camera.agentRef.agentId).toBe('agent:workspace-surveyor');
    const viewModel = runtime.viewModel();
    expect(viewModel.viewport.followedAgentId).toBe('agent:workspace-surveyor');
    expect(viewModel.viewport.agents[0]?.followed).toBe(true);
    expect(viewModel.viewport.cameraMode).toBe('follow-agent');
    await runtime.close();
  });

  it('following an unknown agent is a typed reducer rejection', async () => {
    const { runtime } = await openWorkspace();
    const followed = await runtime.followAgent('agent:ghost');
    expect(followed.ok).toBe(false);
    if (!followed.ok) {
      expect(followed.error.code).toBe('unknown-scene-reference');
    }
    await runtime.close();
  });
});

describe('the workspace runtime — timeline/replay', () => {
  it('scrubbing issues the typed replay intent and moves the canonical position', async () => {
    const { runtime } = await openWorkspace();
    const scrubbed = await runtime.scrubTimeline(6_500);
    expect(scrubbed.ok).toBe(true);
    expect(runtime.currentScene().timeline.position.atMs).toBe(6_500);
    expect(runtime.viewModel().timeline.positionAtMs).toBe(6_500);
    expect(runtime.viewModel().timeline.presentationAtMs).toBe(6_500);
    await runtime.close();
  });

  it('pause and resume toggle the canonical paused flag', async () => {
    const { runtime } = await openWorkspace();
    await runtime.pauseTimeline();
    expect(runtime.currentScene().timeline.position.paused).toBe(true);
    await runtime.resumeTimeline();
    expect(runtime.currentScene().timeline.position.paused).toBe(false);
    await runtime.close();
  });

  it('scrubbing beyond the track end is a typed rejection', async () => {
    const { runtime } = await openWorkspace();
    const scrubbed = await runtime.scrubTimeline(99_999);
    expect(scrubbed.ok).toBe(false);
    if (!scrubbed.ok) {
      expect(scrubbed.error.code).toBe('invalid-replay-position');
    }
    await runtime.close();
  });
});

describe('the workspace runtime — branch/simulation entry points', () => {
  it('the scene controls invoke as typed intents and surface their request effects', async () => {
    const { runtime } = await openWorkspace();
    const effects: string[] = [];
    runtime.setEffectObserver((effect) => effects.push(effect.effect));
    const branched = await runtime.invokeControl('ctl-branch-here', { branchAtMs: 4_000 });
    expect(branched.ok).toBe(true);
    const simulated = await runtime.invokeControl('ctl-simulate', {
      scenarioRef: 'scenario:delivery-v1',
    });
    expect(simulated.ok).toBe(true);
    expect(effects).toContain('branch-requested');
    expect(effects).toContain('simulate-requested');
    const viewModel = runtime.viewModel();
    expect(viewModel.effects.map((entry) => entry.effect.effect)).toContain('simulate-requested');
    // Effect-only intents (branch/simulate) never mutate the canonical scene.
    expect(runtime.currentScene().digest).toBe(SCENE.digest);
    expect(runtime.currentScene().timeline.position.paused).toBe(false);
    await runtime.close();
  });

  it('unknown controls are typed rejections', async () => {
    const { runtime } = await openWorkspace();
    const invoked = await runtime.invokeControl('ctl-void');
    expect(invoked.ok).toBe(false);
    if (!invoked.ok) {
      expect(invoked.error.code).toBe('unknown-control');
    }
    await runtime.close();
  });
});

describe('the workspace runtime — renderer selector, health, fallback', () => {
  it('switching renderers preserves the canonical world digest (continuity)', async () => {
    const { runtime } = await openWorkspace();
    const switched = await runtime.selectRenderer(REDUCED_RENDERER_ID);
    expect(switched.ok).toBe(true);
    if (!switched.ok) return;
    expect(switched.value.toRendererId).toBe(REDUCED_RENDERER_ID);
    expect(switched.value.worldDigest).toBe(SCENE.digest);
    expect(switched.value.fallbackApplied).toBe(false);
    // The reduced renderer skips the camera field (typed, listed).
    expect(switched.value.restoredViewFields).not.toContain('camera');
    expect(switched.value.skippedViewFields).toContain('camera');
    expect(runtime.session()?.rendererId).toBe(REDUCED_RENDERER_ID);
    expect(runtime.viewModel().renderers.activeRendererId).toBe(REDUCED_RENDERER_ID);
    expect(runtime.viewModel().renderers.lastSwitchDigest).toBe(switched.value.switchReceiptDigest);
    await runtime.close();
  });

  it('a target that cannot present falls back down the preference chain (typed failure surfaced)', async () => {
    const { runtime } = await openWorkspace();
    const switched = await runtime.selectRenderer('rr-unresolvable');
    expect(switched.ok).toBe(true); // the fallback chain completed the switch
    if (!switched.ok) return;
    expect(switched.value.fallbackApplied).toBe(true);
    expect(switched.value.toRendererId).toBe(REDUCED_RENDERER_ID);
    const viewModel = runtime.viewModel();
    expect(viewModel.renderers.fallbackApplied).toBe(true);
    expect(viewModel.renderers.lastFailure?.code).toBe('fallback-applied');
    await runtime.close();
  });

  it('health degrades honestly through the view model', async () => {
    const { runtime } = await openWorkspace();
    expect(runtime.viewModel().renderers.health.state).toBe('healthy');
    await runtime.close();
    // After close, the session record reflects disposal.
    expect(runtime.viewModel().renderers.sessionState).toBe('disposed');
  });
});

describe('the workspace runtime — the wall-clock host loop', () => {
  it('ticks apply frames, advance the presentation clock, and refresh health', async () => {
    const { runtime, scheduler, clock } = await openWorkspace();
    runtime.startHostLoop();
    expect(runtime.isLoopRunning).toBe(true);
    const before = runtime.session()?.lastFrameIndex ?? -1;
    scheduler.fire(); // first tick: delta 0 by design (no previous tick)
    clock.advanceTo(10_016);
    scheduler.fire(); // second tick: delta 16ms
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the async tick settle
    const after = runtime.session()?.lastFrameIndex ?? -1;
    expect(after).toBeGreaterThan(before);
    // The presentation clock advanced by the second tick's delta (clamped by track end).
    expect(runtime.viewModel().timeline.presentationAtMs).toBe(1_016);
    runtime.stopHostLoop();
    expect(runtime.isLoopRunning).toBe(false);
    await runtime.close();
  });

  it('the presentation clock pauses with the canonical timeline', async () => {
    const { runtime, scheduler, clock } = await openWorkspace();
    await runtime.pauseTimeline();
    runtime.startHostLoop();
    clock.advanceTo(10_050);
    scheduler.fire();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runtime.viewModel().timeline.presentationAtMs).toBe(1_000); // paused: no advance
    runtime.stopHostLoop();
    await runtime.close();
  });

  it('view-model observers receive loop notifications', async () => {
    const { runtime, scheduler, clock } = await openWorkspace();
    let notifications = 0;
    runtime.setViewModelObserver(() => {
      notifications += 1;
    });
    runtime.startHostLoop();
    clock.advanceTo(10_020);
    scheduler.fire();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(notifications).toBeGreaterThanOrEqual(1);
    runtime.stopHostLoop();
    await runtime.close();
  });
});

describe('the workspace runtime — architecture invariants', () => {
  it('the canonical fixture scene object is NEVER mutated (revisions are new records)', async () => {
    const { runtime } = await openWorkspace();
    const digestBefore = SCENE.digest;
    await runtime.dispatchPointerDown({ x: 0.5, y: 0.5 });
    await runtime.toggleLayer('lyr-site');
    await runtime.composeAnnotation('invariant probe');
    await runtime.scrubTimeline(3_000);
    expect(SCENE.digest).toBe(digestBefore);
    expect(SCENE.focusedEntityIds).toEqual(['we-site-slab']);
    expect(SCENE.appliedOverlays).toEqual([]);
    await runtime.close();
  });

  it('every viewport interaction journals an existing typed epoch.world.interaction intent', async () => {
    const { runtime } = await openWorkspace();
    await runtime.dispatchPointerDown({ x: 0.5, y: 0.5 });
    await runtime.dispatchWheel({ x: 0, y: -100 });
    runtime.setTool('measure');
    await runtime.dispatchPointerDown({ x: 0.0, y: 0.5 });
    await runtime.dispatchPointerDown({ x: 0.9, y: 0.5 });
    const journal = runtime.viewModel().journal;
    expect(journal.length).toBeGreaterThanOrEqual(4);
    for (const entry of journal) {
      expect(entry.controlIntentId.startsWith('epoch.world.interaction.')).toBe(true);
    }
    const kinds = new Set(journal.map((entry) => entry.intentKind));
    expect(kinds.has('select')).toBe(true);
    expect(kinds.has('zoom')).toBe(true);
    expect(kinds.has('measure')).toBe(true);
    await runtime.close();
  });

  it('a closed workspace refuses further input with typed failures', async () => {
    const { runtime } = await openWorkspace();
    await runtime.close();
    const picked = await runtime.dispatchPointerDown({ x: 0.5, y: 0.5 });
    expect(picked.ok).toBe(false);
    if (!picked.ok) {
      expect(picked.error.code).toBe('unknown-session');
    }
  });

  it('navigation stays presentation-only (orbit/pan never touch the canonical scene)', async () => {
    const { runtime } = await openWorkspace();
    const digestBefore = runtime.currentScene().digest;
    runtime.applyGesture({ kind: 'orbit', deltaX: 0.5, deltaY: 0.2 });
    runtime.applyGesture({ kind: 'pan', deltaX: 30, deltaY: 30 });
    runtime.navigate('w');
    runtime.navigate('q');
    runtime.navigate('+');
    runtime.resetNavigation();
    expect(runtime.currentScene().digest).toBe(digestBefore);
    await runtime.close();
  });
});
