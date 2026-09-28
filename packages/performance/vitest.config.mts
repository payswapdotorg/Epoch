import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Deterministic discipline (the W031/W032/W033 philosophy): no
    // shuffling, no coverage, no watching — identical behavior every run.
    sequence: { shuffle: false },
    include: ['test/**/*.test.ts'],
  },
});
