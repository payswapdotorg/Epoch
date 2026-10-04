# Work Order W073 — Desktop Construction Solution Workspace (ACR-012)

Worker Count: 1
W073 runs after W071 merges; concurrent with W072 on disjoint surfaces.

One Work Order = one branch = one PR. Workers never merge.

## Depends

W071 (the frozen `packages/construction-world-fixture` public API — compile
against it, never modify it).

## Purpose

The desktop (Tauri) application gains the Construction Solution Explorer as
its DEFAULT problem-solving surface: entering the product presents the
construction solution world — spatially dominated, Atelier-inspired — with
the same fixture, layers, navigation modes, inspector, BOQ/cost,
constraints, agents, timeline, and solution variants as the web workspace
(W072). NOT a secondary "world" tab buried under lifecycle administration.

## Owned surfaces

- `apps/desktop/app/*` (the desktop UI components: product-app,
  product-workspace, sections, ui-kit — the world section + the default-
  surface restructure)
- `apps/desktop/src/*` (the desktop host/runtime glue the world section
  requires: native/embedded fixture source, native/runtime view-models —
  additive or world-scoped edits)
- `apps/desktop/test/*` + `apps/desktop/scripts/*` (desktop tests/support)
- `apps/desktop/package.json`/manifest ONLY for genuinely required deps
  (prefer existing workspace link-local deps; disclosed in the PR body)
- `qa/desktop/*` additive construction-solution journey tests

## No-go surfaces

- `apps/web/*` (W072), `packages/construction-world-fixture/*` (W071 frozen
  — consume only), other `packages/*`, `adapters/*`, `contracts/*`,
  `packs/*` (frozen)
- `src-tauri/*` config edits ONLY if the world section genuinely requires
  them (e.g. window sizing); disclosed; no bundling/packaging redesign
- No contract bumps, no renderer-adapter changes, no new semantic
  authority, no second BOQ/timeline/lifecycle authority, no mobile, no
  marketplace/billing/developer-portal, no LLM orchestration, no
  deployment changes

## Deliverables

1. **The desktop world section as the DEFAULT surface** — the product opens
   into the construction solution world (or presents it as the primary
   first-class surface with lifecycle/administration demoted to secondary
   navigation); spatially dominated layout (60–75% world viewport) with the
   same Atelier-adapted language as W072: compact top bar, LEFT
   construction navigator (layers/agents/tools), RIGHT inspector + BOQ/
   cost + constraints, floating HUD (view controls, metrics, timeline).
2. **3D mode** — orbit/pan/zoom/focus/reset over real renderer geometry;
   Three.js AND Babylon.js present equivalent construction geometry from
   the W071 fixture; Epoch-owned renderer selector; switching preserves
   tenant, scene identity, world digest, semantic entity identity, focused
   entity, layers, annotations, measurements, timeline position where
   portable, agent references; reference renderer as fallback only.
3. **Plan mode** — true top-down presentation.
4. **Section mode** — cutaway/section exposing internal systems.
5. **Construction layers navigator** — the six layers with toggles/
   isolation through the existing typed Epoch interaction path.
6. **Selection + inspector** — canonical semantic entityId on selection;
   the ACR-012 §9 engineering inspector as a projection of the W071
   fixture.
7. **Measure + annotate** — between/on semantic entities, reusing the
   existing infrastructure.
8. **Agents** — ≥2 visible agents; select/inspect task/follow; current-work
   element highlighted.
9. **Timeline** — scrubber changing presented construction state through
   the EXISTING world/timeline semantics.
10. **BOQ/cost surface** — per-layer rollups + [View BOQ]; bidirectional
    BOQ item ↔ world entity cross-selection.
11. **Constraints/findings surface** — ✓/⚠ list; selecting a finding
    focuses the relevant element(s) in the world.
12. **Solution variants** — Current/Alt A/Alt B with cost/days/risk;
    selecting a variant CHANGES THE WORLD REPRESENTATION.
13. **Desktop journey tests** (`qa/desktop/` additive + `apps/desktop/test/`):
    the acceptance criteria mapped to executable journeys where automatable
    in the desktop harness (the existing desktop test battery pattern),
    plus component-level tests.

## Acceptance (visibly true in the running desktop app — the same 20 as
W072, desktop-rendered)

The desktop world opens a construction solution; the building/site is
visible immediately; both renderers display equivalent construction
geometry; switching preserves the semantic world; orbit/pan/zoom, plan,
section, layers, selection→identity, inspector data, measure, annotate,
visible agents, agent follow, timeline state change, BOQ/cost from the
world, constraints/findings from the world, variant comparison through the
world — and no dashboard/table is mistaken for the spatial world. The
desktop world is the DEFAULT problem-solving surface.

## Visual acceptance

Same Atelier-adapted language as W072 (strong central canvas, compact top
bar, restrained panels, floating HUDs, live metrics, clear selection
highlighting) adapted to professional engineering. The PR body must include
local-run screenshot evidence (component-mount harness screenshots or the
dev-window capture pattern used by the existing desktop batteries; file
paths in the PR description or `qa/desktop/journey-records.md` notes).

## Rules

- Web + desktop render the SAME W071 fixture: same semantic entities, world
  digest, scene structure, layers, timeline, agents, variants, quantities,
  constraints, BOQ references. Differences only where the platform
  genuinely requires (window chrome, native integration points).
- All interactions through the existing typed Epoch interaction path; no
  renderer-local semantic authority.
- REUSE the desktop host patterns (embedded fixture source, view-models,
  product runtime) — evolve, do not rebuild.
- No-go surfaces untouched. Typecheck + lint green; existing desktop
  batteries stay green; new journeys green.
- PR body: Work Order, base SHA, head SHA, owned paths, verification
  commands + counts, screenshot evidence, limitations, architecture
  questions.
