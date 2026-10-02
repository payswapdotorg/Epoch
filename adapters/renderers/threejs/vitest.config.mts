import { defineConfig } from 'vitest/config';

// W058: the Three.js adapter's own unit battery PLUS the
// qa/renderer-conformance/threejs shared-fixture battery (the W056
// qa/renderer-conformance precedent: an out-of-workspace harness wired
// through its owning package's pipeline). The node environment is honest:
// everything here runs headless in Node (no GPU, no DOM) — the injected
// GL surface stays null and no test fabricates browser evidence.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', '../../../qa/renderer-conformance/threejs/*.test.ts'],
  },
});
