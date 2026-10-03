/**
 * J13 — The interactive world closure battery (W061, ACR-007): the 18-leg
 * acceptance battery of the multi-renderer program, driven against the
 * REAL `/world` page in a REAL browser.
 *
 * Environment (recorded exactly, never fabricated): the production build
 * (`next build` + `next start -p 3210`, the free private port of the W061
 * world config — 3100 belongs to the operator infrastructure in this
 * sandbox) under Playwright 1.63 / Chromium 153 with REAL software GL
 * (ANGLE SwiftShader — the launch flags pin it and leg 2 asserts the
 * actual renderer string). Software GL is real-browser WebGL evidence,
 * recorded as exactly that; no GPU exists in this sandbox.
 *
 * The honest pointer basis: every viewport pick targets the position at
 * which the entity REALLY projects under the ACTIVE presenter's camera —
 * derived before the run from the REAL adapters' own projection helpers
 * (`projectedPointerOf` / `projectedPositionOf` over the same canonical
 * fixture through the same runtime), the identical discipline as the
 * headless engine battery. The camera record is fixed by the fixture and
 * only zoom/follow intents change it (both run AFTER every pointer leg),
 * so the derived positions stay valid for the whole pick sequence.
 *
 * Legs (the work-order battery, executed in the journey's functional
 * order; each step names its leg):
 *  1  enter a real fixture problem          (step: leg 1)
 *  2  render a real spatial world           (step: leg 2 — real GL pixels)
 *  3  orbit/move/zoom                       (step: leg 3 — after the pick
 *     legs: the zoom intent changes the canonical camera)
 *  4  select a semantic entity              (step: leg 4)
 *  5  inspect it                            (step: leg 5)
 *  6  isolate/reveal a layer                (step: leg 6)
 *  7  measure                               (step: leg 7)
 *  8  annotate                              (step: leg 8)
 *  9  see and follow an agent               (step: leg 9 — after the pick
 *     legs: the follow intent changes the camera mode)
 * 10  replay/seek                           (step: leg 10)
 * 11  branch/simulate                       (step: leg 11)
 * 12  switch Three.js -> Babylon.js         (step: leg 12)
 * 13  switch back                           (step: leg 13)
 * 14  external foundation path IN PAGE     (the glTF-bridge leg — REAL
 *     since W067/ACR-010: in-page import -> bridge validate/seal -> the
 *     typed bind -> the receipt + the digest-addressed ledger; the
 *     Blender-live variant rides the env-gated official binary, honestly
 *     skipped without EPOCH_BLENDER_LIVE=1 + EPOCH_BLENDER_PATH)
 * 15  verify world digest/entity continuity (steps: legs 12/13/15)
 * 16  force renderer degradation/failure    (j13-world-degradation.spec.ts
 *     — the no-GL project; the fabric-level forced ladder is pinned by
 *     qa/rendering/degradation-fallback.test.ts)
 * 17  approve an actual action through the Action Gateway (test 2)
 * 18  verify resulting state/evidence in Epoch               (test 2)
 */
import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
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
import { RendererFabric, rendererCapabilityManifestOf } from '@epoch/renderer-fabric';
import { sealCapabilityManifest } from '@epoch/capability-registry';
import type { PortableViewState } from '@epoch/renderer-runtime';
import {
  ManualHostClock,
  ManualFrameScheduler,
  WorldWorkspaceRuntime,
  spatialPresentationOf,
} from '@epoch/world-runtime';
import {
  AGENT_IDS,
  DEVICE,
  ENTITY_IDS,
  ONTOLOGY,
  RENDERER_PREFERENCE,
  SCENE,
  TENANT,
  buildWorldFabric,
} from '../src/features/world/host/world-fixture';
import { signIn } from './helpers';

// ---------------------------------------------------------------------------
// The canonical glTF fixture (leg 14): byte-identical to the glTF bridge
// battery's canonical GLB (adapters/foundations/gltf/test/helpers.ts) — the
// pinned SHA-256 below proves the byte-identity. Constructed inline so this
// battery never reaches into another package's test tree.
// ---------------------------------------------------------------------------

const CANONICAL_FIXTURE_DIGEST =
  '9cfd1b40cadefd283a5048301bd3c449f4dfe057095e11479bc9df45202ad556' as const;

/** The canonical fixture triangle: (0,0,0), (1,0,0), (0,1,0) — little-endian floats. */
const TRIANGLE_FLOATS: readonly number[] = [0, 0, 0, 1, 0, 0, 0, 1, 0];

/** The canonical fixture GLB (JSON + 36-byte BIN of the triangle positions). */
function canonicalFixtureGlb(): Uint8Array {
  const floats = new Uint8Array(36);
  const floatView = new DataView(floats.buffer, floats.byteOffset, floats.byteLength);
  TRIANGLE_FLOATS.forEach((value, index) => floatView.setFloat32(index * 4, value, true));
  const json = {
    asset: { version: '2.0', generator: 'epoch-gltf-fixture/1' },
    scene: 0,
    scenes: [{ name: 'Fixture scene', nodes: [0] }],
    nodes: [{ name: 'Fixture node', mesh: 0, translation: [1, 0, 0] }],
    meshes: [
      { name: 'Fixture mesh', primitives: [{ attributes: { POSITION: 0 }, material: 0 }] },
    ],
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
  view.setUint32(0, 0x46546c67, true); // 'glTF'
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunkLength, true);
  view.setUint32(16, 0x4e4f534a, true); // 'JSON'
  out.set(jsonBytes, 20);
  for (let i = 0; i < jsonPadding; i += 1) out[20 + jsonBytes.length + i] = 0x20;
  const binHeader = 20 + jsonChunkLength;
  view.setUint32(binHeader, binChunkLength, true);
  view.setUint32(binHeader + 4, 0x004e4942, true); // 'BIN\0'
  out.set(floats, binHeader + 8);
  return out;
}

