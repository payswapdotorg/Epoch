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
export default defineConfig({
  oxc: { jsx: 'react-jsx' },
  test: {
    environment: 'node',
    include: ['app/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
});
