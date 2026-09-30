// W048 — the WebdriverIO harness for the PACKAGED Tauri application.
//
// How this runs on a provisioned machine (the documented journey protocol):
//   1. build the webview:  cd apps/desktop && pnpm run build:web
//   2. build the native binary + bundles:
//        pnpm run tauri:build:linux   (AppImage + deb)
//        pnpm run tauri:build:windows (NSIS)
//        pnpm run tauri:build:macos   (DMG + .app)
//   3. start tauri-driver (the WebDriver implementation for the Tauri
//      webview; port 4444), then run this config from apps/desktop:
//        pnpm run e2e:tauri
//
// tauri-driver drives the REAL packaged webview (WebKitGTK on Linux,
// WebView2 on Windows, WKWebView on macOS) over the WebDriver protocol —
// the same visible-UI journeys the Playwright dev-server spec asserts,
// executed against the packaged binary.
//
// ENVIRONMENT HONESTY (this machine): no cargo/rustc/webkit2gtk toolchain
// — the packaged binary cannot be built here. This config is delivered
// config-complete; the journeys over the packaged app are recorded in
// docs/journeys/desktop-{linux,windows,macos}.md with the environment
// audit, and the product-logic layer of the SAME journeys runs headlessly
// green (apps/desktop/test/desktop-journeys.test.ts, J01-J09/J11/J12 x 2
// domains) plus the dev-server web E2E (qa/desktop/e2e/, chromium).
import path from 'node:path';
import type { Options } from 'webdriverio';

const here = __dirname;
const APP_ROOT = path.resolve(here, '..', '..', 'apps', 'desktop');
const LINUX_BINARY = path.join(APP_ROOT, 'src-tauri', 'target', 'release', 'epoch-desktop');
const WINDOWS_BINARY = path.join(APP_ROOT, 'src-tauri', 'target', 'release', 'epoch-desktop.exe');
const MACOS_BINARY = path.join(
  APP_ROOT,
  'src-tauri',
  'target',
  'release',
  'bundle',
  'macos',
  'Epoch.app',
  'Contents',
  'MacOS',
  'Epoch',
);

/** The packaged binary for the current platform. */
function applicationForPlatform(): string {
  switch (process.platform) {
    case 'linux':
      return LINUX_BINARY;
    case 'win32':
      return WINDOWS_BINARY;
    case 'darwin':
      return MACOS_BINARY;
    default:
      return LINUX_BINARY;
  }
}

export const config: Options = {
  hostname: '127.0.0.1',
  port: 4444,
  path: '/',
  specs: [path.join(here, 'e2e', 'tauri.spec.ts')],
  maxInstances: 1,
  capabilities: [
    {
      'tauri:options': {
        application: applicationForPlatform(),
      },
    } as Options['capabilities'],
  ],
  logLevel: 'warn',
  waitforTimeout: 30_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 2,
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 120_000,
  },
  reporters: ['spec'],
};
