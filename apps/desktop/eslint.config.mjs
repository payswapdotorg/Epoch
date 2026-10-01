import { defineConfig } from '@epoch/eslint-config';

// App-layer boundary restriction (allowed layers: everything except pack
// internals; the desktop client consumes kernel/experience contracts only).
// The authoritative boundary enforcement remains `pnpm check:boundary`
// (scripts/boundary-check.mjs) over package.json edges and static source
// imports.
//
// W048 additions ignored here (generated artifacts, never linted): the
// Next.js static-export output `out/` (the Tauri webview payload — minified
// vendor chunks) and the synced fixture copy `public/fixtures/`.
export default [
  ...defineConfig({ layer: 'app' }),
  { ignores: ['out/**', 'public/fixtures/**'] },
  {
    // The W048 Node build/audit scripts (scripts/*.mjs): Node globals are
    // declared for the .mjs zone (the shared config carries no globals set).
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
