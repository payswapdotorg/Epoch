// W031 Reference E2E slices — vitest configuration.
//
// tests/e2e is an OWNED SURFACE outside the pnpm-workspace.yaml globs
// (apps/*, packages/*, services/*, packs/*, adapters/*), and the root
// manifests are frozen for this Work Order — so this directory is NOT a
// pnpm importer and has no node_modules of its own. Import resolution is
// therefore EXPLICIT:
//
//   - the @epoch/* packages the slices compose are aliased to their
//     workspace source entries below (the same set tests/e2e/package.json
//     declares as devDependencies — the frozen W031 policy);
//   - TRANSITIVE imports inside those sources resolve normally through
//     each package's own node_modules (pnpm per-package linking);
//   - the 'vitest' import inside test files is auto-aliased by vitest
//     itself.
//
// This file deliberately imports NOTHING except node builtins, so it loads
// without a resolvable 'vitest/config' module. It is a plain config object
// (vitest accepts `export default <config>` without defineConfig).
//
// Run (from the repository root):
//   pnpm --filter @epoch/pack-construction exec vitest run --root ../../tests/e2e
import { fileURLToPath } from 'node:url';

const here = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

export default {
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Deterministic E2E discipline: no file watching, no coverage, no
    // random ordering — the suite must behave identically on every run.
    sequence: { shuffle: false },
    alias: {
      '@epoch/solution-delivery': here('../../packages/solution-delivery/src/index.ts'),
      '@epoch/procurement': here('../../packages/procurement/src/index.ts'),
      '@epoch/execution-tracking': here('../../packages/execution-tracking/src/index.ts'),
      '@epoch/actualization': here('../../packages/actualization/src/index.ts'),
      '@epoch/variance': here('../../packages/variance/src/index.ts'),
      '@epoch/pack-construction': here('../../packs/construction/src/index.ts'),
      '@epoch/pack-software': here('../../packs/software/src/index.ts'),
      '@epoch/adapter-github': here('../../adapters/github/src/index.ts'),
      '@epoch/document-adapter': here('../../packages/document-adapter/src/index.ts'),
      '@epoch/agent-orchestration': here('../../packages/agent-orchestration/src/index.ts'),
      '@epoch/action-protocol': here('../../packages/action-protocol/src/index.ts'),
      '@epoch/action-policy': here('../../packages/action-policy/src/index.ts'),
      '@epoch/policy-contracts': here('../../packages/policy-contracts/src/index.ts'),
      '@epoch/tenancy': here('../../packages/tenancy/src/index.ts'),
      '@epoch/authorization': here('../../packages/authorization/src/index.ts'),
      '@epoch/evidence': here('../../packages/evidence/src/index.ts'),
      '@epoch/event-log': here('../../packages/event-log/src/index.ts'),
    },
  },
};
