# The Three.js Embedded Interactive Renderer (W058)

The FIRST real interactive renderer behind the Renderer Fabric:
[`@epoch/adapter-renderer-threejs`](../../adapters/renderers/threejs) —
Three.js embedded in the Epoch-owned viewport as a replaceable
**capability**, never semantic authority (capability-foundation policy
CF1.0; architecture lock rules 8/13/16).

- Contract: `contracts/renderers` v1.1.0 (the frozen W056 surface; fabric
  protocol `1.0.0`).
- Seam: `RendererAdapter` (`@epoch/renderer-fabric`) — implemented
  exactly; Three.js state is the opaque, ephemeral, provider-native
  session handle.
- Engine: `three` `0.186.1` + `@types/three` `0.186.0` — exact catalog
  pins (`pnpm-workspace.yaml`), never version literals in the package
  (the dependency-baseline policy).
- Engine imports live ONLY in this adapter package. Zero engine
  vocabulary leaks into `contracts/*`, `packages/*`, or the QA harness.

## What the adapter does

| Requirement (W058) | Implementation |
|---|---|
| Scene mounting from canonical envelopes | `mountProjection` builds the entire Three.js scene graph from the ADMITTED typed data (the compiled W011 `3d` graph — primitives, placement, material color/opacity, overlay attributes — plus the scene's camera/timeline/agents/participants). It never re-resolves the ontology and never mutates the canonical scene. |
| Semantic entity mapping | EVERY world `Object3D` carries its semantic entity id in `userData` (`epochEntityId`); agent representations carry `epochAgentId`; decorations resolve to their entity/agent through ancestor lookup (`src/semantics.ts`). Renderer-native state is disposable: rebuilt from the canonical projection on every mount, torn down fully at dispose. |
| Hit testing | The REAL Three.js `Raycaster` against the built graph: a normalized pointer (the W056 envelope grammar, `[0,1]` both axes) becomes an NDC ray through the presentation camera; the first semantically-identified, effectively-visible intersection wins (`src/picking.ts`). Hidden entities and hidden layers are never hit. |
| Camera controls | `CameraControls` (orbit/pan/zoom, spherical math, pole clamping) as PRESENTATION-ONLY state derived from the canonical W016 camera at mount; the portable orbit-camera grammar is the only camera state that crosses the seam (`src/camera.ts`). Arrow keys orbit (shift = pan); wheel dollies; pointer drag orbits — all presentation-only. |
| Overlays/materials/animations | Highlight overlays become tint shells; state overlays become emissive tints + badges; measurement overlays become world-anchored lines; labels/badges are presentation text for the host chrome; animations are evaluated at VIRTUAL time (zero wall-clock; `src/animation.ts`) over node transforms and material opacity. |
| Measurement/annotation affordances | The REAL two-click measurement (first hinted click anchors, second completes the canonical `measure` intent) and annotation (kind-equivalent, renderer-authored text) — always the EXISTING typed W016 intents through the seam, never durable writes. |
| Visible agent representations | Octahedron markers per projected agent (interactive presence: hitting one normalizes to `follow-agent`), presence markers per participant — presentation, not world entities. |
| Frame/evidence capture | Declared (`frameCapture: true`) and honest: without an injected GL surface, capture is a TYPED refusal (never fabricated pixels); with an injected surface it produces a digest-addressed record (media type, byte size, SHA-256 image digest) for the EXISTING Verification/Evidence path — the adapter never writes evidence itself (`src/capture.ts`). |
| Fidelity/device budgets | The declared degradations only: `wireframe` (material flag), `reduced-fidelity` (curved primitives rebuild at the reduced LOD), `static-frame` (playback freezes), reversible, typed; probe policy (desktop/laptop/wall-display full; tablet/phone reduced-fidelity; headset a typed probe rejection — no XR surface in this version) (`src/degradation.ts`, `src/version.ts`). W013 budgets are enforced by the fabric/hosting boundary. |
| Safe disposal | Every geometry/material/texture/renderer created is registered in a `GpuResourceLedger` at creation and disposed exactly once at session dispose — the tests prove the REAL Three.js `dispose` events fired. Disposed sessions refuse everything (terminal). |
| No direct durable mutation | The adapter performs ZERO durable writes. Every normalized intent is re-admitted by the fabric through the W016 total admission + the W013 submit-intent boundary (the Dynamic UI law: adapters are never trusted). The canonical scene is byte-identical after mount/input/switch (proven). |
| Web/Tauri-compatible hosting | The adapter touches no DOM globals. A browser host injects the GL surface (`ThreeGlSurfaceFactory`: a constructed `WebGLRenderer` over the Epoch-owned canvas + a pixel source); Tauri hosts the same injected-surface path. |

No Three.js editor/application UI is required or exposed — the visible
chrome is Epoch's viewport (W057).

## Headless vs. browser — the honesty split

**Headless-proven (Node 22, no GPU — what CI verifies):** the entire
deterministic core — canonical mounting, semantic mapping, scene-graph
construction, camera math (orbit/pan/zoom/spherical), the REAL Raycaster
hit-testing, input normalization into the typed W016 intent vocabulary,
overlay/label/agent presentation, virtual-time animation, declared
degradations, portable snapshot capture/restore, GPU-ledger disposal
(real dispose events), and the fabric integration (registration, probe,
mount, frame, input, switching, dispose) over the shared canonical
fixture (`qa/renderer-conformance/threejs/`).

**Browser-required (injected surface; W061 closes the E2E loop):** real
WebGL rasterization (`WebGLRenderer.render`), the canvas/viewport mount
itself (W057 owns the host), frame IMAGE capture (typed refusal
headless), real input-device event streams (the batteries feed the typed
envelope grammar the host produces from them), and visual smoke. Nothing
in this package fabricates any of that evidence.

## Wiring (the registration path)

```ts
import { ThreeJsRendererAdapter } from '@epoch/adapter-renderer-threejs';
import { RendererFabric, rendererCapabilityManifestOf } from '@epoch/renderer-fabric';
import { sealCapabilityManifest } from '@epoch/capability-registry';

const adapter = new ThreeJsRendererAdapter();          // headless (no GL)
// const adapter = new ThreeJsRendererAdapter({ surfaceFactory }); // browser host

const fabric = new RendererFabric();
const identity = adapter.identity();                   // 'epoch.renderer.three' / 'rr-threejs'
const manifest = rendererCapabilityManifestOf({
  capabilityId: identity.capabilityId,
  version: '1.0.0',
  descriptor: adapter.descriptor(),                    // W013 hosting declaration
  capabilities: adapter.capabilities(),                // W056 fabric capability set
  displayName: identity.displayName,
  description: identity.description,
});
const sealed = sealCapabilityManifest(manifest);
if (sealed.ok) {
  fabric.adapters.register({ manifest: sealed.value.manifest, digest: sealed.value.digest, adapter });
}
// fabric.createSession({ rendererId: 'rr-threejs', ... }) -> mountScene -> applyFrame -> submitInput
```

## Package conventions

Per `adapters/s3-object-store` (epoch layer metadata `experience`,
`exports: { ".": "./src/index.ts" }`, scripts `typecheck`/`lint`/`test`,
`catalog:` protocol for every catalog dependency). Pre-registration
local verification: `adapters/renderers/threejs` is a NESTED package path
the frozen `adapters/*` workspace glob (one level) does not match, so
`scripts/link-local.mjs` builds the package's gitignored local
`node_modules` (workspace symlinks + the engine staged at the EXACT
catalog pins read from `pnpm-workspace.yaml` at run time — zero version
literals). Post-registration (the Tech Lead's lockfile pass adds the
glob entry), pnpm owns the install and none of that exists.

```
cd adapters/renderers/threejs
corepack pnpm install --no-frozen-lockfile   # root workspace install (revert pnpm-lock.yaml before committing)
corepack pnpm typecheck                      # package + qa/renderer-conformance/threejs
corepack pnpm lint                           # package + qa/renderer-conformance/threejs
corepack pnpm test                           # 37 unit + 21 conformance tests, all headless
```

## Conformance

`qa/renderer-conformance/threejs/` drives the REAL adapter over the SAME
shared canonical fixture as the W056 harness (same tenant, same world
digest, same semantic entity ids) with the contract-only reference
renderer as the equivalence basis: identical content-addressed intent
payload digests for the same logical interactions (select/inspect/
isolate/hide/measure/zoom), both switch directions through the REAL
fabric, portable focus/layers/camera carry + application, no durable
semantic mutation, full GPU teardown, and the sealed
`RendererConformanceResult` over all seven check kinds. See that
directory's README for the full inventory.

## Three.js license snapshot — exact pin 0.186.1 (MIT)

Verified against the staged package at the exact catalog pin
(`three@0.186.1`, staged by `scripts/link-local.mjs`; re-verify at any
revision change). The engine's full license text (file `LICENSE` of the
`three` package, copyright "© 2010-2026 three.js authors"):

