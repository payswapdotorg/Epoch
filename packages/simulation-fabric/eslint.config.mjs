import { defineConfig } from '@epoch/eslint-config';

// Kernel-layer boundary restriction (allowed layers: kernel, contracts,
// tooling). The authoritative enforcement is `pnpm check:boundary`
// (scripts/boundary-check.mjs) over package.json edges + static imports.
export default defineConfig({ layer: 'kernel' });
