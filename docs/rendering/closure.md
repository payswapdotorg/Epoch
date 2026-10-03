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
- **Leg 14** — **REAL since W067 (ACR-010) — the verdict flip of this
  record**: the in-page foundation path through the page's OWN Epoch-owned
  import affordance (a plain file input; NO vendor UI): glTF/GLB upload →
  the in-page interchange bridge (validate → normalize → content-address →
  seal — the W060 trust gate running IN THE BROWSER) → the typed `bind`
  intent (W066) → the `binding-requested` effect →
  `RendererFabric.bindSessionAsset` (W065, contract v1.2.0) on the LIVE
  session. Asserted in the battery: the digest-addressed registry entry;
  the bound-asset ledger keyed by the asset digest (the sealed binding
  digest + the receipt digest); the typed receipt in the journal; the
  presented semantic entity ids UNCHANGED; the canonical world digest
  UNCHANGED; the malformed upload refused typed at the gate. The
  **Blender-live variant** (sidecar export over the official Blender
  4.2.11 → UNTRUSTED re-entry → validated binding → in-page bind, with the
  digest continuity across the process seam asserted) RAN-LIVE GREEN at
  W067 — honestly env-gated (`EPOCH_BLENDER_LIVE=1` + `EPOCH_BLENDER_PATH`),
  never claimed as CI. The degradation-path leg (the same spec's
  `chromium-no-gl` project) proves the path stays live on the no-GL
  fallback: the binding applies through the headless presenter AND through
  the reference fallback presenter's own bindAsset seam. The W061-era
  NOT-RUNNABLE record (the adapter-seam-scoped `bindAsset` + the missing
  Blender binary) is superseded by this flip.

Result at the c90badb save point: **3 passed / 2 honest skips, 23.9s**.
Result at the W067 head (ACR-010 closure): **6 passed / 2 project-scoping
skips, 25.8s** — leg 14 REAL, the Blender-live variant green in the live
run (env-gated), the degradation foundation leg green in `chromium-no-gl`.

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

## ACR-010 — the In-Page Foundation Asset Path: the program closure record (W067)

**CLOSED at W067 (2026-10-03).** The three additive surfaces of the ACR all
landed, no break anywhere:

1. **W065 (PR #147, cc3b044)** — the RendererAdapter contract v1.1.0 →
   **v1.2.0** (additive): the fabric-level
   `bindSessionAsset(input: { sessionId, binding, atMs }) →
   FabricResult<RendererAssetBindingReceipt>` orchestration composing the
   UNCHANGED adapter-seam `bindAsset` (session resolution → tenant-scope
   verification → capability/asset-kind check → seam application → the
   digest-addressed, tenant-scoped applied/declined receipt; every failure
   a typed refusal with no partial application). protocolVersion and
   fabricProtocolVersion UNCHANGED.
2. **W066 (PR #149, c6216cb)** — the `bind` interaction kind joins the
   closed world-interaction vocabulary (`WORLD_INTERACTION_KINDS`;
   `WORLD_INTENT_TYPE_VERSION` 1.0.0 → 1.1.0, additive): the intent payload
   carries a VALIDATED binding REFERENCE (the sealed binding's content
   address + tenant scope — never untrusted raw bytes); the reducer emits
   the effect-only `binding-requested` record; world-digest invariance and
   the no-durable-mutation discipline pinned by the negative battery.
3. **W067 (this record)** — the in-page composition: the world runtime
   applies the `binding-requested` effect through the W065 operation
   (`importFoundationAsset` — the interchange bridge's trust gate with the
   digest-addressed registry; `bindFoundationAsset` — the session-addressed
   sealed binding through the bridge's trust-gated factory, the typed bind
   intent, the effect, the fabric operation, the receipt + the
   digest-addressed bound-asset ledger); the web `/world` host and the
   desktop world section expose the Epoch-owned import affordance (a plain
   file input — NO vendor UI) presenting the receipt + the ledger; leg 14
   of the j13-world battery is REAL (the glTF-bridge path, the env-gated
   Blender-live variant RAN-LIVE GREEN, and the degradation-path leg on
   the no-GL/reference fallback).

**Composition note (disclosed):** the web host's manifest is frozen to the
W067 surface set, so the registered glTF interchange bridge is reachable
for the in-page path through the ONE new workspace-package edge
(`@epoch/world-runtime` → `@epoch/adapter-foundation-gltf`, `workspace:*`,
zero external dependencies — exactly the ACR's "W065/W066/W067 use only
registered workspace packages" sanction; no root manifest/lockfile change,
no external dependency). The runtime's public seam stays neutral
(`FoundationAssetBridge` — an injectable validate/seal interface); the
concrete bridge is confined to one composition module
(`src/foundation-bridge.ts`). The web fixture's reference fallback
presenter is declared asset-bindable (`assetKinds: ['mesh']`) at W067,
matching the desktop full reference and the qa harness fixture, so the
declared fallback surface keeps the in-page path live without GL.

**Invariants held (nothing weakened):** only sealed, content-addressed,
tenant-scoped bindings are bindable — the trust gate stays in the bridge
(`admitGltfAsset`/`gltfRendererAssetBinding`, unchanged; the
qa/foundation-renderers negative battery green untouched); untrusted bytes
remain typed refusals at every seam; binding is presentation — the World
Model, Action Gateway, Constraint Engine, and Verification planes are
untouched, the canonical world digest and the presented semantic entity
ids are UNCHANGED by any binding (pinned deterministically and in the
browser); the bound-asset ledger is digest-addressed in-memory experience
state, never a second semantic store.

**Evidence set (W067):** the world-runtime battery 82/82 (12 new session-
asset tests), the desktop suite 195/195 (3 new world-host tests), the web
feature batteries green (12 workspace tests incl. the foundation panel),
the j13-world battery 6 passed / 2 project-scoping skips with the
Blender-live variant green in the live run over the official Blender
4.2.11 (byte-identical tarball to the W068 record, sha256 `7f084fd5…`,
re-verified), and the journey record
([../journeys/interactive-world.md](../journeys/interactive-world.md))
carrying the flipped leg-14 verdict + the updated NOT-VERIFIED-live ledger.

**Honest boundaries (unchanged):** the Blender-live legs remain env-gated
live evidence (operator-supplied binary at an ephemeral non-repo path;
never claimed as CI); GPU rasterization remains impossible in this sandbox
and no run here is claimed as one.
