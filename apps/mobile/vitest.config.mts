import { defineConfig } from 'vitest/config';

// W018: the mobile field client's vitest wiring (repo convention:
// per-package vitest.config.mts, node environment). Tests live in test/
// and exercise the typed field-shell contracts and the in-memory reference
// host; no DOM emulator is in the frozen dependency catalog, and none is
// needed (the reference host is pure typed data + kernel seams).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
