/**
 * J15 — The ENGINEERING INSPECTION journey (W072, ACR-012): the
 * construction professional's first pass over the building IN THE 3D
 * world — navigate the model, pick an element, read its canonical identity
 * and its engineering projection, measure between elements, pin an
 * annotation, and drive the camera.
 *
 * Acceptance mapping (the W072 work order's 20 criteria):
 *  AC 6  — orbit/pan/zoom works (the reset → orbit keys → pan key → the
 *           typed wheel zoom, each verifiably moving the camera)
 *  AC 10 — selecting an element reveals its canonical identity (a REAL
 *           3D pick through the fabric seam → the typed select intent →
 *           the canonical semantic entityId in the inspector)
 *  AC 11 — inspecting an element shows meaningful construction data (the
 *           frozen fixture's §9 engineering projection: type, material,
 *           dimensions, quantity, phase, status, cost, constraints, and
 *           the evidence trail — BOQ line + findings + layer + phase)
 *  AC 12 — measurement works (the documented four-pick cadence over the
 *           REAL measurement affordance: anchor → arm → re-anchor → the
 *           composed typed measure intent + its effect)
 *  AC 13 — annotation works (the typed annotate intent attaches the note
 *           to the focused semantic entity — a CANONICAL revision: the
 *           world digest changes and the note renders in the world)
 *
 * The honest pointer basis (the J13 discipline, reused exactly): every 3D
 * pick targets the position at which the entity REALLY projects under the
 * ACTIVE presenter's camera — derived before the run from the REAL
 * Three.js adapter's own projection helper (`projectedPointerOf`) over the
 * same canonical fixture through the same runtime, in this test process.
 * The camera record is fixed by the fixture and only navigation intents
 * change it (the navigation leg runs AFTER every pointer leg, so the
 * derived positions stay valid for the whole pick sequence).
 *
 * Environment (recorded exactly, never fabricated): the production build
 * (`next start` on the free suite port 3100) under Playwright / Chromium
 * with REAL software GL (ANGLE SwiftShader — this sandbox has no GPU; J14
 * pins the renderer string). Software GL is real-browser WebGL evidence,
 * recorded as exactly that.
 */
import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { ThreeJsRendererAdapter, projectedPointerOf } from '@epoch/adapter-renderer-threejs';
import { BabylonRendererAdapter, nullEngineHost } from '@epoch/adapter-renderer-babylonjs';
import { ManualHostClock, ManualFrameScheduler, WorldWorkspaceRuntime } from '@epoch/world-runtime';
import {
  DEVICE,
  ENTITY_IDS,
  ONTOLOGY,
  RENDERER_PREFERENCE,
  SCENE,
  TRACK,
  buildWorldFabric,
} from '../src/features/world/host/world-fixture';

/** Where the visual evidence lands (gitignored run artifacts). */
const SHOT_DIR = join(process.cwd(), 'e2e-results', 'world-journeys');

/** One entity's derived normalized pointer position (the honest basis). */
type Pointer = { readonly x: number; readonly y: number };

/**
 * The pick targets of this journey — every listed entity is UNOCCLUDED
 * under the construction fixture's canonical camera ([18, 12, 18] target
 * [0, 1.5, 0]; the J13-documented basis): the staging yard sits outside
 * the building, the roof-top HVAC unit above every envelope surface, and
 * the front door protrudes through the south wall face.
 */
const PICK_ENTITY_IDS: readonly string[] = [
  ENTITY_IDS.siteStaging,
  ENTITY_IDS.hvacUnit,
  ENTITY_IDS.doorFront,
];

/**
 * Derive the pointer positions at which the entities project under the
 * REAL Three.js camera (the honest targeting basis — the same projection
 * helper the headless battery uses, over the same canonical fixture
 * through the same runtime, in this test process). The engine's
 * projection math is camera + scene graph only (no GL), so these are the
 * live browser session's projections exactly. The shadow Babylon adapter
 * presents under aspect 1 like the live square engine stage, so the
 * derived normalized pointers transfer to the live session exactly.
 */
