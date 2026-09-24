# runtimes/wasm — Wasm Component Model host-side machinery

Owned by Work Order **W008** (`packages/extension-sdk/*`,
`packages/extension-runtime/*`, `runtimes/wasm/*`).

The Wasm Component Model **HOST-SIDE** type surface: the canonical
component layout (typed descriptor + canonical binary layout rules —
digests, sizes, deterministic ordering), typed import/export surface
declarations (WIT-style), and validation machinery (structural checks +
digest verification).

## Scope discipline (W008)

- **NON-workspace machinery**: this directory is NOT matched by the
  pnpm workspace globs (same status as `contracts/*`), carries NO
  package.json, and is never added to the workspace globs.
- **Self-contained TypeScript source**: `src/` imports NOTHING — not
  zod, not `@epoch/agent-protocol`. The canonical-JSON + SHA-256
  machinery (`src/canonical.ts`, `src/digest.ts`) is a deliberate
  MIRROR of `@epoch/agent-protocol`'s implementation (the "reuse or
  mirror" option from the W008 pin), pinned by parity evidence in
  `test/digest.parity.test.ts`: NIST FIPS 180-4 test vectors, a
  node:crypto cross-check over deterministic corpora, and a
  canonical-JSON fixture corpus.
- **Zero vendored toolchains, zero actual Wasm binaries, zero
  network**: section contents are verified over caller-provided bytes
  (synthetic deterministic content in tests).

## How it is exercised

Typecheck and tests run through `@epoch/extension-runtime`
(`tsconfig.wasm.json` + the `wasm-layout` vitest project) — the
`contracts/*` precedent of checking non-package directories through
the owning workspace package.

## The rule table (single source of truth)

`src/rules.ts` declares the layout surface as a rule tree. Two
deterministic projections derive from it:

- `src/validate.ts` — the structural validator (generic walker: strict
  objects reject unknown fields with precise paths) plus the
  canonical-ordering semantic layer (sorted + duplicate-free arrays);
- `src/emit.ts` — the JSON Schema (draft 2020-12) renderer.

`test/schema-drift.test.ts` pins the committed files under `schemas/`
byte-identical to the emission (regeneration:
`EPOCH_UPDATE_CONTRACTS=1` run from `packages/extension-runtime`).

## Author/host parity (defense in depth)

The author-side `WasmComponentDescriptor` is published by
`@epoch/extension-sdk` (zod-validated). The host deliberately
re-validates independently — sandbox boundaries never trust
author-side tooling. Shape compatibility is pinned by the SHARED
COMMITTED FIXTURE `test/fixtures/component-descriptor.fixture.json`
(REAL SHA-256 section digests over the documented synthetic byte
content in `test/helpers.ts`), which BOTH validators must accept.

## Contents

| Path | What it is |
|---|---|
| `src/version.ts` | Contract version + closed vocabularies (section kinds, WIT value types, patterns). |
| `src/types.ts` | Typed host-side view (descriptor, interfaces, functions, sections). |
| `src/canonical.ts`, `src/digest.ts` | Mirrored canonical JSON + SHA-256 (parity-pinned). |
| `src/rules.ts` | The rule table (validation + emission source of truth). |
| `src/validate.ts` | Structural validation + canonical-ordering semantics. |
| `src/layout.ts` | Content addressing: seal/verify descriptor digests; section-content verification. |
| `src/emit.ts` | Deterministic JSON Schema emission. |
| `schemas/` | Committed contract files + `manifest.json` digest table. |
| `test/` | Positive/negative layout tests, digest parity evidence, schema drift. |
