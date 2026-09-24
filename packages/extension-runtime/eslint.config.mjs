import { defineConfig } from '@epoch/eslint-config';

// Kernel-layer boundary restriction (see packages/eslint-config/README.md):
// the authoritative enforcement is `pnpm check:boundary`
// (scripts/boundary-check.mjs) over package.json edges + static imports.
// runtimes/wasm is non-workspace machinery (contracts/* status) and is
// intentionally OUTSIDE this package's eslint root — it carries no
// package.json and no dependency edges; its typecheck + tests run through
// this package (tsconfig.wasm.json + the vitest `wasm` project below).
export default defineConfig({ layer: 'kernel' });
