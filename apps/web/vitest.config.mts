import { defineConfig } from 'vitest/config';

// W014: the web app shell's vitest wiring (repo convention: per-package
// vitest.config.mts, node environment). Tests live co-located inside the
// W014-owned trees (`app/**`, `src/shell/**`, `src/shared/**`).
//
// - `environment: 'node'` — the shell's tests exercise typed contracts and
//   server-render markup via `react-dom/server`; no DOM emulator is in the
//   frozen dependency catalog, and none is needed.
// - `oxc.jsx: 'react-jsx'` — the app tsconfig keeps Next's `jsx:
//   'preserve'`, which a JS transformer cannot execute; the automatic
//   React runtime is used for tests only (Vite 8 transforms with Oxc).
// - W050: the qa/cross-platform harness zone rides this config (the
//   harness owns apps/web as the canonical client, so its tests execute
//   under apps/web's vitest exactly like qa/desktop rides apps/desktop).
//   The globalSetup link script creates the harness's node_modules symlink
//   after a fresh install (idempotent, gitignored, CI-safe).
// - W052: the qa/production journey harness (the P01-P18 production
//   journeys against a BASE_URL deployment) rides this config too. The
//   suite skips itself unless EPOCH_PRODUCTION_BASE_URL/BASE_URL is set,
//   so the hermetic battery never depends on a deployment.
export default defineConfig({
  oxc: { jsx: 'react-jsx' },
  test: {
    environment: 'node',
    include: ['app/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}', 'qa/**/*.test.ts', '../../qa/cross-platform/*.test.ts'],
    globalSetup: ['./scripts/link-cross-harness.mjs'],
  },
});
