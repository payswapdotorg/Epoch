/**
 * J16 — The DRAWING SET + PROGRAMME journey (W072, ACR-012): reading the
 * construction solution the engineering way — the true top-down PLAN, the
 * SECTION cutaway at the interactive cut plane, the PROGRAMME timeline
 * that visibly builds the world phase by phase, and the construction
 * LAYERS through the typed Epoch interaction path.
 *
 * Acceptance mapping (the W072 work order's 20 criteria):
 *  AC 7  — plan view works (the true top-down presentation of the SAME
 *           semantic world: entities, the A–A cut line, the north arrow,
 *           and a REAL plan pick through the same letterbox-aware mapping
 *           the component uses)
 *  AC 8  — section/cutaway works (the internal systems exposed THROUGH
 *           the envelope at the default cut; the cut is INTERACTIVE — the
 *           steppers re-project the section; a REAL section pick)
 *  AC 16 — timeline changes construction state (the phase scrubbers move
 *           the programme head: the position, the phase HUD, the
 *           built-count metrics, and the DRAWING truth — unbuilt elements
 *           are dashed outlines that turn solid as their phase arrives)
 *  AC 9  — construction layers work (isolation through the typed filter
 *           intent — the navigator state AND the spatial truth: the plan
 *           shows ONLY the isolated layer's entities; reveal-all restores
 *           the full world through the typed show intent)
 *
 * The honest pick basis: the plan/section picks target the positions the
 * components themselves hit-test — derived in this test process from the
 * SAME frozen presentation projection (`presentedEntities` +
 * `planProjectorFor`/`sectionProjectorFor` + `planEntityAt`/
 * `sectionEntityAt`), then mapped through the same letterbox-aware
 * content-box math the canvases' pointer handlers use. A pick that would
 * hit a different entity fails the derivation before the browser is ever
 * involved.
 *
 * Environment (recorded exactly, never fabricated): the production build
 * (`next start` on the free suite port 3100) under Playwright / Chromium
 * with REAL software GL (ANGLE SwiftShader — this sandbox has no GPU; J14
 * pins the renderer string). The engine stage stays MOUNTED (CSS-hidden)
 * through the plan/section legs — the stable-stage doctrine — and this
 * journey re-proves it at the end: back in 3D the REAL GL pixels are
 * still live after the whole drawing-set round trip.
 */
import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import {
  PLAN_VIEW,
  SECTION_CUT_X,
  SECTION_VIEW,
  entityBuiltAtPhase,
  phaseAt,
  planEntityAt,
  planProjectorFor,
  planRectOf,
  presentedEntities,
  sectionEntityAt,
  sectionProjectorFor,
  sectionRectOf,
} from '../src/features/world/construction-solution';
import { ENTITY_IDS, THREE_RENDERER_ID } from '../src/features/world/host/world-fixture';

/** Where the visual evidence lands (gitignored run artifacts). */
const SHOT_DIR = join(process.cwd(), 'e2e-results', 'world-journeys');

/** The presented world under the Current variant (the frozen fixture fold). */
const PRESENTED = presentedEntities('variant-current');

/** The entity record of one id (throws when the fixture does not carry it). */
function presentedOf(entityId: string) {
  const entity = PRESENTED.find((candidate) => candidate.geometry.entityId === entityId);
  if (entity === undefined) {
    throw new Error(`the frozen fixture does not present ${entityId}`);
  }
  return entity;
}

/** The DEFAULT-VISIBLE entity count of the plan presentation (the hidden
 * legacy conduit is entity-hidden until its layer is revealed). */
const VISIBLE_DEFAULT_COUNT = PRESENTED.filter(
  (entity) => entity.geometry.visibleByDefault,
).length;

/** The built-entity count at one phase (the HUD metrics' own fold: the
 * default-visible entities whose phase has arrived). */
function builtCountAt(atMs: number): number {
  const phase = phaseAt(atMs);
  return PRESENTED.filter(
    (entity) => entity.geometry.visibleByDefault && entityBuiltAtPhase(entity.geometry, phase),
  ).length;
}

/**
 * The page-space center of one entity's PLAN footprint: the same projector
 * + hit-test the plan canvas uses, then the same letterbox-aware content
 * box mapping (preserveAspectRatio "meet"). Fails when the point would
 * hit anything but the target entity — never a guessed pick.
 */
