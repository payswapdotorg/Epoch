# The Babylon.js Renderer Adapter (W059 — ACR-007 / X2.0)

This document is the delivery record of Epoch's SECOND embedded interactive
renderer: Babylon.js behind the FROZEN W056 `RendererAdapter` seam
(`@epoch/renderer-fabric`, `contracts/renderers` v1.1.0). It implements the
SAME canonical scene/interaction contract as the first embedded renderer
(W058, Three.js — a parallel Work Order with pairwise-disjoint surfaces);
both mount the same canonical W016 world projection, hit-test raw input into
the same semantic entity ids, normalize into the SAME EXISTING W016
world-interaction intent vocabulary, and present under the same typed
degradation/fidelity budget grammar. Differences between the two renderers
are confined to presentation.

Babylon.js is a CAPABILITY behind this adapter, never authority
(`spec/capability-foundation-policy.md`): no durable writes, no second
semantic store, no Babylon editor/playground UI — the visible surface is
Epoch's viewport, and every input arrives through the fabric's typed
envelopes.

## Where everything lives

| Surface | Location | Role |
|---|---|---|
| Adapter package | `adapters/renderers/babylonjs` (`@epoch/adapter-renderer-babylonjs`, service layer) | The `RendererAdapter` implementation + the injected GL path. The ONLY product surface that imports `@babylonjs/core`. |
| Adapter core | `adapters/renderers/babylonjs/src/adapter.ts` | `BabylonRendererAdapter` — the seam lifecycle: probe → create → mount → frame → input → snapshot/restore → switch participation → dispose. |
| Semantic mapping | `src/mapping.ts` | Canonical projection → Babylon scene graph (the entity-id mapping rule; see below). |
| Semantic picking | `src/picking.ts` | Babylon `scene.pick` → semantic entity ids (+ the deterministic inverse projection). |
| Input normalization | `src/normalize.ts` | Pointer/wheel/key → the EXISTING W016 intent vocabulary (renderer-independent policy, member-for-member aligned with the W056 seam template). |
| Camera mapping | `src/camera.ts` | The W016 portable camera grammar (orbit / free / follow-agent) ⇄ Babylon `ArcRotateCamera` / `FreeCamera`. |
| Degradation | `src/degrade.ts` | The typed fidelity budgets: `reduced-fidelity` / `static-frame` / `wireframe` (declared only). |
| GL host seam | `src/host.ts` | `BabylonEngineHost`: `nullEngineHost()` (headless CI) and `webCanvasEngineHost(canvas)` (browser/Tauri). |
| Unit battery | `adapters/renderers/babylonjs/test` | 46 tests: mounting, input-normalization, degradation, disposal, snapshot-restore, capture-capabilities. |
| Conformance battery | `qa/renderer-conformance/babylonjs` | 18 tests (7 positive + 11 negative) over the W056 SHARED fixture through the REAL fabric. |

## The semantic mapping rule

Every Babylon mesh/node the adapter presents for a world entity carries its
semantic identity in `mesh.metadata`:

```ts
interface BabylonEntityMetadata {
  epochEntityId: string;      // the canonical semantic entity id
  epochEntityDigest: string;  // the entity's content digest (opaque ref)
  epochPrimitive: string;     // the ontology representation primitive
}
```

Agent representations carry `epochAgentId` / `epochAgentDigest` /
`epochAgentTenantId` and are deliberately NOT entity-pickable (agents are
projected participants, not world entities). The mapping is built from the
ADMITTED typed structures only (the compiled W011 graphs of the mounted
revision + the canonical W016 scene for agents/camera/timeline); the
canonical scene object is never mutated, and the entire presentation is
provider-native DISPOSABLE state — a remount rebuilds it from the canonical
data, never patches it.

Primitives map to Babylon builders (`box`/`sphere`/`cylinder`/`cone`/`plane`);
a `mesh` primitive (content-addressed geometry) presents a deterministic
wireframe PROXY pending a validated asset binding — geometry is never
invented. Ontology materials compile to `StandardMaterial`
(`material-color` → diffuse, `material-opacity` → alpha, applied highlight
overlays → emissive), and W016 animation instructions map to Babylon
`Animation` clips attached to their target entity meshes.

## Semantic picking and intent normalization

Pointer input is a raw `RendererInputEnvelope` in normalized [0, 1]
top-left-origin viewport space. The adapter hit-tests through Babylon's own
`scene.pick` with a predicate restricted to pickable ENTITY meshes, then
resolves `metadata.epochEntityId` — the hit test IS semantic. Determinism in
CI: instead of a wall-clock render loop, the picking path recomputes the
camera view/projection matrices and mesh world matrices on demand
(`ensurePickable`), so the same normalized pointer always resolves the same
semantic entity over the NullEngine.

Normalization policy (`src/normalize.ts`, deliberately renderer-independent
and member-for-member aligned with the W056 seam template so equivalent input
normalizes to equivalent intents on EVERY renderer):

