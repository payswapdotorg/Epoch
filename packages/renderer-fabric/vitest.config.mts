import { defineConfig } from 'vitest/config';

// W056: the fabric's own unit battery plus the qa/renderer-conformance
// harness (the W050 qa/cross-platform precedent: an out-of-workspace
// harness wired through its owning package — pnpm-workspace.yaml is
// frozen). The globalSetup link script creates the harness's node_modules
// symlink after a fresh install (idempotent, gitignored, CI-safe).
//
// W061: the qa/rendering battery (the direct Three.js ⇄ Babylon.js
// cross-engine switch + the forced degradation/failure/fallback ladder)
// rides this pipeline too — its link script mirrors the conformance one
// and its own tsconfig/eslint are type-checked/linted by this package's
// scripts. The engine adapters are imported RELATIVELY (they resolve their
// engine dependencies through their OWN registered packages), so this
// package stays engine-free by construction.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'test/**/*.test.ts',
      '../../qa/renderer-conformance/*.test.ts',
      '../../qa/rendering/*.test.ts',
    ],
    globalSetup: [
      './scripts/link-conformance-harness.mjs',
      './scripts/link-rendering-harness.mjs',
    ],
  },
});
