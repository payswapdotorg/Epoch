/**
 * J09 — Agent supervision / intervention (web, production build).
 *
 * The supervision pass evaluates the program + delivery against the
 * thresholds; findings raise alerts (the intervention signal); the agent
 * action (submitted by the delivery copilot agent) is intervened on
 * through the Action Gateway human-approval path; the developers surface
 * shows the live action stream (read-only through action.status).
 */
import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test.describe('J09 agent supervision / intervention', () => {
  test('supervision findings raise alerts and agent actions are intervened on through the Action Gateway', async ({ page }) => {
    await signIn(page, 'construction');

    // -- The agent action: submitted (by the copilot) on Decide. ----------
    await page.goto('/decide');
    await page.getByTestId('submit-action').click();
    await expect(page.getByTestId('submit-summary')).toBeVisible();

    // -- Supervision: the pass evaluates, findings raise alerts. ----------
    await page.goto('/verify');
    await page.getByTestId('run-supervision').click();
    await expect(page.getByTestId('findings-table')).toBeVisible();
    const findingCount = await page.locator('[data-testid="findings-table"] tbody tr').count();
    if (findingCount > 0) {
      await page.getByTestId('raise-alert').click();
      await expect(page.getByTestId('alert-success')).toBeVisible();
    }

    // -- Intervention: the human approves the pending agent action. -------
    await page.goto('/decide');
    await page.getByTestId('approve-action').click();
    await expect(page.getByTestId('approve-success')).toBeVisible();
    await page.getByTestId('execute-action').click();
    await expect(page.getByTestId('execute-success')).toBeVisible();

    // -- The action stream is visible (read-only) on Developers. ----------
    await page.goto('/developers');
    await expect(page.getByTestId('action-status-table')).toBeVisible();
    const rows = await page.locator('[data-testid="action-status-table"] tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
    // The stream sorts ASCENDING by action id (the Action Gateway's own
    // read-path sort; ids carry a monotonic timestamp suffix) — the
    // intervened action is the NEWEST, i.e. the LAST row. After the
    // authorized dispatch its terminal status is 'executed' (the live
    // status the authority recorded).
    await expect(page.locator('[data-testid="action-status-table"] tbody tr').last()).toContainText('executed');
  });
});
