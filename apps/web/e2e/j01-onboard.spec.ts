/**
 * J01 — Onboard / project entry (web, production build).
 *
 * A fresh user (clean browser profile) enters Epoch: picks the fixture
 * environment, authenticates as a registered principal, and reaches the
 * project context + the lifecycle navigator (the Solution Navigator).
 * Both fixture domains are covered (construction + software).
 */
import { test, expect } from '@playwright/test';
import { anchorsOf, signIn } from './helpers';

test.describe('J01 onboard / project entry', () => {
  test('fresh user reaches the project and the navigator (construction)', async ({ page }) => {
    await signIn(page, 'construction');
    await expect(page.getByTestId('project-summary')).toContainText('tenant:nordstrand');
    await expect(page.getByTestId('project-summary')).toContainText('Warehouse extension (steel frame)');
    // The navigator links every lifecycle stage.
    for (const stage of ['understand', 'decide', 'plan', 'acquire', 'realize', 'observe', 'verify', 'forecast', 'close', 'learn']) {
      await expect(page.locator(`[data-stage-link="${stage}"]`)).toBeVisible();
    }
    // The authoritative world digest matches the committed fixture anchor.
    const digest = await page.getByTestId('digest').first().getAttribute('title');
    expect(digest).toContain(anchorsOf('construction').worldDigest);
  });

  test('fresh user reaches the project and the navigator (software)', async ({ page }) => {
    await signIn(page, 'software');
    await expect(page.getByTestId('project-summary')).toContainText('tenant:lightspeed');
    for (const stage of ['understand', 'decide', 'plan', 'acquire']) {
      await expect(page.locator(`[data-stage-link="${stage}"]`)).toBeVisible();
    }
    const digest = await page.getByTestId('digest').first().getAttribute('title');
    expect(digest).toContain(anchorsOf('software').worldDigest);
  });

  test('sign-out returns to the entry surface (recoverable state)', async ({ page }) => {
    await signIn(page, 'construction');
    await page.getByTestId('sign-out').click();
    await expect(page.getByTestId('sign-in')).toBeVisible();
  });
});
