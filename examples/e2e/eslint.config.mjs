// W031 Reference E2E slices — ESLint flat config (examples/e2e).
//
// Same shared workspace config as tests/e2e (reached via a RELATIVE
// import: this directory has no node_modules of its own). ESLint's base
// path is the config's directory, so examples/e2e carries its own copy
// of the pointer.
//
// Run (from this directory):
//   ../../packs/construction/node_modules/.bin/eslint .
import { defineConfig } from '../../packages/eslint-config/index.mjs';

export default defineConfig();
