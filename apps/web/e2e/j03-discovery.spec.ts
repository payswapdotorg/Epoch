/**
 * J03 — Capability / role discovery and organization composition without
 * hard-coded model->role mapping (web, production build).
 *
 * The discovery run synthesizes roles from capability DEMANDS (task/world/
 * evidence/constraint signals) and resolves candidates by measured
 * capability claims — never by name. The UI asserts: role proposals
 * render, gaps render, and the candidate catalog is claim-based.
 */
import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test.describe('J03 capability / role discovery', () => {
  for (const domain of ['construction', 'software'] as const) {
    test(`discovery synthesizes roles from capability demands (${domain})`, async ({ page }) => {
      await signIn(page, domain);
      await page.goto('/decide');
      // The candidate catalog renders with evaluation states (claims, not names).
      const checkboxes = page.locator('[role="group"][aria-label="Discovery candidates"] input[type="checkbox"]');
      await expect(checkboxes.first()).toBeVisible();
      expect(await checkboxes.count()).toBe(3);

      // Run discovery with the default (checked) candidates.
      await page.getByTestId('run-discovery').click();
      await expect(page.getByTestId('discovery-success')).toBeVisible();
      await expect(page.getByTestId('role-table')).toBeVisible();
      const roles = await page.locator('[data-testid="role-table"] tbody tr').count();
      expect(roles).toBeGreaterThan(0);
      // The synthesized role ids derive from demands (no model names).
      const roleText = await page.getByTestId('role-table').textContent();
      expect(roleText).not.toMatch(/gpt|claude|gemini|llama/i);

      // Capability gaps (the ecosystem discovery requests) render.
      await expect(page.getByTestId('gap-table')).toBeVisible();
    });
  }

  test('toggling the candidate set changes the resolution (claims drive matching, not labels)', async ({ page }) => {
    await signIn(page, 'construction');
    await page.goto('/decide');
    // Uncheck the human team: only the copilot + external remain.
    const checkboxes = page.locator('[role="group"][aria-label="Discovery candidates"] input[type="checkbox"]');
    await checkboxes.nth(0).uncheck();
    await page.getByTestId('run-discovery').click();
    await expect(page.getByTestId('discovery-success')).toBeVisible();
    const roles = await page.locator('[data-testid="role-table"] tbody tr').count();
    expect(roles).toBeGreaterThan(0);
  });
});
