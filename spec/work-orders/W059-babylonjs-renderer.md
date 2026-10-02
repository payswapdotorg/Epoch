# W059 — Babylon.js Embedded Interactive Renderer

**Depends:** W056  
**Concurrency:** one of W057/W058/W059

**Owned surfaces**
- `adapters/renderers/babylonjs/*`
- `qa/renderer-conformance/babylonjs/*`
- `docs/rendering/babylonjs.md`

## Objective

Implement the second interchangeable interactive renderer using Babylon.js.

## Required

Implement the same canonical scene/interaction contract as W058: semantic picking, camera controls, overlays/materials/animations, measurement/annotation, agent presence, fidelity budgets, capture where declared, safe disposal and web/Tauri embedding.

## Acceptance

Babylon.js mounts the same fixture as W058 and passes the shared conformance/interaction battery with equivalent normalized intents and unchanged canonical world digest.
