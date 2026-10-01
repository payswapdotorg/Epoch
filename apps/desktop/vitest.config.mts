import { defineConfig } from 'vitest/config';

// W017: the desktop client's vitest wiring (repo convention: per-package
// vitest.config.mts, node environment). Tests live under `test/` and are
// pure typed-contract exercises — no DOM emulator, no native runtime, no
// engine; the reference host is in-memory.
export default defineConfig({
  test: {
    environment: 'node',
    // The qa harness zone: ONLY the journey tests (the e2e specs run
    // under their own runners — playwright/wdio; the harness's symlinked
    // node_modules must never be globbed into the suite).
    include: ['test/**/*.test.ts', '../../qa/desktop/journeys/*.test.ts'],
    // The qa/desktop harness resolves its dependencies through
    // apps/desktop's node_modules (the W048 link script creates the
    // symlink + the @epoch/desktop self-link; idempotent, CI-safe).
    globalSetup: ['./scripts/link-qa-harness.mjs'],
  },
});
