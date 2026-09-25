# contracts/experience-compiler — Epoch Experience Compiler contract surface

Owned by Work Order **W012** (`packages/experience-compiler/*`,
`contracts/experience-compiler/*`). Experience layer.

This directory publishes the typed, versioned, provider-neutral contract
surface of the Epoch **Experience Compiler v1** at its ownership boundary:
the sealed **Render Plan** document — the deterministic, renderer-ready
compiled projection of a W011 Experience Graph for one target device
(staged, sorted, device-shaped, tenant-scoped; envelope digest → plan
digest chain). The runtime implementation is
`@epoch/experience-compiler`; this contract defines only the typed shapes —
no compilation, no rendering, no orchestration lives here.

## Contents

| Path | What it is |
|---|---|
| `index.d.ts` | Versioned TypeScript declaration surface (self-contained, no imports, no runtime code, no vendor/engine vocabulary). |
| `parity.ts` | Compile-time conformance assertions: every published type must be *identical* to the implementation's zod-inferred type. Compiled by `packages/experience-compiler`'s `typecheck` script; any drift fails `pnpm typecheck`. |
| `manifest.json` | Exact-revision evidence anchor: contract version, protocol version, data-type inventory, document kinds, and a SHA-256 digest for every emitted schema file. |
| `schemas/*.schema.json` | Deterministic JSON Schema (draft 2020-12) projection of every surface type, emitted by `renderExperienceCompilerContractFiles()` in `@epoch/experience-compiler`. |

## Authority split (architecture lock rules 8/16)

The Render Plan is a **compiled projection, never authority**:

- the plan chains to the exact W011 envelope revision via
  `sourceEnvelopeDigest` (part of the digested content — the plan digest
  addresses both);
- kernel state is addressed ONLY through `ProjectedReference` values
  (reused W011 shapes): opaque, tenant-scoped, exact-revision digests;
  embedding a kernel object is structurally inexpressible (strict objects
  reject it as `malformed-descriptor`), and kernel-reserved or
  vendor/engine presentation-attribute keys are rejected by the compiler
  with typed `authority-violation` errors (first-class);
- the plan carries no mutation surface, no query language, and no
  semantic vocabulary — a plan cannot state truth, only present it;
- plans are content-addressed: the `digest` is the SHA-256 of the canonical
  JSON of the content (digest field excluded); admission rejects a claimed
  digest that does not match (tamper detection).

## Tenant isolation (R12)

The plan carries the source envelope's `tenantScope` verbatim. Compile
requests and plan admissions for a different expected tenant are rejected
with typed `cross-tenant-denied` errors carrying expected and encountered
tenant ids and a precise path.

## Device-aware plan shaping (R29)

`constraints` carries the target device's budgets and limits as data;
`usage` carries the compiler's deterministic resource accounting. Countable
budget violations are typed `device-budget-exceeded` rejections at compile
time (never silent degradation); opaque mesh assets under a declared
memory budget must declare `byteSize` (accountability). Fidelity
differences (stereoscopy, pose tracking, modalities, refresh, pixels) are
carried as data for the downstream presenter — W019 adapts them.

## Provider neutrality (lock rule 13)

No vendor, engine, renderer, framework, or API vocabulary exists in these
types. A blocklist test fails the build if any vendor/engine token appears
in the published artifacts; the compiler additionally REJECTS
vendor/engine keys in presentation attributes (the `authority-violation`
origin `vendor-blocklist` path). Concrete engines stay behind the
W013/W019 adapter boundary.

## Versioning

`protocolVersion` (`"1.0.0"`) is carried by every plan and validated
exactly — a differing version is a typed `version-unsupported` admission
error, never a silent parse. `contractVersion` (`"1.0.0"`) versions this
published surface. See `contracts/agent/README.md` for the shared policy;
the compiler contract evolves independently.

## Mirrored shared vocabulary

The W011 presentation vocabulary (geometry, styling, meshes, keyframes,
participants, intents, device descriptors, projected references) and the
agent-protocol `JsonValue` primitive are redeclared here so this directory
is a self-contained published artifact; their canonical homes are
`contracts/experience` (W011) and `contracts/agent` (W003), and the parity
assertions verify the mirrors against the implementation (which imports
them from the owning packages).

## JSON Schema fidelity and determinism

Structural-only projection; runtime refinements (canonical stage/op
ordering, stage-kind legality per graph kind, usage consistency, anchor
resolvability, digest verification, tenant checks) are enforced by
`@epoch/experience-compiler`. The committed artifacts are byte-identical
to the deterministic emission (`test/contract-drift.test.ts`);
regeneration is only possible through the documented update mode:

    EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/experience-compiler test contract-drift

## Reconciliation notes (architecture questions)

- The dispatch's "(layer kernel)" gloss is realized as **experience
  layer** in the `epoch.layer` field: the pinned runtime dependency on
  `@epoch/experience-protocol` (experience layer) cannot be imported by a
  kernel-layer package under the W001 boundary rules; W011/W013 are the
  precedent. Recorded in the W012 PR.
- The compiler error taxonomy is the dispatch's six codes plus
  `digest-mismatch`, inherited from the reused W011 admission discipline
  (envelope tamper detection must stay distinguishable from malformed
  payloads).
- `PRIMITIVE_TRIANGLE_ESTIMATES` are conservative deterministic budget
  estimates for enforcement and downstream declared usage — NOT render
  truth; concrete adapters tessellate differently.