- pointer-down without a hint → W016 `select` on the hit entity;
- pointer-down with a hint → the hinted W016 intent kind
  (`select`/`inspect`/`isolate`/`hide`/`measure`/`annotate`); measurement
  pairs the hit entity with the next presented entity in sorted order
  (wrapping) — the renderer-independent pairing policy;
- wheel → W016 `zoom` (scroll up zooms in: ×1.25; scroll down: ×0.8);
- pointer-move / pointer-up → non-activating (`no-target`, no intent; the
  presentation-only camera reaction may run);
- keys: `+`/`=`/`-`/`_` → W016 `zoom`; camera keys (arrows/WASD) are
  presentation-only camera controls; every other key is a TYPED
  `input-unsupported` refusal — never a silent drop, never a parallel
  vocabulary.

Measurement/annotation are AFFORDANCES: the adapter normalizes the intent;
the canonical record flows through the EXISTING authority path (the fabric
re-admits every intent through the W016 total admission — the Dynamic UI law:
adapters are never trusted). The adapter NEVER writes anything durably.

## Camera controls

The portable camera grammar (`orbit` / `free` / `follow-agent`, mirrored in
`contracts/renderers` v1.1.0 from the W016 home) maps to Babylon
`ArcRotateCamera` / `FreeCamera`. Babylon's attached input controls are
NEVER wired (`camera.inputs.clear()`): the adapter owns input
interpretation, and every input arrives through the fabric's typed
envelopes. Pointer-drag orbit/pan, wheel/key zoom, and WASD/arrow
navigation are presentation-only reactions with deterministic fixed steps
and sensitivities (`CAMERA_DEFAULTS`); camera interpolation is
presentation-only state captured back into the portable grammar at snapshot
time. `follow-agent` anchors on the agent's visible representation.

## Fidelity budgets and degradation

The declared capability set (`BABYLONJS_CAPABILITIES`) declares all four
typed degradation kinds (`none`, `reduced-fidelity`, `static-frame`,
`wireframe`); the fabric refuses any UNDECLARED degradation before it
reaches the adapter. Application is deterministic scene-graph flags:

- `wireframe` — every entity material flips `wireframe = true`;
- `reduced-fidelity` — heavyweight presentation features are disabled (fog,
  image-processing, glow layers, shadow maps, plus 2× hardware-scaled
  adaptive resolution); pickability is unaffected (normalized pointers map
  through the ENGINE's reported render size, which scales with it);
- `static-frame` — presentation stops advancing: `applyFrame` records the
  frame but skips the host's present step (the last presented frame stays).

Probe-time budget policy: a device whose declared display budget falls below
the comfortable band (< 921,600 px) presents under `reduced-fidelity` rather
than being refused; `headset`-class devices are refused (no WebXR session
management is wired).

## Agents, capture, disposal

- **Visible agent representations**: every projected agent of the canonical
  scene gets a non-pickable, semantically tagged octahedron marker on a
  deterministic ring placement (agents carry no projected position).
- **Frame/evidence capture** is DECLARED (`frameCapture: true`) but requires
  a real GL host: `captureFrame` captures PNG bytes through the injected
  host's capture path (Babylon screenshot tooling over the session's active
  camera). Headless hosts REFUSE with a typed `session-failed` failure —
  no fabricated evidence (the capture-capabilities battery proves both
  paths).
- **Safe disposal**: `dispose()` runs `scene.dispose()` then
  `engine.dispose()`, discards all presentation state, and marks the session
  terminal; disposed sessions refuse every subsequent invocation with typed
  `session-disposed` failures and report `unavailable` health. Switching
  participation: the adapter captures a sealed portable snapshot
  (`captureSnapshot`) and restores all four declared portable fields
  (`camera`, `focused-entities`, `layer-visibility`, `timeline-position`),
  listing undeclared fields as typed skips — never silent.

## The GL path is injected (headless CI vs. browser)

`BabylonRendererAdapter` never constructs a WebGL engine itself. Every
engine comes from an injected `BabylonEngineHost`:

| Host | Engine | Where it runs |
|---|---|---|
| `nullEngineHost()` | `@babylonjs/core` `NullEngine` (software stub; fixed 1024×768; deterministic lock-step 1/60 s) | CI (Node 22, zero GPU, zero browser) — the default of `babylonjsRendererAdapter()`. |
| `webCanvasEngineHost(canvas)` | real `Engine` over an `HTMLCanvasElement` (WebGL, `preserveDrawingBuffer` for capture) | the web + Tauri webview surface (W061 browser batteries). |

### Headless-proven (the CI battery, 64 tests green)

