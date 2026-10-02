# Epoch — ACR-007 Successor Handoff

## Current live program

ACR-006 remains the live program until W055 closes. Do not dispatch ACR-007 yet.

The current frontier is governed by:
- `spec/development-state/program-state.json`
- `spec/development-state/frontier-state.json`
- `spec/development-state/dependency-state.json`
- `spec/development-state/checkpoint-state.json`

## Successor program

ACR-007 — Interactive World Runtime & Multi-Renderer Fabric is approved and staged.

Read:
1. `spec/architecture-lock.md`
2. `spec/architecture-change-requests/ACR-007-interactive-world-renderer-fabric.md`
3. `spec/renderer-fabric-architecture.md`
4. `spec/work-items.md` (ACR-007 section)
5. `spec/dependency-graph.md` (ACR-007 section)
6. `spec/development-state/staged-successor.json`
7. `spec/work-orders/W056-renderer-fabric-foundation.md` through `W061-multi-renderer-closure.md`
8. `docs/rendering/README.md`
9. `docs/rendering/renderer-matrix.md`

## Mission

Turn Epoch into the intended interactive engineering world while preserving the existing semantic kernel.

The user should be able to open a real engineering problem and work spatially:
navigate -> inspect -> reveal layers -> measure -> annotate -> observe/follow agents -> branch/simulate -> compare -> approve -> verify.

The workflow shell remains supporting context.

## Renderer strategy

- Three.js: first embedded interactive renderer.
- Babylon.js: second embedded interactive renderer.
- Blender: hidden sidecar/high-fidelity capability.
- Godot/O3DE: future native interactive candidates.
- FreeCAD/ParaView/CesiumJS/Assimp/OpenUSD: specialized/rendering/interchange capabilities.

The Epoch UI owns the viewport and controls. Third-party application UI is not the required product surface.

## Dispatch

After W055:

W056

Then, concurrently:

W057 | W058 | W059

Then:

W060

Then:

W061

Maximum three concurrent workers. One Work Order = one branch = one PR. Workers never merge. Root manifests/lockfiles stay serialized Tech Lead work.

## Non-negotiables

World Model remains semantic authority.

Renderer sessions are ephemeral presentation state.

Renderer switching must preserve canonical world digest/identity and semantic focus/layers.

Renderer input becomes typed Epoch intents.

Action Gateway remains execution authority.

Verification/Evidence remains proof authority.

No provider-native scene graph, editor project, renderer cache or process state becomes canonical Epoch state.

## Completion oracle

Git + CI + real renderer/user journey evidence.

A table/status implementation is not equivalent to the interactive world.
