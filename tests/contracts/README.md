# W032 — Contract Conformance Suite (`tests/contracts`)

The **contract conformance layer** of the Epoch cross-domain integration
harness: a generated-per-surface conformance runner over every published
manifest-bearing contract tree under `contracts/`.

- **Conformance runner**: `test/contract-drift.test.ts` (vitest, 406 tests)
- **Registry**: `test/registry.ts` (one entry per published tree)
- **Completeness guard**: `test/contract-registry.test.ts` (10 tests)

## What each tree is checked for

For every registered tree (`actions`, `actualization`, `agent`,
`execution`, `experience`, `experience-compiler`, `procurement`,
`renderers`, `solution-delivery` — each owned by its workspace package):

1. **BYTE-IDENTITY DRIFT** (`contract-drift`, named per tree) — the
   committed artifact set (manifest + schemas) equals the owning
   package's `render*ContractFiles()` emission, file-for-file and
   byte-for-byte, with no extra and no missing artifacts. Any pack,
   kernel or contract schema change without re-emitting its committed
   artifacts fails here — the cross-domain drift net.
2. **MANIFEST INTEGRITY** — every `manifest.schemas[]` entry's SHA-256
   matches the actual committed file bytes (the exact-revision evidence
   anchor), and the manifest's `dataTypes` inventory equals the owning
   package's published surface type list.
3. **VERSION PINNING** — `manifest.contractVersion` equals the package's
   exported contract-version constant; `manifest.protocolVersion` (when
   the tree pins one) equals the package's exported protocol-version
   constant. A version bump on either side without the other fails.
4. **ZOD ROUND-TRIP PARITY** — for every surface type, the live zod
   schema's `z.toJSONSchema()` projection equals the committed JSON
   Schema document (modulo the renderer-injected versioned `$id`, which
   is separately pinned to the tree's convention). Each committed
   document also round-trips byte-stably through JSON
   parse/stringify (the emitter's exact format).
5. **EMISSION DETERMINISM** — two renders are byte-identical.

The completeness guard asserts the registry covers **every**
manifest-bearing `contracts/*` tree on disk, so the drift net can never
silently shrink (a new published tree without registry coverage fails
the suite).

## Scope: declaration-surface trees

`contracts/world` (W002) and `contracts/constraints/v1` (W004) are
type-declaration surfaces **without** emission manifests; their parity is
enforced by their owning packages' own contract-sync tests
(`packages/world-model`, `packages/constraint-language`,
`packages/policy-contracts`). The completeness guard pins exactly that
classification: a manifest appearing in either tree (or any new tree)
must be registered or the suite fails.

## How to run

`tests/contracts` is an owned W032 surface **outside the
pnpm-workspace globs** (the root manifests are frozen for this Work
Order), so it is not a pnpm importer and carries no `node_modules`. The
suite borrows the toolchain of an existing workspace package and resolves
imports via explicit aliases (`vitest.config.mts` + `tsconfig.json`
paths — the same set `package.json` declares as devDependencies).

From the repository root (after `pnpm install`):

```bash
# the conformance battery (416 tests)
pnpm --filter @epoch/pack-construction exec vitest run --root ../../tests/contracts

# typecheck
pnpm --filter @epoch/pack-construction exec tsc --noEmit -p ../../tests/contracts/tsconfig.json

# lint
(cd tests/contracts && ../../packs/construction/node_modules/.bin/eslint .)
```

The repo's own gates (`pnpm check`, `pnpm exec turbo run typecheck lint
test build`) cover the workspace packages (including
`@epoch/test-harness`, the engine this suite and `tests/integration`
run through) and are unaffected by these surfaces.

## Runtime dependency policy (W032 Tech Lead pin, frozen)

The composed workspace packages as **devDependencies only** (declared in
`tests/contracts/package.json`; tests never ship runtime deps):
`@epoch/solution-delivery`, `@epoch/procurement`,
`@epoch/execution-tracking`, `@epoch/actualization`, `@epoch/variance`,
`@epoch/pack-construction`, `@epoch/pack-software`,
`@epoch/document-adapter`, `@epoch/adapter-github`,
`@epoch/action-protocol`, `@epoch/action-policy`, `@epoch/tenancy`,
`@epoch/authorization`, `@epoch/evidence`, `@epoch/event-log`,
`@epoch/tsconfig`, `@epoch/eslint-config`, `vitest`, `typescript`. No
third-party dependencies were added.

**Documented deviations** (the W031 precedent — workspace-internal,
devDependency-only, no lockfile impact since this directory is not a
pnpm importer, no third-party dependency added):

- `@epoch/test-harness` — this Work Order's own engine (the suite runs
  its scenarios through it; it is a first-party workspace package, not a
  third-party dep).
- `@epoch/agent-protocol` — the harness's pinned runtime dependency,
  imported directly for `sha256Hex` (the exact-revision digest anchor
  checks) and for the `contracts/agent` tree's emission.
- `@epoch/experience-protocol`, `@epoch/experience-compiler`,
  `@epoch/renderer-runtime` — the owning packages of the
  `contracts/experience`, `contracts/experience-compiler` and
  `contracts/renderers` trees. The Work Order's acceptance ("contract-drift
  suites green across every contracts/* tree") requires every published
  tree's emitter; these three own published trees and sit outside the
  pinned kernel set.
