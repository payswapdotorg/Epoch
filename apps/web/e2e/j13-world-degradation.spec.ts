/**
 * J13 (degradation leg) — forced renderer degradation/failure and the
 * declared fallback (W061 battery leg 16), in the REAL browser.
 *
 * This spec runs ONLY in the `chromium-no-gl` project of the world config
 * (WebGL disabled at browser launch): the forced condition is a browser
 * with NO usable GL context — exactly the degradation the host
 * composition declares. The engines' documented answer is their
 * deterministic HEADLESS cores (typed, surfaced — never fabricated
 * pixels), and the host's declared fallback surface is the
 * contract-only reference projection (the world stays present + the
 * workspace stays fully interactive — a blank square must never be
 * presented as a world).
 *
 * W067 (ACR-010) extends the degradation battery with the IN-PAGE
 * FOUNDATION PATH on the no-GL/reference fallback: the import affordance
 * + the typed bind stay live on the degraded surface (binding is
 * presentation state, never pixels) — the active presenter's headless
 * core applies the sealed mesh binding, and the declared reference
 * fallback presenter applies it through its own bindAsset seam.
 *
 * The fabric-level forced ladder (declared degradations, undeclared typed
 * refusals, probe-incompatible primary completing through the ordered
 * fallback on the other real engine, forced mount failure with the source
 * retained) is pinned by qa/rendering/degradation-fallback.test.ts over
 * the renderer-fabric pipeline — this browser leg closes the
 * presentation-level degradation the user actually sees.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  THREE_RENDERER_ID,
  ThreeJsRendererAdapter,
  projectedPointerOf,
} from '@epoch/adapter-renderer-threejs';
import {
  BabylonRendererAdapter,
  nullEngineHost,
} from '@epoch/adapter-renderer-babylonjs';
import {
  ManualHostClock,
  ManualFrameScheduler,
  WorldWorkspaceRuntime,
} from '@epoch/world-runtime';
import {
  DEVICE,
  ENTITY_IDS,
  ONTOLOGY,
  RENDERER_PREFERENCE,
  SCENE,
  buildWorldFabric,
} from '../src/features/world/host/world-fixture';

const SHOT_DIR = join(process.cwd(), 'e2e-results', 'world-legs');

// The canonical glTF fixture (byte-identical to the glTF bridge battery's —
// see adapters/foundations/gltf/test/helpers.ts; constructed inline so this
// battery never reaches into another package's test tree).
const CANONICAL_FIXTURE_DIGEST =
  '9cfd1b40cadefd283a5048301bd3c449f4dfe057095e11479bc9df45202ad556' as const;
const TRIANGLE_FLOATS: readonly number[] = [0, 0, 0, 1, 0, 0, 0, 1, 0];

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

test.beforeAll(async () => {
  mkdirSync(SHOT_DIR, { recursive: true });
});

test.describe('J13 leg 16 — forced degradation (no usable GL context)', () => {
  test('the browser without WebGL degrades to the declared headless cores + the reference fallback surface, honestly presented and still interactive', async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium-no-gl',
      'this leg runs only in the chromium-no-gl project (WebGL disabled at launch)',
    );
    expect(browserName).toBe('chromium');
    test.setTimeout(180_000);

    await page.goto('/world');
    await expect(page.locator('[data-world-host="web"]')).toHaveAttribute(
      'data-world-phase',
      'ready',
    );

    // The forced condition is REAL: no WebGL context exists in this browser.
    const glAvailable = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      return canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null;
    });
    expect(glAvailable).toBe(false);

    // The engines' declared degradation: BOTH GL probes honestly report
    // their headless cores (never fabricated pixels).
    const stage = page.locator('[data-engine-stage]');
    await expect(stage).toHaveAttribute('data-gl-three', 'false');
    await expect(stage).toHaveAttribute('data-gl-babylon', 'false');
    // The session itself is healthy on the real adapter's headless core
    // (the workspace did not fail — it degraded, typed).
    await expect(page.getByTestId('renderer-health')).toContainText('healthy');
    await expect(stage).toHaveAttribute('data-active-renderer', THREE_RENDERER_ID);

    // The declared fallback surface: the reference projection presents the
    // spatial world (the engine pixels are NOT live, so the contract-only
    // projection is the honest spatial presentation — never a blank
    // square, never engine pixels claimed without GL).
    await expect(page.locator('[data-viewport="world"]')).toHaveAttribute(
      'data-spatial-overlay',
      'reference',
    );
    await expect(page.locator('[data-world-host="web"]')).toHaveAttribute(
      'data-engine-spatial',
      'false',
    );
    // The reference projection really draws the world: every visible
    // fixture entity presents as a positioned glyph.
    for (const entityId of [
      ENTITY_IDS.slab,
      ENTITY_IDS.frame,
      ENTITY_IDS.panel,
      ENTITY_IDS.riser,
      ENTITY_IDS.hoist,
      ENTITY_IDS.staging,
    ]) {
      await expect(
        page.locator(`[data-viewport-entity="${entityId}"]`),
      ).toBeVisible();
    }
    await page.screenshot({ path: join(SHOT_DIR, 'leg16-degraded-reference.png'), fullPage: true });

    // The degraded world is STILL the interactive workspace: semantic
    // picking runs through the real adapter's headless hit-test core (the
    // pointer derived from the adapter's own projection — same honest
    // basis as the GL journey).
    const pointer = await deriveHeadlessThreePointer(ENTITY_IDS.panel);
    const box = await (async () => {
      const stageElement = page.locator('[data-engine-stage]');
      await stageElement.scrollIntoViewIfNeeded();
      const bounds = await stageElement.boundingBox();
      if (bounds === null) throw new Error('the engine stage is not rendered');
      return bounds;
    })();
    await page.mouse.click(
      box.x + pointer.x * box.width,
      box.y + pointer.y * box.height,
    );
    await expect(
      page
        .locator(
          `[data-panel="journal"] li[data-journal-entry="select"][data-journal-outcome="applied"]`,
        )
        .first(),
    ).toBeVisible();
    await expect(page.locator('[data-inspect="entityId"]')).toHaveText(ENTITY_IDS.panel);
  });

  test('W067 — the in-page foundation path on the no-GL/reference fallback: the degraded world still imports and binds', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'chromium-no-gl',
      'this leg runs only in the chromium-no-gl project (WebGL disabled at launch)',
    );
    test.setTimeout(240_000);

    await page.goto('/world');
    await expect(page.locator('[data-world-host="web"]')).toHaveAttribute(
      'data-world-phase',
      'ready',
    );
    const workspace = page.locator('[data-workspace="world"]');
    const digestBefore = await workspace.getAttribute('data-world-digest');
    const entityIdsBefore = await workspace.getAttribute('data-entity-ids');
    const fixturePath = join(tmpdir(), 'epoch-j13-degradation-leg14.glb');
    writeFileSync(fixturePath, Buffer.from(canonicalFixtureGlb()));

    // The degraded world (no GL, headless three.js core presenting, the
    // reference projection as the spatial overlay) still runs the FULL
    // in-page path: import -> the in-page trust gate -> the typed bind.
    await page.setInputFiles('[data-testid="foundation-import-input"]', fixturePath);
    const ledgerEntry = page.locator(
      `li[data-bound-asset="${CANONICAL_FIXTURE_DIGEST}"][data-outcome="applied"]`,
    );
    await expect(ledgerEntry).toBeVisible();
    const bindingDigest = await ledgerEntry.getAttribute('data-binding-digest');
    expect(bindingDigest).toMatch(/^[0-9a-f]{64}$/);
    const receiptDigest = await ledgerEntry.getAttribute('data-receipt-digest');
    expect(receiptDigest).toMatch(/^[0-9a-f]{64}$/);
    // The binding applied through the ACTIVE presenter's HEADLESS core
    // (three.js — its declared asset kinds include mesh; the GPU upload is
    // the browser path, the binding record is presentation state).
    await expect(ledgerEntry).toContainText(THREE_RENDERER_ID);
    // The typed receipt in the journal + the binding-requested effect.
    await expect(
      page
        .locator(
          '[data-panel="journal"] li[data-journal-entry="bind"][data-journal-outcome="applied"]',
        )
        .first(),
    ).toBeVisible();
    await expect(
      page.locator('[data-panel="journal"] li[data-effect="binding-requested"]').first(),
    ).toBeVisible();
    // The canonical world digest + the presented semantic entity ids are
    // UNCHANGED by the binding (binding is presentation, never semantic).
    expect(await workspace.getAttribute('data-world-digest')).toBe(digestBefore);
    expect(await workspace.getAttribute('data-entity-ids')).toBe(entityIdsBefore);
    await page.screenshot({
      path: join(SHOT_DIR, 'leg16-degraded-foundation-bind.png'),
      fullPage: true,
    });

    // The declared fallback presenter's OWN seam: switch the degraded world
    // to the reference renderer (rr-web-reference — W067 declares it
    // asset-bindable, mirroring the desktop full reference) and re-bind the
    // SAME digest-addressed asset on the fresh session.
    await page.locator('[data-renderer-choice="rr-web-reference"]').click();
    await expect(page.locator('[data-engine-stage]')).toHaveAttribute(
      'data-active-renderer',
      'rr-web-reference',
    );
    await page.getByTestId(`foundation-bind-${CANONICAL_FIXTURE_DIGEST.slice(0, 12)}`).click();
    const referenceEntry = page.locator(
      `li[data-bound-asset="${CANONICAL_FIXTURE_DIGEST}"][data-outcome="applied"]`,
    );
    await expect(referenceEntry.first()).toBeVisible();
    // The newest ledger entry applied through the REFERENCE adapter's own
    // bindAsset seam (the reference presenter's evidence).
    await expect(
      page
        .locator(
          `[data-panel="journal"] li[data-journal-entry="bind"][data-journal-outcome="applied"]`,
        )
        .first(),
    ).toContainText('receipt');
    await expect(referenceEntry.first()).toContainText('rr-web-reference');
    // The ledger is keyed by the SAME asset digest (two applications, one
    // digest-addressed identity) and the world digest is still unchanged.
    await expect(workspace).toHaveAttribute(
      'data-bound-assets',
      CANONICAL_FIXTURE_DIGEST,
    );
    expect(await workspace.getAttribute('data-world-digest')).toBe(digestBefore);
    // The reference presenter stays healthy (binding is not a failure mode).
    await expect(page.getByTestId('renderer-health')).toContainText('healthy');
    await page.screenshot({
      path: join(SHOT_DIR, 'leg16-degraded-reference-bind.png'),
      fullPage: true,
    });
  });
});

/** The projected pointer of one entity under the three.js headless core. */
async function deriveHeadlessThreePointer(
  entityId: string,
): Promise<{ readonly x: number; readonly y: number }> {
  const three = new ThreeJsRendererAdapter();
  const babylon = new BabylonRendererAdapter({ host: nullEngineHost() });
  const { fabric } = buildWorldFabric({ three, babylon });
  const runtime = new WorldWorkspaceRuntime({
    slug: 'j13-degraded-shadow',
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
    const session = runtime.session();
    if (session === null) {
      throw new Error('no shadow session');
    }
    const presentation = three.presentationOf(session.fabricSessionId);
    if (presentation === undefined) {
      throw new Error('no three.js presentation in the shadow workspace');
    }
    const projected = projectedPointerOf(presentation, entityId);
    if (projected === undefined) {
      throw new Error(`entity ${entityId} does not project under the three.js camera`);
    }
    return projected;
  } finally {
    await runtime.close();
  }
}
