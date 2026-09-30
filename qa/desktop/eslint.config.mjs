import { defineConfig } from '@epoch/eslint-config';

// qa/desktop — the W048 desktop journey harness. It carries the app layer:
// exactly like apps/desktop's own test battery (and the services' test
// helpers), it imports product packages AND kernel reference-data builders
// (procurement/alerts/policy-contracts assemble journey records through the
// REAL kernels — the fixture generator's own pattern). `pnpm
// check:boundary` governs package.json edges; this lint-time layer mirrors
// the app tier the harness tests.
export default defineConfig({ layer: 'app' });
