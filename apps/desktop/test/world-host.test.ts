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
//
// W067 (ACR-010): the battery EXTENSION mirrors the web in-page foundation
// path over the same wiring — the imported glTF bytes through the runtime's
// interchange bridge (the W060 trust gate), the typed bind intent, the
// binding-requested effect, the W065 fabric operation onto the LIVE session
// (the REAL Three.js headless presenter first, then the contract-only
// reference seam), the digest-addressed bound-asset ledger, and the typed
// refusals (malformed bytes at the gate; the undeclared-kind presenter).
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
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
 * The canonical glTF fixture (byte-identical to the glTF bridge battery's —
 * the pinned digest proves it; see adapters/foundations/gltf/test/helpers.ts).
 * Constructed inline so this battery never reaches into another package's
 * test tree.
 */
const TRIANGLE_FLOATS: readonly number[] = [0, 0, 0, 1, 0, 0, 0, 1, 0];

const CANONICAL_GLB_DIGEST = '9cfd1b40cadefd283a5048301bd3c449f4dfe057095e11479bc9df45202ad556' as const;

function canonicalGlbBytes(): Uint8Array {
  const floats = new Uint8Array(36);
  const floatView = new DataView(floats.buffer, floats.byteOffset, floats.byteLength);
  TRIANGLE_FLOATS.forEach((value, index) => floatView.setFloat32(index * 4, value, true));
  const json = {
    asset: { version: '2.0', generator: 'epoch-gltf-fixture/1' },
    scene: 0,
    scenes: [{ name: 'Fixture scene', nodes: [0] }],
    nodes: [{ name: 'Fixture node', mesh: 0, translation: [1, 0, 0] }],
    meshes: [{ name: 'Fixture mesh', primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [
      { name: 'Fixture material', pbrMetallicRoughness: { baseColorFactor: [0.8, 0.4, 0.2, 1] } },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36 }],
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  const binPadding = (4 - (floats.length % 4)) % 4;
  const jsonChunkLength = jsonBytes.length + jsonPadding;
  const binChunkLength = floats.length + binPadding;
  const total = 12 + 8 + jsonChunkLength + 8 + binChunkLength;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunkLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  for (let i = 0; i < jsonPadding; i += 1) out[20 + jsonBytes.length + i] = 0x20;
  const binHeader = 20 + jsonChunkLength;
  view.setUint32(binHeader, binChunkLength, true);
  view.setUint32(binHeader + 4, 0x004e4942, true);
  out.set(floats, binHeader + 8);
  return out;
}

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

  it('W067: imports a glTF in-page through the trust gate and binds it on the LIVE three.js session (the web path mirrored)', async () => {
    const { runtime } = await openWorldHost();
    try {
      // The fixture is byte-identical to the bridge battery's canonical GLB.
      const bytes = canonicalGlbBytes();
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(CANONICAL_GLB_DIGEST);
      // The section's import affordance: the raw bytes through the
      // runtime's interchange bridge (validate → normalize → content-address).
      const imported = runtime.importFoundationAsset(bytes, { fileName: 'riser-cap.glb' });
      expect(imported.ok, JSON.stringify(imported)).toBe(true);
      if (!imported.ok) return;
      expect(imported.value.assetDigest).toBe(CANONICAL_GLB_DIGEST);
      expect(imported.value.assetKind).toBe('mesh');
      expect(imported.value.vertexCount).toBe(3);
      expect(imported.value.triangleCount).toBe(1);
      // The typed bind onto the LIVE session (the REAL Three.js headless
      // presenter first — its declared asset kinds include mesh).
      const digestBefore = runtime.currentScene().digest;
      const entitiesBefore = runtime.viewModel().viewport.entities.map((entity) => entity.entityId);
      const bound = await runtime.bindFoundationAsset(imported.value.assetDigest);
      expect(bound.ok, JSON.stringify(bound)).toBe(true);
      if (!bound.ok) return;
      expect(bound.value.outcome).toBe('applied');
      expect(bound.value.rendererId).toBe(THREE_RENDERER_ID);
      expect(bound.value.assetDigest).toBe(CANONICAL_GLB_DIGEST);
      expect(bound.value.bindingDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(bound.value.receiptDigest).toMatch(/^[0-9a-f]{64}$/);
      // The digest-addressed ledger + the journal + the effect surface.
      const view = runtime.viewModel();
      expect(view.sessionAssets.ledger.map((entry) => entry.assetDigest)).toEqual([
        CANONICAL_GLB_DIGEST,
      ]);
      expect(view.sessionAssets.imported[0]?.label).toBe('Fixture mesh');
      expect(
        view.journal.some((entry) => entry.intentKind === 'bind' && entry.outcome === 'applied'),
      ).toBe(true);
      expect(
        view.effects.some(
          (entry) =>
            entry.effect.effect === 'binding-requested' &&
            entry.effect.bindingDigest === bound.value.bindingDigest,
        ),
      ).toBe(true);
      // The canonical world is UNCHANGED (binding is presentation).
      expect(runtime.currentScene().digest).toBe(digestBefore);
      expect(view.viewport.worldDigest).toBe(digestBefore);
      expect(view.viewport.entities.map((entity) => entity.entityId)).toEqual(entitiesBefore);
    } finally {
      await runtime.close();
    }
  });

  it('W067: the contract-only reference presenter binds the same asset on its own seam (the fallback chain, digest-addressed continuity)', async () => {
    const { runtime } = await openWorldHost();
    try {
      const imported = runtime.importFoundationAsset(canonicalGlbBytes(), { fileName: 'riser-cap.glb' });
      expect(imported.ok).toBe(true);
      if (!imported.ok) return;
      // The desktop FULL reference presenter DECLARES mesh assets: the
      // binding applies through the reference adapter's own bindAsset seam.
      const switched = await runtime.selectRenderer(FULL_RENDERER_ID);
      expect(switched.ok).toBe(true);
      const bound = await runtime.bindFoundationAsset(imported.value.assetDigest);
      expect(bound.ok, JSON.stringify(bound)).toBe(true);
      if (!bound.ok) return;
      expect(bound.value.outcome).toBe('applied');
      expect(bound.value.rendererId).toBe(FULL_RENDERER_ID);
      expect(bound.value.fabricSessionId).toBe(runtime.session()?.fabricSessionId);
      // The ledger's continuity key is the ASSET digest (same asset, new
      // session, new session-addressed binding).
      const ledger = runtime.viewModel().sessionAssets.ledger;
      expect(ledger).toHaveLength(1);
      expect(ledger[0]?.assetDigest).toBe(CANONICAL_GLB_DIGEST);
    } finally {
      await runtime.close();
    }
  });

  it('W067: the typed refusals surface honestly (the bridge gate + the undeclared-kind presenter; the session stays healthy)', async () => {
    const { runtime } = await openWorldHost();
    try {
      // Malformed bytes are the bridge's typed refusal — nothing registers.
      const garbage = new TextEncoder().encode('not a gltf container');
      const refused = runtime.importFoundationAsset(garbage, { fileName: 'garbage.bin' });
      expect(refused.ok).toBe(false);
      expect(runtime.viewModel().sessionAssets.imported).toHaveLength(0);
      // The canonical fixture imports cleanly, but the REDUCED reference
      // presenter declares ZERO asset kinds: the fabric refuses typed
      // (the W065 capability check — the reference adapter's seam).
      const imported = runtime.importFoundationAsset(canonicalGlbBytes(), { fileName: 'ok.glb' });
      expect(imported.ok).toBe(true);
      if (!imported.ok) return;
      const switched = await runtime.selectRenderer(REDUCED_RENDERER_ID);
      expect(switched.ok).toBe(true);
      const bound = await runtime.bindFoundationAsset(imported.value.assetDigest);
      expect(bound.ok).toBe(false);
      if (!bound.ok) {
        expect(bound.error.code).toBe('asset-rejected');
      }
      // No partial application: the ledger stays empty, the journal records
      // the rejection, the session stays healthy on the fallback presenter.
      expect(runtime.viewModel().sessionAssets.ledger).toHaveLength(0);
      expect(
        runtime.viewModel().journal.some(
          (entry) => entry.intentKind === 'bind' && entry.outcome === 'rejected',
        ),
      ).toBe(true);
      expect(runtime.viewModel().renderers.health.state).toBe('healthy');
      expect(runtime.session()?.state).toBe('active');
      // An unknown digest is the typed unknown-asset refusal.
      const unknown = await runtime.bindFoundationAsset('b'.repeat(64));
      expect(unknown.ok).toBe(false);
      if (!unknown.ok) {
        expect(unknown.error.code).toBe('unknown-asset');
      }
    } finally {
      await runtime.close();
    }
  });
});
