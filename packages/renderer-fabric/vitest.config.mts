import { defineConfig } from 'vitest/config';

// W056: the fabric's own unit battery plus the qa/renderer-conformance
// harness (the W050 qa/cross-platform precedent: an out-of-workspace
// harness wired through its owning package — pnpm-workspace.yaml is
// frozen). The globalSetup link script creates the harness's node_modules
// symlink after a fresh install (idempotent, gitignored, CI-safe).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', '../../qa/renderer-conformance/*.test.ts'],
    globalSetup: ['./scripts/link-conformance-harness.mjs'],
  },
});
