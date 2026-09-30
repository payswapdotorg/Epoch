// W048 — the dev-server web E2E (Playwright) for the desktop product.
//
// What this proves: the REAL visible UI (the same view-models + product
// composition the packaged Tauri webview serves — the static-export
// frontend against the embedded fixture-backed Application Gateway) works
// end-to-end in a real browser: onboarding, project entry with the
// registry-verified world digest, world inspection, offline queueing and
// the domain switch.
//
// What it deliberately does NOT claim: the native Tauri shell itself
// (install/launch of the packaged binary) — that is the wdio + tauri-driver
// harness (wdio.desktop.conf.ts) and the recorded journey documents
// (docs/journeys/desktop-*.md).
import { defineConfig } from '@playwright/test';
import path from 'node:path';

// qa/desktop is not a workspace package (no package.json): Playwright
// transpiles this config to CommonJS when loading it, so `__dirname` (not
// import.meta) is the stable way to locate the repo tree.
const here = __dirname;
const APP_ROOT = path.resolve(here, '..', '..', 'apps', 'desktop');

export default defineConfig({
  testDir: path.resolve(here),
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4310',
    headless: true,
    trace: 'off',
  },
  webServer: {
    command: 'pnpm run dev',
    cwd: APP_ROOT,
    url: 'http://localhost:4310',
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
