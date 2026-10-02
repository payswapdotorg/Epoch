# Epoch Renderer Matrix

> Program status: CLOSED at W061 (ACR-007/X2.0). The closure record — the
> final matrix, the real-browser software-GL evidence statement, and the
> E2E battery summary — is [closure.md](./closure.md).

## Primary interactive backends

| Backend | Role | Host mode | Initial program | Closure status |
|---|---|---|---|---|
| Three.js | general interactive 3D | embedded in Epoch viewport | W058 | live in the real-browser E2E battery (W061) |
| Babylon.js | general interactive 3D | embedded in Epoch viewport | W059 | live in the real-browser E2E battery (W061) |
| Reference adapter | contract presenter + declared fallback | embedded in Epoch viewport | W056 | the declared no-GL fallback surface (proven, W061 leg 16) |

## External/specialized foundations

| Backend | Role | Host mode | Program | Status |
|---|---|---|---|---|
| Blender | high-fidelity/offscreen rendering + asset workflow | Epoch-controlled sidecar (separate executable; typed process boundary) | W060 | delivered (`@epoch/adapter-renderer-blender`; live-binary battery env-gated, NOT-VERIFIED-live) |
| glTF 2.0 | asset/scene interchange: validate → normalize → content-addressed bindings | interchange bridge behind the W056 seam | W060 | delivered (`@epoch/adapter-foundation-gltf`) |
| FreeCAD | precision CAD | adapter/specialized surface | future | candidate (no concrete W060 use case demanded it) |
| Assimp | asset import normalization | library adapter | future | candidate (the glTF bridge covers the present interchange need) |
| OpenUSD | rich scene interchange/composition | interchange adapter | future | candidate (adopt when richer composition is justified) |
| Godot | interactive game runtime | native adapter candidate | future | not adopted (no concrete capability gap; W060 restriction) |
| O3DE | interactive 3D/runtime | native adapter candidate | future | not adopted (no concrete capability gap; W060 restriction) |
| ParaView | scientific/result visualization | specialized adapter candidate | future | candidate |
| CesiumJS | geospatial/3D Tiles | specialized adapter candidate | future | candidate |

## Selection contract

`Auto` resolves from task/scene/device/fidelity/interaction demands plus user preference. Renderer selection is never semantic state.

The user interacts with one Epoch workspace. Renderer technology is intentionally an implementation detail unless explicitly exposed as diagnostics.

## License planning

License facts are inputs to integration review and must be re-verified at the exact revision:

- Three.js — MIT.
- Babylon.js — Apache-2.0.
- Godot — MIT.
- Blender — GPL-2.0-or-later (separate-executable posture; the full record and distribution obligations are in [blender.md](./blender.md)).
- OpenUSD — TOST.
- glTF 2.0 specification — CC-BY-4.0 (Khronos; no Khronos text/code embedded — see [gltf.md](./gltf.md)).

The capability-foundation and fork gates remain binding.
