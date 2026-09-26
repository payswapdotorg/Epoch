import { defineConfig } from 'vitest/config';

// W017: the desktop client's vitest wiring (repo convention: per-package
// vitest.config.mts, node environment). Tests live under `test/` and are
// pure typed-contract exercises — no DOM emulator, no native runtime, no
// engine; the reference host is in-memory.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
