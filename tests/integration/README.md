# W032 — Cross-domain Integration Scenario Packs (`tests/integration`)

The **core deliverable** of the Cross-domain Integration Harness: named
scenarios that CROSS the two domain packs through the
`@epoch/test-harness` scenario engine — one solution carrying BOTH a
construction work-package (W026 BOQ/programme projections) and a
software work-package (W027 roadmap/backlog projections), over the SAME
W036 solution-delivery spine.

- **Scenario definition**: `scenarios/cross-domain-delivery.ts` (the
  declarative, content-addressed DSL record — 41 steps)
- **The real-kernel driver**: `scenarios/cross-domain-driver.ts`
  (composes W026, W027, W036, W037, W038, W039, W006, W010 through
  their public admission paths; nothing mocked, no kernel internals)
- **Tests**: `test/*.test.ts` (vitest, 33 tests)

## The scenario

```
W026 pack profile ─┐
W027 pack profile ─┤   (both admitted through the W036 gate)
                   ▼
W036 solution (3 lines: 2 construction + 1 software) → baseline approval
                   ▼
W036 ProgramOfWork (BOTH variants: construction-build + software-implementation-deployment)
                   ▼
   ┌──────────────┴──────────────┐
   ▼                             ▼
W026 BOQ projection        W027 roadmap projection
(line ids ≡ plan-line ids)  (releaseId ≡ milestoneId)
W026 programme projection  W027 backlog projection
(activity ids ≡ program)    (epic ≡ workPackage, issue ≡ activity)
   └──────────────┬──────────────┘
                  ▼
W037 procurement chain (Acquire: request → package → quote → selection
   → commitment → purchase order → supplier receipt)
                  ▼
W038 execution tracking (Realize: field intakes for BOTH domains,
   change record, tracking states)
                  ▼
W036 SHARED delivery record (3 observations: excavation + staging
   deploy + steel receipt, through the authority path)
                  ▼
W039 SHARED actualization fold (one store, one acceptance pass,
   actuals for BOTH domains)
                  ▼
W039 SHARED variance ledger (a construction variance AND a software
   variance, one fold summary) + attribution (real W038 change cause,
   real W006 evidence)
                  ▼
Supervision fold (actuals + actualization + variance + delivery links
   + execution state — both domains agree)
                  ▼
Recovery (replay → tamper → verified-prefix continuation) + negatives
   (cross-tenant denial in-trace; authority-bypass attempts rejected)
```

## The named tests (acceptance criteria → evidence)

| Criterion | Named test |
|---|---|
| One solution, BOTH packs, shared delivery/actualization/variance, identity mapping end-to-end | `cross-domain-delivery.test.ts` (13 tests): BOQ line ids ≡ solution line ids; roadmap releases ≡ program milestones; backlog epics/issues ≡ program work-packages/activities; ONE delivery record with BOTH domains' observations + actuals; ONE variance ledger with BOTH domains' variances; delivery links carry one identity spine |
| Cross-tenant denial recorded in-trace | `cross-domain-negative.test.ts`: the `step:delivery-observe-foreign` trace entry carries the typed denial (`cross-tenant-denied`, both tenants) with no state delta; the tenant-isolation invariant passes over the whole scenario |
| Authority-bypass attempt rejected | `cross-domain-negative.test.ts`: `reviseSolutionBaseline` → `baseline-mutation-rejected` (no state delta); tampered event append → `digest-mismatch` (the log refuses); the authority-routing invariant passes |
| Tamper detection + verified-prefix continuation | `cross-domain-recovery.test.ts`: mid-stream tamper detected at the exact index (typed `digest-mismatch`); the fold continues from the verified prefix, byte-identical to folding the untampered records to the same point; replay from a restored log snapshot reproduces the identical state digest; the replayed state equals the live kernel state |
| `trace-replay-deterministic` | `trace-replay-deterministic.test.ts` (6 tests): the runner double-run produces a byte-identical trace; a second full `runScenario` reproduces identical trace bytes + result digest |
| Round-trip + digest verification for scenarios, traces, results | `trace-replay-deterministic.test.ts` (scenario + trace + digests), `cross-domain-delivery.test.ts` (trace sealing), plus the harness library's own 36 tests |
| `contract-drift` suites green across every contracts/* tree | `tests/contracts` (416 tests) |

## How to run

`tests/integration` is an owned W032 surface **outside the
pnpm-workspace globs** (the root manifests are frozen for this Work
Order), so it is not a pnpm importer and carries no `node_modules`. The
suite borrows the toolchain of an existing workspace package and
resolves imports via explicit aliases (`vitest.config.mts` +
`tsconfig.json` paths — the same set `package.json` declares as
devDependencies).

From the repository root (after `pnpm install`):

```bash
# the cross-domain scenario packs (33 tests)
pnpm --filter @epoch/pack-construction exec vitest run --root ../../tests/integration

# typecheck
pnpm --filter @epoch/pack-construction exec tsc --noEmit -p ../../tests/integration/tsconfig.json

# lint
(cd tests/integration && ../../packs/construction/node_modules/.bin/eslint .)
```

## Runtime dependency policy (W032 Tech Lead pin, frozen)

The composed workspace packages as **devDependencies only** (declared in
`tests/integration/package.json`): `@epoch/solution-delivery`,
`@epoch/procurement`, `@epoch/execution-tracking`,
`@epoch/actualization`, `@epoch/variance`, `@epoch/pack-construction`,
`@epoch/pack-software`, `@epoch/document-adapter`,
`@epoch/adapter-github`, `@epoch/action-protocol`,
`@epoch/action-policy`, `@epoch/tenancy`, `@epoch/authorization`,
`@epoch/evidence`, `@epoch/event-log`, `@epoch/tsconfig`,
`@epoch/eslint-config`, `vitest`, `typescript`. No third-party
dependencies were added.

**One documented deviation** (the W031 precedent):
`@epoch/test-harness` — this Work Order's own engine (a first-party
workspace package, the deliverable this suite exists to exercise;
devDependency-only, no lockfile impact since this directory is not a
pnpm importer, no third-party dependency).

## Determinism discipline

Zero wall-clock, zero randomness, zero network (the W031 E2E
philosophy). Every id is explicit (see `scenarios/shared.ts`); every
instant is a fixed constant of the `T[…]` series; every digest is
derived from content through the shared canonical-JSON SHA-256
machinery. The runner double-runs every scenario and requires a
byte-identical trace — asserted both in-scenario (the
`replay-determinism` invariant) and by the named
`trace-replay-deterministic` tests.
