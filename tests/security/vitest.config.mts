// W030 — the security evidence suite vitest configuration.
//
// tests/security is an OWNED SURFACE outside the pnpm-workspace.yaml
// globs (apps/*, packages/*, services/*, packs/*, adapters/*), and the
// root manifests are frozen for this Work Order — so this directory is
// NOT a pnpm importer and has no node_modules of its own. Import
// resolution is therefore EXPLICIT (the same mechanism as
// tests/integration, tests/contracts and tests/performance):
//
//   - the @epoch/* packages this suite composes (the REAL kernels +
//     this Work Order's own engine, @epoch/security-runtime) are
//     aliased to their workspace source entries below — the same set
//     tests/security/package.json declares as devDependencies (the
//     frozen W030 policy);
//   - TRANSITIVE imports inside those sources resolve normally through
//     each package's own node_modules (pnpm per-package linking);
//   - 'zod' is aliased to @epoch/security-runtime's own pinned zod
//     runtime dependency;
//   - the 'vitest' import inside test files is auto-aliased by vitest
//     itself.
//
// Run (from the repository root):
//   pnpm --filter @epoch/security-runtime exec vitest run --root ../../tests/security
import { fileURLToPath } from 'node:url';

const here = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

export default {
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Deterministic evidence discipline: no shuffling, no coverage.
    sequence: { shuffle: false },
    alias: {
      '@epoch/access-projection': here('../../packages/access-projection/src/index.ts'),
      '@epoch/action-protocol': here('../../packages/action-protocol/src/index.ts'),
      '@epoch/agent-orchestration': here('../../packages/agent-orchestration/src/index.ts'),
      '@epoch/action-gateway': here('../../services/action-gateway/src/index.ts'),
      '@epoch/agent-runtime': here('../../services/agent-runtime/src/index.ts'),
      '@epoch/authorization': here('../../packages/authorization/src/index.ts'),
      '@epoch/capability-registry': here('../../packages/capability-registry/src/index.ts'),
      '@epoch/event-log': here('../../packages/event-log/src/index.ts'),
      '@epoch/extension-runtime': here('../../packages/extension-runtime/src/index.ts'),
      '@epoch/marketplace': here('../../packages/marketplace/src/index.ts'),
      '@epoch/observability': here('../../packages/observability/src/index.ts'),
      '@epoch/policy-contracts': here('../../packages/policy-contracts/src/index.ts'),
      '@epoch/security-runtime': here('../../services/security/src/index.ts'),
      '@epoch/simulation-fabric': here('../../packages/simulation-fabric/src/index.ts'),
      '@epoch/simulation-protocol': here('../../packages/simulation-protocol/src/index.ts'),
      '@epoch/solution-delivery': here('../../packages/solution-delivery/src/index.ts'),
      '@epoch/tenancy': here('../../packages/tenancy/src/index.ts'),
      zod: here('../../services/security/node_modules/zod'),
    },
  },
};
