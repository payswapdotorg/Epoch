/**
 * J05 — Program of Work, BOQ/domain schedule and acquisition/procurement
 * (web, production build).
 *
 * The program of work builds over the sealed solution; the BOQ + domain
 * schedule folds render (quantity / cost / milestone schedules); the
 * acquisition chain grounds: quote (procurement.quote) then purchase
 * order (procurement.order) with the kernel validating every
 * cross-reference digest.
 */
import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test.describe('J05 plan / acquire', () => {
  test('the program of work + BOQ folds + the grounded procurement chain', async ({ page }) => {
    await signIn(page, 'construction');

    // -- Program of work + the schedule folds. ---------------------------
    await page.goto('/plan');
    await page.getByTestId('build-program').click();
    await expect(page.getByTestId('program-summary')).toBeVisible();
    await expect(page.getByTestId('program-summary')).toContainText('program:warehouse-extension');
    await expect(page.getByTestId('boq-quantity-table')).toBeVisible();
    expect(await page.locator('[data-testid="boq-quantity-table"] tbody tr').count()).toBeGreaterThan(0);
    await expect(page.getByTestId('cost-table')).toBeVisible();
    expect(await page.locator('[data-testid="cost-table"] tbody tr').count()).toBeGreaterThan(0);
    await expect(page.getByTestId("milestone-table")).toBeVisible();
    expect(await page.locator('[data-testid="milestone-table"] tbody tr').count()).toBeGreaterThan(0);

    // -- Acquisition: quote -> order. -------------------------------------
    await page.goto('/acquire');
    await expect(page.getByTestId('acquisition-chain')).toBeVisible();
    await page.getByTestId('request-quote').click();
    await expect(page.getByTestId('quote-success')).toBeVisible();
    await page.getByTestId('issue-order').click();
    await expect(page.getByTestId('order-success')).toBeVisible();
  });

  test('the software domain plan + acquisition (release projection)', async ({ page }) => {
    await signIn(page, 'software');
    await page.goto('/plan');
    await page.getByTestId('build-program').click();
    await expect(page.getByTestId('program-summary')).toBeVisible();
    await expect(page.getByTestId('program-summary')).toContainText('program:checkout-v2-delivery');
    await page.goto('/acquire');
    await page.getByTestId('request-quote').click();
    await expect(page.getByTestId('quote-success')).toBeVisible();
    await page.getByTestId('issue-order').click();
    await expect(page.getByTestId('order-success')).toBeVisible();
  });
});
