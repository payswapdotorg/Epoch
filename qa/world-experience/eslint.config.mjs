import { defineConfig } from '@epoch/eslint-config';

// qa/world-experience — the W057 interactive-world workspace harness. It
// imports the web feature module (app layer — the workspace component
// whose driver parity is pinned here) plus the experience-layer product
// roots (world-runtime, renderer-fabric, renderer-runtime,
// world-experience, capability-registry), driving them through the real
// kernels. `pnpm check:boundary` governs package.json edges; this
// lint-time layer mirrors the app tier the harness tests.
export default defineConfig({ layer: 'app' });
