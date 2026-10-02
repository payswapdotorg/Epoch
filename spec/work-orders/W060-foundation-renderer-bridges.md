# W060 — Foundation Renderer & Asset Bridges

Status: STAGED
Wave: ACR-007 / foundation bridges (serialized after the wave)
Depends On: W057, W058, W059
Worker Count: 1

**Owned surfaces**
- `adapters/renderers/blender/*`
- `adapters/foundations/freecad/*`
- `adapters/foundations/assimp/*`
- `adapters/foundations/openusd/*`
- `docs/rendering/*`
- `qa/foundation-renderers/*`

## Objective

Bring at least one external foundation into the hidden Epoch rendering system and establish reusable asset/interchange bridges.

## Required

### Blender
Implement a sidecar/headless capability for high-fidelity/offscreen rendering, scene processing and/or asset preparation. The visible surface remains Epoch; the Blender editor UI is not required.

### Interchange/assets
Establish validated translation boundaries for glTF where appropriate, OpenUSD where richer composition is justified, Assimp for normalization where useful, and FreeCAD precision geometry where a real use case requires it.

## Restrictions

- Provider-native files never become Epoch authority.
- External process/file access is scoped and typed.
- Blender license/distribution obligations must be recorded before release packaging.
- Do not add Godot/O3DE merely for catalog completeness; implement them only if a concrete capability gap remains.

## Acceptance

At least one real external foundation path is exercised end-to-end through the Renderer Fabric, without a separate provider UI, with semantic identity and evidence continuity preserved.
