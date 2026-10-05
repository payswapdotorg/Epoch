/**
 * J17 — The TEAM + COST + RISK journey (W072, ACR-012): working the
 * construction solution with the site team and the commercial lens — the
 * agents present in the world (and the camera that follows them), the
 * BOQ/cost surface cross-highlighted BIDIRECTIONALLY with the world, the
 * constraints/findings explored spatially (the hidden MEP clash becomes
 * discoverable IN the world), and the solution variants compared THROUGH
 * the world (selecting a variant changes the world representation — never
 * a table-only comparison).
 *
 * Acceptance mapping (the W072 work order's 20 criteria):
 *  AC 14 — agents are visible inside the world (≥2 fixture agents: the
 *           presence rail + the world markers in 3D AND on the plan)
 *  AC 15 — agent follow works (the typed follow-agent intent: the camera
 *           mode switches, the presence flags, the agent's task inspects,
 *           and its current-work element highlights in the world)
 *  AC 17 — BOQ/cost can be explored from the world (the per-layer rollups
 *           + subtotal → contingency → total; BOQ line → selects its world
 *           entity; world pick → reveals its BOQ line — bidirectional,
 *           persistent until cleared)
 *  AC 18 — constraints/findings can be explored from the world (the ✓/⚠
 *           records; selecting the MEP-clash ⚠ focuses its elements AND
 *           reveals the hidden owning layer — the clash source becomes
 *           spatially discoverable)
 *  AC 19 — solution variants can be compared through the world (Current /
 *           Alt A / Alt B with cost/days/risk; selecting Alt A issues the
 *           typed branch intent and REMOVES the clash source from the
 *           world + moves the rerouted duct; Alt B ADDS the interior AHU —
 *           the world representation itself changes)
 *
 * The honest pick basis: the plan picks target the positions the plan
 * canvas itself hit-tests — derived in this test process from the SAME
 * frozen presentation projection (`presentedEntities` +
 * `planProjectorFor` + `planEntityAt`), then mapped through the same
 * letterbox-aware content-box math the canvas' pointer handler uses.
 *
 * Environment (recorded exactly, never fabricated): the production build
 * (`next start` on the free suite port 3100) under Playwright / Chromium
 * with REAL software GL (ANGLE SwiftShader — this sandbox has no GPU; J14
 * pins the renderer string).
 */
import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import {
  BOQ_ROLLUPS,
  BOQ_TOTAL,
  PLAN_VIEW,
  boqEstimate,
  formatEur,
  planEntityAt,
  planProjectorFor,
  planRectOf,
  presentedConstraints,
  presentedEntities,
} from '../src/features/world/construction-solution';
import { CS } from '../src/features/world/construction-tokens';
import { AGENT_IDS, ENTITY_IDS, MARKER_IDS } from '../src/features/world/host/world-fixture';

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

/** The flattened BOQ line count (the frozen per-layer rollups' fold). */
const BOQ_LINE_COUNT = BOQ_ROLLUPS.reduce((count, rollup) => count + rollup.lineItems.length, 0);

/** The findings count under the Current variant (fixture records + the
 * variant's own constraint notes — the inspector's own fold). */
const FINDINGS_COUNT = presentedConstraints('variant-current').length;

/**
 * The page-space center of one entity's PLAN footprint (the same projector
 * + hit-test + letterbox-aware mapping the plan canvas uses; fails when
 * the point would hit anything but the target entity).
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
 * One entity's plan footprint rect as the PAGE renders it (the SVG rect's
 * viewBox-space attributes — the same space planRectOf projects into).
 */
async function pagePlanRectOf(page: Page, entityId: string): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  return page.locator(`[data-cs-plan-entity="${entityId}"] rect`).first().evaluate((el) => {
    const rect = el as SVGRectElement;
    return {
      x: Number(rect.getAttribute('x')),
      y: Number(rect.getAttribute('y')),
      width: Number(rect.getAttribute('width')),
      height: Number(rect.getAttribute('height')),
    };
  });
}

