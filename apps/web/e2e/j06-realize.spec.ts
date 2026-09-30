/**
 * J06 — Realize, field observation, actualization, verification and
 * forecast (web, production build).
 *
 * The delivery record opens over the sealed solution; the field
 * observation captures against the program anchor; the rolling forecast
 * (actualization) projects completion; the supervision pass runs; the
 * verification chain validates; the alert raises on a finding; the
 * outcome registers (learn) and the delivery closes.
 */
import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test.describe('J06 realize / observe / verify / forecast', () => {
  test('delivery open -> field observation -> forecast -> supervision -> alert -> learn -> close', async ({ page }) => {
    await signIn(page, 'construction');

    // -- Realize: open the delivery + capture the field observation. -----
    await page.goto('/realize');
    await page.getByTestId('open-delivery').click();
    await expect(page.getByTestId('delivery-summary')).toBeVisible();
    await expect(page.getByTestId('delivery-summary')).toContainText('open');
    await page.getByTestId('observe-quantity').fill('118.5');
    await page.getByTestId('capture-observation').click();
    await expect(page.getByTestId('observe-success')).toBeVisible();
    await expect(page.getByTestId('observation-table')).toBeVisible();
    await expect(page.locator('[data-testid="observation-table"] tbody tr')).toHaveCount(1);

    // -- Observe/Actualize: the rolling forecast. -------------------------
    await page.goto('/observe');
    await page.getByTestId('actuals-value').fill('40');
    await page.getByTestId('factor-value').fill('1.1');
    await page.getByTestId('roll-forecast').click();
    await expect(page.getByTestId('forecast-summary')).toBeVisible();
    await expect(page.getByTestId('forecast-summary')).toContainText('Remaining');
    await expect(page.getByTestId('forecast-summary')).toContainText('At completion');

    // -- Verify: the chain + the supervision pass + the alert. ------------
    await page.goto('/verify');
    await page.getByTestId('verify-chain').click();
    await expect(page.getByTestId('verify-success')).toBeVisible();
    await page.getByTestId('run-supervision').click();
    await expect(page.getByTestId('findings-table')).toBeVisible();
    const findings = await page.locator('[data-testid="findings-table"] tbody tr').count();
    if (findings > 0) {
      await page.getByTestId('raise-alert').click();
      await expect(page.getByTestId('alert-success')).toBeVisible();
    }

    // -- Learn + Close. ----------------------------------------------------
    await page.goto('/learn');
    await page.getByTestId('register-outcome').click();
    await expect(page.getByTestId('learn-success')).toBeVisible();
    await page.goto('/close');
    await page.getByTestId('close-delivery').click();
    await expect(page.getByTestId('close-summary')).toBeVisible();
    await expect(page.getByTestId('close-summary')).toContainText('closed');
  });

  test('the software domain realize + forecast (release projection)', async ({ page }) => {
    await signIn(page, 'software');
    await page.goto('/realize');
    await page.getByTestId('open-delivery').click();
    await expect(page.getByTestId('delivery-summary')).toBeVisible();
    await page.getByTestId('observe-quantity').fill('3');
    await page.getByTestId('capture-observation').click();
    await expect(page.getByTestId('observe-success')).toBeVisible();
    await page.goto('/observe');
    await page.getByTestId('roll-forecast').click();
    await expect(page.getByTestId('forecast-summary')).toBeVisible();
    await page.goto('/verify');
    await page.getByTestId('verify-chain').click();
    await expect(page.getByTestId('verify-success')).toBeVisible();
  });
});
