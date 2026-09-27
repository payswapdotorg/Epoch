// W032 Cross-domain integration scenario packs — vitest configuration.
//
// tests/integration is an OWNED SURFACE outside the pnpm-workspace.yaml
// globs (apps/*, packages/*, services/*, packs/*, adapters/*), and the
// root manifests are frozen for this Work Order — so this directory is
// NOT a pnpm importer and has no node_modules of its own. Import
// resolution is therefore EXPLICIT (the same mechanism as tests/e2e and
// tests/contracts):
//
//   - the @epoch/* packages this suite composes are aliased to their
//     workspace source entries below (the same set
//     tests/integration/package.json declares as devDependencies — the
//     frozen W032 policy, plus @epoch/test-harness, this Work Order's
//     own engine);
//   - TRANSITIVE imports inside those sources resolve normally through
//     each package's own node_modules (pnpm per-package linking);
//   - 'zod' is aliased to @epoch/test-harness's own pinned zod runtime
//     dependency;
//   - the 'vitest' import inside test files is auto-aliased by vitest
//     itself.
//
// Run (from the repository root):
//   pnpm --filter @epoch/pack-construction exec vitest run --root ../../tests/integration
import { fileURLToPath } from 'node:url';

const here = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

export default {
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Deterministic integration discipline: no shuffling, no coverage.
    sequence: { shuffle: false },
    alias: {
      '@epoch/action-policy': here('../../packages/action-policy/src/index.ts'),
      '@epoch/action-protocol': here('../../packages/action-protocol/src/index.ts'),
      '@epoch/actualization': here('../../packages/actualization/src/index.ts'),
      '@epoch/adapter-github': here('../../adapters/github/src/index.ts'),
      '@epoch/agent-protocol': here('../../packages/agent-protocol/src/index.ts'),
      '@epoch/authorization': here('../../packages/authorization/src/index.ts'),
      '@epoch/document-adapter': here('../../packages/document-adapter/src/index.ts'),
      '@epoch/event-log': here('../../packages/event-log/src/index.ts'),
      '@epoch/evidence': here('../../packages/evidence/src/index.ts'),
      '@epoch/execution-tracking': here('../../packages/execution-tracking/src/index.ts'),
      '@epoch/pack-construction': here('../../packs/construction/src/index.ts'),
      '@epoch/pack-software': here('../../packs/software/src/index.ts'),
      '@epoch/procurement': here('../../packages/procurement/src/index.ts'),
      '@epoch/solution-delivery': here('../../packages/solution-delivery/src/index.ts'),
      '@epoch/tenancy': here('../../packages/tenancy/src/index.ts'),
      '@epoch/test-harness': here('../../packages/test-harness/src/index.ts'),
      '@epoch/variance': here('../../packages/variance/src/index.ts'),
      zod: here('../../packages/test-harness/node_modules/zod'),
    },
  },
};