// ---------------------------------------------------------------------------
// The Blender-live sidecar helpers (leg 14, env-gated). The sidecar adapter
// package is NOT a declared dependency of apps/web (its manifest is frozen
// to this Work Order's surface), so the live run links it into the run
// node_modules (the PR run book) and the adapter loads through a
// RUNTIME-RESOLVED specifier — the env-gated body is the only code path
// that ever evaluates it (CI skips this leg before reaching the import).
// ---------------------------------------------------------------------------

/** The sidecar adapter's bare specifier (resolved ONLY in the env-gated live run). */
const BLENDER_ADAPTER_SPECIFIER: string = '@epoch/adapter-renderer-blender';

/** The structural shape of the sidecar adapter module this battery drives. */
interface BlenderAdapterModule {
  readonly BlenderSidecarRendererAdapter: new (options: {
    readonly blenderPath: string;
    readonly workspaceDir: string;
  }) => {
    identity(): {
      readonly capabilityId: string;
      readonly rendererId: string;
      readonly displayName: string;
    };
    descriptor(): Parameters<typeof rendererCapabilityManifestOf>[0]['descriptor'];
    capabilities(): Parameters<typeof rendererCapabilityManifestOf>[0]['capabilities'];
    adapterSessionOf(fabricSessionId: string): { readonly fabricSessionId: string } | undefined;
    prepareGltfAsset(
      session: { readonly fabricSessionId: string },
      input: { readonly atMs: number },
    ): Promise<
      | {
          readonly ok: true;
          readonly value: {
            readonly glbDigest: string;
            readonly glbBytes: number;
            readonly glbBytesData: Uint8Array;
          };
        }
      | { readonly ok: false; readonly error: { readonly message: string } }
    >;
  };
}

/** The fixture track position (the web world fixture's timeline head). */
const TRACK_POSITION_AT_MS = 1_500;

/** A minimal valid portable view state for the sidecar session mount. */
function sidecarViewState(): PortableViewState {
  return {
    focusedEntityIds: [ENTITY_IDS.riser],
    layerVisibility: [],
    timelinePosition: { atMs: TRACK_POSITION_AT_MS, frameIndex: 45, paused: false },
    camera: { mode: 'orbit', position: [30, 22, 30], target: [4, 3, 0] },
    hiddenEntityIds: [],
  };
}

/** Register the sidecar adapter with a fabric through the REAL registry. */
function registerSidecarRenderer(
  fabric: RendererFabric,
  blender: InstanceType<BlenderAdapterModule['BlenderSidecarRendererAdapter']>,
): void {
  const identity = blender.identity();
  const manifest = rendererCapabilityManifestOf({
    capabilityId: identity.capabilityId,
    version: '1.0.0',
    descriptor: blender.descriptor(),
    capabilities: blender.capabilities(),
    displayName: identity.displayName,
    description: 'The env-gated live sidecar export of the leg-14 Blender variant.',
  });
  const sealed = sealCapabilityManifest(manifest);
  if (!sealed.ok) {
    throw new Error(`the sidecar manifest failed to seal: ${sealed.error.message}`);
  }
  const registered = fabric.adapters.register({
    manifest: sealed.value.manifest,
    digest: sealed.value.digest,
    adapter: blender as never,
  });
  if (!registered.ok) {
    throw new Error(`the sidecar renderer failed to register: ${registered.error.message}`);
  }
}

/** Where the visual evidence lands (gitignored run artifacts; the
 * committed evidence is this spec + the journey record). */
const SHOT_DIR = join(process.cwd(), 'e2e-results', 'world-legs');

/** One engine's derived entity-pointer map (normalized [0,1] viewport space). */
type PointerMap = Record<string, { readonly x: number; readonly y: number }>;

/** The visible fixture entities whose projections the battery targets. */
const PICKABLE_ENTITY_IDS: readonly string[] = [
  ENTITY_IDS.slab,
  ENTITY_IDS.frame,
  ENTITY_IDS.panel,
  ENTITY_IDS.riser,
  ENTITY_IDS.hoist,
  ENTITY_IDS.staging,
];

/**
 * Derive the pointer positions at which the entities project under EACH
 * real engine's own camera (the honest targeting basis — the same
 * projection helpers the headless battery uses, over the same canonical
 * fixture through the same runtime, in this test process). The engines'
 * projection math is camera + scene graph only (no GL), so these are the
 * live browser sessions' projections exactly.
 */
