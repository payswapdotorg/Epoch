// W061 — the WEB WORLD HOST's REAL-ENGINE integration battery (Node, no
// GPU): the proof that the `/world` route's composition mounts the REAL
// Three.js and Babylon.js renderers behind the REAL fabric seam and that
// the full workspace loop works against them:
//
// - the fabric registers the two REAL renderers + the reference fallback,
//   and the runtime opens on the PREFERRED real renderer (Three.js first);
// - semantic picking goes through the REAL Three.js Raycaster (the pointer
//   is derived from the adapter's own projection — `projectedPointerOf`);
// - the runtime's REAL switching invariant carries the canonical world
//   digest + semantic entity ids to the REAL Babylon.js adapter (NullEngine
//   in Node — the deterministic core) and back, restoring the portable
//   view state (typed skips where the capability set does not declare it);
// - the same entity picks through the REAL Babylon scene.pick on the
//   switched session (the pointer derived from `projectedPositionOf`).
//
// The BROWSER GL legs (real WebGL rasterization over the injected surfaces,
// real pixels) are the Playwright battery (apps/web/e2e/j13-world.spec.ts).
import { describe, expect, it } from 'vitest';
import {
  THREE_RENDERER_ID,
  ThreeJsRendererAdapter,
  projectedPointerOf,
} from '@epoch/adapter-renderer-threejs';
import {
  BABYLONJS_RENDERER_ID,
  BabylonRendererAdapter,
  nullEngineHost,
} from '@epoch/adapter-renderer-babylonjs';
import {
  ManualFrameScheduler,
  ManualHostClock,
  WorldWorkspaceRuntime,
  spatialPresentationOf,
} from '@epoch/world-runtime';
import {
  ENTITY_IDS,
  ONTOLOGY,
  DEVICE,
  REFERENCE_RENDERER_ID,
  RENDERER_PREFERENCE,
  SCENE,
  buildWorldFabric,
  isEngineRenderer,
} from './world-fixture';

