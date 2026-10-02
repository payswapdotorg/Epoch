import { defineConfig } from '@epoch/eslint-config';

// Experience-layer boundary restriction (allowed layers: experience,
// kernel, contracts, tooling — see packages/eslint-config/README.md). The
// authoritative boundary enforcement remains `pnpm check:boundary`
// (scripts/boundary-check.mjs) over package.json edges and static source
// imports.
export default [
  ...defineConfig({ layer: 'experience' }),
  {
    // The W057 Node link script (scripts/*.mjs): Node globals are declared
    // for the .mjs zone (the shared config carries no globals set — the
    // apps/web W050 precedent for its own scripts zone).
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
