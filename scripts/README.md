# Epoch scripts

W001-owned automation. All commands run from the repository root.
See `scripts/DEPENDENCY-BASELINE.md` for the frozen dependency baseline and
CI install policy.

## Standardized entrypoints (root package.json)

| Script          | What it does                                                        |
| --------------- | ------------------------------------------------------------------- |
| `pnpm check`    | governance + package-boundary checks (always runs fresh, no cache)  |
| `pnpm typecheck`| `turbo run typecheck` — `tsc --noEmit` in every package with TS/JS sources |
| `pnpm lint`     | `turbo run lint` — eslint (flat config from `@epoch/eslint-config`) |
| `pnpm test`     | `turbo run test` — vitest in every package with tests               |
| `pnpm build`    | `turbo run build` — builds (apps/web via `next build`)              |

CI (`/.github/workflows/ci.yml`) runs the turbo form:
`pnpm turbo run governance boundary typecheck lint test build`.
The root `tsconfig.json` is an editor baseline only (`files: []`); real
typechecking happens per workspace package — do not run `tsc -p .` at the root.

## governance-check.py

Python3, stdlib only. Exit 0 = PASS, 1 = failures listed. Checks:

1. Required canonical files (incl. `IMPLEMENTATION.md`, the four
   `spec/development-state/*.json` files, `spec/worker-runbook.md`, and every
   `spec/work-orders/W*.md` referenced by the dependency graph).
2. Worker-count governance: `maxConcurrentWorkers` in 1..3; `inFlight` ⊆
   `active` with ≤ 3 ids; authorized (active ∪ inFlight) work-order files
   declare `Worker Count: 1`; any other work-order file declaring a different
   worker count is invalid.
3. Pairwise-disjoint owned surfaces across active/inFlight Work Orders
   (parsed from the `spec/work-items.md` ownership table; exact intersecting
   paths are reported).
4. W001 present in `spec/work-items.md` (bootstrap sanity).

`--root DIR` checks another tree (used by fixtures).
`--selftest` runs the negative-fixture battery — reproducible evidence that
invalid worker counts, missing canonical files, missing referenced
work-order files, and overlapping ownership are each detected
(`pnpm --filter @epoch/boundary-checker test` runs it in CI).

## boundary-check.mjs

Node, stdlib only. Exit 0 = PASS, 1 = violations, 2 = usage error. Enforces
the Epoch layer model declared in every workspace package.json via
`"epoch": { "layer": "..." }`:

- `tooling` → tooling
- `kernel` → kernel, contracts, tooling
- `contracts` → contracts, tooling
- `experience` → experience, kernel, contracts, tooling
- `pack` → contracts, kernel, tooling (capability APIs)
- `service`/`app` → anything except pack internals (deep `/src`, `/internal`)

Checked surfaces: package.json dependency edges (dependencies /
devDependencies / optionalDependencies / peerDependencies) AND static
source-level import statements (`from`/`import`/`require`/dynamic `import()`).
Relative imports escaping a package root are also violations. Violation
messages name both packages and layers.

`--root DIR` checks another tree (used by the fixtures in
`packages/boundary-checker`, which prove the valid set passes and every
violation class fails). A second, independent enforcement layer lives in
`packages/eslint-config/boundary.mjs` (`no-restricted-imports`) — the rule
tables are intentionally duplicated; keep them in sync.
