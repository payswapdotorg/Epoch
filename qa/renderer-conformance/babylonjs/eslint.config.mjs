import { defineConfig } from '@epoch/eslint-config';

// qa/renderer-conformance/babylonjs — the W059 Babylon.js conformance
// battery. It carries the service layer exactly like the adapter package
// it rides (the battery imports the @epoch/adapter-renderer-babylonjs
// product root — which composes the fabric, renderer-runtime,
// world-experience and capability-registry kernels through its own
// package's node_modules — driving them through the real seams).
// `pnpm check:boundary` governs package.json edges; this lint-time layer
// mirrors the service tier the battery tests.
export default defineConfig({ layer: 'service' });
