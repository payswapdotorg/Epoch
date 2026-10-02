# Epoch Rendering

Rendering is an implementation capability of Epoch, never the source of truth.

## Initial backend plan

| Backend | Role | User-visible surface |
|---|---|---|
| Three.js | embedded general interactive 3D | Epoch viewport |
| Babylon.js | embedded general interactive 3D | Epoch viewport |
| Blender | high-fidelity/offscreen rendering + asset processing | Epoch viewport/output surface |
| Godot | native interactive candidate | Epoch surface |
| O3DE | native interactive candidate | Epoch surface |
| FreeCAD | precision geometry candidate | Epoch surface |
| ParaView | scientific/result visualization candidate | Epoch surface |
| CesiumJS | geospatial visualization candidate | Epoch surface |
| Assimp | asset normalization | behind adapter |
| OpenUSD / glTF | scene/asset interchange | behind adapter |

## Selection

Renderer selection is capability-driven from task/scene/device/fidelity requirements and user preference. `Auto` is allowed.

Selection must never change semantic state.

## Distribution/embedding rule

The normal user sees one Epoch application. Provider/editor windows are not required for the core workflow.

External foundations run behind an Epoch-controlled boundary and receive only the scoped inputs they need.

## License rule

Exact revision/transitive-license audits are required at integration time. Current planning references: Three.js MIT, Babylon.js Apache-2.0, Godot MIT, Blender GPL, OpenUSD TOST. The existing capability-foundation/fork policy remains binding.
