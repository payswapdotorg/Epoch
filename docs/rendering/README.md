# Epoch Rendering

Rendering is an implementation capability of Epoch, never the source of truth.

## The frozen fabric contract (W056, ACR-007/X2.0)

The Renderer Fabric contract is FROZEN for W057-W059: the provider-neutral
session/snapshot/switching contract (`contracts/renderers` v1.1.0), the
`RendererAdapter` seam, the capability-registry registration path, and the
shared conformance fixture. Implementation guide for adapter authors:
[renderer-fabric-contract.md](./renderer-fabric-contract.md).

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

Delivered so far: Three.js (W058 — [threejs.md](./threejs.md)), Babylon.js
(W059 — [babylonjs.md](./babylonjs.md)), the Blender offscreen sidecar and
the glTF 2.0 asset/interchange bridge (W060 —
[blender.md](./blender.md), [gltf.md](./gltf.md)). Current per-backend
status: [renderer-matrix.md](./renderer-matrix.md).

## Program closure (W061)

The multi-renderer program is CLOSED: the interactive world is the real
cross-client experience with both real engines live behind the frozen
seam, verified in a real browser over real software GL (SwiftShader ANGLE
— honestly presented as software rasterization). The full closure record —
the final matrix, the software-GL evidence statement, the 18-leg E2E
battery summary — is [closure.md](./closure.md). Post-program renderer
work requires a new ACR.

## Selection

Renderer selection is capability-driven from task/scene/device/fidelity requirements and user preference. `Auto` is allowed.

Selection must never change semantic state.

## Distribution/embedding rule

The normal user sees one Epoch application. Provider/editor windows are not required for the core workflow.

External foundations run behind an Epoch-controlled boundary and receive only the scoped inputs they need.

## License rule

Exact revision/transitive-license audits are required at integration time. Current planning references: Three.js MIT, Babylon.js Apache-2.0, Godot MIT, Blender GPL, OpenUSD TOST. The existing capability-foundation/fork policy remains binding.
