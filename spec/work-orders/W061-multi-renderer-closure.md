# W061 — Multi-Renderer Integration & Interactive World Closure

Status: AUTHORIZED
Wave: ACR-007 / serialized closure
Depends On: W060
Worker Count: 1

**Owned surfaces**
- `apps/web/*`
- `apps/desktop/*`
- `packages/world-runtime/*`
- `packages/renderer-fabric/*`
- `qa/rendering/*`
- `qa/world-experience/*`
- `docs/journeys/interactive-world.md`
- `docs/rendering/*`
- `release/clients/*`
- `spec/PROJECT-STATE.md`
- `spec/development-state/*`
- `AI_CONTINUATION.md`
- `docs/LLM-ARCHITECT-HANDOFF.md`
- `README.md`

## Objective

Make the interactive world the real cross-client Epoch experience and close the renderer program.

## Required acceptance battery

1. enter a real fixture problem;
2. render a real spatial world;
3. orbit/move/zoom;
4. select a semantic entity;
5. inspect it;
6. isolate/reveal a layer;
7. measure;
8. annotate;
9. see and follow an agent;
10. replay/seek;
11. branch/simulate;
12. switch Three.js -> Babylon.js without leaving Epoch;
13. switch back;
14. exercise the external foundation path without separate vendor UI;
15. verify world digest/entity continuity;
16. force renderer degradation/failure and verify declared fallback;
17. approve an actual action through Action Gateway;
18. verify resulting state/evidence in Epoch.

## Non-negotiable UX

The central viewport is the primary workspace. A table/status shell plus an auxiliary 3D panel is not sufficient.

For every P0/P1/P2 defect:

Observe -> record -> reproduce -> regression test -> fix -> rerun -> close.

## Final evidence

Record exact source commit, renderer revisions, license snapshot, platform matrix, journey records, renderer-switch evidence, fallback evidence, semantic digest continuity, visual evidence and CI/E2E results.
