import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

// Two projects: the package's own tests, and the runtimes/wasm machinery
// tests (the contracts/* precedent of exercising non-package directories
// through the owning workspace package — runtimes/wasm has no
// package.json and is NOT a pnpm workspace member).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'extension-runtime',
          environment: 'node',
          include: ['test/**/*.test.ts'],
        },
      },
      {
        root: path.resolve(here, '../../runtimes/wasm'),
        test: {
          name: 'wasm-layout',
          environment: 'node',
          include: ['test/**/*.test.ts'],
        },
      },
    ],
  },
});
