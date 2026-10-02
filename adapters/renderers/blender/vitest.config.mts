import { defineConfig } from 'vitest/config';

// W060: the Blender sidecar adapter's own unit + boundary battery. The node
// environment is honest: everything here runs in Node — the REAL spawn-based
// process boundary against the committed Node CLI double (the strongest
// no-Blender evidence available: real subprocesses, real timeouts, real byte
// caps, real report files; only Blender itself is doubled). The real-binary
// battery is test/live-blender.test.ts — ENV-GATED (EPOCH_BLENDER_PATH +
// EPOCH_BLENDER_LIVE=1), skipped by default, never claimed as CI-verified.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
