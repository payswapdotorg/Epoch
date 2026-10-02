// W057 — the desktop WORLD-HOST wiring test: the exact composition the
// world section mounts (the desktop fixture world + the REAL RendererFabric
// with the contract-only reference renderers + the REAL
// @epoch/world-runtime WorldWorkspaceRuntime over the full-fidelity
// DESKTOP device descriptor), driven through the interaction script the
// section's UI surfaces issue. Pure typed-contract exercise (node, no DOM
// emulator — the W017 desktop test convention; the visible UI is the
// section component over THIS wiring).
import { describe, expect, it } from 'vitest';
import {
  ManualHostClock,
  ManualFrameScheduler,
  WorldWorkspaceRuntime,
} from '@epoch/world-runtime';
import {
  AGENT_IDS,
  BRANCH_AT_MS,
  ENTITY_IDS,
  FULL_RENDERER_ID,
  ONTOLOGY,
  REDUCED_RENDERER_ID,
  RENDERER_PREFERENCE,
  SCENE,
  TENANT,
  buildWorldFabric,
  DEVICE,
} from '../app/components/world-host/world-fixture';

/** The reference hit-test partition helper: x that picks entityId over a presented list. */
function pointerXOf(presented: readonly string[], entityId: string): number {
  const index = presented.indexOf(entityId);
  if (index === -1) {
    throw new Error(`${entityId} is not presented by the desktop fixture`);
  }
  return (index + 0.5) / presented.length;
}

/** The initially presented entities (visible, sorted — the fixture's hidden duct is absent). */
const INITIAL_PRESENTED = [
  ENTITY_IDS.frame,
  ENTITY_IDS.panel,
  ENTITY_IDS.riser,
  ENTITY_IDS.slab,
  ENTITY_IDS.staging,
] as const;

/** After a full reveal every entity is presented (sorted). */
const ALL_PRESENTED = [
  ENTITY_IDS.duct,
  ENTITY_IDS.frame,
  ENTITY_IDS.panel,
  ENTITY_IDS.riser,
  ENTITY_IDS.slab,
  ENTITY_IDS.staging,
] as const;

async function openWorldHost() {
  const clock = new ManualHostClock(60_000);
  const scheduler = new ManualFrameScheduler();
  const runtime = new WorldWorkspaceRuntime({
    slug: 'desktop-world-test',
    fabric: buildWorldFabric(),
    scene: SCENE,
    ontology: ONTOLOGY,
    device: DEVICE,
    clock,
    scheduler,
    rendererPreference: RENDERER_PREFERENCE,
  });
  const opened = await runtime.open();
  if (!opened.ok) {
    throw new Error(`the desktop world host failed to open: ${opened.error.message}`);
  }
  return { runtime, clock, scheduler };
}

