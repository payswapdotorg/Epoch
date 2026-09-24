import { defineConfig } from '@epoch/eslint-config';

// Kernel-layer boundary restriction. The W001 `layerRestrictions()` ESLint-10
// defect (pre-ESLint-10 `paths` shape) was fixed on the foundation branch
// (PR #9), so kernel packages pass their layer directly again. The
// authoritative boundary enforcement remains `pnpm check:boundary`
// (scripts/boundary-check.mjs) over package.json edges + static imports.
export default defineConfig({ layer: 'kernel' });
