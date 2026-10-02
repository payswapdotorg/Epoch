# ACR-007 — Interactive World Runtime & Multi-Renderer Fabric

**Status:** APPROVED_STAGED  
**Approved:** 2026-10-02  
**Activation:** after ACR-006/W055 completion and an X2.0 lock transition  
**Target experience version:** X2.0  
**Work Orders:** W056-W061

## Why this exists

The W016/W013 foundations already model scenes, entities, cameras, overlays, animations, agent presence, timelines and typed interaction intents. The current product does not yet turn those contracts into the intended spatial experience.

The next phase therefore adds the missing concrete rendering/product layer without replacing Epoch's semantic architecture.

## Product thesis

Epoch's primary problem-solving surface becomes an interactive spatial world:

`Open problem -> enter world -> navigate -> inspect -> reveal layers -> measure/annotate -> observe/follow agents -> branch/simulate -> compare -> approve -> observe result -> verify`

Workflow tables/status panels remain supporting projections, not a substitute for the world.

## Architecture

```
Epoch authorities
      |
World Model + Solution/Delivery/Evidence
      |
World Experience projection
      |
Renderer Fabric
  |       |        |
  |       |        +--> external sidecar foundations
  |       |
  |       +----------> Babylon.js embedded
  |
  +------------------> Three.js embedded
```

Renderer implementations never become semantic authority.

### Renderer classes

**Embedded interactive:** Three.js and Babylon.js. They render inside the Epoch-owned web/Tauri surface; users do not see a vendor editor.

**External sidecar:** Blender for high-fidelity/offscreen rendering, asset processing and scene preparation. Blender is controlled behind a typed process/IPC boundary; the normal user surface remains Epoch.

**Native engine candidates:** Godot and O3DE may be added when a concrete capability need justifies their cost.

**Specialized capabilities:** FreeCAD, ParaView, CesiumJS and Assimp may supply precision geometry, scientific/geospatial visualization or asset normalization. OpenUSD/glTF are interchange mechanisms, not semantic stores.

## Renderer switching

A renderer session is ephemeral. Canonical state that must survive a switch includes:

- tenant and scene identity;
- world digest;
- semantic entity IDs/relationships;
- focused entity;
- semantic layer visibility;
- Epoch measurements/annotations;
- agent references;
- replay/timeline position where portable;
- evidence references;
- applicable fidelity/context.

A switch recreates presentation from canonical Epoch projection data. Provider-native scene graphs, caches, handles and local camera interpolation are disposable.

The user-facing control is an Epoch renderer selector, not a vendor application.

## Interaction boundary

Renderer input is translated to existing Epoch world interaction intents:

`pointer/keyboard/touch -> renderer handle -> semantic entity ID -> typed Epoch intent -> existing authority`

Renderer implementations cannot:

- mutate durable state directly;
- bypass Action Gateway;
- become World/Solution/Delivery/Verification authority;
- inject arbitrary executable UI.

## Foundation boundary

The existing `spec/capability-foundation-policy.md` remains binding.

Planning references verified for the current upstream projects include:

- Three.js: MIT.
- Babylon.js: Apache-2.0.
- Godot: MIT.
- Blender: GPL.
- OpenUSD: TOST.

Exact revisions and transitive licenses must be audited when an adapter is implemented.

## Acceptance

ACR-007 is complete only when:

1. a real spatial world is the primary web/desktop workspace;
2. at least two real interchangeable interactive renderers mount the same canonical fixture;
3. selecting an object produces its canonical semantic identity;
4. navigation, inspect, layer isolate/reveal, measure and annotate work;
5. agents are visibly represented and followable;
6. replay/branch/simulation entry is visible from the world;
7. switching renderers preserves canonical world digest/identity;
8. renderer failure can fall back/degrade without semantic corruption;
9. at least one external foundation path is exercised behind the Epoch-owned surface;
10. the user never needs to open a vendor editor to perform the core workflow;
11. real renderer/browser/desktop evidence exists;
12. no table/status projection is accepted as equivalent to the interactive world.

## Implementation graph

```
ACR-006/W055
      |
    W056
      |
  +---+---+
  |   |   |
 W057 W058 W059
  +---+---+
      |
    W060
      |
    W061
```

First concurrent wave after W056: **W057 | W058 | W059**.

See `spec/renderer-fabric-architecture.md` and the W056-W061 Work Orders.
