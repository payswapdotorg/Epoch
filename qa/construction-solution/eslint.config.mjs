import { defineConfig } from '@epoch/eslint-config';

// qa/construction-solution — the W071 construction-solution fixture
// acceptance battery. It exercises the @epoch/construction-world-fixture
// public API (the FROZEN public contract W072/W073 compile against) plus
// the experience-layer product roots (world-experience, renderer-fabric,
// renderer-runtime, capability-registry) through the REAL kernels.
// `pnpm check:boundary` governs package.json edges; this lint-time layer
// mirrors the service tier the harness composes (the same pattern as
// qa/world-experience, which is layer:app because it imports the web
// feature — this harness imports no app layer, so service is correct).
export default defineConfig({ layer: 'service' });
