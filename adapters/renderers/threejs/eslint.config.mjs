import { defineConfig } from '@epoch/eslint-config';

// W058 — the Three.js renderer adapter (experience layer: it implements the
// W056 RendererAdapter seam of the experience-layer fabric). The engine
// import (three) is an EXTERNAL dependency of this adapter package only —
// the authoritative boundary enforcement remains `pnpm check:boundary`
// (scripts/boundary-check.mjs) over package.json edges and static imports.
export default [
  ...defineConfig({ layer: 'experience' }),
  {
    // The local link script (scripts/*.mjs): Node globals for the .mjs zone
    // (the renderer-fabric precedent for its own scripts zone).
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
