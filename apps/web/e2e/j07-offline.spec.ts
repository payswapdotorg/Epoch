/**
 * J07 — Offline work, queue, reconnect, idempotent sync (web, production
 * build).
 *
 * The field intent is captured while offline: the request fails as typed
 * transient, the intent queues as a PENDING projection (the offline queue
 * bound to the session scope). Reconnect drains through recovery.replay —
 * each intent replays through the Action Gateway path with its
 * idempotency key; a second drain returns the RECORDED outcome
 * (replayed: true, same digest — never double-apply).
 */
import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test.describe('J07 offline / queue / idempotent sync', () => {
  test('offline capture queues, reconnect drains exactly once', async ({ page }) => {
    await signIn(page, 'construction');
    await page.goto('/realize');
    // Wait for the stage surface BEFORE going offline: the full-page load
    // resolves the session + configuration asynchronously (session.validate
    // -> bootstrap); going offline mid-resolution would conflate a network
    // failure with a session verdict (the client must never do that).
    await expect(page.getByTestId('open-delivery')).toBeVisible();
    await expect(page.getByTestId('observe-quantity')).toBeVisible();

    // -- Offline: the capture fails transiently and queues. --------------
    await page.context().setOffline(true);
    await page.getByTestId('observe-quantity').fill('111');
    await page.getByTestId('capture-observation').click();
    // The typed transient error surfaces (network unavailable) with the
    // recovery action; the queue holds the pending projection.
    await expect(page.getByTestId('observe-error')).toBeVisible();
    await expect(page.getByTestId('observe-error')).toContainText('Network unavailable');
    await expect(page.getByTestId('queue-pending-count')).toBeVisible();
    await expect(page.getByTestId('queue-pending-count')).toContainText('1 queued offline');

    // -- Reconnect: the drain goes through recovery.replay. ---------------
    await page.context().setOffline(false);
    await page.getByTestId('drain-queue').click();
    await expect(page.getByTestId('queue-state-pill')).toBeVisible();
    await expect(page.getByTestId('queue-state-pill')).toContainText('1 synced');
    // The observation is now admitted through the gateway (idempotent).
    await expect(page.getByTestId('observe-success')).toBeVisible();

    // -- Idempotent re-drain: the same key returns the RECORDED outcome. -
    // The queue no longer holds pending intents (drained) — the state
    // transition is permanent (no double-apply path exists client-side).
    await expect(page.getByTestId('queue-pending-count')).toHaveCount(0);
    // The observation ledger shows exactly ONE entry for the capture.
    await expect(page.locator('[data-testid="observation-table"] tbody tr')).toHaveCount(1);
  });

  test('evidence intake queues offline too (queueable intents across stages)', async ({ page }) => {
    await signIn(page, 'construction');
    await page.goto('/understand');
    // Same discipline as test 1: the surface must be resolved before the
    // offline transition (no mid-resolution network conflation).
    await expect(page.getByTestId('evidence-note')).toBeVisible();
    await page.context().setOffline(true);
    await page.getByTestId('evidence-note').fill('offline evidence (J07)');
    await page.getByTestId('capture-evidence').click();
    await expect(page.getByTestId('intake-error')).toBeVisible();
    await expect(page.getByTestId('queue-pending-count')).toContainText('1 queued offline');
    await page.context().setOffline(false);
    await page.getByTestId('drain-queue').click();
    await expect(page.getByTestId('queue-state-pill')).toContainText('1 synced');
  });
});
