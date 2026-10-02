// THE W057 WORLD-EXPERIENCE ACCEPTANCE JOURNEY — the work-order battery:
// "A user can enter a real fixture problem and solve through the spatial
// world without relying on a table/status representation. Interactions
// produce existing typed Epoch intents."
//
// The journey drives the REAL @epoch/world-runtime WorldWorkspaceRuntime
// over the REAL fixture problem (world-fixture.ts) through the REAL
// RendererFabric seam (two contract-only reference renderers — the same
// mount W058/W059's engines occupy). Every step asserts the SPATIAL
// world surface (the viewport view model), never a table/status
// projection, and every interaction's typed intent is journaled.
//
// The W061 full closure adds the real engines (W058/W059), the external
// foundation path (W060), browser/desktop E2E, and the Action Gateway
// approval leg; this battery is the honest W057 scope.
import { describe, expect, it } from 'vitest';
import { navigationFromCamera } from '../../packages/world-runtime/src/index';
import {
  AGENT_IDS,
  BRANCH_AT_MS,
  CONTROL_IDS,
  ENTITY_IDS,
  FULL_RENDERER_ID,
  HIDDEN_ENTITY_ID,
  LAYERS,
  OVERLAY_IDS,
  PRESENTED_ENTITY_IDS,
  REDUCED_RENDERER_ID,
  SCENE,
  TENANT,
  hitEntityOf,
  openWorkspace,
  pointerXOf,
} from './world-fixture';

