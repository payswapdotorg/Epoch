# qa/renderer-conformance — the W056 renderer conformance harness

The shared-fixture conformance battery of the Renderer Fabric contract
(Work Order W056, ACR-007/X2.0): the acceptance proof that the fabric can
mount a REAL adapter contract, normalize a user interaction into the
EXISTING typed Epoch world-interaction intent vocabulary, SWITCH renderers,
and prove canonical identity/digest continuity — without durable semantic
mutation.

## What the harness proves (spec/renderer-fabric-architecture.md)

Running TWO distinguishable instances of the contract-only reference
adapter (`@epoch/renderer-fabric` `ReferenceRendererAdapter` — two renderer
kinds, different capability sets) over ONE shared canonical fixture (a REAL
W016 `WorldScene` compiled through the REAL W016 compiler and admitted
through the REAL W013 hosting boundary):

- **tenant continuity** — same tenant across both renderers and the switch;
- **digest continuity** — the canonical world digest survives mounting,
  input normalization, and switching;
- **semantic entity ids** — both renderers present the same semantic entity
  ids (opaque canonical references, never embedded state);
- **equivalent supported interaction outcomes** — the same normalized
  pointer resolves the same semantic entity on both renderers;
- **same semantic focus/layers** — the portable view state (focus, layer
  visibility, timeline) carries across the switch;
- **equivalent normalized intents** — renderer input normalizes to the
  SAME typed `epoch.world.interaction.*` intents on both renderers (the
  EXISTING W016 vocabulary — never a parallel one);
- **renderer-specific differences confined to presentation** — the reduced
  renderer skips undeclared portable fields (typed, listed, never silent).

Every run emits a sealed, content-addressed `RendererConformanceResult`
(the `epoch.renderer-conformance-result` contract document).

## Honest scope

W056 freezes the CONTRACT + FABRIC + CONFORMANCE with a contract-only
reference adapter proving the seam end-to-end. This harness imports ZERO
rendering engines (no Three.js, no Babylon.js — those arrive as real
adapters in W058/W059 behind the frozen seam) and draws nothing; the
reference adapter's "presentation" is a typed in-memory index of the
canonical projection's presented entities.

## Layout

- `fixture.ts` — the shared conformance fixture: the canonical W016 scene
  (entities, ontology, timeline, camera, agent, focus, overlay), the
  tenant-scoped device snapshot, the two reference renderers, and the
  fabric wired through the REAL `@epoch/capability-registry`.
- `renderer-conformance.test.ts` — the positive battery: registration,
  mount, input normalization, switching, continuity proofs, no-mutation
  proofs, and the sealed conformance result.
- `renderer-conformance.negative.test.ts` — the failure/degradation/fallback
  battery: typed failures for every documented failure mode, aborted
  switches retaining the previous session, fallback chains, degradation
  typing, and the tenant/digest continuity violations.

## Running

NOT a pnpm workspace package (`pnpm-workspace.yaml` is frozen). The
harness rides `@epoch/renderer-fabric`'s pipeline (the W050
`qa/cross-platform` precedent):

```
corepack pnpm --filter @epoch/renderer-fabric test          # unit + this harness
corepack pnpm --filter @epoch/renderer-fabric typecheck      # cold typecheck incl. this harness
corepack pnpm --filter @epoch/renderer-fabric lint           # lint incl. this harness
```

The harness's `node_modules` is a gitignored symlink created by the
fabric's vitest `globalSetup` (`packages/renderer-fabric/scripts/
link-conformance-harness.mjs`); its TypeScript typecheck never depends on
the link (every bare import is mapped declaratively in `tsconfig.json` —
the W048/W050 cold-checkout doctrine).
