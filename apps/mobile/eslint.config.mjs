import { defineConfig } from '@epoch/eslint-config';

// App-layer boundary declaration (allowed layers: all; pack internals
// off-limits). The authoritative enforcement is `pnpm check:boundary`
// (scripts/boundary-check.mjs) over package.json edges + static imports.
export default defineConfig({ layer: 'app' });
