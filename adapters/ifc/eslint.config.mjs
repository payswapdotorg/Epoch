import { defineConfig } from '@epoch/eslint-config';

// Service-layer boundary restriction (adapters sit outside the kernel; the
// authoritative enforcement is `pnpm check:boundary`
// (scripts/boundary-check.mjs) over package.json edges + static imports).
export default defineConfig({ layer: 'service' });