Scene-graph construction from the admitted canonical projection (semantic
entity-id mapping, materials/overlays, animation clips, labels, agent
representations, hidden-entity filtering), semantic picking (Babylon
`scene.pick` over the NullEngine with deterministic matrix recomputation),
input normalization into the EXISTING W016 vocabulary, camera
mapping/controls (all three portable modes + zoom/orbit/pan reactions),
typed degradations (all three kinds), snapshot capture/sealing, portable
view-state restore (all four fields, typed skips), asset-binding trust
discipline (untrusted never mounts), frame counters, safe disposal
(`engine.dispose()` verified), and the full shared-fixture conformance
battery (switching both directions against the reference renderer,
equivalent normalized intents, digest/tenant continuity, no-mutation
proofs, typed failure/fallback/abort taxonomies).

### Browser-required (W061 closes this; nothing here is claimed as evidence)

Actual WebGL rasterization/pixels; real canvas pointer-event plumbing (the
adapter's input arrives pre-normalized — the browser shell maps DOM events
to envelopes); `webCanvasEngineHost` engine creation over a real context;
real PNG frame capture through Babylon's screenshot tooling; WebGPU or
context-loss/restore behavior; visual smoke (W060) and browser/desktop E2E
(W061). The browser host code is exported and reviewed, but it carries NO
CI evidence — that is exactly the honest split.

## Conformance (the Work Order acceptance proof)

`qa/renderer-conformance/babylonjs` runs the REAL Babylon adapter over the
W056 SHARED fixture (same tenant, same canonical world scene, same world
digest, same semantic entity ids, same device session) through the REAL
fabric and registry, and proves all seven check kinds: tenant-continuity,
digest-continuity, semantic-entity-ids, interaction-outcomes (equivalent to
the reference renderer — same hit entity, same intent payload digest),
normalized-intents (ONE shared W016 vocabulary), semantic-focus-layers
(portable restore), and presentation-only-differences (typed, never
silent). The negative battery proves the typed failure taxonomy, degraded
switching, fallback chains, aborted-switch retention, disposed-session
refusals, untrusted-asset rejection, and the honest headless capture
refusal.

### How to run everything

```bash
# from the repo root — governance + boundary (mandatory)
corepack pnpm run check

# the adapter package: install (local only), then the full battery
cd adapters/renderers/babylonjs
corepack pnpm install --no-frozen-lockfile      # regenerates the lockfile LOCALLY
corepack pnpm run typecheck                     # adapter + conformance battery (tsc, cold-checkout safe)
corepack pnpm run lint                          # eslint both zones + the qa battery link
corepack pnpm run test                          # vitest: 46 unit + 18 conformance = 64 tests

# from the repo root, BEFORE committing — never commit lockfile changes
git checkout pnpm-lock.yaml
```

The battery's `node_modules` is a gitignored symlink the adapter's vitest
`globalSetup` (`scripts/link-qa-battery.mjs`) creates after a fresh install
(the W056 harness-linking doctrine; `qa/renderer-conformance` is not a
workspace package because `pnpm-workspace.yaml` is frozen). The battery's
typecheck never depends on the link — its tsconfig maps every bare import
declaratively.

## Dependency and license snapshot (recorded at integration)

- Package: `@babylonjs/core` **9.29.0** — the exact catalog pin
  (`pnpm-workspace.yaml`, foundation commit `aab4c73`; the adapter's
  package.json declares `"@babylonjs/core": "catalog:"`, never a literal).
- License: **Apache-2.0** — the package ships the full Apache License 2.0
  text (`license.md`); `package.json` declares `"license": "Apache-2.0"`.
  Source of truth: https://github.com/BabylonJS/Babylon.js (Apache-2.0).
- NOTICE (the package's `NOTICE.md`, verbatim inventory at 9.29.0):
  - Babylon.js — Copyright 2023 The Babylon.js team (Apache-2.0);
  - Draco Compression v1.5.6 (google/draco) — Apache-2.0;
  - Basis transcoder — Copyright 2024 The Khronos Group — Apache-2.0;
  - GLSLang v11.8.0 (KhronosGroup/glslang) — Copyright 2024 The Khronos
    Group — Apache-2.0;
  - TWGSL (BabylonJS/twgsl) — Copyright 2021-2024 The Babylon.js team —
    Apache-2.0;
  - meshoptimizer (zeux/meshoptimizer) — Copyright (c) 2016-2026 Arseny
    Kapoulkine — MIT.
- Runtime dependency footprint: `@babylonjs/core` has ZERO runtime
  dependencies (the bundled components above ride inside the package).
- Verdict: Apache-2.0 + MIT components — permissive, no copyleft
  obligations; compatible with the Epoch distribution model under
  `spec/capability-foundation-policy.md` (record exact revision +
  transitive licenses at integration — done above; re-verify on any bump).

## Honest scope (what W059 is NOT)

- No browser/GPU execution evidence (see the split above — W061's surface).
- No visual-smoke battery (W060) and no desktop/web E2E (W061).
- No persistence of any kind: adapter sessions, snapshots and receipts are
  in-memory presentation state by design (the fabric has no persistence
  API).
- The renderer selector/chrome integration (W057's world workspace) and the
  external/specialized foundations (W060) are separate Work Orders.
