import { defineConfig, devices } from '@playwright/test';

/**
 * @epoch/web — the browser E2E configuration (W047).
 *
 * E2E location decision (Work Order pin 5): the browser journey suite
 * lives under `apps/web/e2e/` — apps/web is the workspace package that
 * owns the playwright toolchain (qa/ is outside the pnpm workspace globs,
 * so a qa/web package could not resolve workspace/catalog deps). The
 * journey RECORDS + artifacts live in qa/web/ (the owned evidence
 * surface); docs/journeys/web.md documents the contract.
 *
 * Journeys run against the PRODUCTION build (`next build && next start`)
 * — never dev mode; the build mode is recorded in every journey record.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e-results/results.json' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  outputDir: 'e2e-results/artifacts',
  webServer: {
    command: 'npx next start -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 120_000,
    cwd: __dirname,
  },
});