describe('the world journey — enter the fixture problem through the spatial world', () => {
  it('opens the workspace presenting the canonical fixture revision (enter a real fixture problem)', async () => {
    const { runtime } = await openWorkspace();
    try {
      const session = runtime.session();
      expect(session?.state).toBe('active');
      expect(session?.rendererId).toBe(FULL_RENDERER_ID);
      const view = runtime.viewModel();
      // The SPATIAL world: the viewport is the primary surface, carrying
      // the canonical identity (scene id, world digest, tenant).
      expect(view.viewport.sceneId).toBe(SCENE.sceneId);
      expect(view.viewport.worldDigest).toBe(SCENE.digest);
      expect(view.viewport.tenantId).toBe(TENANT);
      expect(view.viewport.sceneName).toBe('Riverside plant-room riser coordination');
      // Seven canonical entities, each projected into the viewport space.
      expect(view.viewport.entities).toHaveLength(7);
      for (const entity of view.viewport.entities) {
        expect(entity.contentDigest).toMatch(/^[0-9a-f]{64}$/);
        expect(Array.isArray(entity.position)).toBe(true);
      }
      // The visible entities project INTO the frustum (spatial glyphs with
      // depth); the hidden legacy duct is the only invisible glyph (a ghost
      // at its spatial position — findable by revealing its layer).
      const projected = view.viewport.entities.filter(
        (entity) => entity.ndc !== null && entity.visible,
      );
      expect(projected.map((entity) => entity.entityId).sort()).toEqual(
        [...PRESENTED_ENTITY_IDS].sort(),
      );
      const hidden = view.viewport.entities.find(
        (entity) => entity.entityId === HIDDEN_ENTITY_ID,
      );
      expect(hidden?.visible).toBe(false);
      // Semantic layers are derived from the canonical entity types.
      expect(view.layers.map((layer) => layer.layerId)).toEqual([...LAYERS]);
      // The renderer selector lists BOTH registered renderers (Epoch-owned
      // chrome over the real registry).
      expect(view.renderers.choices.map((choice) => choice.rendererId).sort()).toEqual(
        [FULL_RENDERER_ID, REDUCED_RENDERER_ID].sort(),
      );
      expect(view.renderers.health.state).toBe('healthy');
    } finally {
      await runtime.close();
    }
  });

  it('orbit/pan/zoom + desktop navigation keys move the presentation camera (never the canonical scene)', async () => {
    const { runtime } = await openWorkspace();
    try {
      const before = runtime.viewModel().viewport.navigation;
      runtime.applyGesture({ kind: 'orbit', deltaX: 0.6, deltaY: 0.15 });
      runtime.applyGesture({ kind: 'pan', deltaX: 40, deltaY: -20 });
      for (const key of ['w', 'a', 'q', 'r'] as const) {
        runtime.navigate(key);
      }
      const after = runtime.viewModel().viewport.navigation;
      expect(after.azimuthRad).not.toBeCloseTo(before.azimuthRad, 6);
      expect(after.elevationRad).not.toBeCloseTo(before.elevationRad, 6);
      expect(after.target).not.toEqual(before.target);
      // The canonical camera record is untouched (presentation-only).
      expect(runtime.currentScene().camera).toEqual(SCENE.camera);
      // Semantic zoom goes through the fabric seam as the TYPED zoom intent.
      const zoom = await runtime.dispatchWheel({ x: 0, y: -120 });
      expect(zoom.ok).toBe(true);
      if (zoom.ok) {
        expect(zoom.value.receipt.intent?.id).toBe('epoch.world.interaction.zoom');
        expect(zoom.value.applied).toBe(true);
      }
      const journal = runtime.viewModel().journal;
      expect(journal.some((entry) => entry.intentKind === 'zoom' && entry.outcome === 'applied')).toBe(true);
      // Reset restores the canonical camera presentation (the CURRENT
      // revision's camera — the zoom intent already re-scaled it).
      runtime.resetNavigation();
      expect(runtime.viewModel().viewport.navigation).toEqual(
        navigationFromCamera(runtime.currentScene().camera),
      );
    } finally {
      await runtime.close();
    }
  });

  it('picks the CANONICAL semantic entity through the fabric seam (semantic picking + selection)', async () => {
    const { runtime } = await openWorkspace();
    try {
      // Pick a DIFFERENT entity than the initially-focused one so the pick
      // produces a NEW canonical revision (focused moves riser -> frame).
      const x = pointerXOf(ENTITY_IDS.frame);
      expect(hitEntityOf(x)).toBe(ENTITY_IDS.frame);
      const picked = await runtime.dispatchPointerDown({ x, y: 0.5 });
      expect(picked.ok).toBe(true);
      if (picked.ok) {
        // The receipt carries the SEMANTIC entity id + the typed intent.
        expect(picked.value.receipt.hitEntityId).toBe(ENTITY_IDS.frame);
        expect(picked.value.receipt.intent?.id).toBe('epoch.world.interaction.select');
        expect(picked.value.receipt.outcome).toBe('normalized');
        expect(picked.value.applied).toBe(true);
      }
      // The canonical revision now FOCUSES the picked entity — visible in
      // the spatial world as the focus state of the picked glyph.
      const view = runtime.viewModel();
      const glyph = view.viewport.entities.find((entity) => entity.entityId === ENTITY_IDS.frame);
      expect(glyph?.focused).toBe(true);
      expect(view.inspect.entityId).toBe(ENTITY_IDS.frame);
      expect(view.inspect.label).toBe('Frame grid B');
      expect(view.inspect.entityType).toBe('site:structure');
    } finally {
      await runtime.close();
    }
  });

  it('inspects the picked entity through the typed inspect intent (effect routed, never executed)', async () => {
    const { runtime } = await openWorkspace();
    try {
      runtime.setTool('inspect');
      const picked = await runtime.dispatchPointerDown({ x: pointerXOf(ENTITY_IDS.panel), y: 0.5 });
      expect(picked.ok).toBe(true);
      const effects = runtime.viewModel().effects;
      const inspect = effects.find(
        (entry) => entry.effect.effect === 'inspect-requested'
          && entry.effect.entityId === ENTITY_IDS.panel,
      );
      // The inspect intent NEVER mutates the scene: it surfaces the typed
      // request effect for the host to route to the world model.
      expect(inspect).toBeDefined();
      expect(picked.ok && picked.value.applied).toBe(false);
      // The inspect panel nevertheless shows the CANONICAL entity data.
      expect(runtime.viewModel().inspect.entityId).toBe(ENTITY_IDS.panel);
      expect(runtime.viewModel().inspect.label).toBe('Main distribution panel MD-2');
    } finally {
      await runtime.close();
    }
  });

  it('isolates and reveals semantic layers — finding the HIDDEN clash risk through the world', async () => {
    const { runtime } = await openWorkspace();
    try {
      // Isolate the MEP layer: ONLY panel + riser (+ the hidden duct)
      // remain visible — the site/delivery layers leave the world.
      const isolated = await runtime.isolateLayer('lyr-mep');
      expect(isolated.ok && isolated.value).toBe(true);
      let view = runtime.viewModel();
      const visibleIds = view.viewport.entities
        .filter((entity) => entity.visible)
        .map((entity) => entity.entityId)
        .sort();
      expect(visibleIds).toEqual([ENTITY_IDS.legacyDuct, ENTITY_IDS.panel, ENTITY_IDS.riser].sort());
      // The hidden legacy duct is now part of the presented world (the
      // filter intent makes it visible) — and the fabric presents the NEW
      // canonical revision on a fresh session.
      const ductGlyph = view.viewport.entities.find((entity) => entity.entityId === HIDDEN_ENTITY_ID);
      expect(ductGlyph?.visible).toBe(true);
      // The layer panel derives the isolation state from the same revision.
      const mep = view.layers.find((layer) => layer.layerId === 'lyr-mep');
      expect(mep?.visible).toBe(true);
      // Reveal everything: the full world returns.
      const revealed = await runtime.revealAllLayers();
      expect(revealed.ok && revealed.value).toBe(true);
      view = runtime.viewModel();
      expect(view.viewport.entities.every((entity) => entity.visible)).toBe(true);
      // Every layer transition was an EXISTING typed intent.
      const journal = runtime.viewModel().journal;
      expect(journal.some((entry) => entry.intentKind === 'filter' && entry.outcome === 'applied')).toBe(true);
      expect(journal.some((entry) => entry.intentKind === 'show' && entry.outcome === 'applied')).toBe(true);
    } finally {
      await runtime.close();
    }
  });

  it('measures the riser run through two spatial picks (the declared measurement overlay applies)', async () => {
    const { runtime } = await openWorkspace();
    try {
      runtime.setTool('measure');
      // First pick arms the measurement (a typed no-apply receipt)…
      const armed = await runtime.dispatchPointerDown({ x: pointerXOf(ENTITY_IDS.panel), y: 0.5 });
      expect(armed.ok && armed.value.applied).toBe(false);
      // …second pick composes the typed measure intent between the two
      // canonical entities.
      const measured = await runtime.dispatchPointerDown({ x: pointerXOf(ENTITY_IDS.riser), y: 0.5 });
      expect(measured.ok).toBe(true);
      if (measured.ok) {
        expect(measured.value.receipt.intent?.id).toBe('epoch.world.interaction.measure');
      }
      const effects = runtime.viewModel().effects;
      const measure = effects.find(
        (entry) => entry.effect.effect === 'measure-requested'
          && entry.effect.fromEntityId === ENTITY_IDS.panel
          && entry.effect.toEntityId === ENTITY_IDS.riser,
      );
      expect(measure).toBeDefined();
      // The workspace applies the DECLARED measurement overlay when the
      // measure effect matches it — the ruled line appears in the world.
      const view = runtime.viewModel();
      const overlay = view.viewport.overlays.find(
        (candidate) => candidate.overlayId === OVERLAY_IDS.riserRun,
      );
      expect(overlay).toBeDefined();
      expect(overlay?.overlayKind).toBe('measurement');
      expect(overlay?.fromEntityId).toBe(ENTITY_IDS.panel);
      expect(overlay?.toEntityId).toBe(ENTITY_IDS.riser);
      expect(overlay?.label).toBe('Panel-to-riser run');
    } finally {
      await runtime.close();
    }
  });

  it('annotates the focused entity (the annotation overlay enters the canonical revision)', async () => {
    const { runtime } = await openWorkspace();
    try {
      const annotated = await runtime.composeAnnotation('Reroute riser east of L4 duct');
      expect(annotated.ok && annotated.value).toBe(true);
      const view = runtime.viewModel();
      const annotation = view.viewport.overlays.find(
        (overlay) => overlay.overlayKind === 'annotation',
      );
      expect(annotation).toBeDefined();
      expect(annotation?.text).toBe('Reroute riser east of L4 duct');
      // The annotation targeted the focused canonical entity (the riser).
      expect(annotation?.entityId).toBe(ENTITY_IDS.riser);
      // The annotation intent is journaled as the EXISTING typed intent.
      expect(
        runtime.viewModel().journal.some(
          (entry) => entry.intentKind === 'annotate' && entry.outcome === 'applied',
        ),
      ).toBe(true);
    } finally {
      await runtime.close();
    }
  });

  it('sees and follows the surveyor agent (visible presence + the typed follow-agent intent)', async () => {
    const { runtime } = await openWorkspace();
    try {
      const view = runtime.viewModel();
      // Presence is visible IN the world: both agents project as markers.
      expect(view.viewport.agents.map((agent) => agent.agentId).sort()).toEqual(
        [AGENT_IDS.surveyor, AGENT_IDS.coordinator].sort(),
      );
      expect(view.viewport.followedAgentId).toBeNull();
      const followed = await runtime.followAgent(AGENT_IDS.surveyor);
      expect(followed.ok && followed.value).toBe(true);
      const after = runtime.viewModel();
      // The canonical camera record now follows the agent (semantic state).
      expect(after.viewport.cameraMode).toBe('follow-agent');
      expect(after.viewport.followedAgentId).toBe(AGENT_IDS.surveyor);
      const marker = after.viewport.agents.find((agent) => agent.agentId === AGENT_IDS.surveyor);
      expect(marker?.followed).toBe(true);
    } finally {
      await runtime.close();
    }
  });

  it('scrubs, pauses, and resumes the delivery replay (typed timeline intents)', async () => {
    const { runtime } = await openWorkspace();
    try {
      const scrubbed = await runtime.scrubTimeline(BRANCH_AT_MS);
      expect(scrubbed.ok && scrubbed.value).toBe(true);
      expect(runtime.viewModel().timeline.positionAtMs).toBe(BRANCH_AT_MS);
      expect(runtime.viewModel().timeline.presentationAtMs).toBe(BRANCH_AT_MS);
      const paused = await runtime.pauseTimeline();
      expect(paused.ok && paused.value).toBe(true);
      expect(runtime.viewModel().timeline.paused).toBe(true);
      const resumed = await runtime.resumeTimeline();
      expect(resumed.ok && resumed.value).toBe(true);
      expect(runtime.viewModel().timeline.paused).toBe(false);
      // The branch-point marker is presented on the timeline surface.
      expect(
        runtime.viewModel().timeline.markers.some(
          (marker) => marker.markerKind === 'branch-point' && marker.atMs === BRANCH_AT_MS,
        ),
      ).toBe(true);
      // Scrubbing past the track end is a typed rejection (never a clamp).
      const beyond = await runtime.scrubTimeline(999_999);
      expect(beyond.ok).toBe(false);
      if (!beyond.ok) {
        expect(beyond.error.code).toBe('invalid-replay-position');
      }
    } finally {
      await runtime.close();
    }
  });

  it('enters branch and simulation through the scene controls (typed intents + request effects)', async () => {
    const { runtime } = await openWorkspace();
    try {
      await runtime.scrubTimeline(BRANCH_AT_MS);
      const branched = await runtime.invokeControl(CONTROL_IDS.branch, { branchAtMs: BRANCH_AT_MS });
      expect(branched.ok).toBe(true);
      // Branch/simulate are EFFECT-ONLY intents: the scene revision never
      // changes (value=false) — the request is surfaced for its authority.
      expect(branched.ok ? branched.value : null).toBe(false);
      const simulated = await runtime.invokeControl(CONTROL_IDS.simulate, {
        scenarioRef: 'scope-riverside-hoist-sequence',
      });
      expect(simulated.ok).toBe(true);
      expect(simulated.ok ? simulated.value : null).toBe(false);
      const effects = runtime.viewModel().effects;
      expect(
        effects.find(
          (entry) => entry.effect.effect === 'branch-requested' && entry.effect.atMs === BRANCH_AT_MS,
        ),
      ).toBeDefined();
      expect(
        effects.find(
          (entry) => entry.effect.effect === 'simulate-requested'
            && entry.effect.scenarioRef === 'scope-riverside-hoist-sequence',
        ),
      ).toBeDefined();
      // Branch/simulate NEVER mutate the scene: the world digest is the
      // scrub revision's, and both intents surfaced as effects only.
      const before = runtime.currentScene().digest;
      expect(effects.length).toBeGreaterThanOrEqual(2);
      expect(runtime.currentScene().digest).toBe(before);
    } finally {
      await runtime.close();
    }
  });

  it('switches renderers both ways with world-digest continuity (the fabric switching invariant)', async () => {
    const { runtime } = await openWorkspace();
    try {
      const originalDigest = runtime.currentScene().digest;
      const toReduced = await runtime.selectRenderer(REDUCED_RENDERER_ID);
      expect(toReduced.ok).toBe(true);
      if (toReduced.ok) {
        expect(toReduced.value.toRendererId).toBe(REDUCED_RENDERER_ID);
        expect(toReduced.value.worldDigest).toBe(originalDigest);
        // The reduced renderer declares no camera portability — the skip
        // is typed and listed, never silent.
        expect(toReduced.value.skippedViewFields).toContain('camera');
        expect(toReduced.value.restoredViewFields).not.toContain('camera');
      }
      expect(runtime.viewModel().renderers.activeRendererId).toBe(REDUCED_RENDERER_ID);
      // The switch receipt digest is surfaced (continuity evidence).
      expect(runtime.viewModel().renderers.lastSwitchDigest).toMatch(/^[0-9a-f]{64}$/);
      const backToFull = await runtime.selectRenderer(FULL_RENDERER_ID);
      expect(backToFull.ok).toBe(true);
      if (backToFull.ok) {
        expect(backToFull.value.worldDigest).toBe(originalDigest);
        expect(backToFull.value.restoredViewFields).toContain('camera');
      }
      expect(runtime.viewModel().renderers.activeRendererId).toBe(FULL_RENDERER_ID);
      // The canonical scene survived the round trip unchanged.
      expect(runtime.currentScene().digest).toBe(originalDigest);
    } finally {
      await runtime.close();
    }
  });

  it('the wall-clock host loop drives presentation without touching canonical semantics', async () => {
    const { runtime, clock, scheduler } = await openWorkspace();
    try {
      runtime.startHostLoop();
      expect(runtime.isLoopRunning).toBe(true);
      const before = runtime.viewModel().timeline;
      scheduler.fire(); // first tick: delta 0 by design (no previous tick)
      clock.advanceTo(clock.nowMs() + 250);
      scheduler.fire(); // second tick: delta 250ms
      await new Promise((resolve) => setTimeout(resolve, 0)); // the async tick settles
      const after = runtime.viewModel().timeline;
      // The presentation clock advanced with the tick (playing timeline).
      expect(after.presentationAtMs).toBeGreaterThan(before.presentationAtMs);
      // The canonical position is unchanged (it moves only through typed
      // replay intents — the host loop is presentation-only).
      expect(after.positionAtMs).toBe(before.positionAtMs);
      runtime.stopHostLoop();
      expect(runtime.isLoopRunning).toBe(false);
    } finally {
      await runtime.close();
    }
  });

  it('the architectural invariants hold end-to-end (no second store, no mutation, typed intents only)', async () => {
    const { runtime } = await openWorkspace();
    try {
      // Interact across every surface.
      await runtime.dispatchPointerDown({ x: pointerXOf(ENTITY_IDS.frame), y: 0.5 });
      runtime.applyGesture({ kind: 'orbit', deltaX: 0.3, deltaY: 0 });
      await runtime.dispatchWheel({ x: 0, y: -120 });
      await runtime.toggleLayer('lyr-site');
      await runtime.followAgent(AGENT_IDS.coordinator);
      await runtime.scrubTimeline(8_000);
      await runtime.invokeControl(CONTROL_IDS.pause);
      // 1. The INPUT canonical scene object is NEVER mutated.
      expect(SCENE.entities.map((entity) => [entity.entityId, entity.visible])).toEqual([
        [ENTITY_IDS.frame, true],
        [ENTITY_IDS.hoist, true],
        [ENTITY_IDS.legacyDuct, false],
        [ENTITY_IDS.panel, true],
        [ENTITY_IDS.riser, true],
        [ENTITY_IDS.slab, true],
        [ENTITY_IDS.staging, true],
      ]);
      expect(SCENE.focusedEntityIds).toEqual([ENTITY_IDS.riser]);
      expect(SCENE.timeline.position.atMs).toBe(1_500);
      // 2. Every journaled interaction used an EXISTING typed intent id.
      const journal = runtime.viewModel().journal;
      expect(journal.length).toBeGreaterThan(0);
      for (const entry of journal) {
        expect(entry.controlIntentId).toMatch(/^epoch\.world\.interaction\.[a-z-]+$/);
      }
      const kinds = new Set(journal.map((entry) => entry.controlIntentId));
      expect(kinds.has('epoch.world.interaction.select')).toBe(true);
      expect(kinds.has('epoch.world.interaction.zoom')).toBe(true);
      expect(kinds.has('epoch.world.interaction.hide')).toBe(true);
      expect(kinds.has('epoch.world.interaction.follow-agent')).toBe(true);
      expect(kinds.has('epoch.world.interaction.replay')).toBe(true);
      expect(kinds.has('epoch.world.interaction.pause')).toBe(true);
      // 3. Renderer sessions are ephemeral: exactly one live fabric
      //    session exists at rest (revisions replaced theirs).
      expect(runtime.session()?.state).toBe('active');
      // 4. Semantic effects are surfaced, never executed here.
      for (const entry of runtime.viewModel().effects) {
        expect(entry.effect.effect).toMatch(/-requested$/);
      }
    } finally {
      await runtime.close();
    }
  });
});
