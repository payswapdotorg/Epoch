# W057 — Interactive World Workspace & Game-like Engineering UX

Status: STAGED
Wave: ACR-007 / first concurrent wave (one of W057|W058|W059)
Depends On: W056
Worker Count: 1

**Owned surfaces**
- `packages/world-runtime/*`
- `apps/web/src/features/world/*`
- `apps/web/src/shell/*` only for the world route/mount
- `apps/desktop/*` only for world-host wiring
- `qa/world-experience/*`
- `docs/journeys/interactive-world.md`

## Objective

Make the spatial world the primary Epoch problem-solving workspace on web and desktop.

## Required

- real 3D viewport mount;
- orbit/pan/zoom and desktop navigation;
- semantic picking;
- selection/inspection;
- layer isolation/reveal;
- measurement and annotation;
- visible agent presence/follow;
- timeline/replay;
- branch/simulation entry;
- renderer selector and health/fallback surface.

Existing lifecycle/project panels become secondary context surfaces.

## Acceptance

A user can enter a real fixture problem and solve through the spatial world without relying on a table/status representation. Interactions produce existing typed Epoch intents. W057 may use a contract-only reference adapter while W058/W059 land real engines; it must not invent renderer semantics.
