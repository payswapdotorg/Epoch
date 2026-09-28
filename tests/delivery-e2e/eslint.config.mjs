// W044 Delivery-to-Learning E2E fixture — ESLint flat config.
//
// Reuses the workspace's shared config (@epoch/eslint-config) via a
// RELATIVE import: tests/delivery-e2e has no node_modules of its own
// (it is not a pnpm importer — see vitest.config.mts), and the shared
// config's own dependencies resolve from packages/eslint-config/
// node_modules.
//
// No `layer` is passed: layer-boundary import restrictions are scoped
// to workspace packages (both enforcement layers scan pnpm-workspace
// globs), and tests/delivery-e2e is deliberately outside them. The
// recommended JS/TS rule set still applies to every file linted under
// this config.
//
// Run (from the repository root):
//   pnpm --filter @epoch/pack-construction exec eslint \
//     --config ../../tests/delivery-e2e/eslint.config.mjs \
//     ../../tests/delivery-e2e ../../examples/delivery-e2e
import { defineConfig } from '../../packages/eslint-config/index.mjs';

export default defineConfig();