describe('the desktop world host (W057 wiring)', () => {
  it('composes the REAL workspace over the full-fidelity desktop device', async () => {
    const { runtime } = await openWorldHost();
    try {
      expect(DEVICE.device.deviceClass).toBe('desktop');
      expect(DEVICE.device.interaction).toContain('keyboard');
      expect(DEVICE.device.interaction).toContain('pointer');
      // The full reference renderer presents (the fallback stays unused).
      expect(runtime.session()?.rendererId).toBe(FULL_RENDERER_ID);
      const view = runtime.viewModel();
      expect(view.viewport.tenantId).toBe(TENANT);
      expect(view.viewport.worldDigest).toBe(SCENE.digest);
      expect(view.viewport.entities).toHaveLength(6);
      // The desktop renders the full Experience Graph vocabulary.
      expect(view.renderers.choices.map((choice) => choice.rendererId).sort()).toEqual(
        [FULL_RENDERER_ID, REDUCED_RENDERER_ID].sort(),
      );
    } finally {
      await runtime.close();
    }
  });

  it('the section interaction script drives typed intents through the fabric seam', async () => {
    const { runtime } = await openWorldHost();
    try {
      // Semantic picking: select the frame (a different entity than the
      // fixture's focused riser, so the pick produces a new revision).
      const picked = await runtime.dispatchPointerDown({
        x: pointerXOf(INITIAL_PRESENTED, ENTITY_IDS.frame),
        y: 0.5,
      });
      expect(picked.ok).toBe(true);
      if (picked.ok) {
        expect(picked.value.receipt.hitEntityId).toBe(ENTITY_IDS.frame);
        expect(picked.value.receipt.intent?.id).toBe('epoch.world.interaction.select');
        expect(picked.value.applied).toBe(true);
      }
      // Inspect (effect-only): the canonical record without mutation.
      runtime.setTool('inspect');
      const inspected = await runtime.dispatchPointerDown({
        x: pointerXOf(INITIAL_PRESENTED, ENTITY_IDS.panel),
        y: 0.5,
      });
      expect(inspected.ok).toBe(true);
      expect(
        runtime.viewModel().effects.some(
          (entry) => entry.effect.effect === 'inspect-requested',
        ),
      ).toBe(true);
      // Isolate the MEP layer: the hidden legacy duct returns to the world.
      const isolated = await runtime.isolateLayer('lyr-mep');
      expect(isolated.ok && isolated.value).toBe(true);
      const view = runtime.viewModel();
      expect(
        view.viewport.entities.find((entity) => entity.entityId === ENTITY_IDS.duct)?.visible,
      ).toBe(true);
      await runtime.revealAllLayers();
      // Measure the panel-to-riser run over the FULLY REVEALED world (the
      // reference hit-test partitions over the six presented entities).
      runtime.setTool('measure');
      await runtime.dispatchPointerDown({ x: pointerXOf(ALL_PRESENTED, ENTITY_IDS.panel), y: 0.5 });
      await runtime.dispatchPointerDown({ x: pointerXOf(ALL_PRESENTED, ENTITY_IDS.riser), y: 0.5 });
      expect(
        runtime.viewModel().viewport.overlays.some(
          (overlay) => overlay.overlayKind === 'measurement',
        ),
      ).toBe(true);
      // Annotate the focused entity.
      const annotated = await runtime.composeAnnotation('Desktop annotation: reroute riser');
      expect(annotated.ok && annotated.value).toBe(true);
      // Follow the surveyor agent.
      const followed = await runtime.followAgent(AGENT_IDS.surveyor);
      expect(followed.ok && followed.value).toBe(true);
      expect(runtime.viewModel().viewport.followedAgentId).toBe(AGENT_IDS.surveyor);
      // Timeline transport + branch/simulate entry points.
      const scrubbed = await runtime.scrubTimeline(BRANCH_AT_MS);
      expect(scrubbed.ok && scrubbed.value).toBe(true);
      const branched = await runtime.invokeControl('ctl-dw-branch', { branchAtMs: BRANCH_AT_MS });
      expect(branched.ok).toBe(true);
      const simulated = await runtime.invokeControl('ctl-dw-simulate', {
        scenarioRef: 'scope-desktop-hoist',
      });
      expect(simulated.ok).toBe(true);
      expect(
        runtime.viewModel().effects.some((entry) => entry.effect.effect === 'branch-requested'),
      ).toBe(true);
      expect(
        runtime.viewModel().effects.some((entry) => entry.effect.effect === 'simulate-requested'),
      ).toBe(true);
      // Every journaled interaction used an EXISTING typed intent id.
      for (const entry of runtime.viewModel().journal) {
        expect(entry.controlIntentId).toMatch(/^epoch\.world\.interaction\.[a-z-]+$/);
      }
      // The fixture scene object is NEVER mutated.
      expect(SCENE.focusedEntityIds).toEqual([ENTITY_IDS.riser]);
      expect(SCENE.timeline.position.atMs).toBe(2_000);
    } finally {
      await runtime.close();
    }
  });

  it('switches renderers both ways over the desktop host with digest continuity', async () => {
    const { runtime } = await openWorldHost();
    try {
      const digest = runtime.currentScene().digest;
      const toReduced = await runtime.selectRenderer(REDUCED_RENDERER_ID);
      expect(toReduced.ok).toBe(true);
      if (toReduced.ok) {
        expect(toReduced.value.worldDigest).toBe(digest);
        expect(toReduced.value.skippedViewFields).toContain('camera');
      }
      const backToFull = await runtime.selectRenderer(FULL_RENDERER_ID);
      expect(backToFull.ok).toBe(true);
      if (backToFull.ok) {
        expect(backToFull.value.worldDigest).toBe(digest);
        expect(backToFull.value.restoredViewFields).toContain('camera');
      }
      expect(runtime.currentScene().digest).toBe(digest);
    } finally {
      await runtime.close();
    }
  });
});
