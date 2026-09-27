import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Deterministic harness discipline (the W031 E2E philosophy): no
    // shuffling, no coverage, no watching — identical behavior every run.
    sequence: { shuffle: false },
    include: ['test/**/*.test.ts'],
  },
});
