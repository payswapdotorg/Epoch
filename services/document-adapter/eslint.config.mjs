import { defineConfig } from '@epoch/eslint-config';

// Service-layer boundary restriction (authoritative CLI:
// scripts/boundary-check.mjs; duplicated rule tables kept in sync by
// design — see packages/eslint-config).
export default defineConfig({ layer: 'service' });
