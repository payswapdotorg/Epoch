import { defineConfig } from '@epoch/eslint-config';

// App-layer boundary restriction (allowed layers: everything except pack
// internals; the desktop client consumes kernel/experience contracts only).
// The authoritative boundary enforcement remains `pnpm check:boundary`
// (scripts/boundary-check.mjs) over package.json edges and static source
// imports.
export default defineConfig({ layer: 'app' });
