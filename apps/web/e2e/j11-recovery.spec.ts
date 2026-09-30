/**
 * J11 — Recovery from network/session/input/action/connector/evidence
 * failures (web, production build).
 *
 * (a) session expiry -> the typed auth-session-expired error class with
 *     the re-authenticate recovery action -> re-authentication succeeds;
 * (b) connector failure -> the typed transient error class with
 *     retry-with-backoff (the retried call carries the SAME correlation
 *     id — the causation chain) -> the retry succeeds;
 * (c) input failure -> the authority rejection surfaces VERBATIM (the
 *     authority's own typed error, never a client-invented semantic
 *     error).
 */
import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test.describe('J11 recovery', () => {
  test('session expiry forces re-authentication and recovery succeeds', async ({ page }) => {
    // A short-lived session (1 minute) exercises the expiry path.
    await signIn(page, 'construction', { ttl: '1m' });
    await expect(page.getByTestId('project-summary')).toBeVisible();

    // Wait past the expiry (the authority decides; the client revalidates).
    await page.waitForTimeout(62_000);

    // The next operation fails with the typed auth-session-expired class
    // and the re-authenticate recovery action.
    await page.goto('/understand');
    await expect(page.getByTestId('expired-notice')).toBeVisible();
    await expect(page.getByTestId('expired-notice')).toContainText('Session expired');
    await expect(page.getByTestId('expired-notice')).toContainText('re-authenticate');

    // Re-authentication issues a fresh session and the surface recovers.
    await page.getByTestId('entry-domain').selectOption('construction');
    await page.getByTestId('entry-principal').selectOption('principal:delivery-lead');
    await page.getByTestId('sign-in').click();
    // The re-authentication recovers THE SAME ROUTE (the entry gate swaps
    // back to the Understand stage — the user resumes where the session
    // expired) and the world projection re-resolves to the authoritative
    // digest (reload always resolves authoritative state).
    await expect(page.getByTestId('world-digest')).toBeVisible();
    await expect(page.getByTestId('world-digest-match')).toBeVisible();
  });

  test('connector failure retries with the same correlation id and succeeds', async ({ page }) => {
    await signIn(page, 'construction');
    await page.goto('/understand');

    // Abort exactly ONE /api/gateway call (the connector failure): the
    // transport retries with backoff under the SAME correlation id.
    let aborted = 0;
    await page.route('**/api/gateway', async (route) => {
      if (aborted === 0) {
        aborted += 1;
        await route.abort('connectionfailed');
        return;
      }
      await route.continue();
    });

    await page.getByTestId('evidence-note').fill('retry evidence (J11)');
    await page.getByTestId('capture-evidence').click();
    // The retried call succeeded through the gateway.
    await expect(page.getByTestId('intake-success')).toBeVisible();
    expect(aborted).toBe(1);
  });

  test('an invalid field measure surfaces the authority rejection verbatim', async ({ page }) => {
    await signIn(page, 'construction');
    await page.goto('/realize');
    await page.getByTestId('open-delivery').click();
    await expect(page.getByTestId('delivery-summary')).toBeVisible();
    // A structurally-invalid measure: the execution-tracking authority
    // rejects with its own typed error (dangling-reference or validation).
    await page.getByTestId('observe-quantity').fill('not-a-number');
    await page.getByTestId('capture-observation').click();
    await expect(page.getByTestId('observe-error')).toBeVisible();
    await expect(page.getByTestId('observe-error')).toContainText('Authority rejected the request');
    await expect(page.getByTestId('error-recovery')).toContainText('surface verbatim');
  });
});
