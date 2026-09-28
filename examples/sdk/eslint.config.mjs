// W035 examples/sdk — ESLint flat config.
//
// Same discipline as release/eslint.config.mjs: examples/sdk has no
// node_modules of its own (it is not a pnpm importer — see
// release/vitest.config.mts), and the shared workspace config is
// imported relatively with its dependencies resolving from
// packages/eslint-config/node_modules. No `layer`: layer-boundary
// restrictions are scoped to workspace packages.
//
// Run (from the repository root):
//   (cd examples/sdk && ../../packages/test-harness/node_modules/.bin/eslint .)
import { defineConfig } from '../../packages/eslint-config/index.mjs';

export default defineConfig();
