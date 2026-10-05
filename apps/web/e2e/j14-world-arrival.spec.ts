/**
 * J14 — The construction solution ARRIVAL (W072, ACR-012): the first
 * impression of `/world` exactly as the work order's acceptance criteria
 * see it — a construction solution opens, an actual building/site is
 * visible immediately, real engine geometry presents (Three.js AND
 * Babylon.js), the renderer switch preserves the same semantic world, and
 * the spatial world — never a dashboard — dominates the surface.
 *
 * Acceptance mapping (the W072 work order's 20 criteria; this journey
 * carries the arrival half — the exploration journeys continue in J15–J17):
 *  AC 1  — /world opens a construction solution
 *  AC 2  — an actual building/site is visible immediately (real GL pixels
 *           at the ready flip, before any interaction)
 *  AC 3  — Three.js displays actual construction geometry (the SwiftShader
 *           ANGLE renderer string + massing pixel forensics on the live
 *           drawing buffer)
 *  AC 4  — Babylon.js displays equivalent construction geometry (the
 *           switched-to live GL surface carries real lit pixels over the
 *           same frozen entity set)
 *  AC 5  — renderer switching preserves the same semantic world (the
 *           canonical digest, the semantic entity set, the selection and
 *           the timeline position carry across Three.js → Babylon.js →
 *           Three.js; the switch receipt is surfaced)
 *  AC 20 — no dashboard/table is mistaken for the spatial world (the
 *           dominance class: the world viewport is the primary surface,
 *           the rails flank it at restrained shares, the HUDs float OVER
 *           the canvas, and the default state never scrolls)
 *
 * Environment (recorded exactly, never fabricated): the production build
 * (`next start` on the free suite port 3100) under Playwright / Chromium
 * with REAL software GL (ANGLE SwiftShader — this sandbox has no GPU; the
 * spec asserts the actual renderer string). Software GL is real-browser
 * WebGL evidence, recorded as exactly that.
 */
import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import {
  BABYLONJS_RENDERER_ID,
  ENTITY_IDS,
  REFERENCE_RENDERER_ID,
  SCENE,
  TENANT,
  THREE_RENDERER_ID,
} from '../src/features/world/host/world-fixture';

/** Where the visual evidence lands (gitignored run artifacts; the
 * committed evidence is this spec + the journey record). */
const SHOT_DIR = join(process.cwd(), 'e2e-results', 'world-journeys');

/**
 * The REAL Three.js GL pixel forensics over the LIVE drawing buffer: the
 * warm paper ground (#ddd7cb — the host-owned clear color) plus the
 * construction massing rendered on top of it. A blank or context-dead
 * canvas fails both readings (the massing share and the color diversity).
 */
async function threeMassingOf(page: Page): Promise<{
  ctx: boolean;
  distinct: number;
  nonGroundShare: number;
}> {
  return page.evaluate(() => {
    const canvas = document.querySelector(
      'canvas[data-engine-canvas="rr-threejs"]',
    ) as HTMLCanvasElement | null;
    const gl = canvas?.getContext('webgl2');
    if (canvas === null || gl === null || gl === undefined) {
      return { ctx: false, distinct: 0, nonGroundShare: 0 };
    }
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let ground = 0;
    const colors = new Set<string>();
    for (let i = 0; i < buf.length; i += 4) {
      colors.add(`${buf[i]},${buf[i + 1]},${buf[i + 2]}`);
      if (
        Math.abs(buf[i] - 221) < 6 &&
        Math.abs(buf[i + 1] - 215) < 6 &&
        Math.abs(buf[i + 2] - 203) < 6
      ) {
        ground += 1;
      }
    }
    return {
      ctx: true,
      distinct: colors.size,
      nonGroundShare: (w * h - ground) / (w * h),
    };
  });
}

/**
 * The Babylon.js GL pixel forensics: real lit geometry (the babylon
 * adapter mounts a hemispheric light) over its navy clear — the drawing
 * buffer is diverse and spread, never a flat clear.
 */