```text
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

`@types/three@0.186.0` is MIT-licensed (DefinitelyTyped). The engine and
its types are dev/runtime capabilities of this adapter package only; the
capability-foundation and fork gates remain binding.

## Known limitations (honest)

- **No GL evidence yet.** Everything rasterization-shaped is the injected
  surface; browser E2E closes with W061. Headless `applyFrame` advances
  the real scene-graph presentation and reports `presented: true` with an
  explicit headless note — no pixel is claimed.
- **`mesh` primitives present as placeholder boxes.** A
  content-addressed mesh binding without a bound asset presents a
  deterministic placeholder (typed presentation, never a silent semantic
  substitution); the real mesh/texture upload pipeline is the W060
  asset-bridge surface.
- **The semantic-layer → entity binding is the adapter's declared
  presentation policy.** The W016 scene carries no canonical layer model
  (layer ids are the fabric-owned portable vocabulary), so the adapter
  derives layers deterministically from the canonical entity types
  (`conformance:node` → `lyr-node`). The portable layer STATE carries
  across switches exactly; whether a given layer id has a presentation
  effect depends on the derived mapping (documented, deterministic, and
  proven where the ids align).
- **Annotation text is renderer-authored.** The annotate affordance
  derives its text from the entity's presentation label; the canonical
  annotate intent (kind + entity) is equivalent across renderers, the
  text payload is the affordance's own (presentation-only difference,
  recorded in the conformance battery).
- **This adapter version ships no XR surface.** Headset devices get a
  typed probe rejection at session creation (never a silent failure).
