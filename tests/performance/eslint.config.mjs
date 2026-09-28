// W034 performance-scale evidence suite — ESLint flat config.
//
// Reuses the workspace's shared config (@epoch/eslint-config) via a
// RELATIVE import: tests/performance has no node_modules of its own (it
// is not a pnpm importer — see vitest.config.mts), and the shared
// config's own dependencies resolve from packages/eslint-config/node_modules.
//
// Run (from the repository root):
//   pnpm --filter @epoch/test-harness exec eslint \
//     --config ../../tests/performance/eslint.config.mjs \
//     ../../tests/performance
import { defineConfig } from '../../packages/eslint-config/index.mjs';

// Service layer (the same class as tests/integration): this suite
// composes kernel packages, domain packs and the test harness as
// declared devDependencies of an owned test surface.
export default defineConfig({ layer: 'service' });
