import { defineConfig } from '@epoch/eslint-config';

// qa/cross-platform — the W050 cross-platform journey harness. It carries
// the app layer exactly like the qa/desktop harness (W048): the harness
// imports product packages AND the three client apps' product roots (web
// server runtime, desktop native runtime, mobile field host), assembling
// journey records through the REAL kernels. `pnpm check:boundary` governs
// package.json edges; this lint-time layer mirrors the app tier the
// harness tests.
export default defineConfig({ layer: 'app' });
