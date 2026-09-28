// W044 Delivery-to-Learning E2E fixture — ESLint flat config
// (examples/delivery-e2e).
//
// Same shared workspace config as tests/delivery-e2e (reached via a
// RELATIVE import: this directory has no node_modules of its own).
// ESLint's base path is the config's directory, so
// examples/delivery-e2e carries its own copy of the pointer.
//
// Run (from this directory):
//   ../../packs/construction/node_modules/.bin/eslint .
import { defineConfig } from '../../packages/eslint-config/index.mjs';

export default defineConfig();
