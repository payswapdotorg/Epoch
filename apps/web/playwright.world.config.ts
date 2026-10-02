import { defineConfig, devices } from '@playwright/test';

/**
 * @epoch/web — the W061 world-closure E2E configuration (ACR-007).
 *
 * Why a SECOND config (the W047 `playwright.config.ts` stays the CI
 * default, untouched): that config pins port 3100 for its webServer — in
 * THIS sandbox 3100 (with 3000/9222) belongs to the operator's replay
 * infrastructure and must never be touched, so the W061 battery runs the
 * SAME production build on the free private port 3210 through this
 * config. Same doctrine as the W047 config otherwise: production build
 * (`next build` + `next start`), one worker, no parallelism, no retries,
 * traces/screenshots retained on failure under `e2e-results/` (gitignored
 * — binary run artifacts stay local; the committed evidence is the record
 * set + the specs).
 *
 * Projects:
 * - `chromium` — the REAL browser with REAL software GL: the sandbox has
 *   no GPU, so WebGL runs over ANGLE/SwiftShader (the launch flags pin
 *   it; the spec asserts the actual renderer string). This is
 *   real-Chromium real-GL evidence — recorded exactly as software GL
 *   (SwiftShader ANGLE), never presented as a GPU run.
 * - `chromium-no-gl` — the same browser with WebGL disabled at launch:
 *   the forced-degradation leg (the engines' declared headless cores +
 *   the reference-projection fallback surface, honestly presented).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'e2e-results/world-results/results.json' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:3210',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      // ONLY the W061 closure battery: the W047 journey suite (j01-j12)
      // belongs to the W047 config's doctrine, NOT this battery. Running it
      // here too was accidental: on this 4GB sandbox the shared production
      // server accumulates in-memory sessions across the long sweep and the
      // mid-run journey legs hit their 15s expect timeouts with MOVING
      // failure sets (j08/j09/j10/j11 across runs — environmental, not
      // regressions; a fresh server passes every one, TL-verified). The
      // world battery stays deterministic and scoped.
      testMatch: /j13-world.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
    {
      name: 'chromium-no-gl',
      testMatch: /j13-world-degradation\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-webgl', '--disable-webgl2'],
        },
      },
    },
  ],
  outputDir: 'e2e-results/world-results/artifacts',
  webServer: {
    command: 'npx next start -p 3210',
    url: 'http://localhost:3210',
    reuseExistingServer: false,
    timeout: 120_000,
    cwd: __dirname,
  },
});