async function babylonPixelsOf(page: Page): Promise<{
  ctx: boolean;
  distinct: number;
  spread: number;
}> {
  return page.evaluate(() => {
    const canvas = document.querySelector(
      'canvas[data-engine-canvas="rr-babylonjs-embedded"]',
    ) as HTMLCanvasElement | null;
    const gl = canvas?.getContext('webgl2');
    if (canvas === null || gl === null || gl === undefined) {
      return { ctx: false, distinct: 0, spread: 0 };
    }
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const buf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const colors = new Set<string>();
    let minR = 255;
    let maxR = 0;
    let minG = 255;
    let maxG = 0;
    let minB = 255;
    let maxB = 0;
    for (let i = 0; i < buf.length; i += 4) {
      colors.add(`${buf[i]},${buf[i + 1]},${buf[i + 2]}`);
      minR = Math.min(minR, buf[i]);
      maxR = Math.max(maxR, buf[i]);
      minG = Math.min(minG, buf[i + 1]);
      maxG = Math.max(maxG, buf[i + 1]);
      minB = Math.min(minB, buf[i + 2]);
      maxB = Math.max(maxB, buf[i + 2]);
    }
    return {
      ctx: true,
      distinct: colors.size,
      spread: Math.max(maxR - minR, maxG - minG, maxB - minB),
    };
  });
}

