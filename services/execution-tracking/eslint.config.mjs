import { defineConfig } from '@epoch/eslint-config';

// Service-layer boundary restriction (allowed layers: all; pack internals
// off-limits). The authoritative enforcement is `pnpm check:boundary`
// (scripts/boundary-check.mjs) over package.json edges + static imports.
export default defineConfig({ layer: 'service' });
