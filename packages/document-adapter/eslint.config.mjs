import { defineConfig } from '@epoch/eslint-config';

// Kernel-layer boundary restriction (authoritative CLI: scripts/boundary-check.mjs;
// duplicated rule tables kept in sync by design — see packages/eslint-config).
export default defineConfig({ layer: 'kernel' });
