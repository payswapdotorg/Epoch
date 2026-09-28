// W030 security evidence suite — ESLint flat config.
//
// Reuses the workspace's shared config (@epoch/eslint-config) via a
// RELATIVE import: tests/security has no node_modules of its own (it
// is not a pnpm importer — see vitest.config.mts), and the shared
// config's own dependencies resolve from
// packages/eslint-config/node_modules.
//
// Run (from the repository root):
//   pnpm --filter @epoch/security-runtime exec eslint \
//     --config ../../tests/security/eslint.config.mjs \
//     ../../tests/security
import { defineConfig } from '../../packages/eslint-config/index.mjs';

// Service layer (the same class as tests/integration): this suite
// composes kernel packages and the security runtime as declared
// devDependencies of an owned test surface.
export default defineConfig({ layer: 'service' });
