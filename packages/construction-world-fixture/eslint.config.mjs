import { defineConfig } from '@epoch/eslint-config';

// packages/construction-world-fixture — the W071 shared construction-
// solution fixture (ACR-012). Service-layer composition: it composes the
// REAL @epoch/world-experience WorldScene admission, the REAL
// @epoch/renderer-fabric seam (W058 Three.js + W059 Babylon.js adapters
// via devDependencies — the same seam the conformance batteries prove),
// the frozen @epoch/pack-construction + @epoch/solution-delivery shapes,
// and the @epoch/capability-registry manifest sealing. `pnpm
// check:boundary` governs package.json edges; this lint-time layer
// mirrors the service tier the fixture composes (the same pattern as
// @epoch/test-harness, which is layer:service).
export default defineConfig({ layer: 'service' });
