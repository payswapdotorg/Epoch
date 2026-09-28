import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Deterministic evidence discipline: no shuffling, no coverage.
    sequence: { shuffle: false },
  },
});