/** Open one workspace over the REAL (headless) engines of the web fixture. */
async function openEngineWorkspace(): Promise<{
  readonly runtime: WorldWorkspaceRuntime;
  readonly three: ThreeJsRendererAdapter;
  readonly babylon: BabylonRendererAdapter;
  readonly clock: ManualHostClock;
  readonly scheduler: ManualFrameScheduler;
}> {
  const clock = new ManualHostClock(100_000);
  const scheduler = new ManualFrameScheduler();
  const three = new ThreeJsRendererAdapter();
  const babylon = new BabylonRendererAdapter({ host: nullEngineHost() });
  const { fabric } = buildWorldFabric({ three, babylon });
  const runtime = new WorldWorkspaceRuntime({
    slug: 'web-world-test',
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
    throw new Error(`the web world workspace failed to open: ${opened.error.message}`);
  }
  return { runtime, three, babylon, clock, scheduler };
}

/**
 * The pointer position at which one entity projects under the ACTIVE
 * session's presenter (the adapter's own projection — the honest targeting
 * basis: the pointer is DERIVED from the real projection, never guessed).
 */
function pointerAt(
  runtime: WorldWorkspaceRuntime,
  three: ThreeJsRendererAdapter,
  babylon: BabylonRendererAdapter,
  entityId: string,
): { readonly x: number; readonly y: number } {
  const session = runtime.session();
  if (session === null) {
    throw new Error('no active session');
  }
  if (session.rendererId === THREE_RENDERER_ID) {
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
  const adapterSession = babylon.adapterSessionOf(session.fabricSessionId);
  if (adapterSession === undefined) {
    throw new Error('no babylon adapter session for the active session');
  }
  const projected = babylon.projectedPositionOf(adapterSession, entityId);
  if (projected === null) {
    throw new Error(`entity ${entityId} does not project under the babylon camera`);
  }
  return projected;
}

describe('the web world host — the REAL renderers behind the /world route (headless)', () => {
  it('registers the REAL Three.js and Babylon.js renderers plus the reference fallback through the REAL registry', () => {
    const three = new ThreeJsRendererAdapter();
    const babylon = new BabylonRendererAdapter({ host: nullEngineHost() });
    const { fabric } = buildWorldFabric({ three, babylon });
    const listed = fabric.adapters.listRenderers().map((entry) => entry.descriptor.rendererId);
    expect([...listed].sort()).toEqual(
      [BABYLONJS_RENDERER_ID, REFERENCE_RENDERER_ID, THREE_RENDERER_ID].sort(),
    );
    // The ordered preference: the REAL Three.js renderer first, the REAL
    // Babylon.js renderer second, the contract-only reference last.
    expect(RENDERER_PREFERENCE).toEqual([
      THREE_RENDERER_ID,
      BABYLONJS_RENDERER_ID,
      REFERENCE_RENDERER_ID,
    ]);
    expect(isEngineRenderer(THREE_RENDERER_ID)).toBe(true);
    expect(isEngineRenderer(BABYLONJS_RENDERER_ID)).toBe(true);
    expect(isEngineRenderer(REFERENCE_RENDERER_ID)).toBe(false);
  });

  it('opens the workspace on the PREFERRED real renderer (Three.js) with canonical digest continuity', async () => {
    const { runtime } = await openEngineWorkspace();
    try {
      const session = runtime.session();
      expect(session?.state).toBe('active');
      expect(session?.rendererId).toBe(THREE_RENDERER_ID);
      // The session presents the SPATIAL PRESENTATION PROJECTION (the
      // derived canonical revision — controls/narrative stay with the host).
      expect(session?.mountedWorldDigest).toBe(spatialPresentationOf(SCENE).digest);
      const view = runtime.viewModel();
      // The workspace view model reports the CANONICAL digest.
      expect(view.viewport.worldDigest).toBe(SCENE.digest);
      // The Epoch-owned selector offers BOTH real engines + the fallback.
      expect(view.renderers.choices.map((choice) => choice.rendererId).sort()).toEqual(
        [THREE_RENDERER_ID, BABYLONJS_RENDERER_ID, REFERENCE_RENDERER_ID].sort(),
      );
      expect(view.renderers.health.state).toBe('healthy');
    } finally {
      await runtime.close();
    }
  });

  it('picks the CANONICAL semantic entity through the REAL Three.js Raycaster (the fabric seam)', async () => {
    const { runtime, three, babylon } = await openEngineWorkspace();
    try {
      // Pick a DIFFERENT entity than the focused one so the select intent
      // produces a NEW canonical revision (focus moves COL-04 -> staging).
      const pointer = pointerAt(runtime, three, babylon, ENTITY_IDS.siteStaging);
      const picked = await runtime.dispatchPointerDown(pointer);
      expect(picked.ok).toBe(true);
      if (picked.ok) {
        expect(picked.value.receipt.hitEntityId).toBe(ENTITY_IDS.siteStaging);
        expect(picked.value.receipt.intent?.id).toBe('epoch.world.interaction.select');
        expect(picked.value.receipt.outcome).toBe('normalized');
        expect(picked.value.applied).toBe(true);
      }
      // The canonical revision now focuses the picked entity.
      expect(runtime.currentScene().focusedEntityIds).toEqual([ENTITY_IDS.siteStaging]);
      expect(runtime.viewModel().inspect.entityId).toBe(ENTITY_IDS.siteStaging);
      expect(runtime.viewModel().inspect.label).toBe('Staging / laydown yard');
    } finally {
      await runtime.close();
    }
  });

  it('switches Three.js -> Babylon.js -> Three.js through the REAL switching invariant with digest/entity continuity', async () => {
    const { runtime, three, babylon } = await openEngineWorkspace();
    try {
      // Semantic pick on the REAL three.js presenter first (the focus moves
      // to the staging yard — a new canonical revision presented on a fresh
      // session; the digest below is read AFTER it).
      const pickedOnThree = await runtime.dispatchPointerDown(
        pointerAt(runtime, three, babylon, ENTITY_IDS.siteStaging),
      );
      expect(pickedOnThree.ok && pickedOnThree.value.applied).toBe(true);
      const presentationDigest = spatialPresentationOf(runtime.currentScene()).digest;

      // SWITCH to the REAL Babylon.js renderer (the fabric invariant).
      const toBabylon = await runtime.selectRenderer(BABYLONJS_RENDERER_ID);
      expect(toBabylon.ok).toBe(true);
      if (toBabylon.ok) {
        expect(toBabylon.value.fromRendererId).toBe(THREE_RENDERER_ID);
        expect(toBabylon.value.toRendererId).toBe(BABYLONJS_RENDERER_ID);
        // Digest continuity: the derived presentation digest (the anchor of
        // every fabric session over this canonical revision) carries across
        // the switch, and the canonical revision itself is untouched.
        expect(toBabylon.value.worldDigest).toBe(presentationDigest);
        // Both real engines declare the full portable view state.
        expect(toBabylon.value.restoredViewFields).toContain('camera');
        expect(toBabylon.value.skippedViewFields).not.toContain('camera');
      }
      expect(runtime.session()?.rendererId).toBe(BABYLONJS_RENDERER_ID);
      expect(runtime.viewModel().renderers.activeRendererId).toBe(BABYLONJS_RENDERER_ID);
      expect(runtime.viewModel().renderers.lastSwitchDigest).toMatch(/^[0-9a-f]{64}$/);
      // Entity continuity on the Babylon session: the same presented set.
      const babylonSession = runtime.session();
      const adapterSession = babylon.adapterSessionOf(babylonSession?.fabricSessionId ?? '');
      expect(adapterSession).toBeDefined();
      const presentedOnBabylon = babylon.presentedEntityIds(adapterSession!);
      expect(presentedOnBabylon).toContain(ENTITY_IDS.siteStaging);
      expect(presentedOnBabylon).toContain(ENTITY_IDS.hvacUnit);
      expect(presentedOnBabylon).not.toContain(ENTITY_IDS.legacyConduit);
      // Semantic picking through the REAL Babylon scene.pick on the
      // switched session (a different entity — the roof beam grid). The
      // beam self-picks through the adapter's own projected-position basis
      // under the restored camera (empirically isolated per entity — the
      // construction fixture's dense interior occludes most projected
      // centers through the building; the beam's cut face is unoccluded).
      const pickedOnBabylon = await runtime.dispatchPointerDown(
        pointerAt(runtime, three, babylon, ENTITY_IDS.beam02),
      );
      expect(pickedOnBabylon.ok).toBe(true);
      if (pickedOnBabylon.ok) {
        expect(pickedOnBabylon.value.receipt.hitEntityId).toBe(ENTITY_IDS.beam02);
        expect(pickedOnBabylon.value.receipt.intent?.id).toBe('epoch.world.interaction.select');
      }

      // The beam pick created a NEW canonical revision (focus moved) — the
      // projection digest of the CURRENT revision is the switch anchor now.
      const canonicalDigestAfterBeamPick = runtime.currentScene().digest;
      const presentationDigestAfterPick = spatialPresentationOf(
        runtime.currentScene(),
      ).digest;
      expect(presentationDigestAfterPick).not.toBe(presentationDigest);

      // SWITCH BACK (the reverse direction — same invariants).
      const backToThree = await runtime.selectRenderer(THREE_RENDERER_ID);
      expect(backToThree.ok).toBe(true);
      if (backToThree.ok) {
        expect(backToThree.value.toRendererId).toBe(THREE_RENDERER_ID);
        expect(backToThree.value.restoredViewFields).toContain('camera');
        expect(backToThree.value.worldDigest).toBe(presentationDigestAfterPick);
      }
      expect(runtime.session()?.rendererId).toBe(THREE_RENDERER_ID);
      // The canonical revision survived the round trip (only focus moved —
      // the staging/beam picks were select intents; the entities, overlays
      // and timeline of the original revision are untouched).
      expect(runtime.currentScene().entities.map((entity) => entity.entityId).sort()).toEqual(
        SCENE.entities.map((entity) => entity.entityId).sort(),
      );
      // And the switch-back touched nothing canonical: the digest read
      // right after the beam pick (the last intent) still identifies the
      // revision — switching is non-semantic by construction.
      expect(runtime.currentScene().digest).toBe(canonicalDigestAfterBeamPick);
    } finally {
      await runtime.close();
    }
  });
});
