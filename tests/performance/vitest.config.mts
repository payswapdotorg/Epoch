// W034 — the performance-scale evidence suite vitest configuration.
//
// tests/performance is an OWNED SURFACE outside the pnpm-workspace.yaml
// globs (apps/*, packages/*, services/*, packs/*, adapters/*), and the
// root manifests are frozen for this Work Order — so this directory is
// NOT a pnpm importer and has no node_modules of its own. Import
// resolution is therefore EXPLICIT (the same mechanism as
// tests/integration and tests/e2e):
//
//   - the @epoch/* packages this suite composes (the measured workspace
//     packages + this Work Order's own engine, @epoch/performance) are
//     aliased to their workspace source entries below — the same set
//     tests/performance/package.json declares as devDependencies (the
//     frozen W034 policy);
//   - TRANSITIVE imports inside those sources resolve normally through
//     each package's own node_modules (pnpm per-package linking);
//   - 'zod' is aliased to @epoch/test-harness's own pinned zod runtime
//     dependency;
//   - the 'vitest' import inside test files is auto-aliased by vitest
//     itself.
//
// Run (from the repository root):
//   pnpm --filter @epoch/test-harness exec vitest run --root ../../tests/performance
import { fileURLToPath } from 'node:url';

const here = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

export default {
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Deterministic evidence discipline: no shuffling, no coverage.
    sequence: { shuffle: false },
    alias: {
      '@epoch/actualization': here('../../packages/actualization/src/index.ts'),
      '@epoch/agent-protocol': here('../../packages/agent-protocol/src/index.ts'),
      '@epoch/pack-construction': here('../../packs/construction/src/index.ts'),
      '@epoch/pack-software': here('../../packs/software/src/index.ts'),
      '@epoch/performance': here('../../packages/performance/src/index.ts'),
      '@epoch/solution-delivery': here('../../packages/solution-delivery/src/index.ts'),
      '@epoch/tenancy': here('../../packages/tenancy/src/index.ts'),
      '@epoch/test-harness': here('../../packages/test-harness/src/index.ts'),
      '@epoch/variance': here('../../packages/variance/src/index.ts'),
      zod: here('../../packages/test-harness/node_modules/zod'),
    },
  },
};
