// W048 — the dev-server web E2E spec: the visible desktop product UI over
// the embedded fixture-backed Application Gateway (the exact composition
// the packaged Tauri webview serves). Every assertion mirrors a journey
// step: J01 onboarding/project entry, J02 understand/reconstruct, J07
// offline queueing/reconnect/drain, and the construction/software domain
// switch (a fresh product root per domain).
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // The product composes on mount (fixture load + digest verification +
  // embedded gateway construction): wait for the session bar.
  await expect(page.getByRole('banner')).toBeVisible({ timeout: 60_000 });
});

test('J01 — the app loads and onboards into an active session', async ({ page }) => {
  await expect(page.getByText('Epoch Desktop')).toBeVisible();

  // Pre-authentication: the honest empty state.
  await expect(page.getByText(/Authenticate to begin/i).first()).toBeVisible();

  // Authenticate: the session bar flips to active.
  await page.getByRole('button', { name: /^Authenticate$/ }).click();
  await expect(page.getByLabel('Session state')).toContainText('active', { timeout: 60_000 });
  await expect(page.getByLabel('Session state')).toContainText('principal:');
  await expect(page.getByLabel('Session state')).toContainText('embedded');
});

test('J01 — project entry resolves the registry-verified world digest', async ({ page }) => {
  await page.getByRole('button', { name: /^Authenticate$/ }).click();
  await expect(page.getByLabel('Session state')).toContainText('active', { timeout: 60_000 });

  // The J01 section is the initial screen: enter the project.
  await page.getByRole('button', { name: /^Enter project$/ }).click();
  await expect(page.getByText('world digest matches the fixture registry')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('node kind')).toBeVisible();
});

test('J02 — understand/reconstruct inspects the world entities', async ({ page }) => {
  await page.getByRole('button', { name: /^Authenticate$/ }).click();
  await expect(page.getByLabel('Session state')).toContainText('active', { timeout: 60_000 });

  await page.getByRole('button', { name: /Understand/ }).click();
  await page.getByRole('button', { name: /^Inspect world$/ }).click();
  await expect(page.getByText(/^World entities \(\d+\)$/)).toBeVisible({ timeout: 60_000 });
});

test('J07 — offline: enqueue, reconnect, drain with exactly-once semantics', async ({ page }) => {
  await page.getByRole('button', { name: /^Authenticate$/ }).click();
  await expect(page.getByLabel('Session state')).toContainText('active', { timeout: 60_000 });

  await page.getByRole('button', { name: /Offline/ }).click();

  // Go offline: the state badge flips and Go online enables.
  await page.getByRole('button', { name: /^Go offline$/ }).click();
  await expect(page.getByRole('button', { name: /^Go online$/ })).toBeEnabled({ timeout: 30_000 });

  // Enqueue the sample observation: a PENDING projection appears.
  await page.getByRole('button', { name: /^Enqueue sample observation$/ }).click();
  await expect(page.getByText('1 pending')).toBeVisible({ timeout: 30_000 });

  // Reconnect + drain: the queue empties through the gateway.
  await page.getByRole('button', { name: /^Go online$/ }).click();
  await expect(page.getByRole('button', { name: /^Go offline$/ })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole('button', { name: /^Drain queue$/ }).click();
  await expect(page.getByText('no pending intents', { exact: true })).toBeVisible({ timeout: 60_000 });
});

test('the domain switch rebuilds the product over the software fixtures', async ({ page }) => {
  await page.getByRole('button', { name: /^Authenticate$/ }).click();
  await expect(page.getByLabel('Session state')).toContainText('active', { timeout: 60_000 });

  // Switch to the software domain: a FRESH product root composes over the
  // software fixtures (a fresh session is required — the honest J11 path).
  await page.getByRole('button', { name: /^Software$/ }).click();
  await expect(page.getByText(/Authenticate to begin/i).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: /^Authenticate$/ }).click();
  await expect(page.getByLabel('Session state')).toContainText('active', { timeout: 60_000 });

  await page.getByRole('button', { name: /^Enter project$/ }).click();
  await expect(page.getByText('world digest matches the fixture registry')).toBeVisible({ timeout: 60_000 });
});
