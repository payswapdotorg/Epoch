import { defineConfig } from '@epoch/eslint-config';

// W060 — the glTF 2.0 asset bridge (experience layer: it feeds the frozen
// W056 fabric asset path — RendererAssetBinding over @epoch/renderer-runtime).
// Zero external dependencies; `pnpm check:boundary` remains the authoritative
// package-edge enforcement.
export default [
  ...defineConfig({ layer: 'experience' }),
  {
    // The local link script (scripts/*.mjs): Node globals for the .mjs zone
    // (the renderer-fabric / W058 scripts-zone precedent).
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextEncoder: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },
];
