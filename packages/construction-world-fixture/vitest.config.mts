import { defineConfig } from 'vitest/config';

// W071: the construction-world-fixture package's own unit battery plus the
// qa/construction-solution harness (the W056 qa/renderer-conformance +
// W057 qa/world-experience precedent: an out-of-workspace harness wired
// through its owning package — pnpm-workspace.yaml is NOT touched for the
// harness). The globalSetup link script creates the harness's
// node_modules symlink after a fresh install (idempotent, gitignored,
// CI-safe).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', '../../qa/construction-solution/*.test.ts'],
    globalSetup: ['./scripts/link-construction-harness.mjs'],
  },
});
