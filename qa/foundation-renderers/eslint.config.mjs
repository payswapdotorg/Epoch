import { defineConfig } from '@epoch/eslint-config';

// qa/foundation-renderers — the W060 foundation & asset-bridge battery. It
// carries the experience layer exactly like the harness it extends: it
// drives the REAL @epoch/adapter-foundation-gltf (the glTF interchange
// bridge), the REAL @epoch/adapter-renderer-threejs (a real engine behind
// the frozen W056 seam), and the REAL @epoch/adapter-renderer-blender
// (the external-process sidecar) through the shared canonical fixture.
// `pnpm check:boundary` governs package.json edges; this lint-time layer
// mirrors the experience tier the battery tests.
export default defineConfig({ layer: 'experience' });
