/**
 * J10 — Developer / marketplace capability flow (web, production build).
 *
 * The marketplace entitlement check decides through the marketplace
 * authority (the deployment ledger provides grants; the kernel decides);
 * the entitled capability pack participates in capability discovery; the
 * developer surface shows the capability-contribution action stream
 * through the Action Gateway.
 */
import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test.describe('J10 developer / marketplace capability flow', () => {
  test('entitlement check -> installed capability -> discovery participation -> developer stream', async ({ page }) => {
    await signIn(page, 'construction');

    // -- Marketplace: the entitlement check through the authority. --------
    await page.goto('/marketplace');
    await expect(page.getByTestId('marketplace-listing')).toBeVisible();
    await page.getByTestId('check-entitlement').click();
    await expect(page.getByTestId('entitlement-success')).toBeVisible();
    await expect(page.getByTestId('capability-pack-table')).toBeVisible();
    await expect(page.locator('[data-testid="capability-pack-table"] tbody tr').first()).toContainText('entitled');

    // -- The entitled pack links into capability discovery (J03). --------
    await expect(page.getByTestId('discovery-link')).toBeVisible();

    // -- Developers: the contribution/approval stream. --------------------
    await page.goto('/developers');
    await expect(page.getByTestId('action-status-table')).toBeVisible();
    // No actions yet for this session: submit one through the flow.
    await page.goto('/decide');
    await page.getByTestId('submit-action').click();
    await expect(page.getByTestId('submit-summary')).toBeVisible();
    await page.goto('/developers');
    // The stream sorts ASCENDING by action id (the Action Gateway's read
    // path; ids carry a monotonic timestamp suffix) — the action just
    // submitted is the NEWEST, i.e. the LAST row, and its live status is
    // the authority's own vocabulary ('awaiting-approval').
    await expect(page.locator('[data-testid="action-status-table"] tbody tr').last()).toContainText('awaiting-approval');
  });

  test('the software domain entitlement flow', async ({ page }) => {
    await signIn(page, 'software');
    await page.goto('/marketplace');
    await page.getByTestId('check-entitlement').click();
    await expect(page.getByTestId('entitlement-success')).toBeVisible();
  });
});
