import { defineConfig } from 'vitest/config';

// W059: the Babylon.js adapter's unit battery plus the
// qa/renderer-conformance/babylonjs shared-fixture battery (the W056
// doctrine: an out-of-workspace harness wired through its owning package —
// pnpm-workspace.yaml is frozen). The globalSetup link script creates the
// harness's node_modules symlink after a fresh install (idempotent,
// gitignored, CI-safe).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', '../../../qa/renderer-conformance/babylonjs/*.test.ts'],
    globalSetup: ['./scripts/link-qa-battery.mjs'],
  },
});
