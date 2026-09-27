// W031 Reference E2E slices — ESLint flat config.
//
// Reuses the workspace's shared config (@epoch/eslint-config) via a
// RELATIVE import: tests/e2e has no node_modules of its own (it is not a
// pnpm importer — see vitest.config.mts), and the shared config's own
// dependencies resolve from packages/eslint-config/node_modules.
//
// No `layer` is passed: layer-boundary import restrictions are scoped to
// workspace packages (both enforcement layers scan pnpm-workspace globs),
// and tests/e2e is deliberately outside them. The recommended JS/TS rule
// set still applies to every file linted under this config.
//
// Run (from the repository root):
//   pnpm --filter @epoch/pack-construction exec eslint \
//     --config ../../tests/e2e/eslint.config.mjs ../../tests/e2e ../../examples/e2e
import { defineConfig } from '../../packages/eslint-config/index.mjs';

export default defineConfig();
