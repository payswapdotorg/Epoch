// W061 — the desktop WORLD-HOST wiring test: the exact composition the
// world section mounts (the desktop fixture world + the REAL RendererFabric
// with the REAL Three.js and Babylon.js renderers registered ahead of the
// contract-only reference pair — the declared fallback chain — + the REAL
// @epoch/world-runtime WorldWorkspaceRuntime over the full-fidelity DESKTOP
// device descriptor), driven through the interaction script the section's
// UI surfaces issues. Pure typed-contract exercise (node, no DOM emulator —
// the W017 desktop test convention; the visible UI is the section component
// over THIS wiring). The REAL adapters run their deterministic headless
// cores here (the Three.js adapter without a GL surface, the Babylon.js
// adapter over the NullEngine host — the section injects the webview GL
// surfaces in the browser; the W061 browser E2E covers the live-GL legs).
import { describe, expect, it } from 'vitest';
import {
  ManualHostClock,
  ManualFrameScheduler,
  WorldWorkspaceRuntime,
  spatialPresentationOf,
} from '@epoch/world-runtime';
import {
  BABYLONJS_RENDERER_ID,
  BabylonRendererAdapter,
  nullEngineHost,
} from '@epoch/adapter-renderer-babylonjs';
import {
  THREE_RENDERER_ID,
  ThreeJsRendererAdapter,
  projectedPointerOf,
} from '@epoch/adapter-renderer-threejs';
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

/**
 * The pointer position at which one entity projects under the ACTIVE
 * session's presenter (the adapter's own projection — the honest targeting
 * basis: the pointer is DERIVED from the real projection, never guessed).
 */
function pointerAt(
  runtime: WorldWorkspaceRuntime,
  three: ThreeJsRendererAdapter,
  entityId: string,
): { readonly x: number; readonly y: number } {
  const session = runtime.session();
  if (session === null) {
    throw new Error('no active session');
  }
  const presentation = three.presentationOf(session.fabricSessionId);
  if (presentation === undefined) {
    throw new Error('no three.js presentation for the active session');
  }
  const projected = projectedPointerOf(presentation, entityId);
  if (projected === undefined) {
    throw new Error(`entity ${entityId} does not project under the three.js camera`);
  }
  return projected;
}

