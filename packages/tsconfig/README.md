# @epoch/tsconfig

Shared TypeScript compiler bases (Epoch layer: `tooling`).

- `base.json` — strict defaults shared by every workspace package.
- `library.json` — for `packages/*` library code (kernel, contracts, …).
- `app.json` — for bundler-served apps (Next.js, Tauri shells).

Usage: `"extends": "@epoch/tsconfig/app.json"` (declare `@epoch/tsconfig` as a
`workspace:*` devDependency). `pnpm typecheck` runs `tsc --noEmit` in each
workspace package that declares a `typecheck` script.
