import { defineConfig } from '@epoch/eslint-config';

// App-layer boundary declaration (allowed layers: all; pack internals
// off-limits). The authoritative enforcement is `pnpm check:boundary`
// (scripts/boundary-check.mjs) over package.json edges + static imports.
//
// Package-local additions (W049): the bundler Metro config is CommonJS by nature
// (the toolchain reads it through Node require), so the flat config grants it
// the CommonJS source type + the Node globals for that one file.
export default defineConfig({ layer: 'app' }).concat([
  {
    files: ['metro.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
      },
    },
    rules: {
      // The Metro config is the one sanctioned CommonJS require site (the
      // toolchain loads it through Node require, not the bundler).
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