/** The composition the section mounts: the REAL engines (headless cores) + the reference fallbacks. */
async function openWorldHost() {
  const clock = new ManualHostClock(60_000);
  const scheduler = new ManualFrameScheduler();
  const three = new ThreeJsRendererAdapter();
  const babylon = new BabylonRendererAdapter({ host: nullEngineHost() });
  const { fabric } = buildWorldFabric({ three, babylon });
  const runtime = new WorldWorkspaceRuntime({
    slug: 'desktop-world-test',
    fabric,
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
  return { runtime, three, babylon, clock, scheduler };
}

describe('the desktop world host (W061 wiring — the REAL renderers)', () => {
  it('composes the REAL workspace over the full-fidelity desktop device', async () => {
    const { runtime, three } = await openWorldHost();
    try {
      expect(DEVICE.device.deviceClass).toBe('desktop');
      expect(DEVICE.device.interaction).toContain('keyboard');
      expect(DEVICE.device.interaction).toContain('pointer');
      // The PREFERRED renderer presents: the REAL Three.js adapter (its
      // deterministic headless core in node; the section injects the
      // webview GL surface in the browser).
      expect(runtime.session()?.rendererId).toBe(THREE_RENDERER_ID);
      expect(three.presentationOf(runtime.session()?.fabricSessionId ?? '')).toBeDefined();
      const view = runtime.viewModel();
      expect(view.viewport.tenantId).toBe(TENANT);
      // The view model reports the CANONICAL digest; the session presents
      // the SPATIAL PRESENTATION PROJECTION of it (host-chrome kinds stay
      // with the host — see @epoch/world-runtime spatialPresentationOf).
      expect(view.viewport.worldDigest).toBe(SCENE.digest);
      expect(runtime.session()?.mountedWorldDigest).toBe(spatialPresentationOf(SCENE).digest);
      expect(view.viewport.entities).toHaveLength(6);
      // The Epoch-owned selector offers BOTH real engines + the reference
      // fallback pair.
      expect(view.renderers.choices.map((choice) => choice.rendererId).sort()).toEqual(
        [THREE_RENDERER_ID, BABYLONJS_RENDERER_ID, FULL_RENDERER_ID, REDUCED_RENDERER_ID].sort(),
      );
    } finally {
      await runtime.close();
    }
  });

  it('the section interaction script drives typed intents through the REAL fabric seam', async () => {
    const { runtime, three } = await openWorldHost();
    try {
      // Semantic picking through the REAL Three.js Raycaster: select the
      // frame (a different entity than the fixture's focused riser, so the
      // pick produces a new revision).
      const picked = await runtime.dispatchPointerDown(
        pointerAt(runtime, three, ENTITY_IDS.frame),
      );
      expect(picked.ok).toBe(true);
      if (picked.ok) {
        expect(picked.value.receipt.hitEntityId).toBe(ENTITY_IDS.frame);
        expect(picked.value.receipt.intent?.id).toBe('epoch.world.interaction.select');
        expect(picked.value.applied).toBe(true);
      }
      // Inspect (effect-only): the canonical record without mutation.
      runtime.setTool('inspect');
      const inspected = await runtime.dispatchPointerDown(
        pointerAt(runtime, three, ENTITY_IDS.panel),
      );
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
      // Measure the panel-to-riser run over the REAL adapter: the REAL
      // engines implement a STATEFUL two-click measurement affordance (the
      // first measure-hinted click anchors the ADAPTER's measurement with a
      // typed no-target receipt, so the runtime's own two-pick composition
      // arms on the SECOND normalized measure receipt and completes on the
      // adapter's second compose cycle — the documented fourth pick; see
      // the workspace module docs).
      runtime.setTool('measure');
      await runtime.dispatchPointerDown(pointerAt(runtime, three, ENTITY_IDS.panel));
      await runtime.dispatchPointerDown(pointerAt(runtime, three, ENTITY_IDS.riser));
      await runtime.dispatchPointerDown(pointerAt(runtime, three, ENTITY_IDS.riser));
      const measured = await runtime.dispatchPointerDown(
        pointerAt(runtime, three, ENTITY_IDS.panel),
      );
      expect(measured.ok).toBe(true);
      expect(
        runtime.viewModel().viewport.overlays.some(
          (overlay) => overlay.overlayKind === 'measurement',
        ),
      ).toBe(true);
      // Annotate the focused entity (a workspace command — the composed
      // typed annotate intent).
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

  it('switches Three.js -> Babylon.js -> reference -> Three.js with digest continuity (the fallback chain)', async () => {
    const { runtime, three } = await openWorldHost();
    try {
      const canonicalDigest = runtime.currentScene().digest;
      const presentationDigest = spatialPresentationOf(runtime.currentScene()).digest;
      // SWITCH to the REAL Babylon.js renderer (NullEngine core in node).
      const toBabylon = await runtime.selectRenderer(BABYLONJS_RENDERER_ID);
      expect(toBabylon.ok).toBe(true);
      if (toBabylon.ok) {
        expect(toBabylon.value.fromRendererId).toBe(THREE_RENDERER_ID);
        expect(toBabylon.value.worldDigest).toBe(presentationDigest);
        expect(toBabylon.value.restoredViewFields).toContain('camera');
      }
      expect(runtime.session()?.rendererId).toBe(BABYLONJS_RENDERER_ID);
      // SWITCH to the contract-only reference presenter (the declared
      // fallback): the reduced portability is typed and listed.
      const toReduced = await runtime.selectRenderer(REDUCED_RENDERER_ID);
      expect(toReduced.ok).toBe(true);
      if (toReduced.ok) {
        expect(toReduced.value.worldDigest).toBe(
          spatialPresentationOf(runtime.currentScene()).digest,
        );
        expect(toReduced.value.skippedViewFields).toContain('camera');
      }
      // SWITCH BACK to the REAL Three.js renderer (same invariants).
      const backToThree = await runtime.selectRenderer(THREE_RENDERER_ID);
      expect(backToThree.ok).toBe(true);
      if (backToThree.ok) {
        expect(backToThree.value.worldDigest).toBe(
          spatialPresentationOf(runtime.currentScene()).digest,
        );
        expect(backToThree.value.restoredViewFields).toContain('camera');
      }
      expect(runtime.session()?.rendererId).toBe(THREE_RENDERER_ID);
      expect(three.presentationOf(runtime.session()?.fabricSessionId ?? '')).toBeDefined();
      // The canonical revision itself never changed (switching is
      // non-semantic by construction).
      expect(runtime.currentScene().digest).toBe(canonicalDigest);
    } finally {
      await runtime.close();
    }
  });
});