async function deriveEnginePointers(): Promise<{
  readonly three: PointerMap;
  readonly babylon: PointerMap;
}> {
  const three = new ThreeJsRendererAdapter();
  const babylon = new BabylonRendererAdapter({ host: nullEngineHost() });
  const { fabric } = buildWorldFabric({ three, babylon });
  const runtime = new WorldWorkspaceRuntime({
    slug: 'j13-shadow',
    fabric,
    scene: SCENE,
    ontology: ONTOLOGY,
    device: DEVICE,
    clock: new ManualHostClock(100_000),
    scheduler: new ManualFrameScheduler(),
    rendererPreference: RENDERER_PREFERENCE,
  });
  try {
    const opened = await runtime.open();
    if (!opened.ok) {
      throw new Error(`the shadow workspace failed to open: ${opened.error.message}`);
    }
    const threePointers: PointerMap = {};
    const threeSession = runtime.session();
    if (threeSession === null) {
      throw new Error('no shadow session on the preferred three.js renderer');
    }
    const presentation = three.presentationOf(threeSession.fabricSessionId);
    if (presentation === undefined) {
      throw new Error('no three.js presentation in the shadow workspace');
    }
    for (const entityId of PICKABLE_ENTITY_IDS) {
      const projected = projectedPointerOf(presentation, entityId);
      if (projected === undefined) {
        throw new Error(`entity ${entityId} does not project under the three.js camera`);
      }
      threePointers[entityId] = projected;
    }

    const switched = await runtime.selectRenderer(BABYLONJS_RENDERER_ID);
    if (!switched.ok) {
      throw new Error(`the shadow switch to babylon.js failed: ${switched.error.message}`);
    }
    const babylonPointers: PointerMap = {};
    const babylonSession = runtime.session();
    if (babylonSession === null) {
      throw new Error('no shadow session on babylon.js after the switch');
    }
    const adapterSession = babylon.adapterSessionOf(babylonSession.fabricSessionId);
    if (adapterSession === undefined) {
      throw new Error('no babylon adapter session in the shadow workspace');
    }
    for (const entityId of PICKABLE_ENTITY_IDS) {
      const projected = babylon.projectedPositionOf(adapterSession, entityId);
      if (projected === null) {
        throw new Error(`entity ${entityId} does not project under the babylon camera`);
      }
      babylonPointers[entityId] = projected;
    }
    return { three: threePointers, babylon: babylonPointers };
  } finally {
    await runtime.close();
  }
}

/** The derived pointer maps (filled once before the battery). */
let pointers: {
  readonly three: PointerMap;
  readonly babylon: PointerMap;
};

test.beforeAll(async () => {
  mkdirSync(SHOT_DIR, { recursive: true });
  pointers = await deriveEnginePointers();
});

/** The live engine-stage box (the square region pointer input normalizes against). */
async function stageBox(page: Page): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const stage = page.locator('[data-engine-stage]');
  await stage.scrollIntoViewIfNeeded();
  const box = await stage.boundingBox();
  if (box === null) {
    throw new Error('the engine stage is not rendered');
  }
  return box;
}

/** Click the projected pointer position of one entity (a real mouse click). */
async function clickEntityPointer(
  page: Page,
  engine: 'three' | 'babylon',
  entityId: string,
): Promise<void> {
  const pointer = pointers[engine][entityId];
  if (pointer === undefined) {
    throw new Error(`no derived ${engine} pointer for ${entityId}`);
  }
  const box = await stageBox(page);
  await page.mouse.click(box.x + pointer.x * box.width, box.y + pointer.y * box.height);
}

/** The canonical world digest currently presented by the workspace. */
async function worldDigest(page: Page): Promise<string> {
  const digest = await page.locator('[data-workspace="world"]').getAttribute('data-world-digest');
  expect(digest).not.toBeNull();
  return digest ?? '';
}

/** Assert one intent-journal entry (the newest entry wins; reversed list). */
async function expectJournal(
  page: Page,
  intentKind: string,
  outcome: string,
): Promise<void> {
  await expect(
    page
      .locator(
        `[data-panel="journal"] li[data-journal-entry="${intentKind}"][data-journal-outcome="${outcome}"]`,
      )
      .first(),
  ).toBeVisible();
}

/** The navigation HUD text (the presentation camera readout). */
async function hudText(page: Page): Promise<string> {
  const text = await page.locator('[data-viewport-hud]').textContent();
  expect(text).not.toBeNull();
  return text ?? '';
}

/** Select the 'select' tool (the pick tool of the plain semantic picks). */
async function selectTool(page: Page): Promise<void> {
  await page.locator('[data-tool="select"]').click();
}

