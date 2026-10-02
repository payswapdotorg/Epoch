# qa/renderer-conformance/threejs — the W058 Three.js renderer conformance battery

The shared-fixture conformance battery of the FIRST real interactive
renderer (Work Order W058, ACR-007/X2.0): the acceptance proof that the
real Three.js viewport renders the shared canonical fixture and produces
normalized Epoch world interaction intents — behind the frozen W056
`RendererAdapter` seam, through the REAL capability registry, the REAL
W016 compiler/admission, and the REAL W013 hosting boundary.

## What the battery proves (spec/renderer-fabric-architecture.md)

Driving the REAL `@epoch/adapter-renderer-threejs` (a real Three.js scene
graph, a real Raycaster, real camera math) over the SAME shared canonical
fixture as the W056 harness (`../fixture.ts` — the same tenant, the same
sealed scene digest, the same semantic entity ids), with the contract-only
reference renderer as the equivalence basis:

- **tenant continuity** — the three.js session presents the fixture tenant
  across mount, input, and both switch directions;
- **digest continuity** — the canonical world digest survives mounting,
  input normalization, degradation, and switching (and a different world
  revision is a typed `switch-incompatible` refusal);
- **semantic entity ids** — the adapter presents EXACTLY the fixture's
  presented entities; every world `Object3D` carries its semantic entity
  id (agent representations carry their agent ids);
- **equivalent interaction outcomes** — the pointer is DERIVED from the
  real Three.js projection (never guessed) and resolves the same semantic
  entity the reference renderer resolves;
- **equivalent normalized intents** — the same logical interaction
  (select/inspect/isolate/hide/measure/zoom, aligned input ids) produces
  the IDENTICAL content-addressed intent payload digest on both renderers;
  annotation is kind-equivalent with renderer-authored text (a documented
  presentation-only difference);
- **same semantic focus/layers** — the portable focus/layers/timeline/
  camera carry across switches; the declared layer policy applies to the
  real presentation (hidden layers are not interactive);
- **differences confined to presentation** — camera state, LOD, wireframe,
  marker shapes, and the annotation text are presentation-only;
- **safety invariants** — no durable semantic mutation (the canonical
  scene is byte-identical after mount/input/switch; the select intent
  flows through the W016 reducer as a NEW revision), full GPU teardown at
  dispose (real Three.js dispose events, nothing survives), dispose is
  terminal, untrusted assets never mount, an aborted switch retains the
  previous session, and headless frame capture is a typed refusal (no
  fabricated GL evidence).

Every run emits the sealed, content-addressed `RendererConformanceResult`
(the `epoch.renderer-conformance-result` contract document) over all seven
check kinds.

## Honest scope

Everything here runs headless in Node 22 (no GPU, no DOM): the scene
graph, camera math, Raycaster hit-testing, input normalization,
degradation, snapshot/restore, and disposal are the REAL product path.
GL rasterization and frame-image capture require the injected GL surface
(`ThreeGlSurfaceFactory` — the browser path; W061 closes the browser E2E
loop). No test fabricates browser evidence.

## Layout

- `threejs-conformance.test.ts` — the positive battery: registration
  through the REAL capability registry, canonical mounting + semantic
  mapping, projection-derived hit-testing + intent normalization with
  reference-renderer payload-digest equivalence, portable focus/layers/
  camera application, BOTH switch directions through the REAL fabric,
  virtual-time frames + declared degradations, no-durable-mutation
  proofs, full GPU teardown, and the sealed conformance result.
- `threejs-conformance.negative.test.ts` — the failure battery: typed
  probe rejections (headset incompatible, phone reduced-fidelity),
  cross-tenant refusals, digest-continuity enforcement, malformed input
  and unserviced modalities, unsupported intent hints, the asset trust
  discipline, terminal dispose, honest headless capture refusal, aborted
  switches retaining the real session, and foreign-handle hardening.

## Running

NOT a pnpm workspace package (`pnpm-workspace.yaml` is frozen). The
battery rides the owning adapter package's pipeline (the W056
qa/renderer-conformance precedent):

```
cd adapters/renderers/threejs
corepack pnpm install --no-frozen-lockfile   # see the package README (pre-registration)
corepack pnpm test                            # unit battery + THIS conformance battery
corepack pnpm typecheck                       # package + this battery (own tsconfig)
corepack pnpm lint                            # package + this battery (own eslint config)
```

The battery's `node_modules` is a gitignored symlink created by the
adapter's link script (`adapters/renderers/threejs/scripts/link-local.mjs`,
run automatically by every package script); its TypeScript typecheck never
depends on the link (every bare import is mapped declaratively in
`tsconfig.json` — the W048/W050 cold-checkout doctrine).
