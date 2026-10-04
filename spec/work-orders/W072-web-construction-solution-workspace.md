# Work Order W072 — Web Construction Solution Workspace (ACR-012)

Worker Count: 1 (parallel with W073 — pairwise-disjoint surfaces)

One Work Order = one branch = one PR. Workers never merge.

## Depends

W071 (the frozen `packages/construction-world-fixture` public API — compile
against it, never modify it).

## Purpose

The web `/world` route becomes the Construction Solution Explorer: a
spatially dominated, Atelier-inspired engineering workspace presenting the
W071 construction solution through the REAL Three.js and Babylon.js
adapters, with plan/3D/section navigation, the construction navigator,
engineering inspector, BOQ/cost, constraints, agents, timeline, and
solution variants.

## Owned surfaces

- `apps/web/src/features/world/*` (all of it — the workspace, host, views,
  and tests)
- `apps/web/src/shell/*` ONLY additive route/mount adjustments the world
  workspace requires (the `/world` route registration + mount; no other
  feature's routes touched)
- `apps/web/src/product/*`, `apps/web/src/client/*`, `apps/web/src/shared/*`,
  `apps/web/src/server/*` ONLY additive files the world workspace requires
  (e.g. shared world client glue) — additive only, never modifying another
  feature's files
- `qa/web/*` additive construction-solution journey tests
- `apps/web` package.json/manifest ONLY for deps the world workspace
  genuinely requires (prefer existing link-local workspace deps; disclosed
  in the PR body)

## No-go surfaces

- `apps/desktop/*` (W073), `packages/construction-world-fixture/*` (W071
  frozen — consume only), `packages/*`, `adapters/*`, `contracts/*`,
  `packs/*` (all frozen)
- No contract bumps, no renderer-adapter changes, no new semantic
  authority, no second BOQ/timeline/lifecycle authority, no mobile, no
  marketplace/billing/developer-portal, no LLM orchestration, no
  deployment changes

## Deliverables

1. **Spatially dominated layout** (Atelier-adapted): the construction world
   viewport occupies 60–75% of the main screen; compact top bar (solution
   name, renderer selector, view mode, session context); LEFT construction
   navigator (layers: Site/Foundation/Structure/Envelope/MEP/Finishes,
   agents list, tools); RIGHT engineering inspector + BOQ/cost +
   constraints; floating HUD elements (view controls, metrics, timeline
   scrubber, measure/annotate state). Warm neutral background, compact
   professional typography, restrained panels, clear selected-state
   highlighting. NOT a dashboard with a small embedded viewport.
2. **3D mode** — orbit/pan/zoom/focus/reset over real renderer geometry;
   Three.js AND Babylon.js present equivalent construction geometry
   (registered per the W071 fixture); the renderer selector is Epoch-owned
   (web UI control); switching preserves tenant, scene identity, world
   digest, semantic entity identity, focused entity, layers, annotations,
   measurements, timeline position where portable, agent references; the
   reference renderer remains the declared fallback only.
3. **Plan mode** — true top-down presentation of the same semantic world.
4. **Section mode** — cutaway/section presentation exposing internal
   construction systems (structure/MEP visible through the envelope).
5. **Construction layers navigator** — layer toggles/isolation ("show only
   foundations/structure/MEP/envelope/finishes") operating through the
   existing typed Epoch interaction path.
6. **Selection + inspector** — clicking an element yields the canonical
   semantic entityId; the inspector shows the ACR-012 §9 engineering data
   (identity, type, material, dimensions, quantity, status, cost,
   constraints with ✓/⚠, evidence) as a projection of the W071 fixture —
   never a second ledger.
7. **Measure + annotate** — measure between semantic entities (reusing the
   measurement infrastructure); attach Epoch annotations to semantic
   entities (reusing the annotation infrastructure).
8. **Agents** — ≥2 visible agents inside the world; select an agent;
   inspect its task; follow the agent (camera follows); see the element it
   is currently working on (highlight).
9. **Timeline** — a scrubber/slider that changes the presented construction
   state (site → … → finishes) through the EXISTING world/timeline
   semantics; the world visibly builds phase by phase.
10. **BOQ/cost surface** — per-layer rollups (Foundations/Structure/
    Envelope/MEP/Finishes → subtotal → contingency → total) + [View BOQ];
    BOQ item → selects/focuses the corresponding world entities; world
    element → reveals its BOQ/cost data (bidirectional cross-highlight).
11. **Constraints/findings surface** — ✓/⚠ constraint list; selecting a
    finding focuses the relevant element(s) in the world; at least one
    spatially discoverable ⚠ (e.g. the MEP clash).
12. **Solution variants** — Current/Alternative A/Alternative B selector
    with cost/days/risk comparison; selecting a variant CHANGES THE WORLD
    REPRESENTATION (world-state deltas applied; never table-only).
13. **Web journey/e2e tests** (`qa/web/` additive): the 20 acceptance
    criteria below mapped to executable journeys where automatable (the
    browser-GL battery pattern from W061/W067 — real software GL via
    SwiftShader ANGLE), plus component-level tests for navigator/
    inspector/BOQ/constraints/variants/timeline behavior.

## Acceptance (visibly true in the running web app)

1. `/world` opens a construction solution. 2. An actual building/site is
visible immediately. 3. Three.js displays actual construction geometry.
4. Babylon.js displays equivalent construction geometry. 5. Renderer
switching preserves the same semantic world. 6. Orbit/pan/zoom works.
7. Plan view works. 8. Section/cutaway works. 9. Construction layers work.
10. Selecting an element reveals its canonical identity. 11. Inspecting an
element shows meaningful construction data. 12. Measurement works.
13. Annotation works. 14. Agents are visible inside the world. 15. Agent
follow works. 16. Timeline changes construction state. 17. BOQ/cost can be
explored from the world. 18. Constraints/findings can be explored from the
world. 19. Solution variants can be compared through the world. 20. No
dashboard/table is mistaken for the spatial world.

## Visual acceptance

Before declaring complete, compare the running app against the Atelier
reference (supplied HTML): retain the visual language (strong central
canvas, compact top bar, restrained side panels, floating HUDs, live
metrics, obvious spatial interactions) adapted to professional engineering.
The reviewer (TL) will screenshot the running app for the record; the PR
body must include the local-run screenshot evidence (file paths in the PR
description or `qa/web/journey-records.md` notes).

## Rules

- All world interactions flow through the existing typed Epoch interaction
  path; no renderer-local semantic authority.
- REUSE: world host pattern (`world-host.tsx`), engine bootstrap
  (`world-engines`/`browser-gl`), the W061 workspace component structure —
  evolve them, do not rebuild from scratch.
- No-go surfaces untouched. Typecheck + lint green; the existing web
  batteries stay green; new journeys green.
- PR body: Work Order, base SHA, head SHA, owned paths, verification
  commands + counts, screenshot evidence, limitations, architecture
  questions.
