# qa/rendering — the W061 engine-pair battery

The direct cross-engine battery of the renderer closure (Work Order
W061, ACR-007/X2.0): the REAL Three.js adapter (W058) and the REAL
Babylon.js adapter (W059) in ONE fabric, over the SHARED canonical
conformance fixture — the cross-battery the wave-1 review deferred to
this closure ("transitivity already holds through the shared reference
adapter; the direct run is W061's").

## What the battery proves

`engine-pair.test.ts` — the direct Three.js ⇄ Babylon.js switch:

- **one registry, both engines** — both real adapters register through
  the REAL capability registry and present the SAME canonical world
  (same tenant, same world digest, same semantic entity ids, same
  presented set);
- **the direct switch both directions** — Three.js → Babylon.js →
  Three.js through the REAL switching invariant: the canonical world
  digest and tenant carry, the target mounts from the canonical
  projection, the FULL portable view state restores (both engines
  declare the complete grammar — camera, focus, layers, timeline), the
  receipt seals, the source session disposes;
- **identical normalized intents** — the same logical interaction through
  each engine's OWN hit-test surface (the Three.js Raycaster / the
  Babylon `scene.pick`, the pointer DERIVED from each engine's own
  projection) produces the IDENTICAL content-addressed intent payload
  digest on both engines in both directions;
- **no durable mutation** — the canonical fixture object is
  byte-identical after the full cross-engine round trip;
- **tenant sealing** — a cross-tenant world projection never mounts on
  either engine (the R12 gate; the direct registry changes nothing).

`degradation-fallback.test.ts` — the forced degradation/failure/fallback
ladder (the W061 acceptance legs "force renderer degradation and verify
the declared fallback" / "force renderer failure and verify the declared
fallback"):

- **declared degradations apply on BOTH engines** (reduced-fidelity,
  static-frame, wireframe): presentation-only, reversible, recorded in
  the frame envelope and the session record, and RECOVER (a later `none`
  frame returns the record to `active`);
- **undeclared degradations are typed refusals** — the fabric gate
  (declared-only, never silent), proven with a narrow-capability engine
  variant in the SAME fabric where the real Three.js engine still accepts
  the same declared kind;
- **the ordered fallback chain** — a switch whose PRIMARY target cannot
  present (a probe-incompatible engine variant) COMPLETES on the OTHER
  REAL ENGINE, recorded (`fallbackApplied` + the typed trigger) with
  digest/tenant continuity intact;
- **the abort path** — a switch whose target cannot MOUNT (a
  forced-mount-failure engine variant) aborts typed (`switch-aborted`,
  stage `mount`) and the previous session is RETAINED (still active,
  still presenting, still interactive; the half-created target session is
  disposed — no orphans);
- **degraded sessions still switch** — degradation is presentation
  state, not identity: a static-frame-degraded source switches with full
  continuity, and the reverse direction holds.

## How to run

The battery rides the `@epoch/renderer-fabric` pipeline (the W056
qa/renderer-conformance doctrine):

```
corepack pnpm --filter @epoch/renderer-fabric test
```

The fabric package's `typecheck`/`lint` scripts type-check/lint this
directory's own tsconfig/eslint; its vitest includes
`../../qa/rendering/*.test.ts` and the globalSetup link script
(`packages/renderer-fabric/scripts/link-rendering-harness.mjs`) creates
this directory's gitignored `node_modules` symlink after a fresh install.

## Honest scope

The deterministic cores of both engines (scene graphs, hit-testing,
normalization, switching, snapshots, disposal) run for REAL here in
Node 22 — GL rasterization and real pixels are the browser E2E surface
(`apps/web/e2e/j13-world.spec.ts`), not this battery. The typed HEADLESS
frame-image-capture refusals of both adapters are pinned by their own
unit batteries (`adapters/renderers/threejs` capture-capabilities,
`adapters/renderers/babylonjs` capture) — not duplicated here.
