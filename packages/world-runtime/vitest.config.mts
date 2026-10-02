import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// W057: the world runtime's own unit battery plus the qa/world-experience
// harness (the W056 qa/renderer-conformance precedent: an out-of-workspace
// harness wired through its owning package — pnpm-workspace.yaml is
// frozen). The globalSetup link script creates the harness's node_modules
// symlink after a fresh install (idempotent, gitignored, CI-safe).
//
// `oxc.jsx.runtime: 'automatic'` — the harness's web-driver-parity battery
// renders the REAL apps/web workspace component (react-dom/server, exactly
// like the web app's own tests). The bare 'react' / 'react-dom/server'
// imports of the HARNESS files (which live outside apps/web's node_modules
// chain) are aliased to the web app's installed copies; the component files
// inside apps/web resolve their own imports through their real paths
// (the same copy — no dual-instance hazard). The cold type-check maps the
// same specifiers to @types in the harness tsconfig (see
// qa/world-experience/tsconfig.json).
const here = path.dirname(fileURLToPath(import.meta.url));
const webModule = (spec: string): string => path.resolve(here, '../../apps/web/node_modules', spec);

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: [
      { find: /^react$/, replacement: webModule('react') },
      { find: /^react-dom\/server$/, replacement: webModule('react-dom/server.node.js') },
    ],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', '../../qa/world-experience/*.test.ts'],
    globalSetup: ['./scripts/link-world-harness.mjs'],
  },
});
