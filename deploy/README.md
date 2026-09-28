# W033 — `deploy/` (the deployment model)

The typed, DETERMINISTIC, provider-NEUTRAL deployment model of Epoch, as
data and pure functions — proof-of-correctness artifacts, not live deploys.
There are NO real cloud provider calls, NO infrastructure provisioning and
NO credentials anywhere in this tree (see
[`docs/operations/provider-neutrality-contract.md`](../docs/operations/provider-neutrality-contract.md)).

## The surface

| Module | What it is |
| --- | --- |
| `src/version.ts` | Contract version + the closed vocabularies (component kinds, environment tiers, step kinds, error codes) |
| `src/primitives.ts` | Opaque ids, the digest discipline (canonical-JSON SHA-256 over `@epoch/agent-protocol`), typed errors, the total-result shape |
| `src/provenance.ts` | Provenance on every record (actor, method, caller-supplied instant, derived-from digests) |
| `src/neutrality.ts` | The provider-vocabulary blocklist + the deterministic record scanner (`provider-vocabulary-rejected`) |
| `src/topology/` | TOPOLOGY: components, environments, placement, wiring — content-addressed data; admission, sealing, dependency closure |
| `src/gates/` | DEPLOY GATES: the verification battery as data (typed policy records + fixture gate reports + evaluation) |
| `src/plan/` | DEPLOY PLANS: the deterministic planner — dependency-sorted typed steps, replay-stable plan digests |
| `src/executor/` | The REFERENCE EXECUTOR: fixture environment states, typed step outcomes, receipts, atomic rollback |
| `test/` | The thin evidence suite (also exercises the `ops/` tree) |

## How to run

`deploy/` and `ops/` are owned W033 surfaces OUTSIDE the
`pnpm-workspace.yaml` globs, and by the W033 runtime dependency policy they
carry **no `package.json` and no `node_modules`**. The suite borrows the
toolchain of `@epoch/test-harness` (a declared devDependency of this
policy) and resolves imports through explicit aliases
(`deploy/vitest.config.mts` + `deploy/tsconfig.json`).

From the repository root, after `pnpm install`:

```bash
# the evidence suite (97 tests)
pnpm --filter @epoch/test-harness exec vitest run --root ../../deploy

# typecheck (deploy src + test + the ops tree transitively)
pnpm --filter @epoch/test-harness exec tsc --noEmit -p ../../deploy/tsconfig.json

# lint
(cd deploy && ../packages/test-harness/node_modules/.bin/eslint .)
```

The repo's own gates (`pnpm check`,
`pnpm exec turbo run typecheck lint test build`) cover the workspace
packages and are unaffected by this surface (by design — same as W031's
`tests/e2e`): the proof layer adds evidence without touching gate inputs.

## Runtime dependency policy (W033 Tech Lead pin, frozen)

The typed modules under `deploy/src` and `ops/src` depend ONLY on:

- `@epoch/agent-protocol` — canonical JSON + SHA-256 digests + the
  timestamp primitive;
- `@epoch/tenancy` — the tenant-id primitive;
- `zod` — schema validation;
- (`ops/` additionally composes `@epoch/deploy-model` — this tree's own
  deploy surface, never a workspace package).

Test-only devDependencies (declared policy; resolved via aliases):
`@epoch/test-harness` (toolchain borrow: vitest, typescript, eslint,
`@types/node`), `vitest`, `typescript`, `@epoch/tsconfig`,
`@epoch/eslint-config`. `@epoch/observability` (W030) is NOT merged at
this revision and is skipped gracefully — see
[`docs/operations/runbook-index.md`](../docs/operations/runbook-index.md).
No third-party dependencies were added.

## Determinism contract

Zero wall-clock, zero randomness, zero network. Every instant is
caller-supplied; every id/digest is content-derived. Identical inputs
produce identical digests everywhere: topology revisions built from the
same records in any order, plans planned from the same topology + set +
environment, runs executed against the same fixtures — byte-identical,
pinned by `deploy/test/*.test.ts`.
