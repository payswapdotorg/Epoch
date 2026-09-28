// W035 release/ — vitest configuration (the thin release-kit test suite).
//
// release/ is an OWNED W035 surface outside the pnpm-workspace.yaml globs
// (apps/*, packages/*, services/*, packs/*, adapters/*), and the root
// manifests are frozen for this Work Order — so this tree is NOT a pnpm
// importer and carries NO node_modules (per the W035 runtime dependency
// policy there is deliberately NO package.json under release/). This
// suite therefore borrows the toolchain of an existing workspace package
// (@epoch/test-harness — a declared devDependency of this policy) and
// resolves imports EXPLICITLY:
//
//   - @epoch/release-kit    -> release/src/index.ts (this tree);
//   - @epoch/agent-protocol + @epoch/tenancy -> their workspace sources
//     (the declared runtime dependencies of the release kit);
//   - 'zod'                 -> the zod linked into @epoch/test-harness
//     (zod is NOT present at the workspace root — pnpm isolates it per
//     package — so the exact-match alias below is required);
//   - the REAL upstream SDK/authority surfaces (@epoch/adapter-sdk,
//     @epoch/capability-registry, @epoch/extension-sdk,
//     @epoch/marketplace, @epoch/event-log, @epoch/deploy-model,
//     @epoch/performance) -> their workspace sources, TEST-ONLY imports
//     for the parity / contract-sync / examples evidence — never runtime
//     edges of the release kit (the W023 devDep-parity precedent);
//   - TRANSITIVE imports inside the @epoch/* sources resolve normally
//     through each package's own node_modules (pnpm per-package linking).
//
// This file imports NOTHING except node builtins, so it loads without a
// resolvable 'vitest/config' module. Deterministic suite discipline: no
// watching, no coverage, no shuffle — identical behavior every run.
//
// Run (from the repository root, after `pnpm install`):
//   pnpm --filter @epoch/test-harness exec vitest run --root ../../release
import { fileURLToPath } from 'node:url';

const here = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

export default {
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    sequence: { shuffle: false },
    alias: [
      { find: /^zod$/, replacement: here('../packages/test-harness/node_modules/zod/index.js') },
      { find: '@epoch/agent-protocol', replacement: here('../packages/agent-protocol/src/index.ts') },
      { find: '@epoch/tenancy', replacement: here('../packages/tenancy/src/index.ts') },
      { find: '@epoch/release-kit', replacement: here('./src/index.ts') },
      // Test-only upstream surfaces (parity / contract-sync / examples).
      { find: '@epoch/adapter-sdk', replacement: here('../packages/adapter-sdk/src/index.ts') },
      { find: '@epoch/capability-registry', replacement: here('../packages/capability-registry/src/index.ts') },
      { find: '@epoch/extension-sdk', replacement: here('../packages/extension-sdk/src/index.ts') },
      { find: '@epoch/marketplace', replacement: here('../packages/marketplace/src/index.ts') },
      { find: '@epoch/event-log', replacement: here('../packages/event-log/src/index.ts') },
      { find: '@epoch/deploy-model', replacement: here('../deploy/src/index.ts') },
      { find: '@epoch/performance', replacement: here('../packages/performance/src/index.ts') },
      // Transitive sources of the test-only imports (resolved here
      // because the aliased @epoch/* sources import them as bare
      // specifiers): event-log -> action-protocol + world-model ->
      // world-contracts (the tests/e2e alias pattern).
      { find: '@epoch/action-protocol', replacement: here('../packages/action-protocol/src/index.ts') },
      { find: '@epoch/world-model', replacement: here('../packages/world-model/src/index.ts') },
      { find: '@epoch/world-contracts', replacement: here('../contracts/world/src/index.ts') },
    ],
  },
};
