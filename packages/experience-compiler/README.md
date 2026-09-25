# @epoch/experience-compiler

Epoch Experience Compiler v1 — Work Order **W012** (experience layer).

The pure projection stage between the W011 Experience Protocol and the W013
renderer surfaces (architecture.md "Experience Runtime" — binding): it
**validates** Experience Graph envelopes with the W011 admission discipline
and **compiles** them into deterministic, renderer-ready **Render Plans** —
staged, canonically sorted, content-addressed, device-shaped, and
tenant-scoped. It is never semantic authority, never mutates kernel state,
and never becomes a second semantic store (architecture lock rules 8/16).

## Entry points

| Export | What it is |
|---|---|
| `compileExperienceGraph({ envelope, device, expectedTenantId? })` | The total compile entry point: W011 envelope admission (reused 1:1), target-device gates, vendor-field authority scan, per-graph-kind deterministic passes, device budget enforcement, sealing. Returns `CompilerResult<RenderPlan>` — never throws. |
| `parseRenderPlan(input, options?)` | The consumer-side total admission of a serialized plan (version gate → schema → digest → tenant → resolvability). |
| `serializeRenderPlan` / `computeRenderPlanDigest` / `sealRenderPlan` / `verifyRenderPlanDigest` / `planDigestChain` | Digest discipline: canonical SHA-256 content addressing, tamper detection, and the envelope-digest → plan-digest chain. |
| `computePlanUsage` / `enforceDeviceBudgets` / `constraintsOf` | Device-aware plan shaping as reusable pure functions. |

## The Render Plan

A plan is a sealed document (`schema: 'epoch.render-plan'`,
`protocolVersion: '1.0.0'`, document kind `experience.render-plan`) that:

- **chains to the exact envelope revision** — `sourceEnvelopeDigest` is part
  of the digested content, so the plan digest addresses both the compiled
  form and the envelope revision it compiled from;
- **carries the envelope's tenant scope verbatim** (R12) — cross-tenant
  compile requests are typed `cross-tenant-denied` rejections;
- **preserves projected kernel references opaquely** — `sourceRefs` and
  per-op `ref` values are the W11 `ProjectedReference` shapes, unchanged;
- **restructures the presentation content into stages** — the fixed
  canonical pipeline `relate > draw-2d > place-3d > animate > narrate >
  timeline > presence > controls`, each stage present iff it has content,
  each stage's ops canonically sorted (draw order, node id, flattened
  animation keys, narrative sequence, timeline time, participant id);
- **records device-shaped constraints as data** — `constraints` mirrors the
  target device's budgets/limits for downstream presenters (W013/W019);
- **records deterministic resource usage** — `usage` carries exact
  node/edge counts, the conservative primitive-triangle estimate
  (`PRIMITIVE_TRIANGLE_ESTIMATES`; meshes count 0), and mesh-asset bytes.

## Compile precedence (fixed; every failure is a typed `CompilerError`)

1. **envelope admission** — the full W011 pipeline via
   `parseExperienceGraph` (version gate, schema gate, digest gate, tenant
   gate, resolvability gate, kernel authority gate); failures surface 1:1
   with the same code;
2. **target-device version gate** — numeric `descriptorVersion` skew fails
   fast with `version-unsupported`;
3. **target-device schema gate** — W011 device-descriptor validation with
   precise dotted paths;
4. **vendor-field authority gate** — presentation-attribute keys (including
   nested object keys) carrying vendor/engine token segments
   (`VENDOR_KEY_SEGMENTS`) are rejected as `authority-violation` with
   origin `vendor-blocklist`;
5. **structural compile gate** — per-graph-kind passes; cyclic `follows`
   chains and over-anchored labels are typed `malformed-descriptor`
   rejections;
6. **device budget gate** — countable violations are typed
   `device-budget-exceeded` (`maxTriangles` / `maxTextureBytes`); opaque
   mesh assets under a declared memory budget must declare `byteSize`
   (accountability is a typed `malformed-descriptor`, never a silent
   pass);
7. **seal** — schema-validated, canonical-JSON digested, returned.

## Determinism

Identical `(envelope, device)` inputs compile to **byte-identical** plans
(canonical JSON, sorted iteration, stable ids; zero wall-clock, zero
randomness in src). Key-order permutations of the envelope JSON produce
identical plan bytes; a different target device produces a different plan
digest.

## Authority boundaries (tested first-class)

- kernel-reserved presentation-attribute keys → `authority-violation`
  (origin `kernel-reserved`, via the reused W011 admission);
- vendor/engine fields (including nested attribute keys, camelCase and
  separator variants) → `authority-violation` (origin `vendor-blocklist`);
- inline kernel state is structurally inexpressible (strict objects; the
  plan references kernel state opaquely, never embeds it);
- provider neutrality: no vendor/engine/framework token may appear in the
  contract surface or in compiled plan bytes (neutrality battery).

## Runtime dependencies (the W012 pin)

Exactly `@epoch/agent-protocol` (canonical digest machinery) and
`@epoch/experience-protocol` (the consumed W011 envelope/device vocabulary
— genuine runtime composition; same shape as W013's renderer-runtime).
Compatibility with `@epoch/world-model` (projected references) and
`@epoch/renderer-runtime` (the downstream plan consumer) is pinned via
devDependency compile-time parity (`src/host-parity.ts`) and runtime parity
tests (`test/world-parity.test.ts`, `test/renderer-parity.test.ts`) — never
runtime deps.

## Contract surface

The published, versioned contract surface lives at
`contracts/experience-compiler/` (the W002-W004 shared-contract
convention): `index.d.ts` (self-contained declarations), `parity.ts`
(compile-time `Equals<>` assertions), `manifest.json` (exact-revision
anchor with per-file SHA-256), and `schemas/*.schema.json` (deterministic
JSON Schema draft 2020-12 emission). Regeneration is only possible through
the documented update mode:

    EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/experience-compiler test contract-drift

## Layer

`"epoch": { "layer": "experience" }` — the W001 boundary convention: the
pinned runtime dependency on `@epoch/experience-protocol` (experience
layer) requires the experience layer (a kernel-layer package may not
import experience; W011/W013 are the precedent).

## Tests

`pnpm --filter @epoch/experience-compiler test` — positive compile
round-trips, named negative cases (version, malformed, digest, tenant,
unknown-reference, kernel/vendor authority, device budgets, cycles),
determinism, plan admission, contract surface/drift, neutrality, and the
world/renderer parity batteries.
