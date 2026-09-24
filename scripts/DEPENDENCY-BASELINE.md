# Epoch dependency baseline (W001 freeze)

This document defines the frozen dependency baseline that W002-W004 (and all
later Work Orders) consume so their branches never edit root manifests or the
lockfile. Owned by W001 (`scripts/**`).

## Frozen catalog

Declared in `pnpm-workspace.yaml` under `catalog:` — exact pins, no ranges:

| Package                | Exact version | Consumers                            |
| ---------------------- | ------------- | ------------------------------------ |
| `typescript`           | 5.9.3         | all TS packages (typescript-eslint caps TS at <6.1) |
| `vitest`               | 5.0.1         | packages with tests                  |
| `@vitest/coverage-v8`  | 5.0.1         | optional coverage runs (W002+)       |
| `zod`                  | 4.6.5         | protocol/contract packages (W002-W004) |
| `turbo`                | 2.11.3        | root (task orchestration)            |
| `eslint`               | 10.11.0       | lintable packages                    |
| `@eslint/js`           | 10.0.1        | `@epoch/eslint-config`               |
| `typescript-eslint`    | 8.70.1        | `@epoch/eslint-config`               |
| `next`                 | 15.5.26       | `apps/web`                           |
| `react` / `react-dom`  | 19.3.0        | `apps/web`                           |
| `@types/react` / `@types/react-dom` | 19.3.0 | `apps/web`                |
| `@types/node`          | 22.20.4       | node-targeting packages (CI runs Node 22) |

Package manager: `pnpm@10.34.5` (pinned exactly in root `package.json`
`packageManager`; CI activates it via `corepack enable pnpm`). CI runs on
Node 22 (ubuntu-latest).

## Rules for W002+ branches

1. NEW workspace packages reference dependencies with the `catalog:` protocol
   only — never version literals. Only `workspace:*` references to other
   Epoch packages may be added.
2. MUST NOT edit (the CI baseline guard enforces this on non-foundation
   branches): `package.json`, `pnpm-workspace.yaml`, `turbo.json`,
   root `tsconfig*.json`, `pnpm-lock.yaml`.
3. Local development may regenerate the lockfile
   (`pnpm install --no-frozen-lockfile`), but before committing run
   `git checkout pnpm-lock.yaml` — never commit lockfile changes from a
   non-foundation branch.
4. If a needed dependency is missing from the catalog, raise it as an
   Architecture Question in your PR; the Tech Lead adds it through a
   foundation branch (`work/foundation-*`) or the next serialized change.

## CI behavior

- `main` and foundation branches (`work/W001-*`, `work/foundation-*`):
  `pnpm install --frozen-lockfile` against the committed baseline lockfile.
- All other branches: `pnpm install --no-frozen-lockfile` (regenerated for the
  CI run only; the guard would fail anyway if the lockfile were committed).
- The baseline guard fails a non-foundation branch whose diff vs `origin/main`
  touches any root-level protected manifest (see `.github/workflows/ci.yml`).

## One-command battery (fresh checkout)

```
pnpm install     # node_modules for the whole workspace
pnpm check       # governance + package-boundary checks (always fresh)
pnpm typecheck   # turbo: tsc --noEmit across workspace packages
pnpm lint        # turbo: eslint across workspace packages
pnpm test        # turbo: vitest across workspace packages
pnpm build       # turbo: builds (apps/web via next build)
```

CI runs the turbo form of the same battery:
`pnpm turbo run governance boundary typecheck lint test build`.

Requirements: Node >= 22.12, pnpm 10 (via corepack), python3 (governance).
