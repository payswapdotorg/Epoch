import { defineConfig } from '@epoch/eslint-config';

// qa/renderer-conformance — the W056 renderer conformance harness. It
// carries the experience layer exactly like the fabric package it rides
// (the harness imports @epoch/renderer-fabric, @epoch/renderer-runtime,
// @epoch/world-experience, and @epoch/capability-registry product roots,
// driving them through the real kernels). `pnpm check:boundary` governs
// package.json edges; this lint-time layer mirrors the experience tier
// the harness tests.
export default defineConfig({ layer: 'experience' });
