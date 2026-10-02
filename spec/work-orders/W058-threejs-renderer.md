# W058 — Three.js Embedded Interactive Renderer

**Depends:** W056  
**Concurrency:** one of W057/W058/W059

**Owned surfaces**
- `adapters/renderers/threejs/*`
- `qa/renderer-conformance/threejs/*`
- `docs/rendering/threejs.md`

## Objective

Implement the first real interactive renderer behind the Renderer Fabric using Three.js, embedded into the Epoch-owned viewport.

## Required

- scene mounting from canonical envelopes;
- semantic entity mapping and hit testing;
- camera controls;
- overlays/materials/animations;
- measurement/annotation affordances;
- visible agent representations;
- frame/evidence capture where declared;
- fidelity/device budgets;
- safe disposal;
- no direct durable mutation;
- web/Tauri-compatible hosting.

## Acceptance

The real Three.js viewport renders the shared canonical fixture and produces normalized Epoch world interaction intents. No Three.js editor/application UI is required or exposed.
