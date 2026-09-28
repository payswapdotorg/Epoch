# W035 — `release/` (the release readiness kit)

The typed, DETERMINISTIC release/SDK-docs/marketplace READINESS model of
Epoch, as data and pure functions — proof-of-correctness artifacts, not
live release tooling. Nothing in this tree contacts a distribution
channel, reads git state, or executes a command: the battery is DATA
(mirrored from the W033 deploy gate), the revision is caller-supplied
data, and every record is content-addressed.

## The surface

| Module | What it is |
| --- | --- |
| `src/version.ts` | Contract version + the closed vocabularies (readiness domains, check kinds, verdicts, component kinds, budget outcomes, event kinds, error codes) |
| `src/primitives.ts` | Opaque ids, the digest discipline (canonical-JSON SHA-256 over `@epoch/agent-protocol`), typed errors, the total-result shape |
| `src/provenance.ts` | Provenance on every record (typed actor: opaque id + role, method, caller-supplied instant, derived-from digests) — the W033 shape, mirrored |
| `src/scope.ts` | THE SCOPE: components, battery (the W033 GateCommand grammar, mirrored), benchmark citations (the W034 vocabulary, mirrored), SDK surface pins, the marketplace readiness subject |
| `src/evidence.ts` | The typed completion-evidence union (one shape per check kind) + admission (positivity enforcement) |
| `src/checklist.ts` | THE CHECKLIST: deterministic derivation over the fixed DOMAIN_CHECK_TABLE, immutable completion transitions, sealing + tamper detection |
| `src/evaluation.ts` | THE VERDICT: the pure ready/blocked fold with typed open items (a sealed, content-addressed record) |
| `src/notes.ts` | Release notes as typed records with typed citations |
| `src/manifest.ts` | THE MANIFEST: seals only when ready (the typed refusal point), rolls evidence up per domain, derives its id from its digest |
| `src/events.ts` | THE JOURNAL: append-only `release:readiness` events over the W010 event shapes (type-equal mirror) + the deterministic replay fold |
| `src/index.ts` | The typed public API |
| `test/` | The evidence suite (positive / negative / recovery / determinism / parity / contract-sync / examples) |

## How to run

`release/` is an owned W035 surface OUTSIDE the
`pnpm-workspace.yaml` globs, and by the W035 runtime dependency policy
it carries **no `package.json` and no `node_modules`**. The suite
borrows the toolchain of `@epoch/test-harness` (a declared
devDependency of this policy) and resolves imports through explicit
aliases (`release/vitest.config.mts` + `release/tsconfig.json`).

From the repository root, after `pnpm install`:

```bash
# the evidence suite (75 tests)
pnpm --filter @epoch/test-harness exec vitest run --root ../../release

# typecheck (release src + test + examples/sdk transitively)
pnpm --filter @epoch/test-harness exec tsc --noEmit -p ../../release/tsconfig.json

# lint (the release tree; then the examples/sdk tree)
(cd release && ../packages/test-harness/node_modules/.bin/eslint .)
(cd examples/sdk && ../../packages/test-harness/node_modules/.bin/eslint .)
```

The repo's own gates (`pnpm check`, `pnpm exec turbo run typecheck
lint test build`) cover the workspace packages and are unaffected by
this surface (by design — the same discipline as W033's `deploy/` and
W031's `tests/e2e`): the proof layer adds evidence without touching
gate inputs.

## Runtime dependency policy (W035 Tech Lead pin, frozen)

The typed modules under `release/src` depend ONLY on:

- `@epoch/agent-protocol` — canonical JSON + SHA-256 digests + the
  timestamp primitive;
- `@epoch/tenancy` — the tenant-id primitive;
- `zod` — schema validation.

The upstream authorities this model COMPOSES (W033 deploy-model, W034
performance, W023 marketplace, W010 event-log, the W007/W008 SDK
packages) are consumed as TEST-ONLY imports through the vitest/tsc
aliases — never runtime edges (the W023 devDep-parity precedent):
`release/test/parity.test.ts` pins every mirrored grammar against the
real exported constants and validators, and
`release/test/contract-sync.test.ts` pins the SDK docs' version
declarations against the real contract constants.

## The evidence suite

| File | What it proves |
| --- | --- |
| `readiness.positive.test.ts` | The golden path: scope admission, deterministic derivation, immutable completion, evaluation, notes, manifest roll-up, journal + fold |
| `readiness.negative.test.ts` | Every typed refusal point (validation / digest-mismatch / unknown-item / item-already-complete / evidence-rejected / release-not-ready), one named test each |
| `readiness.recovery.test.ts` | Blocked → ready by completion (no rewrite); tamper → re-seal; journal extension → replayed recovery |
| `determinism.test.ts` | Byte-identical digests across two full pipeline runs; byte-stable example digest projections |
| `parity.test.ts` | The upstream pins: W010 (type-equal event content, real seal-path admission, identical digests), W033 (battery grammar, reference battery, component kinds, provenance), W034 (budget vocabulary, id grammar), W023 (id grammars) |
| `contract-sync.test.ts` | The SDK docs version matrix vs the REAL exported constants; the pinned doc files exist; the release notes cite real budget ids |
| `examples.test.ts` | The five SDK examples run green with asserted typed outcomes |

## Determinism contract

Zero wall-clock, zero randomness, zero I/O in `src/`. Every instant is
caller-supplied; every id/digest derives from content. The only file
reads in the tree are the committed doc fixtures of
`contract-sync.test.ts` (content-addressed by git — deterministic).

## Not this tree's concern

Distribution, artifact publishing, channel management, release
automation against live systems, git operations, changelog generation
from commit history, and UI — any real distribution channel is a future
adapter behind a provider-neutral seam (the W033 provider-neutrality
pattern applied to release). The release DOCUMENTATION is
`docs/release/`; the SDK docs are `docs/sdk/`; the marketplace
readiness docs are `docs/marketplace-readiness/`.
