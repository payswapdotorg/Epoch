// W032 Contract conformance suite — ESLint flat config.
//
// Reuses the workspace's shared config (@epoch/eslint-config) via a
// RELATIVE import: tests/contracts has no node_modules of its own (it is
// not a pnpm importer — see vitest.config.mts), and the shared config's
// own dependencies resolve from packages/eslint-config/node_modules.
//
// Run (from the repository root):
//   pnpm --filter @epoch/pack-construction exec eslint \
//     --config ../../tests/contracts/eslint.config.mjs ../../tests/contracts
import { defineConfig } from '../../packages/eslint-config/index.mjs';

export default defineConfig();
