# The Renderer Program Closure Record (W061 — ACR-007 / X2.0)

This is the closure record of the multi-renderer program (W056 → W057 |
W058 | W059 → W060 → W061): the interactive world is the real cross-client
Epoch experience, both real engines live behind the frozen seam, verified
in a real browser over real software GL. Rendering remains an
implementation capability — never the source of truth (architecture lock
rules 8/13/16).

## The final renderer matrix

| Renderer / foundation | Version (exact catalog pin) | License | Role | Delivered by |
|---|---|---|---|---|
| Three.js | `three@0.186.1` (+ `@types/three@0.186.0`) | MIT | embedded general interactive 3D — FIRST engine | W058 (`@epoch/adapter-renderer-threejs`) |
| Babylon.js | `@babylonjs/core@9.29.0` | Apache-2.0 | embedded general interactive 3D — SECOND engine | W059 (`@epoch/adapter-renderer-babylonjs`) |
| Reference adapter | contract-only (`@epoch/renderer-fabric` built-in) | Epoch-owned | the deterministic contract presenter + the DECLARED fallback surface when no GL exists | W056 |
| Blender | sidecar separate executable (never linked/bundled) | GPL-2.0-or-later (the separate-executable posture) | high-fidelity/offscreen rendering + asset processing behind a typed process boundary | W060 (`@epoch/adapter-renderer-blender`) |
| glTF 2.0 | interchange format (Khronos spec; no Khronos text/code embedded) | spec CC-BY-4.0 | asset/scene interchange: validate → normalize → content-addressed trust-gated bindings | W060 (`@epoch/adapter-foundation-gltf`) |

License snapshots live with their delivery records and are NOT duplicated
here: Three.js — [threejs.md](./threejs.md); Babylon.js —
[babylonjs.md](./babylonjs.md); Blender — [blender.md](./blender.md)
(including the IF-BUNDLED distribution obligations); glTF — [gltf.md](./gltf.md).
The full per-backend status table (including the future candidates:
FreeCAD, Assimp, OpenUSD, Godot, O3DE, ParaView, CesiumJS) is
[renderer-matrix.md](./renderer-matrix.md).

## Where the real engines live in the product

- Web: `/world` — `WorldWorkspaceHost` composes the REAL
  `@epoch/world-runtime` over the REAL `RendererFabric` with Three.js
  first, Babylon.js second, the reference adapter as declared fallback;
  both engines present in the SAME Epoch-owned viewport (the engine stage),
  switched without leaving the page.
- Desktop: the Tauri world section registers the same real-renderer
  preference chain (the world host is the DEFAULT surface).
- Engine imports live ONLY in the adapter packages. Zero engine vocabulary
  in `contracts/*`, `packages/*`, or the QA harnesses (grep-verified at
  every review gate).

## The real-browser software-GL evidence statement

The W061 closure E2E battery (`apps/web/playwright.world.config.ts` +
`apps/web/e2e/j13-world.spec.ts` / `j13-world-degradation.spec.ts`) runs
the REAL production build (`next build` + `next start`, free port 3210) in
REAL Chromium (Playwright 1.63.0) with REAL WebGL — honestly recorded as
SOFTWARE GL: the sandbox has no GPU, so WebGL is rasterized by
ANGLE/SwiftShader (`--use-angle=swiftshader
--enable-unsafe-swiftshader`), and the battery ASSERTS the actual renderer
string contains `SwiftShader`. This is real-Chromium real-GL evidence
(driver, context, shaders, frames), presented as exactly what it is:
software rasterization, never a GPU run. GPU-rasterized evidence remains
NOT-VERIFIED-live and is recorded as such — never fabricated.

## The E2E battery summary (the 18-leg closure acceptance)

- **Legs 1-13 + 15** (one test): enter the real fixture problem; render
  the real spatial world (real GL pixels); orbit/pan/zoom (real keyboard +
  wheel, the typed `zoom` intent); select a semantic entity (a real click
  at the entity's DERIVED projected position through the Three.js
  Raycaster); inspect (the typed effect-only intent); isolate/reveal a
  layer (typed `filter`/`show`, hidden-layer picks honestly `no-target`);
  measure (the documented four-pick cadence); annotate (a canonical
  revision change — digest asserted); see and follow an agent; replay/seek
  (typed `replay`, pause/resume); branch/simulate (typed entry, effects
  await authorities); **switch Three.js → Babylon.js and back WITHOUT
  leaving Epoch** — world digest + tenant continuity asserted on every
  switch, semantic picks through each engine's own hit-test surface on the
  switched session.
- **Legs 17-18** (one test): approve an actual action through the REAL
  Action Gateway (submit → `awaiting-approval` → approve → execute) and
  verify the resulting state/evidence re-resolves in Epoch (`executed` in
  the authoritative action-status table).
- **Leg 16** (the `chromium-no-gl` project — WebGL disabled at launch, the
  forced condition asserted real): both engines' GL probes honestly report
  their headless cores, the session stays healthy, the declared fallback
  (the contract-only reference projection) presents the world, and the
  degraded world stays fully interactive.
- **Leg 14** — honestly NOT-RUNNABLE (the recorded skip): `bindAsset` is
  adapter-seam-scoped in the frozen RendererAdapter contract v1.1.0 (a
  fabric-level asset-binding orchestration would be a contract change —
  the W060 advisory), and no Blender binary exists in this sandbox. The
  external foundation path is proven at its real surface by
  `qa/foundation-renderers` (84/84 + the 15-test battery: glTF → validate
  → binding → `bindAsset` on a REAL Three.js adapter session + the
  Blender-double subprocess round-trip) and the adapter suites.

Result at the c90badb save point: **3 passed / 2 honest skips, 23.9s**.

The deterministic engine batteries behind it: `qa/rendering`
(`engine-pair.test.ts` — the direct Three⇄Babylon cross-switch over the
SHARED canonical fixture with digest/tenant/portable-state continuity,
identical content-addressed intent payload digests through each engine's
own hit-test surface, no-durable-mutation, tenant sealing;
`degradation-fallback.test.ts` — the forced ladder) and the frozen
baselines (renderer-fabric 36/36 pipeline, renderer-runtime 227/227,
threejs 58/58, babylonjs 64/64, gltf 84/84, blender 40 + 3 env-gated live
skips).

The full per-leg verdict table with evidence pointers and the defect
ledger (the two P1 bring-up fixes + the ledgered W016 marker-time P2) is
the journey record: [../journeys/interactive-world.md](../journeys/interactive-world.md).

## Closure status

ACR-007 is CLOSED by W061: at least two real interactive renderers behind
the frozen seam (proven in the real browser), at least one external
foundation path (proven at its real surface), no vendor UI as the primary
Epoch surface (the viewport is Epoch's), renderer switching preserves the
canonical world identity/digest (proven deterministically and in the
browser), and the World Model remains the only semantic authority
(pinned by the invariant batteries of every wave). Post-program renderer
work (a fabric-level asset-binding orchestration, the W016
numeric-comparator fix, additional foundations) requires a new ACR.
