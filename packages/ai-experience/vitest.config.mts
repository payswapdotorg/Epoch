import { defineConfig } from 'vitest/config';

// The package's own contract battery runs in node. The SAME runner also
// executes the pure-logic tests of the W015 web feature module
// (apps/web/src/features/agents): the feature module cannot declare
// dependencies in the frozen app manifest (integration is a serialized
// shell/integration Work Order), so its tests run here in Vitest `globals`
// mode — the feature test files import nothing outside apps/web and use
// the injected describe/it/expect globals (ambient declarations live in
// the feature module). This keeps every W015-owned test green within the
// workspace battery without touching any frozen file.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'test/**/*.test.ts',
      '../../apps/web/src/features/agents/**/*.test.ts',
    ],
  },
});
