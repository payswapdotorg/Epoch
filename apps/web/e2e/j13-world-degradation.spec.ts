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
 * The fabric-level forced ladder (declared degradations, undeclared typed
 * refusals, probe-incompatible primary completing through the ordered
 * fallback on the other real engine, forced mount failure with the source
 * retained) is pinned by qa/rendering/degradation-fallback.test.ts over
 * the renderer-fabric pipeline — this browser leg closes the
 * presentation-level degradation the user actually sees.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
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
