# @epoch/progressive-scene

Epoch Progressive Scene kernel (Work Order **W019**, experience layer) —
the **content-side half of Renderer/Device Adaptation**: deterministic
progressive refinement of sealed W011 Experience Graphs into ordered LOD
ladders that fit the W013 renderer hosting budgets.

## What this package owns

- **The canonical reduction stage sequence** (`CANONICAL_STAGE_ORDER`,
  `CANONICAL_STAGE_TABLE`) — animation clips drop first, opaque
  content-addressed mesh assets substitute to neutral box proxies
  (texture relief), expensive primitives (spheres) downgrade to the box
  proxy (the classic geometry LOD step), supplementary presentation
  nodes prune in canonical order (cursors → seats → markers → tracks),
  then the frozen 3D→2D fallback (`prune-spatial-nodes` — the "low
  capability = 2D/reduced" row), then shapes, controls, and the minimal
  core. One pure total applicator per stage (`src/reduce.ts`).
- **The sealed progressive scene ladder**
  (`deriveProgressiveLadder`) — rung 0 is the source graph at full
  fidelity; every subsequent rung is the previous rung with exactly one
  stage applied, **re-sealed as a valid W011 graph** (mountable through
  the unchanged W013 `mount-graph` path) and carrying an explicit
  `RungReduction` manifest (pruned ids, substitutions, dropped edges,
  usage before/after) — same semantics, different fidelity, **never
  silent** (the W016 fidelity discipline). Rungs chain by digest, so
  the derivation history is tamper-evident; `rungGraphAt` re-derives
  any rung deterministically.
- **Budget fitting** (`fitGraphToLimits`) — walks the ladder against
  the W013 binding's effective limits and returns the first fitting
  rung with its sealed graph digest, usage estimate, the full reduction
  trace, and the **declared usage the W013 mount envelope must carry**
  (`declaredTriangles` / `declaredTextureBytes`). When even the
  minimal-core rung cannot fit, the answer is a typed
  `unfittable-scene` rejection — honesty over silent clamping.
- **Deterministic usage accounting** (`estimateGraphUsage`) — exact
  node/edge counts, the mirrored W012 per-primitive triangle estimate
  table (`PROGRESSIVE_PRIMITIVE_TRIANGLE_ESTIMATES`, parity-pinned via
  devDependencies — never a runtime edge), and exact mesh-asset bytes.

## Non-negotiables

- **Same semantics** (lock rule 8): surviving nodes keep their projected
  kernel references; the tenant scope, graph id, projected inputs, and
  device slot carry over verbatim. Adaptation changes presentation
  fidelity, never semantics.
- **Determinism**: zero wall-clock, zero randomness, zero I/O; the same
  source graph + ladder id always yields the byte-identical
  content-addressed ladder.
- **Tenant isolation (R12)**: the ladder fixes the graph's tenant scope;
  cross-tenant derivation and admission are typed
  `cross-tenant-denied` rejections.
- **Provider neutrality** (lock rule 13): the proxy primitive is the
  neutral `box`; zero engine vocabulary, zero GPU code, zero
  UI-framework dependencies; strict objects reject vendor fields.

## Runtime dependencies

`@epoch/agent-protocol` (canonical digest machinery),
`@epoch/experience-protocol` (the W011 graph vocabulary), and
`@epoch/renderer-runtime` (the W013 effective-limits authority — the
fit target, never redefined). Compatibility with
`@epoch/experience-compiler` (the estimate table) and
`@epoch/experience-runtime` is pinned via devDependencies +
compile-time parity (`src/kernel-parity.ts`) and runtime parity tests —
never runtime deps.

## Composition flow (W019)

```
W011 sealed Experience Graph ──deriveProgressiveLadder──▶ sealed ladder (rungs, manifests)
        │                                                        │
        │                          fitGraphToLimits(graph, W013 binding.effective)
        ▼                                                        ▼
  W013 RendererBinding ─────────────▶ fitting rung (re-sealed W011 graph + declaredUsage)
                                          │
                                          ▼
                        W013 admitInvocation(mount-graph, rung, declaredUsage)  [unchanged path]
```

## Contract surface

Version constants + typed index export (`src/index.ts`), runtime zod
validators (`src/*.ts`), and the committed JSON Schema projection under
`schemas/` pinned by `test/contract-drift.test.ts` (the W007/W009/W015/
W016 in-package convention). Regeneration:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/progressive-scene test contract-drift
```

## Tests

`pnpm --filter @epoch/progressive-scene test` — positive, negative,
boundary (stage skips, minimal-core survival, exact-fit rung selection,
inclusive budgets), determinism, provider-neutrality, W012/W013
runtime parity (a fitted rung mounts through a REAL W013 binding
end-to-end), and contract drift (85 tests).
