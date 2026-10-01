import { defineConfig } from '@epoch/eslint-config';

export default [
  ...defineConfig({ layer: 'app' }),
  {
    // The W050 Node link script (scripts/*.mjs): Node globals are declared
    // for the .mjs zone (the shared config carries no globals set — the
    // apps/desktop W048 precedent for its own scripts zone).
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
