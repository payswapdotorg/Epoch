# Epoch Renderer Matrix

## Primary interactive backends

| Backend | Role | Host mode | Initial program |
|---|---|---|---|
| Three.js | general interactive 3D | embedded in Epoch viewport | W058 |
| Babylon.js | general interactive 3D | embedded in Epoch viewport | W059 |

## External/specialized foundations

| Backend | Role | Host mode | Program |
|---|---|---|---|
| Blender | high-fidelity/offscreen rendering + asset workflow | Epoch-controlled sidecar | W060 |
| FreeCAD | precision CAD | adapter/specialized surface | W060 candidate |
| Assimp | asset import normalization | library adapter | W060 candidate |
| OpenUSD | rich scene interchange/composition | interchange adapter | W060 candidate |
| Godot | interactive game runtime | native adapter candidate | future |
| O3DE | interactive 3D/runtime | native adapter candidate | future |
| ParaView | scientific/result visualization | specialized adapter candidate | future |
| CesiumJS | geospatial/3D Tiles | specialized adapter candidate | future |

## Selection contract

`Auto` resolves from task/scene/device/fidelity/interaction demands plus user preference. Renderer selection is never semantic state.

The user interacts with one Epoch workspace. Renderer technology is intentionally an implementation detail unless explicitly exposed as diagnostics.

## License planning

License facts are inputs to integration review and must be re-verified at the exact revision:

- Three.js — MIT.
- Babylon.js — Apache-2.0.
- Godot — MIT.
- Blender — GPL.
- OpenUSD — TOST.

The capability-foundation and fork gates remain binding.