async function deriveThreePointers(): Promise<Record<string, Pointer>> {
  const three = new ThreeJsRendererAdapter();
  const babylon = new BabylonRendererAdapter({
    host: nullEngineHost({ width: 1024, height: 1024 }),
  });
  const { fabric } = buildWorldFabric({ three, babylon });
  const runtime = new WorldWorkspaceRuntime({
    slug: 'j15-shadow',
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
      throw new Error('no shadow session on the preferred three.js renderer');
    }
    const presentation = three.presentationOf(session.fabricSessionId);
    if (presentation === undefined) {
      throw new Error('no three.js presentation in the shadow workspace');
    }
    const pointers: Record<string, Pointer> = {};
    for (const entityId of PICK_ENTITY_IDS) {
      const projected = projectedPointerOf(presentation, entityId);
      if (projected === undefined) {
        throw new Error(`entity ${entityId} does not project under the three.js camera`);
      }
      pointers[entityId] = projected;
    }
    return pointers;
  } finally {
    await runtime.close();
  }
}

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
  pointers: Record<string, Pointer>,
  entityId: string,
): Promise<void> {
  const pointer = pointers[entityId];
  if (pointer === undefined) {
    throw new Error(`no derived three.js pointer for ${entityId}`);
  }
  const box = await stageBox(page);
  await page.mouse.click(box.x + pointer.x * box.width, box.y + pointer.y * box.height);
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

test.describe('J15 the engineering inspection journey (W072)', () => {
  test('ACs 6 + 10-13 — pick, inspect, measure, annotate, then navigate the 3D world', async ({
    page,
  }) => {
    // The shadow pointer derivation + the four-pick measure cadence + the
    // real software GL mount all ride the same budget.
    test.setTimeout(420_000);
    mkdirSync(SHOT_DIR, { recursive: true });
    const pointers = await deriveThreePointers();

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

    // -- AC 10: selecting an element reveals its canonical identity. ------
    // A REAL 3D pick through the fabric seam (the active Three.js
    // Raycaster hit-test → the typed select intent → the runtime's inspect
    // projection): the inspector names the CANONICAL semantic entity id.
    await clickEntityPointer(page, pointers, ENTITY_IDS.siteStaging);
    await expectJournal(page, 'select', 'applied');
    await expect(page.locator('[data-inspect="entityId"]')).toHaveText(
      ENTITY_IDS.siteStaging,
    );
    await expect(page.locator('[data-inspect="label"]')).toContainText(
      'Staging / laydown yard',
    );
    // The workspace selection state carries the SAME canonical identity.
    await expect(workspace).toHaveAttribute(
      'data-selected-entity',
      ENTITY_IDS.siteStaging,
    );

    // -- AC 11: inspecting shows meaningful construction data. ------------
    // The inspect tool + a REAL pick of the front door (an element with a
    // full §9 trail: a BOQ line, a ⚠ clearance finding, layer + phase).
    await page.locator('[data-tool="inspect"]').click();
    await clickEntityPointer(page, pointers, ENTITY_IDS.doorFront);
    // Effect-only intent: the receipt is admitted (journal 'normalized')
    // and the inspect-requested EFFECT awaits its authority.
    await expectJournal(page, 'inspect', 'normalized');
    await expect(
      page.locator('[data-panel="journal"] li[data-effect="inspect-requested"]').first(),
    ).toBeVisible();
    await expect(page.locator('[data-inspect="entityId"]')).toHaveText(
      ENTITY_IDS.doorFront,
    );
    // The engineering inspector card: the frozen fixture's §9 projection
    // of the front entrance door (identity, type, material, dimensions,
    // quantity, phase, status, cost, constraints — never a second ledger).
    const card = page.getByTestId('cs-inspect-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Front entrance door');
    await expect(card).toContainText('envelope:door');
    await expect(card).toContainText('Insulated steel door · Thermal 1.2 W/m2K');
    await expect(card).toContainText('1.00 × 2.00 × 0.25 m');
    await expect(card).toContainText('1 nr');
    await expect(card).toContainText('walls');
    await expect(card).toContainText('complete');
    await expect(card).toContainText('€780.00 · line:cs-door-front');
    await expect(card).toContainText('Clear width 1000mm; min 2100mm height');
    // The §9 evidence trail under the card: the identity-mapped BOQ line,
    // the ⚠ finding that references this element, the owning layer+phase.
    const evidence = page.getByTestId('cs-evidence-card');
    await expect(evidence).toBeVisible();
    await expect(evidence).toContainText('BOQ line:cs-door-front · €780.00');
    await expect(evidence).toContainText('Front door threshold clearance needs trimming');
    await expect(evidence).toContainText('Envelope (lyr-envelope)');
    await expect(evidence).toContainText('Walls');
    await page.screenshot({ path: join(SHOT_DIR, 'j15-inspect-door.png'), fullPage: true });

    // -- AC 12: measurement works (the documented four-pick cadence). -----
    // The engines' own measurement affordance anchors on the first
    // measure-hinted click (a typed no-target receipt), the runtime's
    // two-pick composition ARMS on the second normalized measure receipt,
    // and the adapter's second compose cycle completes on the fourth pick
    // (the same cadence the J13 closure battery drives).
    await page.locator('[data-tool="measure"]').click();
    // Pick 1: the adapter's measurement anchor (typed no-target receipt).
    await clickEntityPointer(page, pointers, ENTITY_IDS.siteStaging);
    await expect(
      page.locator('[data-panel="journal"] li[data-journal-entry="measure"]').first(),
    ).toContainText('measurement anchor set');
    // Pick 2: the runtime's two-pick composition ARMS (typed no-apply).
    await clickEntityPointer(page, pointers, ENTITY_IDS.hvacUnit);
    await expect(
      page.locator('[data-panel="journal"] li[data-journal-entry="measure"]').first(),
    ).toContainText('measurement armed (pick the second entity)');
    // Pick 3: the adapter's SECOND anchor cycle (re-anchored on the second
    // entity; the THIRD measure journal entry).
    await clickEntityPointer(page, pointers, ENTITY_IDS.hvacUnit);
    await expect(
      page.locator('[data-panel="journal"] li[data-journal-entry="measure"]'),
    ).toHaveCount(3);
    await expect(
      page.locator('[data-panel="journal"] li[data-journal-entry="measure"]').first(),
    ).toContainText('measurement anchor set');
    // Pick 4: the composed typed measure intent (effect-only: the
    // measure-requested effect awaits its authority — FOUR entries).
    await clickEntityPointer(page, pointers, ENTITY_IDS.siteStaging);
    await expect(
      page.locator('[data-panel="journal"] li[data-journal-entry="measure"]'),
    ).toHaveCount(4);
    await expect(
      page.locator('[data-panel="journal"] li[data-effect="measure-requested"]').first(),
    ).toBeVisible();
    // The measure-state HUD carries the cadence (the live measure hint).
    await expect(page.getByTestId('cs-measure-hint')).toBeVisible();

    // -- AC 13: annotation works (a canonical revision). ------------------
    const digestBeforeAnnotation = await workspace.getAttribute('data-world-digest');
    expect(digestBeforeAnnotation).not.toBeNull();
    await page.getByTestId('annotation-input').fill('Verify riser penetration before pour');
    await page.getByTestId('annotation-submit').click();
    await expectJournal(page, 'annotate', 'applied');
    // The annotation entered the CANONICAL revision (a new world digest).
    expect(await workspace.getAttribute('data-world-digest')).not.toBe(
      digestBeforeAnnotation,
    );
    // The note renders IN the world (the annotation overlay chrome at the
    // focused entity's projected position).
    const annotationOverlay = page.locator(
      '[data-testid="cs-world-chrome"] [data-overlay-kind="annotation"]',
    );
    await expect(annotationOverlay).toBeVisible();
    await expect(annotationOverlay).toContainText('Verify riser penetration be');
    await page.screenshot({ path: join(SHOT_DIR, 'j15-annotate.png'), fullPage: true });

    // -- AC 6: orbit/pan/zoom (LAST — the navigation intents change the
    // camera the derived pointers depend on). -----------------------------
    // Focus the viewport (the reset button sits inside it; keyboard events
    // bubble to its key handler) and baseline the navigation HUD.
    await page.getByTestId('viewport-reset-camera').click();
    const hudBaseline = await hudText(page);
    // Desktop keys: Q orbits (the azimuth moves), W pans (the anchor moves).
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
    await page.screenshot({ path: join(SHOT_DIR, 'j15-navigate.png'), fullPage: true });

    // The track head is untouched by the whole journey (only user scrub
    // moves it; J16 drives the programme).
    await expect(page.getByTestId('timeline-position')).toHaveText(
      `${(TRACK.positionAtMs / 1000).toFixed(1)}s / ${(TRACK.endMs / 1000).toFixed(1)}s`,
    );
  });
});