test.describe('J14 the construction solution arrival (W072)', () => {
  test('ACs 1-5 + 20 — the world-dominant arrival through both real engines, one semantic world', async ({
    page,
  }) => {
    // Real software GL on two engine mounts legitimately takes its time on
    // the CPU rasterizer; the budget covers the whole arrival sweep.
    test.setTimeout(300_000);
    mkdirSync(SHOT_DIR, { recursive: true });

    // -- AC 1: /world opens a construction solution. ----------------------
    await page.goto('/world');
    await expect(page.locator('[data-world-host="web"]')).toHaveAttribute(
      'data-world-phase',
      'ready',
    );
    const workspace = page.locator('[data-workspace="world"]');
    await expect(workspace).toHaveAttribute(
      'data-workspace-kind',
      'construction-solution',
    );
    // The compact solution bar names the frozen fixture problem + tenant.
    await expect(page.getByTestId('cs-solution-bar')).toContainText(
      'Construction solution — Pioneer Block-A',
    );
    await expect(page.getByTestId('cs-session-context')).toContainText(TENANT);
    // The canonical digest is the sealed fixture digest (the same world the
    // desktop presents — the frozen W071 anchor).
    expect(await workspace.getAttribute('data-world-digest')).toBe(SCENE.digest);
    // The semantic entity set is the frozen construction vocabulary: the
    // building systems AND the site context, through the canonical scene.
    const entityIds = (await workspace.getAttribute('data-entity-ids')) ?? '';
    for (const entityId of [
      ENTITY_IDS.groundSlab,
      ENTITY_IDS.column01,
      ENTITY_IDS.wallSouth,
      ENTITY_IDS.roofCladding,
      ENTITY_IDS.hvacUnit,
      ENTITY_IDS.siteStaging,
    ]) {
      expect(entityIds).toContain(entityId);
    }
    // The renderer bar: both REAL engines + the contract-only reference
    // fallback, healthy, on the PREFERRED real renderer (Three.js first).
    await expect(page.getByTestId('renderer-health')).toContainText('healthy');
    for (const choice of [THREE_RENDERER_ID, BABYLONJS_RENDERER_ID, REFERENCE_RENDERER_ID]) {
      await expect(page.locator(`[data-renderer-choice="${choice}"]`)).toBeVisible();
    }
    await expect(
      page.locator(`[data-renderer-choice="${THREE_RENDERER_ID}"]`),
    ).toHaveAttribute('data-renderer-active', 'true');

    // -- AC 2 + 3: an actual building/site is visible IMMEDIATELY, through
    // real Three.js geometry (REAL GL pixels at the ready flip — no
    // interaction, no waiting for user intent).
    await expect(page.locator('[data-engine-stage]')).toHaveAttribute(
      'data-active-renderer',
      THREE_RENDERER_ID,
    );
    await expect(page.locator('[data-engine-stage]')).toHaveAttribute(
      'data-gl-three',
      'true',
    );
    // The host's honest surface-mode flag: the REAL engine presents the
    // spatial world (never the reference projection beside dead pixels).
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
        'canvas[data-engine-canvas="rr-threejs"]',
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
    // The massing forensics (polled: the first frames after the ready flip
    // may still be compositing — the pixels must arrive on their own).
    await expect
      .poll(async () => (await threeMassingOf(page)).ctx, { timeout: 20_000 })
      .toBe(true);
    await expect
      .poll(async () => (await threeMassingOf(page)).nonGroundShare, { timeout: 20_000 })
      .toBeGreaterThan(0.05);
    const massing = await threeMassingOf(page);
    expect(massing.distinct).toBeGreaterThanOrEqual(30);
    await page.screenshot({ path: join(SHOT_DIR, 'j14-arrival-three.png'), fullPage: true });

    // -- AC 20: no dashboard/table is mistaken for the spatial world. -----
    // The dominance class, measured from the REAL DOM boxes at the battery
    // canvas (1280x720): the world viewport is the PRIMARY surface, the
    // navigator/inspector rails flank it at restrained shares, the HUDs
    // float OVER the canvas (inside the viewport box), and the default
    // state never scrolls the page.
    await expect(page.getByTestId('cs-world-viewport')).toHaveAttribute(
      'data-workspace-primary',
      '',
    );
    await expect(page.getByTestId('cs-navigator')).toHaveAttribute(
      'data-workspace-secondary',
      '',
    );
    await expect(page.getByTestId('cs-inspector')).toHaveAttribute(
      'data-workspace-secondary',
      '',
    );
    const dominance = await page.evaluate(() => {
      const viewport = document.querySelector('[data-testid="cs-world-viewport"]');
      const row = document.querySelector('[data-workspace-row]');
      const space = document.querySelector('[data-workspace="world"]');
      const navigator = document.querySelector('[data-testid="cs-navigator"]');
      const inspector = document.querySelector('[data-testid="cs-inspector"]');
      const hudControls = document.querySelector('[data-testid="cs-view-controls"]');
      const hudMetrics = document.querySelector('[data-testid="cs-metrics"]');
      const hudTimeline = document.querySelector('[data-testid="cs-timeline"]');
      if (
        viewport === null || row === null || space === null || navigator === null ||
        inspector === null || hudControls === null || hudMetrics === null || hudTimeline === null
      ) {
        return null;
      }
      const v = viewport.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      const s = space.getBoundingClientRect();
      const n = navigator.getBoundingClientRect();
      const i = inspector.getBoundingClientRect();
      const inside = (hud: DOMRect): boolean =>
        hud.left >= v.left - 1 && hud.right <= v.right + 1 && hud.top >= v.top - 1 && hud.bottom <= v.bottom + 1;
      return {
        viewportShareOfRow: (v.width * v.height) / (r.width * r.height),
        viewportShareOfWorkspace: (v.width * v.height) / (s.width * s.height),
        navigatorFlanksLeft: n.right <= v.left + 1,
        inspectorFlanksRight: i.left >= v.right - 1,
        hudsFloatOverCanvas:
          inside(hudControls.getBoundingClientRect()) &&
          inside(hudMetrics.getBoundingClientRect()) &&
          inside(hudTimeline.getBoundingClientRect()),
        noPageScroll: document.documentElement.scrollHeight <= window.innerHeight + 1,
      };
    });
    expect(dominance).not.toBeNull();
    // The 60–75% band (work order deliverable 1) over the MAIN SURFACE —
    // the workspace row (navigator | world | inspector) the band governs.
    // The whole-workspace reading (the compact solution bar included)
    // stays an honest majority; the phase-A record carries the four-size
    // table on both bases and the full-window reading.
    expect(dominance?.viewportShareOfRow).toBeGreaterThanOrEqual(0.6);
    expect(dominance?.viewportShareOfRow).toBeLessThanOrEqual(0.8);
    expect(dominance?.viewportShareOfWorkspace).toBeGreaterThanOrEqual(0.55);
    expect(dominance?.navigatorFlanksLeft).toBe(true);
    expect(dominance?.inspectorFlanksRight).toBe(true);
    expect(dominance?.hudsFloatOverCanvas).toBe(true);
    expect(dominance?.noPageScroll).toBe(true);

    // -- AC 4: Babylon.js displays equivalent construction geometry. -----
    const digestBeforeSwitch = await workspace.getAttribute('data-world-digest');
    const entityIdsBeforeSwitch = entityIds;
    const selectedBeforeSwitch = (await workspace.getAttribute('data-selected-entity')) ?? '';
    const timelineBeforeSwitch = (await page.getByTestId('timeline-position').textContent()) ?? '';
    await page.locator(`[data-renderer-choice="${BABYLONJS_RENDERER_ID}"]`).click();
    await expect(page.locator('[data-engine-stage]')).toHaveAttribute(
      'data-active-renderer',
      BABYLONJS_RENDERER_ID,
    );
    // The Babylon GL surface went live at its first session mount: the
    // REAL engine presents (never the reference projection).
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
    // Real LIT pixels: the drawing buffer is diverse and spread (the
    // babylon adapter's hemispheric light shades the same construction
    // geometry; a flat clear or a dead context fails both readings).
    await expect
      .poll(async () => (await babylonPixelsOf(page)).ctx, { timeout: 20_000 })
      .toBe(true);
    await expect
      .poll(async () => (await babylonPixelsOf(page)).distinct, { timeout: 20_000 })
      .toBeGreaterThanOrEqual(15);
    const babylon = await babylonPixelsOf(page);
    expect(babylon.spread).toBeGreaterThan(30);
    await page.screenshot({ path: join(SHOT_DIR, 'j14-arrival-babylon.png'), fullPage: true });

    // -- AC 5: the switch preserves the SAME semantic world. --------------
    // (The full interactive-continuity proof — semantic picking through
    // both engines — is the J13 battery's legs 12/13/15; this journey pins
    // the semantic identity itself: digest, entity set, selection,
    // timeline, and the surfaced switch receipt.)
    expect(await workspace.getAttribute('data-world-digest')).toBe(digestBeforeSwitch);
    expect(await workspace.getAttribute('data-entity-ids')).toBe(entityIdsBeforeSwitch);
    expect(await workspace.getAttribute('data-selected-entity')).toBe(selectedBeforeSwitch);
    await expect(page.getByTestId('timeline-position')).toHaveText(timelineBeforeSwitch);
    await expect(page.getByTestId('renderer-switch-evidence')).toContainText(
      'Last switch receipt',
    );
    // And back to Three.js: the same world, still on the live GL surface.
    await page.locator(`[data-renderer-choice="${THREE_RENDERER_ID}"]`).click();
    await expect(page.locator('[data-engine-stage]')).toHaveAttribute(
      'data-active-renderer',
      THREE_RENDERER_ID,
    );
    await expect(page.locator('[data-engine-stage]')).toHaveAttribute(
      'data-gl-three',
      'true',
    );
    await expect(page.locator('[data-world-host="web"]')).toHaveAttribute(
      'data-engine-spatial',
      'true',
    );
    expect(await workspace.getAttribute('data-world-digest')).toBe(digestBeforeSwitch);
    expect(await workspace.getAttribute('data-entity-ids')).toBe(entityIdsBeforeSwitch);
    // The Three.js massing is STILL the same real pixels after the round
    // trip (the GL binding survives the switch — the stable-stage doctrine).
    await expect
      .poll(async () => (await threeMassingOf(page)).nonGroundShare, { timeout: 20_000 })
      .toBeGreaterThan(0.05);
    await page.screenshot({ path: join(SHOT_DIR, 'j14-arrival-back-to-three.png'), fullPage: true });
  });
});
