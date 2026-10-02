import { defineConfig } from 'vitest/config';

// W060: the glTF bridge's own unit battery PLUS the
// qa/foundation-renderers end-to-end battery (the W056/W058
// out-of-workspace-harness doctrine: the battery rides THIS package's
// pipeline — its link script builds the battery's node_modules link and its
// typecheck script type-checks the battery's own tsconfig). The node
// environment is honest: everything here is pure code (no GPU, no DOM, no
// filesystem, no network — the bridge performs ZERO I/O by construction).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', '../../../qa/foundation-renderers/*.test.ts'],
  },
});
