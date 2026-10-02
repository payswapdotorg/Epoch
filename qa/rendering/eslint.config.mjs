import { defineConfig } from '@epoch/eslint-config';

// qa/rendering — the W061 direct engine-pair battery (Three.js ⇄
// Babylon.js cross-switch + the forced degradation/failure/fallback
// ladder). It carries the experience layer exactly like the fabric
// package it rides (the battery imports the fabric, renderer-runtime,
// world-experience, capability-registry, and both real engine-adapter
// product roots, driving them through the real kernels).
// `pnpm check:boundary` governs package.json edges; this lint-time layer
// mirrors the experience tier the battery tests.
export default defineConfig({ layer: 'experience' });