/** The plan footprint rect of one entity under one variant (in-test fold). */
function expectedPlanRectOf(entityId: string, variantId: 'variant-current' | 'variant-alt-a') {
  const entities = presentedEntities(variantId);
  const entity = entities.find((candidate) => candidate.geometry.entityId === entityId);
  if (entity === undefined) {
    throw new Error(`the frozen fixture does not present ${entityId} under ${variantId}`);
  }
  return planRectOf(entity, planProjectorFor(entities));
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

test.describe('J17 the team + cost + risk journey (W072)', () => {
  test('ACs 14-15 + 17-19 — agents, BOQ cross-highlight, findings focus, variants through the world', async ({
    page,
  }) => {
    test.setTimeout(420_000);
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
    const presence = page.locator('[data-panel="presence"]');

    // -- AC 14: agents are visible inside the world. ----------------------
    // The presence rail names both fixture agents with their live tasks.
    await expect(
      presence.locator(`li[data-presence-agent="${AGENT_IDS.structuralEngineer}"]`),
    ).toBeVisible();
    await expect(
      presence.locator(`li[data-presence-agent="${AGENT_IDS.siteCoordinator}"]`),
    ).toBeVisible();
    await expect(presence.locator('li[data-presence-agent]')).toHaveCount(2);
    // …and they are IN the world: the 3D chrome carries the projected
    // presence markers (labels at their interpolated positions).
    await expect(
      page.locator('[data-testid="cs-world-chrome"] [data-cs-agent]').first(),
    ).toBeVisible();
    // …and the PLAN presentation carries BOTH agents at their world
    // positions (the true top-down world, the same agents).
    await page.getByTestId('cs-mode-plan').click();
    await expect(
      page.locator(`[data-testid="cs-plan-canvas"] [data-cs-agent="${AGENT_IDS.structuralEngineer}"]`),
    ).toBeVisible();
    await expect(
      page.locator(`[data-testid="cs-plan-canvas"] [data-cs-agent="${AGENT_IDS.siteCoordinator}"]`),
    ).toBeVisible();
    await page.getByTestId('cs-mode-3d').click();

    // -- AC 15: agent follow works (the camera follows the agent). --------
    await page.getByTestId(`follow-${AGENT_IDS.structuralEngineer}`).click();
    await expectJournal(page, 'follow-agent', 'applied');
    // The camera record switched to the agent (the HUD names the mode).
    await expect(page.locator('[data-viewport-hud]')).toContainText('follow-agent');
    await expect(
      presence.locator(`li[data-presence-agent="${AGENT_IDS.structuralEngineer}"]`),
    ).toHaveAttribute('data-agent-followed', 'true');
    // The agent's task inspects (the agent card) with its current-work
    // element — and that element highlights IN the world (the agent →
    // world cross-selection, persistent like every cross-selection).
    await page.getByTestId(`agent-inspect-${AGENT_IDS.structuralEngineer}`).click();
    const agentCard = page.getByTestId('cs-agent-card');
    await expect(agentCard).toBeVisible();
    await expect(agentCard).toContainText('A. Reyes — Structural Engineer');
    await expect(agentCard).toContainText('Inspecting column COL-04 (SE) rebar fixings before concrete pour.');
    await expect(agentCard).toContainText('COL-04');
    await page.getByTestId('cs-agent-card-work').click();
    // The current-work element is selected (the canonical identity).
    await expect(workspace).toHaveAttribute('data-selected-entity', ENTITY_IDS.column04);
    // The cross-highlight names the agent cause (the BOQ tab's chip — the
    // cross-selection state is shared across the whole workspace).
    await page.getByTestId('cs-inspector-tab-boq').click();
    await expect(page.getByTestId('cs-cross-highlight')).toHaveAttribute('data-source', 'agent');
    await expect(page.getByTestId('cs-cross-highlight')).toContainText(
      `agent current-work · ${ENTITY_IDS.column04}`,
    );
    // The world side: the current-work element carries the selection
    // stroke on the plan (the engineer's column).
    await page.getByTestId('cs-mode-plan').click();
    await expect(
      page.locator(`[data-cs-plan-entity="${ENTITY_IDS.column04}"] rect`).first(),
    ).toHaveAttribute('stroke', CS.selection);
    // Closing the agent card returns to the element inspector (the
    // cross-highlight persists by contract until cleared/replaced).
    await page.getByTestId('cs-inspector-tab-inspect').click();
    await page.getByTestId('cs-agent-card-close').click();
    await expect(page.getByTestId('cs-inspect-card')).toBeVisible();
    await expect(page.locator('[data-inspect="entityId"]')).toHaveText(ENTITY_IDS.column04);
    await page.screenshot({ path: join(SHOT_DIR, 'j17-agent-follow.png'), fullPage: true });

    // -- AC 17: BOQ/cost explored from the world (bidirectional). ---------
    await page.getByTestId('cs-inspector-tab-boq').click();
    // The per-layer rollups (the six construction layers) + the estimate
    // fold (subtotal → contingency → total) + the authoritative fixture
    // grand total — the frozen fixture's own values, never a second ledger.
    for (const rollup of BOQ_ROLLUPS) {
      await expect(page.getByTestId(`cs-boq-rollup-${rollup.layerId}`)).toBeVisible();
      await expect(page.getByTestId(`cs-boq-rollup-${rollup.layerId}`)).toContainText(
        formatEur(rollup.subtotal.amount),
      );
    }
    await expect(page.getByTestId('cs-boq-total')).toHaveText(formatEur(boqEstimate().total));
    await expect(page.getByTestId('cs-boq-fixture-total')).toContainText(
      formatEur(BOQ_TOTAL.amount),
    );
    // [View BOQ] opens the line items (every identity-mapped line).
    await page.getByTestId('cs-boq-toggle').click();
    await expect(page.locator('[data-testid="cs-boq-line"]')).toHaveCount(BOQ_LINE_COUNT);
    // BOQ → world: one line selects + highlights ITS world entity.
    await page
      .locator(`[data-testid="cs-boq-line"][data-cs-boq-entity="${ENTITY_IDS.hvacUnit}"]`)
      .click();
    await expect(page.getByTestId('cs-cross-highlight')).toHaveAttribute('data-source', 'boq');
    await expect(page.getByTestId('cs-cross-highlight')).toContainText(
      `BOQ → world · ${ENTITY_IDS.hvacUnit}`,
    );
    await expect(workspace).toHaveAttribute('data-selected-entity', ENTITY_IDS.hvacUnit);
    // …the world side (the plan carries the selection stroke on the line's
    // entity — the roof-top HVAC unit).
    await expect(
      page.locator(`[data-cs-plan-entity="${ENTITY_IDS.hvacUnit}"] rect`).first(),
    ).toHaveAttribute('stroke', CS.selection);
    // World → BOQ: a REAL plan pick of the staging yard reveals its line.
    const staging = await planPointOf(page, ENTITY_IDS.siteStaging);
    await page.mouse.click(staging.x, staging.y);
    await expect(workspace).toHaveAttribute('data-selected-entity', ENTITY_IDS.siteStaging);
    await expect(page.getByTestId('cs-cross-highlight')).toHaveAttribute('data-source', 'world');
    await expect(page.getByTestId('cs-cross-highlight')).toContainText('world → BOQ');
    await expect(
      page.locator(`[data-testid="cs-boq-line"][data-cs-boq-entity="${ENTITY_IDS.siteStaging}"]`),
    ).toHaveAttribute('data-cross-highlighted', 'true');
    // The persistence contract's explicit exit: Clear.
    await page.getByTestId('cs-clear-highlight').click();
    await expect(page.getByTestId('cs-cross-highlight')).toHaveAttribute('data-source', 'none');
    await page.screenshot({ path: join(SHOT_DIR, 'j17-boq.png'), fullPage: true });

    // -- AC 18: constraints/findings explored from the world. -------------
    await page.getByTestId('cs-inspector-tab-findings').click();
    // The ✓/⚠ records (the frozen fixture's six findings + the variant's
    // own constraint notes — the inspector's own fold).
    await expect(page.locator('[data-testid="cs-constraint"]')).toHaveCount(FINDINGS_COUNT);
    const clash = page.locator(
      '[data-testid="cs-constraint"][data-constraint-id="W071-finding-002"]',
    );
    await expect(clash).toHaveAttribute('data-severity', 'warn');
    await expect(clash).toContainText('MEP clash');
    // The SPATIAL DISCOVERY setup: isolate a non-MEP layer so every MEP
    // entity leaves the world (the typed filter intent)…
    await page.getByTestId('layer-isolate-lyr-structure').click();
    await expectJournal(page, 'filter', 'applied');
    await expect(page.locator(`[data-cs-plan-entity="${ENTITY_IDS.hvacDuct}"]`)).toHaveCount(0);
    // …then select the ⚠ finding: it focuses its elements AND reveals the
    // hidden owning MEP layer through the typed show intent — the clash
    // (duct × riser × the hidden legacy conduit) becomes discoverable IN
    // the world, never through a table alone.
    await clash.click();
    await expectJournal(page, 'show', 'applied');
    await expect(page.locator(`[data-cs-plan-entity="${ENTITY_IDS.hvacDuct}"]`)).toBeVisible();
    await expect(page.locator(`[data-cs-plan-entity="${ENTITY_IDS.plumbingRiser}"]`)).toBeVisible();
    await expect(
      page.locator(`[data-cs-plan-entity="${ENTITY_IDS.legacyConduit}"]`),
    ).toBeVisible();
    // The focus: the finding's first element is selected, its other
    // elements carry the cross-highlight stroke in the world.
    await expect(workspace).toHaveAttribute('data-selected-entity', ENTITY_IDS.hvacDuct);
    await expect(
      page.locator(`[data-cs-plan-entity="${ENTITY_IDS.plumbingRiser}"] rect`).first(),
    ).toHaveAttribute('stroke', CS.boq);
    await page.screenshot({ path: join(SHOT_DIR, 'j17-findings.png'), fullPage: true });

    // -- AC 19: variants compared THROUGH the world (never table-only). ---
    await page.getByTestId('cs-inspector-tab-variants').click();
    // The three frozen variants with cost / days / risk…
    for (const variantId of ['variant-current', 'variant-alt-a', 'variant-alt-b']) {
      await expect(
        page.locator(`[data-testid="cs-variant"][data-variant-id="${variantId}"]`),
      ).toBeVisible();
    }
    const altA = page.locator('[data-testid="cs-variant"][data-variant-id="variant-alt-a"]');
    await expect(altA).toContainText('€43,000.00');
    await expect(altA).toContainText('58 days');
    await expect(altA).toContainText('risk low');
    await expect(altA).toContainText('2Δ · 1✕');
    // …and the programme's branch point is on the track (where they fork).
    await expect(page.locator(`[data-marker="${MARKER_IDS.branch}"]`)).toBeVisible();
    // Selecting Alt A issues the typed branch intent at the branch point
    // and CHANGES THE WORLD (the fixture's deltas apply).
    await altA.click();
    await expect(workspace).toHaveAttribute('data-variant-id', 'variant-alt-a');
    await expect(page.getByTestId('cs-variant-chip')).toHaveAttribute(
      'data-variant-id',
      'variant-alt-a',
    );
    await expect(
      page.locator('[data-panel="journal"] li[data-effect="branch-requested"]').first(),
    ).toBeVisible();
    // …the clash source is REMOVED from the world (the MEP layer is
    // revealed here — its absence is the REMOVAL, not hiddenness).
    await expect(
      page.locator(`[data-cs-plan-entity="${ENTITY_IDS.legacyConduit}"]`),
    ).toHaveCount(0);
    // …and the rerouted duct's footprint MOVED (+0.5m offset, +1.0m run):
    // the page's own rect equals the fixture-folded Alt-A geometry and
    // differs from the Current geometry.
    const pageDuct = await pagePlanRectOf(page, ENTITY_IDS.hvacDuct);
    const altADuct = expectedPlanRectOf(ENTITY_IDS.hvacDuct, 'variant-alt-a');
    const currentDuct = expectedPlanRectOf(ENTITY_IDS.hvacDuct, 'variant-current');
    expect(Math.abs(pageDuct.x - altADuct.x)).toBeLessThan(0.75);
    expect(Math.abs(pageDuct.y - altADuct.y)).toBeLessThan(0.75);
    expect(Math.abs(pageDuct.width - altADuct.width)).toBeLessThan(0.75);
    expect(
      Math.abs(pageDuct.y - currentDuct.y) + Math.abs(pageDuct.width - currentDuct.width),
    ).toBeGreaterThan(1);
    // …the 3D presentation carries the variant-delta badges (removed ✕,
    // changed ●) at the affected entities' positions.
    await page.getByTestId('cs-mode-3d').click();
    await expect(
      page.locator('[data-testid="cs-world-chrome"] [data-variant-delta="removed"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="cs-world-chrome"] [data-variant-delta="changed"]').first(),
    ).toBeVisible();
    await page.screenshot({ path: join(SHOT_DIR, 'j17-variant-alt-a.png'), fullPage: true });
    // Alt B: the split-system — a NEW entity appears in the world.
    await page.getByTestId('cs-mode-plan').click();
    await page
      .locator('[data-testid="cs-variant"][data-variant-id="variant-alt-b"]')
      .click();
    await expect(workspace).toHaveAttribute('data-variant-id', 'variant-alt-b');
    const ahu = page.locator('[data-cs-plan-entity="cs-mep-hvac-ahu-interior"]');
    await expect(ahu).toBeVisible();
    // The ADDED-entity presentation: the footprint + its success ring.
    await expect(ahu.locator('rect')).toHaveCount(2);
    await expect(ahu.locator('rect').nth(1)).toHaveAttribute('stroke', CS.success);
    await page.screenshot({ path: join(SHOT_DIR, 'j17-variant-alt-b.png'), fullPage: true });
    // Back to Current: the world returns to the baseline (the conduit —
    // its layer still revealed — is back in the world).
    await page
      .locator('[data-testid="cs-variant"][data-variant-id="variant-current"]')
      .click();
    await expect(workspace).toHaveAttribute('data-variant-id', 'variant-current');
    await expect(
      page.locator(`[data-cs-plan-entity="${ENTITY_IDS.legacyConduit}"]`),
    ).toBeVisible();
    await page.screenshot({ path: join(SHOT_DIR, 'j17-variant-current.png'), fullPage: true });
  });
});
