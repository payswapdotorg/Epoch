// W033 ops/ — ESLint flat config.
//
// Same discipline as deploy/eslint.config.mjs: ops/ is an owned W033
// surface outside the pnpm-workspace globs (no package.json, no
// node_modules — the W033 runtime dependency policy); the shared
// workspace config is imported relatively and its dependencies resolve
// from packages/eslint-config/node_modules. No `layer`: layer-boundary
// restrictions are scoped to workspace packages.
//
// Run (from the repository root):
//   (cd ops && ../packages/test-harness/node_modules/.bin/eslint .)
import { defineConfig } from '../packages/eslint-config/index.mjs';

export default defineConfig();
