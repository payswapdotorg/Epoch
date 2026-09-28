import { defineConfig } from '@epoch/eslint-config';

// Service layer (the same class as @epoch/test-harness): the performance
// library is engineering infrastructure whose runtime dependencies are
// kernel-layer primitives (@epoch/agent-protocol for canonical digests,
// @epoch/tenancy for tenant-id primitives, zod). The measurement SUBJECTS
// (solution-delivery, actualization, variance, the packs, the harness)
// are NEVER runtime or dev dependencies of this package — they compose as
// devDependencies of the TEST trees (tests/performance), exactly the
// W032 driver-seam pattern. The authoritative enforcement is
// `pnpm check:boundary` (scripts/boundary-check.mjs) over package.json
// edges + static imports, with this lint config as the second layer.
export default defineConfig({ layer: 'service' });