test.describe('J13 the interactive world (W061 closure battery)', () => {
  test('legs 1-13 + 15 — the real spatial world through both real engines, without leaving Epoch', async ({
    page,
  }) => {
    // Software GL (SwiftShader ANGLE) is REAL browser GL but CPU-rasterized:
    // the two engine mounts + the full 16-leg sweep through both real
    // engines legitimately takes minutes on the software rasterizer — the
    // budget covers the whole battery including the switch legs.
    test.setTimeout(540_000);

    // -- Leg 1: enter a real fixture problem. -----------------------------
    await page.goto('/world');
    await expect(page.locator('[data-world-host="web"]')).toHaveAttribute(
      'data-world-phase',
      'ready',
    );
    // The workspace banner names the REAL fixture problem + tenant + digest.
    await expect(page.locator('[data-viewport-world-digest]')).toContainText(
      'Riverside plant-room riser coordination',
    );
    await expect(page.locator('[data-viewport-world-digest]')).toContainText(TENANT);
    // The canonical digest is the sealed fixture digest (the shadow derives
    // from the same fixture construction the page mounts).
    expect(await worldDigest(page)).toBe(SCENE.digest);
    // The renderer bar: both real engines + the reference fallback, healthy,
    // on the PREFERRED real renderer (Three.js first).
    await expect(page.getByTestId('renderer-health')).toContainText('healthy');
    await expect(page.locator('[data-engine-stage]')).toHaveAttribute(
      'data-active-renderer',
      THREE_RENDERER_ID,
    );
    for (const choice of [THREE_RENDERER_ID, BABYLONJS_RENDERER_ID, 'rr-web-reference']) {
      await expect(page.locator(`[data-renderer-choice="${choice}"]`)).toBeVisible();
    }
    await expect(
      page.locator(`[data-renderer-choice="${THREE_RENDERER_ID}"]`),
    ).toHaveAttribute('data-renderer-active', 'true');
    await page.screenshot({ path: join(SHOT_DIR, 'leg01-enter.png'), fullPage: true });

    // -- Leg 2: render a real spatial world (REAL GL pixels). --------------
    // The honest GL evidence: SwiftShader ANGLE software GL is live for the
    // active Three.js surface (the Babylon surface goes live at its first
    // session — leg 12).
    await expect(page.locator('[data-engine-stage]')).toHaveAttribute(
      'data-gl-three',
      'true',
    );
    // The REAL engine presents the spatial world (the host's honest
    // surface-mode flag — on [data-world-host], the composition root).
    await expect(page.locator('[data-world-host="web"]')).toHaveAttribute(
      'data-engine-spatial',
      'true',
    );
    await expect(
      page.locator(`canvas[data-engine-canvas="${THREE_RENDERER_ID}"]`),
    ).toBeVisible();
    // The actual GL renderer string — pinned as software GL evidence.
    const glRenderer = await page.evaluate(() => {
      const canvas = document.querySelector(
        `canvas[data-engine-canvas="${'rr-threejs'}"]`,
      ) as HTMLCanvasElement | null;
      const gl = canvas?.getContext('webgl2');
      if (gl === null || gl === undefined) return null;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      return dbg === null
        ? String(gl.getParameter(gl.RENDERER))
        : String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
    });
    expect(glRenderer).not.toBeNull();
    expect(String(glRenderer)).toContain('SwiftShader');
    await page.screenshot({ path: join(SHOT_DIR, 'leg02-render-three.png'), fullPage: true });

    // -- Leg 4: select a semantic entity (the fabric seam hit-test). -------
    await clickEntityPointer(page, 'three', ENTITY_IDS.panel);
    await expectJournal(page, 'select', 'applied');
    await expect(page.locator('[data-inspect="entityId"]')).toHaveText(ENTITY_IDS.panel);
    await expect(page.locator('[data-inspect="label"]')).toContainText(
      'Main distribution panel MD-2',
    );

    // -- Leg 5: inspect it (the typed inspect intent + its effect). --------
    await page.locator('[data-tool="inspect"]').click();
    await clickEntityPointer(page, 'three', ENTITY_IDS.riser);
    // Effect-only intent: the receipt is admitted (journal 'normalized') and
    // the inspect-requested EFFECT awaits its authority (the world model).
    await expectJournal(page, 'inspect', 'normalized');
    await expect(
      page.locator('[data-panel="journal"] li[data-effect="inspect-requested"]').first(),
    ).toBeVisible();
    await expect(page.locator('[data-inspect="entityId"]')).toHaveText(ENTITY_IDS.riser);

    // -- Leg 6: isolate/reveal a layer (the typed filter + show intents). --
    await selectTool(page);
    await page.getByTestId(`layer-isolate-lyr-mep`).click();
    await expectJournal(page, 'filter', 'applied');
    // The other layers' entities left the world (honest spatial proof: the
    // staging entity's projected position now hits NOTHING through the real
    // engine seam — invisible entities never hit).
    await clickEntityPointer(page, 'three', ENTITY_IDS.staging);
    await expectJournal(page, 'select', 'no-target');
    // Reveal restores the world (the show intent).
    await page.getByTestId('layers-reveal-all').click();
    await expectJournal(page, 'show', 'applied');
    await clickEntityPointer(page, 'three', ENTITY_IDS.staging);
    await expectJournal(page, 'select', 'applied');
    await expect(page.locator('[data-inspect="entityId"]')).toHaveText(ENTITY_IDS.staging);

    // -- Leg 7: measure (the stateful cadence over the REAL affordance). --
    // The documented four-pick cycle (the desktop world-host battery + the
    // workspace module docs): the engines' own measurement affordance
    // anchors on the first measure-hinted click (a typed no-target
    // receipt), so the runtime's two-pick composition arms on the SECOND
    // normalized measure receipt and completes on the adapter's second
    // compose cycle (the fourth pick).
    await page.locator('[data-tool="measure"]').click();
    // Pick 1: the adapter's measurement anchor (typed no-target receipt).
    await clickEntityPointer(page, 'three', ENTITY_IDS.panel);
    await expect(
      page
        .locator('[data-panel="journal"] li[data-journal-entry="measure"]')
        .first(),
    ).toContainText('measurement anchor set');
    // Pick 2: the runtime's two-pick composition ARMS (typed no-apply).
    await clickEntityPointer(page, 'three', ENTITY_IDS.riser);
    await expect(
      page
        .locator('[data-panel="journal"] li[data-journal-entry="measure"]')
        .first(),
    ).toContainText('measurement armed (pick the second entity)');
    // Pick 3: the adapter's SECOND anchor cycle (the first compose reset
    // its anchor — this re-anchors on the second entity; the same typed
    // anchor-set receipt, now the THIRD measure journal entry).
    await clickEntityPointer(page, 'three', ENTITY_IDS.riser);
    await expect(
      page.locator('[data-panel="journal"] li[data-journal-entry="measure"]'),
    ).toHaveCount(3);
    await expect(
      page
        .locator('[data-panel="journal"] li[data-journal-entry="measure"]')
        .first(),
    ).toContainText('measurement anchor set');
    // Pick 4: the composed typed measure intent (effect-only: the
    // measure-requested effect awaits its authority — FOUR measure journal
    // entries now, the newest the applied receipt).
    await clickEntityPointer(page, 'three', ENTITY_IDS.panel);
    await expect(
      page.locator('[data-panel="journal"] li[data-journal-entry="measure"]'),
    ).toHaveCount(4);
    await expect(
      page.locator('[data-panel="journal"] li[data-effect="measure-requested"]').first(),
    ).toBeVisible();

    // -- Leg 8: annotate (the typed annotate intent — a canonical change). -
    const digestBeforeAnnotation = await worldDigest(page);
    await page.getByTestId('annotation-input').fill(
      'Clash risk at the riser penetration — verify before pour',
    );
    await page.getByTestId('annotation-submit').click();
    await expectJournal(page, 'annotate', 'applied');
    // The annotation entered the CANONICAL revision (a new digest).
    expect(await worldDigest(page)).not.toBe(digestBeforeAnnotation);

    // -- Leg 10: replay/seek (the typed replay intent + transport). --------
    await expect(page.locator('[data-marker="mrk-web-branch"]')).toBeVisible();
    const track = page.getByTestId('timeline-track');
    const trackBox = await track.boundingBox();
    expect(trackBox).not.toBeNull();
    await page.mouse.click(
      (trackBox?.x ?? 0) + (trackBox?.width ?? 1) * 0.6,
      (trackBox?.y ?? 0) + (trackBox?.height ?? 1) / 2,
    );
    await expect(page.getByTestId('timeline-position')).toHaveText('5.4s / 9.0s');
    await expectJournal(page, 'replay', 'applied');
    await page.getByTestId('timeline-pause').click();
    await expect(page.getByTestId('timeline-paused')).toBeVisible();
    await expectJournal(page, 'pause', 'applied');
    await page.getByTestId('timeline-resume').click();
    await expect(page.getByTestId('timeline-playing')).toBeVisible();
    await expectJournal(page, 'resume', 'applied');

    // -- Leg 11: branch/simulate (typed entry, effects await authority). ---
    await page.locator(`[data-scene-control="ctl-web-branch-delivery"]`).click();
    await expect(
      page.locator('[data-panel="journal"] li[data-effect="branch-requested"]').first(),
    ).toBeVisible();
    await page.locator(`[data-scene-control="ctl-web-simulate-sequence"]`).click();
    await expect(
      page.locator('[data-panel="journal"] li[data-effect="simulate-requested"]').first(),
    ).toBeVisible();

    // -- Leg 12: switch Three.js -> Babylon.js WITHOUT leaving Epoch. ------
    const digestBeforeSwitch = await worldDigest(page);
    await page.locator(`[data-renderer-choice="${BABYLONJS_RENDERER_ID}"]`).click();
    await expect(page.locator('[data-engine-stage]')).toHaveAttribute(
      'data-active-renderer',
      BABYLONJS_RENDERER_ID,
    );
    // The Babylon GL surface went live at its first session mount: the real
    // engine presents (never the reference projection beside its pixels).
    await expect(page.locator('[data-engine-stage]')).toHaveAttribute(
      'data-gl-babylon',
      'true',
    );
    await expect(page.locator('[data-world-host="web"]')).toHaveAttribute(
      'data-engine-spatial',
      'true',
    );
    await expect(
      page.locator(`canvas[data-engine-canvas="${BABYLONJS_RENDERER_ID}"]`),
    ).toBeVisible();
    // Leg 15 (Babylon side): the world digest carries across the switch.
    expect(await worldDigest(page)).toBe(digestBeforeSwitch);
    // The switch receipt is surfaced (the Epoch-owned evidence chrome).
    await expect(page.getByTestId('renderer-switch-evidence')).toContainText(
      'Last switch receipt',
    );
    // Semantic picking through the REAL Babylon scene.pick (entity
    // continuity on the switched session — the riser).
    await selectTool(page);
    await clickEntityPointer(page, 'babylon', ENTITY_IDS.riser);
    await expectJournal(page, 'select', 'applied');
    await expect(page.locator('[data-inspect="entityId"]')).toHaveText(ENTITY_IDS.riser);
    await page.screenshot({ path: join(SHOT_DIR, 'leg12-babylon.png'), fullPage: true });

    // -- Leg 13: switch back (the reverse direction, same invariants). ----
    const digestBeforeSwitchBack = await worldDigest(page);
    await page.locator(`[data-renderer-choice="${THREE_RENDERER_ID}"]`).click();
    await expect(page.locator('[data-engine-stage]')).toHaveAttribute(
      'data-active-renderer',
      THREE_RENDERER_ID,
    );
    await expect(page.locator('[data-world-host="web"]')).toHaveAttribute(
      'data-engine-spatial',
      'true',
    );
    expect(await worldDigest(page)).toBe(digestBeforeSwitchBack);
    // Leg 15 (Three side): the same world is interactive through the real
    // Three.js Raycaster again (the panel picks after the round trip).
    await clickEntityPointer(page, 'three', ENTITY_IDS.panel);
    await expectJournal(page, 'select', 'applied');
    await expect(page.locator('[data-inspect="entityId"]')).toHaveText(ENTITY_IDS.panel);
    await page.screenshot({ path: join(SHOT_DIR, 'leg13-back-to-three.png'), fullPage: true });

    // -- Leg 3: orbit/move/zoom (presentation navigation + the typed zoom).
    // Focus the viewport (the reset button sits inside it; keyboard events
    // bubble to its key handler) and baseline the navigation HUD.
    await page.getByTestId('viewport-reset-camera').click();
    const hudBaseline = await hudText(page);
    // Desktop keys: Q orbits (azimuth moves), W pans (anchor moves).
    await page.keyboard.press('q');
    await page.keyboard.press('q');
    const hudAfterOrbit = await hudText(page);
    expect(hudAfterOrbit).not.toBe(hudBaseline);
    await page.keyboard.press('w');
    const hudAfterPan = await hudText(page);
    expect(hudAfterPan).not.toBe(hudAfterOrbit);
    // Wheel zoom: the typed zoom intent (journal) + the camera distance
    // changes in the HUD.
    const box = await stageBox(page);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -100);
    await expectJournal(page, 'zoom', 'applied');
    const hudAfterZoom = await hudText(page);
    expect(hudAfterZoom).not.toBe(hudAfterPan);
    await page.screenshot({ path: join(SHOT_DIR, 'leg03-orbit-zoom.png'), fullPage: true });

    // -- Leg 9: see and follow an agent (visible presence). ----------------
    const presence = page.locator('[data-panel="presence"]');
    await expect(
      presence.locator(`li[data-presence-agent="${AGENT_IDS.surveyor}"]`),
    ).toBeVisible();
    await expect(
      presence.locator(`li[data-presence-agent="${AGENT_IDS.coordinator}"]`),
    ).toBeVisible();
    await page.getByTestId(`follow-${AGENT_IDS.surveyor}`).click();
    await expectJournal(page, 'follow-agent', 'applied');
    // The camera record switched to the agent (the HUD names the mode).
    await expect(page.locator('[data-viewport-hud]')).toContainText('follow-agent');
    await expect(
      presence.locator(`li[data-presence-agent="${AGENT_IDS.surveyor}"]`),
    ).toHaveAttribute('data-agent-followed', 'true');
    await page.screenshot({ path: join(SHOT_DIR, 'leg09-follow-agent.png'), fullPage: true });
  });

  test("legs 17-18 — approve an actual action through the Action Gateway and verify the resulting state/evidence in Epoch", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    // The world workspace surfaces request effects that AWAIT their
    // authorities (the effects panel of leg 5/7/11 evidence); the APPROVAL
    // authority of an actual action is the Action Gateway — Epoch's only
    // execution path — exercised here through the app's decision surface
    // in the same real browser battery.
    await signIn(page, 'construction');
    await page.goto('/decide');
    // The baseline seals byte-exact to the committed fixture anchor (the
    // J04 discipline — the decision surface gates on it).
    await page.getByTestId('seal-solution').click();
    await expect(page.getByTestId('seal-success')).toBeVisible();
    // The decision the action carries (the constrained value the human
    // declares with the submission — the J04 discipline).
    await page.getByTestId('constraint-value').fill('12');
    await page.getByTestId('evaluate-constraint').click();
    await expect(page.getByTestId('constraint-outcome')).toBeVisible();
    await page.getByTestId('validate-chain').click();
    await expect(page.getByTestId('chain-success')).toBeVisible();
    await page.getByTestId('approve-baseline').click();
    await expect(page.getByTestId('baseline-success')).toBeVisible();

    // -- Leg 17: submit -> approve through the REAL Action Gateway. -------
    await page.getByTestId('submit-action').click();
    await expect(page.getByTestId('submit-summary')).toBeVisible();
    await expect(page.getByTestId('submit-summary')).toContainText('awaiting-approval');
    await page.getByTestId('approve-action').click();
    await expect(page.getByTestId('approve-success')).toBeVisible();
    await expect(page.getByTestId('execute-action')).toBeEnabled();
    await page.getByTestId('execute-action').click();
    await expect(page.getByTestId('execute-success')).toBeVisible();

    // -- Leg 18: the resulting state/evidence resolves in Epoch. ----------
    // The executed action's terminal status re-resolves from the
    // authoritative action stream on the Developers surface.
    await page.goto('/developers');
    await expect(page.getByTestId('action-status-table')).toBeVisible();
    await expect(page.locator('[data-testid="action-status-table"] tbody tr').last()).toContainText(
      'executed',
    );
    await page.screenshot({ path: join(SHOT_DIR, 'leg17-18-action-gateway.png'), fullPage: true });
  });

  test('leg 14 — the external foundation path IN PAGE: glTF bridge -> typed bind -> the digest-addressed ledger (no vendor UI)', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    // The glTF-bridge path (no Blender needed): the canonical fixture GLB
    // (byte-identical to the bridge battery's — the pinned digest proves
    // it) goes through the page's OWN import affordance: the file input ->
    // the runtime's interchange bridge (validate -> normalize ->
    // content-address: the W060 trust gate, IN PAGE) -> the digest-addressed
    // registry -> the typed `bind` intent (W066) -> the binding-requested
    // effect -> the W065 fabric operation on the LIVE session -> the
    // receipt + the digest-addressed bound-asset ledger.
    const fixturePath = join(tmpdir(), 'epoch-j13-leg14-canonical.glb');
    writeFileSync(fixturePath, Buffer.from(canonicalFixtureGlb()));
    const malformedPath = join(tmpdir(), 'epoch-j13-leg14-malformed.bin');
    writeFileSync(malformedPath, Buffer.from('this is definitely not a glTF container', 'utf8'));

    await page.goto('/world');
    await expect(page.locator('[data-world-host="web"]')).toHaveAttribute(
      'data-world-phase',
      'ready',
    );
    const workspace = page.locator('[data-workspace="world"]');
    const digestBefore = await worldDigest(page);
    const entityIdsBefore = await workspace.getAttribute('data-entity-ids');
    expect(entityIdsBefore).toContain(ENTITY_IDS.riser);

    // The trust gate first (honest): malformed bytes are the bridge's TYPED
    // refusal — nothing registers, nothing binds, the session stays healthy.
    await page.setInputFiles('[data-testid="foundation-import-input"]', malformedPath);
    await expect(
      page
        .locator(
          '[data-panel="journal"] li[data-journal-entry="import-asset"][data-journal-outcome="rejected"]',
        )
        .first(),
    ).toBeVisible();
    await expect(page.locator('[data-imported-asset]')).toHaveCount(0);

    // The canonical import -> the typed bind (one in-page flow).
    await page.setInputFiles('[data-testid="foundation-import-input"]', fixturePath);
    // The digest-addressed registry entry (the RAW-byte content address).
    await expect(
      page.locator(`[data-imported-asset="${CANONICAL_FIXTURE_DIGEST}"]`),
    ).toBeVisible();
    // The sealed binding digest + the receipt in the digest-addressed ledger.
    const ledgerEntry = page.locator(
      `li[data-bound-asset="${CANONICAL_FIXTURE_DIGEST}"][data-outcome="applied"]`,
    );
    await expect(ledgerEntry).toBeVisible();
    const bindingDigest = await ledgerEntry.getAttribute('data-binding-digest');
    expect(bindingDigest).toMatch(/^[0-9a-f]{64}$/);
    const receiptDigest = await ledgerEntry.getAttribute('data-receipt-digest');
    expect(receiptDigest).toMatch(/^[0-9a-f]{64}$/);
    await expect(ledgerEntry).toContainText(THREE_RENDERER_ID);
    // The ledger's digest-addressed key is surfaced on the workspace root.
    await expect(workspace).toHaveAttribute(
      'data-bound-assets',
      CANONICAL_FIXTURE_DIGEST,
    );
    // The typed receipt in the journal: the bind intent, applied, with the
    // receipt evidence in the entry detail.
    const bindJournal = page.locator(
      '[data-panel="journal"] li[data-journal-entry="bind"][data-journal-outcome="applied"]',
    );
    await expect(bindJournal.first()).toBeVisible();
    await expect(bindJournal.first()).toContainText(receiptDigest?.slice(0, 12) ?? '');
    // The binding-requested effect awaits its authority routing (the
    // experience-scoped request, never executed by the UI).
    await expect(
      page.locator('[data-panel="journal"] li[data-effect="binding-requested"]').first(),
    ).toBeVisible();
    // The presented semantic entity ids are UNCHANGED (binding is
    // presentation, never a semantic write).
    expect(await workspace.getAttribute('data-entity-ids')).toBe(entityIdsBefore);
    // The canonical world digest is UNCHANGED.
    expect(await worldDigest(page)).toBe(digestBefore);
    // The presented world stays fully interactive through the live engine
    // seam (the same derived-pointer basis as the pick legs — the panel
    // resolves through the REAL Three.js Raycaster after the binding).
    await selectTool(page);
    await clickEntityPointer(page, 'three', ENTITY_IDS.panel);
    await expectJournal(page, 'select', 'applied');
    await expect(page.locator('[data-inspect="entityId"]')).toHaveText(ENTITY_IDS.panel);
    await page.screenshot({ path: join(SHOT_DIR, 'leg14-foundation-bind.png'), fullPage: true });
  });

  test('leg 14 (Blender-live variant) — sidecar export -> UNTRUSTED re-entry -> validated binding -> in-page bind', async ({
    page,
  }) => {
    // Honestly env-gated (the W064/W068 method): the official Blender binary
    // is operator-supplied at an ephemeral NON-REPO path; without
    // EPOCH_BLENDER_LIVE=1 + EPOCH_BLENDER_PATH this leg is an honest skip,
    // never fabricated. The sidecar defects are CLOSED at W068 (the live
    // battery is green against the official 4.2.11).
    test.skip(
      process.env.EPOCH_BLENDER_LIVE !== '1' || !process.env.EPOCH_BLENDER_PATH,
      'the Blender-live variant requires the official binary (EPOCH_BLENDER_LIVE=1 + EPOCH_BLENDER_PATH; the W064/W068 method — download.blender.org/release/Blender4.2/blender-4.2.11-linux-x64.tar.xz to a non-repo path, sha256 7f084fd57f1351bcae3434fc5450643547e4ad3d69cd93d4dd14a784203ee2ec). The sidecar adapter is linked into the run node_modules for the live run (see the PR run book); CI skips this leg honestly.',
    );
    test.setTimeout(600_000);
    // NODE side: the REAL sidecar boundary over the REAL official binary —
    // mount the canonical world, export the GLB through the typed process
    // boundary (the boundary re-computes the artifact digest; the provider's
    // self-report is never trusted). The adapter loads through the CJS
    // pipeline (createRequire from this spec's location over the
    // runtime-resolved specifier) so its own source imports link exactly as
    // they do in its own battery.
    const nodeRequire = createRequire(join(process.cwd(), 'e2e', 'j13-world.spec.ts'));
    const blenderModule = nodeRequire(BLENDER_ADAPTER_SPECIFIER) as BlenderAdapterModule;
    const workspaceDir = mkdtempSync(join(tmpdir(), 'epoch-j13-blender-live-'));
    const blender = new blenderModule.BlenderSidecarRendererAdapter({
      blenderPath: process.env.EPOCH_BLENDER_PATH as string,
      workspaceDir,
    });
    const fabric = new RendererFabric();
    registerSidecarRenderer(fabric, blender);
    const sidecarSessionId = 'fx-j13-blender-live-export';
    // The SPATIAL PRESENTATION PROJECTION (the derived canonical revision
    // the world runtime presents — host-chrome kinds stay with the host);
    // the batch sidecar hosts only the spatial kinds, and the session's
    // world projection must address the exact mounted revision.
    const sidecarScene = spatialPresentationOf(SCENE);
    const created = await fabric.createSession({
      rendererId: blender.identity().rendererId,
      device: DEVICE,
      worldProjection: {
        sceneId: sidecarScene.sceneId,
        worldDigest: sidecarScene.digest,
        tenantScope: sidecarScene.tenantScope,
      },
      viewState: sidecarViewState(),
      fabricSessionId: sidecarSessionId,
      atMs: 0,
      expectedTenantId: TENANT,
    });
    if (!created.ok) {
      throw new Error(`the sidecar session failed: ${created.error.message}`);
    }
    const mounted = await fabric.mountScene(sidecarSessionId, {
      scene: sidecarScene,
      ontology: ONTOLOGY,
      atMs: 1,
      expectedTenantId: TENANT,
    });
    if (!mounted.ok) {
      throw new Error(`the sidecar mount failed: ${mounted.error.message}`);
    }
    const adapterSession = blender.adapterSessionOf(sidecarSessionId);
    if (adapterSession === undefined) {
      throw new Error('no sidecar adapter session');
    }
    const prepared = await blender.prepareGltfAsset(adapterSession, { atMs: 2 });
    if (!prepared.ok) {
      throw new Error(`the sidecar export failed: ${prepared.error.message}`);
    }
    // The boundary's VERIFIED digest of the exported GLB (untrusted bytes
    // until the in-page bridge re-validates them).
    const exportedDigest = prepared.value.glbDigest;
    const exportedPath = join(workspaceDir, 'leg14-blender-live-export.glb');
    writeFileSync(exportedPath, Buffer.from(prepared.value.glbBytesData));

    // PAGE side: the UNTRUSTED exported bytes re-enter through the SAME
    // in-page path (the page's bridge validates -> content-addresses ->
    // seals -> the typed bind) — no vendor UI anywhere in the loop.
    await page.goto('/world');
    await expect(page.locator('[data-world-host="web"]')).toHaveAttribute(
      'data-world-phase',
      'ready',
    );
    const digestBefore = await worldDigest(page);
    await page.setInputFiles('[data-testid="foundation-import-input"]', exportedPath);
    const ledgerEntry = page.locator(
      `li[data-bound-asset="${exportedDigest}"][data-outcome="applied"]`,
    );
    await expect(ledgerEntry).toBeVisible();
    // DIGEST CONTINUITY ACROSS THE PROCESS SEAM: the asset digest the PAGE's
    // bridge computed equals the digest the boundary verified — the bytes
    // that left the sidecar are the bytes Epoch validated, and the ledger is
    // keyed by that content address.
    const bindingDigest = await ledgerEntry.getAttribute('data-binding-digest');
    expect(bindingDigest).toMatch(/^[0-9a-f]{64}$/);
    await expect(
      page
        .locator('[data-panel="journal"] li[data-journal-entry="bind"][data-journal-outcome="applied"]')
        .first(),
    ).toBeVisible();
    // The canonical world digest is UNCHANGED by the whole round trip.
    expect(await worldDigest(page)).toBe(digestBefore);
    await page.screenshot({ path: join(SHOT_DIR, 'leg14-blender-live.png'), fullPage: true });
    // Cleanup the ephemeral workspace (never committed, never in-repo).
    rmSync(workspaceDir, { recursive: true, force: true });
  });
});
