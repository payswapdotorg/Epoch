import { defineConfig } from '@epoch/eslint-config';

// Service-layer adapter (adapters sit outside the kernel; the authoritative
// enforcement is `pnpm check:boundary` (scripts/boundary-check.mjs) over
// package.json edges + static imports; this config mirrors the service tier
// — the adapter may compose every Epoch layer's public surface, including
// the engine dependency that lives ONLY in this package).
export default [
  ...defineConfig({ layer: 'service' }),
  {
    // The W059 Node link script (scripts/*.mjs): Node globals are declared
    // for the .mjs zone (the shared config carries no globals set — the
    // W056 renderer-fabric precedent for its own scripts zone).
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextEncoder: 'readonly',
      },
    },
  },
];
