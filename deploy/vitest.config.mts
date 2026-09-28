// W033 deploy/ — vitest configuration (the thin deploy/ test suite).
//
// deploy/ and ops/ are OWNED W033 SURFACES outside the pnpm-workspace.yaml
// globs (apps/*, packages/*, services/*, packs/*, adapters/*), and the
// root manifests are frozen for this Work Order — so NEITHER tree is a
// pnpm importer and neither carries node_modules (per the W033 runtime
// dependency policy there is deliberately NO package.json under deploy/
// or ops/). This suite therefore borrows the toolchain of an existing
// workspace package (@epoch/test-harness — a declared devDependency of
// this policy) and resolves imports EXPLICITLY:
//
//   - @epoch/deploy-model -> deploy/src/index.ts (this tree);
//   - @epoch/ops-kit      -> ../ops/src/index.ts (the sibling owned tree);
//   - @epoch/agent-protocol + @epoch/tenancy -> their workspace sources
//     (the declared runtime dependencies of the deploy model);
//   - 'zod'               -> the zod linked into @epoch/test-harness
//     (zod is NOT present at the workspace root — pnpm isolates it per
//     package — so the exact-match alias below is required);
//   - TRANSITIVE imports inside the @epoch/* sources resolve normally
//     through each package's own node_modules (pnpm per-package linking).
//
// This file imports NOTHING except node builtins, so it loads without a
// resolvable 'vitest/config' module. Deterministic suite discipline: no
// watching, no coverage, no shuffle — identical behavior every run.
//
// Run (from the repository root, after `pnpm install`):
//   pnpm --filter @epoch/test-harness exec vitest run --root ../../deploy
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
      { find: '@epoch/deploy-model', replacement: here('./src/index.ts') },
      { find: '@epoch/ops-kit', replacement: here('../ops/src/index.ts') },
    ],
  },
};