async function planPointOf(page: Page, entityId: string): Promise<{ x: number; y: number }> {
  const projector = planProjectorFor(PRESENTED);
  const rect = planRectOf(presentedOf(entityId), projector);
  const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const hit = planEntityAt(PRESENTED, projector, point);
  if (hit?.geometry.entityId !== entityId) {
    throw new Error(
      `the derived plan pick of ${entityId} would hit ${hit?.geometry.entityId ?? 'nothing'}`,
    );
  }
  const box = await page.getByTestId('cs-plan-canvas').boundingBox();
  if (box === null) {
    throw new Error('the plan canvas is not rendered');
  }
  const scale = Math.min(box.width / PLAN_VIEW.width, box.height / PLAN_VIEW.height);
  const offsetX = box.x + (box.width - PLAN_VIEW.width * scale) / 2;
  const offsetY = box.y + (box.height - PLAN_VIEW.height * scale) / 2;
  return { x: offsetX + point.x * scale, y: offsetY + point.y * scale };
}

/**
 * The page-space center of one entity's SECTION cut rect (the same
 * projector + hit-test the section canvas uses, at the live cut position).
 */
async function sectionPointOf(
  page: Page,
  entityId: string,
  cutX: number,
): Promise<{ x: number; y: number }> {
  const projector = sectionProjectorFor(PRESENTED, cutX);
  const rect = sectionRectOf(presentedOf(entityId), projector);
  const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const hit = sectionEntityAt(PRESENTED, projector, point, cutX);
  if (hit?.geometry.entityId !== entityId) {
    throw new Error(
      `the derived section pick of ${entityId} would hit ${hit?.geometry.entityId ?? 'nothing'}`,
    );
  }
  const box = await page.getByTestId('cs-section-canvas').boundingBox();
  if (box === null) {
    throw new Error('the section canvas is not rendered');
  }
  const scale = Math.min(box.width / SECTION_VIEW.width, box.height / SECTION_VIEW.height);
  const offsetX = box.x + (box.width - SECTION_VIEW.width * scale) / 2;
  const offsetY = box.y + (box.height - SECTION_VIEW.height * scale) / 2;
  return { x: offsetX + point.x * scale, y: offsetY + point.y * scale };
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

test.describe('J16 the drawing set + programme journey (W072)', () => {
  test('ACs 7-9 + 16 — plan, section cutaway, the programme, and the layers', async ({ page }) => {
    test.setTimeout(300_000);
    mkdirSync(SHOT_DIR, { recursive: true });

    await page.goto('/world');
    await expect(page.locator('[data-world-host="web"]')).toHaveAttribute(
      'data-world-phase',
      'ready',
    );
    await expect(page.locator('[data-engine-stage]')).toHaveAttribute(
      'data-gl-three',
      'true',
    );
    const workspace = page.locator('[data-workspace="world"]');

    // -- AC 7: plan view works (true top-down, north up). -----------------
    await page.getByTestId('cs-mode-plan').click();
    await expect(page.getByTestId('cs-plan-canvas')).toBeVisible();
    await expect(page.getByTestId('cs-mode-banner')).toContainText('PLAN');
    // The plan presents the SAME semantic world: every default-visible
    // fixture entity has a footprint (the frozen fold, exactly).
    await expect(page.locator('[data-cs-plan-entity]')).toHaveCount(VISIBLE_DEFAULT_COUNT);
    // The engineering-drawing conventions: the labelled A–A cut line (one
    // cut state ties the plan to the section) + the north arrow.
    await expect(page.getByTestId('cs-plan-cut-line')).toBeVisible();
    await expect(page.getByTestId('cs-plan-cut-line')).toHaveAttribute(
      'data-cut-x',
      String(SECTION_CUT_X),
    );
    // A REAL plan pick (the staging yard's footprint center, derived
    // through the component's own projector + hit-test): the canonical
    // semantic identity surfaces from the DRAWING, exactly as from 3D.
    const staging = await planPointOf(page, ENTITY_IDS.siteStaging);
    await page.mouse.click(staging.x, staging.y);
    await expect(workspace).toHaveAttribute('data-selected-entity', ENTITY_IDS.siteStaging);
    await expect(page.locator('[data-inspect="entityId"]')).toHaveText(
      ENTITY_IDS.siteStaging,
    );
    await page.screenshot({ path: join(SHOT_DIR, 'j16-plan.png'), fullPage: true });

    // -- AC 8: section/cutaway works (the internal systems THROUGH the
    // envelope, at the live interactive cut plane). ------------------------
    await page.getByTestId('cs-mode-section').click();
    await expect(page.getByTestId('cs-section-canvas')).toBeVisible();
    await expect(page.getByTestId('cs-section-canvas')).toHaveAttribute(
      'data-cut-x',
      String(SECTION_CUT_X),
    );
    await expect(page.getByTestId('cs-mode-banner')).toContainText('SECTION A–A');
    // The cutaway exposes the internal construction systems through the
    // envelope: the foundation + slab, the cut wall, the beams, the
    // ceiling AND the MEP zone (duct + riser) — never an empty shell.
    for (const entityId of [
      ENTITY_IDS.foundationStrip,
      ENTITY_IDS.groundSlab,
      ENTITY_IDS.wallSouth,
      ENTITY_IDS.beam01,
      ENTITY_IDS.ceiling,
      ENTITY_IDS.hvacDuct,
      ENTITY_IDS.plumbingRiser,
    ]) {
      await expect(page.locator(`[data-cs-section-entity="${entityId}"]`)).toBeVisible();
    }
    // The cut is INTERACTIVE: stepping the cut re-projects the section
    // (the canvas + the HUD carry the new cut position).
    await page.getByTestId('cs-section-cut-inc').click();
    await expect(page.getByTestId('cs-section-canvas')).toHaveAttribute('data-cut-x', '2.25');
    await expect(page.getByTestId('cs-section-cut-value')).toContainText('2.25');
    await page.getByTestId('cs-section-cut-dec').click();
    await page.getByTestId('cs-section-cut-dec').click();
    await expect(page.getByTestId('cs-section-canvas')).toHaveAttribute('data-cut-x', '1.75');
    await page.getByTestId('cs-section-cut-reset').click();
    await expect(page.getByTestId('cs-section-canvas')).toHaveAttribute(
      'data-cut-x',
      String(SECTION_CUT_X),
    );
    // A REAL section pick (the HVAC duct's cut-rect center — the internal
    // MEP element the cutaway exposes; the honest-basis guard verifies the
    // point hits the duct through the component's own hit-test before the
    // click): the internal system is selectable from the DRAWING too.
    const duct = await sectionPointOf(page, ENTITY_IDS.hvacDuct, SECTION_CUT_X);
    await page.mouse.click(duct.x, duct.y);
    await expect(workspace).toHaveAttribute('data-selected-entity', ENTITY_IDS.hvacDuct);
    await expect(page.locator('[data-inspect="entityId"]')).toHaveText(
      ENTITY_IDS.hvacDuct,
    );
    await page.screenshot({ path: join(SHOT_DIR, 'j16-section.png'), fullPage: true });

    // -- AC 16: the timeline changes the presented construction state. ----
    // Back on the plan, where the programme's world effect is plainly
    // visible. The initial programme head (the frozen track position).
    await page.getByTestId('cs-mode-plan').click();
    await expect(page.getByTestId('timeline-position')).toHaveText('2.0s / 16.0s');
    await expect(page.getByTestId('cs-timeline-phase')).toHaveText('Excavation');
    // The phase scrubber: jump to the Structure phase — the position, the
    // phase HUD, and the built-count metrics all follow (the metrics'
    // own fixture fold).
    await page.getByTestId('cs-phase-phase-structure').click();
    await expect(page.getByTestId('timeline-position')).toHaveText('6.0s / 16.0s');
    await expect(page.getByTestId('cs-timeline-phase')).toHaveText('Structure');
    await expect(page.getByTestId('cs-metrics')).toContainText(
      `built ${builtCountAt(6000)}/`,
    );
    // The DRAWING truth of the programme: at the Structure phase the MEP
    // zone is still FUTURE work — dashed outlines in the plan (dashed
    // MEP) while the arrived phases are solid (the foundation slab)…
    await expect(
      page.locator(`[data-cs-plan-entity="${ENTITY_IDS.hvacDuct}"] rect`).first(),
    ).toHaveAttribute('stroke-dasharray', '4 4');
    await expect(
      page.locator(`[data-cs-plan-entity="${ENTITY_IDS.groundSlab}"] rect`).first(),
    ).not.toHaveAttribute('stroke-dasharray', '4 4');
    await page.screenshot({ path: join(SHOT_DIR, 'j16-phase-structure.png'), fullPage: true });
    // …and at the Finishes phase the world is fully BUILT — solid.
    await page.getByTestId('cs-phase-phase-finishes').click();
    await expect(page.getByTestId('cs-timeline-phase')).toHaveText('Finishes');
    await expect(page.getByTestId('cs-metrics')).toContainText(
      `built ${builtCountAt(14_000)}/`,
    );
    await expect(
      page.locator(`[data-cs-plan-entity="${ENTITY_IDS.hvacDuct}"] rect`).first(),
    ).not.toHaveAttribute('stroke-dasharray', '4 4');
    await expect(
      page.locator(`[data-cs-plan-entity="${ENTITY_IDS.ceiling}"] rect`).first(),
    ).not.toHaveAttribute('stroke-dasharray', '4 4');
    await page.screenshot({ path: join(SHOT_DIR, 'j16-phase-finishes.png'), fullPage: true });

    // -- AC 9: construction layers work (the typed filter intent). --------
    // Isolating MEP leaves ONLY the MEP entities in the world.
    await page.getByTestId('layer-isolate-lyr-mep').click();
    await expectJournal(page, 'filter', 'applied');
    // The navigator presents the isolated layer (the affordance state).
    await expect(page.getByTestId('cs-layer-lyr-mep')).toHaveAttribute('data-isolated', 'true');
    await expect(page.getByTestId('cs-layer-lyr-envelope')).toHaveAttribute(
      'data-layer-state',
      'hidden',
    );
    // The SPATIAL truth (never a checkbox claim): every remaining plan
    // footprint belongs to the MEP layer.
    const isolatedIds = await page
      .locator('[data-cs-plan-entity]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-cs-plan-entity') ?? ''));
    expect(isolatedIds.length).toBeGreaterThanOrEqual(5);
    for (const entityId of isolatedIds) {
      expect(presentedOf(entityId).geometry.layer).toBe('lyr-mep');
    }
    await page.screenshot({ path: join(SHOT_DIR, 'j16-isolate-mep.png'), fullPage: true });
    // Reveal-all restores the FULL world through the typed show intent.
    await page.getByTestId('layers-reveal-all').click();
    await expectJournal(page, 'show', 'applied');
    await expect(page.getByTestId('cs-layer-lyr-mep')).toHaveAttribute('data-isolated', 'false');
    const revealedIds = await page
      .locator('[data-cs-plan-entity]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-cs-plan-entity') ?? ''));
    expect(revealedIds.length).toBeGreaterThanOrEqual(VISIBLE_DEFAULT_COUNT);
    for (const entityId of [ENTITY_IDS.siteStaging, ENTITY_IDS.wallSouth, ENTITY_IDS.hvacDuct]) {
      expect(revealedIds).toContain(entityId);
    }

    // -- The stable-stage round trip: back in 3D after the whole drawing
    // set, the REAL GL surface is still live and still presents the world
    // (the plan/section legs CSS-hid the mounted stage; they never
    // unmounted it — the GL binding survives).
    await page.getByTestId('cs-mode-3d').click();
    await expect(page.getByTestId('cs-world-chrome')).toBeVisible();
    await expect(page.locator('[data-engine-stage]')).toHaveAttribute(
      'data-active-renderer',
      THREE_RENDERER_ID,
    );
    await expect(page.locator('[data-engine-stage]')).toHaveAttribute('data-gl-three', 'true');
    await expect(page.locator('[data-world-host="web"]')).toHaveAttribute(
      'data-engine-spatial',
      'true',
    );
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const canvas = document.querySelector(
              'canvas[data-engine-canvas="rr-threejs"]',
            ) as HTMLCanvasElement | null;
            const gl = canvas?.getContext('webgl2');
            if (canvas === null || gl === null || gl === undefined) return 0;
            const w = gl.drawingBufferWidth;
            const h = gl.drawingBufferHeight;
            const buf = new Uint8Array(w * h * 4);
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
            let ground = 0;
            for (let i = 0; i < buf.length; i += 4) {
              if (
                Math.abs(buf[i] - 221) < 6 &&
                Math.abs(buf[i + 1] - 215) < 6 &&
                Math.abs(buf[i + 2] - 203) < 6
              ) {
                ground += 1;
              }
            }
            return (w * h - ground) / (w * h);
          }),
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0.05);
    await page.screenshot({ path: join(SHOT_DIR, 'j16-back-to-3d.png'), fullPage: true });
  });
});
