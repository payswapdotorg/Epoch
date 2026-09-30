/**
 * J02 — Understand / reconstruct, inspect known/unknowns, acquire
 * high-value missing information (web, production build).
 *
 * The World View resolves the authoritative digest; the knowns (entities +
 * live assertions with confidence) and the unknowns (information gaps)
 * render; a field evidence capture (evidence.intake through the gateway)
 * acquires missing information and the lookup returns the records.
 */
import { test, expect } from '@playwright/test';
import { anchorsOf, signIn } from './helpers';

test.describe('J02 understand / knowns / unknowns / evidence', () => {
  test('the world view resolves the authoritative digest + entities + unknowns, and evidence capture closes a gap', async ({ page }) => {
    await signIn(page, 'construction');
    await page.goto('/understand');
    await expect(page.getByTestId('world-digest')).toBeVisible();
    // The authoritative digest equals the committed fixture anchor. The
    // understand stage shows several digest chips; the world digest chip
    // (scoped under [data-testid="world-digest"]) carries the fixture anchor.
    const worldChip = page.getByTestId('world-digest').locator('[data-testid="digest"]');
    const worldTitle = await worldChip.getAttribute('title');
    expect(worldTitle).toContain(anchorsOf('construction').worldDigest);

    // Knowns: entities + live assertions. (All counts are the retrying
    // toHaveCount form — the stage loads world.snapshot -> world.entities
    // -> evidence.get sequentially, so later tables resolve later.)
    await expect(page.getByTestId('entity-table')).toBeVisible();
    await expect(page.locator('[data-testid="entity-table"] tbody tr')).toHaveCount(8);
    await expect(page.getByTestId('assertion-table')).toBeVisible();
    await expect(page.locator('[data-testid="assertion-table"] tbody tr')).toHaveCount(12);

    // Unknowns: the information-gap projection renders.
    await expect(page.getByTestId('unknowns-table')).toBeVisible();

    // Evidence records of the fixture subject (exactly the fixture record
    // before any capture).
    await expect(page.getByTestId('evidence-table')).toBeVisible();
    await expect(page.locator('[data-testid="evidence-table"] tbody tr')).toHaveCount(1);

    // Acquire high-value missing information: capture evidence.
    await page.getByTestId('evidence-note').fill('north strip survey received (J02)');
    await page.getByTestId('evidence-confidence').fill('0.95');
    await page.getByTestId('capture-evidence').click();
    await expect(page.getByTestId('intake-success')).toBeVisible();
    // The record is retrievable (evidence.get through the gateway): the
    // subject now holds the fixture record + the captured observation.
    await expect(page.locator('[data-testid="evidence-table"] tbody tr')).toHaveCount(2);
  });
});
