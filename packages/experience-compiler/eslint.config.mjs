import { defineConfig } from '@epoch/eslint-config';

// Experience-layer boundary restriction (allowed layers: experience, kernel,
// contracts, tooling). The authoritative boundary enforcement remains
// `pnpm check:boundary` (scripts/boundary-check.mjs) over package.json edges
// and static source imports.
export default defineConfig({ layer: 'experience' });
