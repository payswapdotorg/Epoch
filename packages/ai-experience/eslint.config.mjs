import { defineConfig } from '@epoch/eslint-config';

// Experience-layer boundary restriction (see packages/eslint-config/README.md):
// the authoritative enforcement is `pnpm check:boundary`
// (scripts/boundary-check.mjs) over package.json edges + static imports.
export default defineConfig({ layer: 'experience' });
