# ACR-012 — Construction Solution Explorer

**Status:** APPROVED (operator directive, 2026-10-04)
**Approved:** 2026-10-04 (operator handoff: "Construction Solution Explorer — new product direction")
**Activation:** this record (governance/acr012-activation)
**Target experience version:** X2.0 UNCHANGED — this ACR introduces NO new semantic authority; it is a product-surface program over the existing E1.0/X2.0 authorities
**Work Orders:** W071 (fixture, serialized first) → W072 (web) ∥ W073 (desktop), max concurrent 3, W072/W073 pairwise-disjoint
**Deadline:** 2026-10-05 00:00 (operator directive — fast progress without quality loss)

## Why this exists

The interactive-world infrastructure (W056–W068) delivered the world runtime,
experience projection, renderer fabric, Three.js + Babylon.js adapters, the
web `/world` host, the desktop host, typed interaction intents, renderer
switching/fallback, navigation state, semantic handling, measurement/
annotation, timeline/replay, agent presence, the construction domain pack,
and the BOQ/procurement/delivery infrastructure.

Those foundations are REAL and must be REUSED, not rebuilt.

The problem: the current product surface does not yet deliver the intended
engineering experience. The `/world` host presents an abstract seven-entity
plant-room fixture inside a workspace layout; the desktop world is not the
default problem-solving surface. A dashboard containing world metadata is
NOT the spatial world.

## Product thesis

Epoch's primary construction problem-solving experience:

```
Open construction problem
      ↓
Enter solution world
      ↓
Navigate around building/site
      ↓
Inspect elements
      ↓
Reveal/isolate systems
      ↓
Measure / annotate
      ↓
Observe agents working
      ↓
Move through construction timeline
      ↓
Inspect quantities / BOQ / cost
      ↓
Inspect constraints and findings
      ↓
Branch / compare / simulate
      ↓
Approve solution
```

The spatial world is the PRIMARY product surface (60–75% of the main screen).
Tables, forms, lifecycle lists and status panels are secondary projections.

**Critical failure condition:** the application loads successfully BUT the
main screen still feels like a workflow/dashboard application with a small or
abstract "world" embedded inside it. That is an automatic failure.

## UX reference

The supplied "Atelier — Commercial Space Planner" HTML file is the visual and
interaction reference. Adapt its structure and interaction model — NOT its
domain or branding:

```
Atelier                          -> Epoch construction
─────────────────────────────────────────────────────
strong central canvas            -> construction world viewport (60–75%)
compact top bar                  -> solution/context bar
left library/navigation          -> construction layers navigator
right inspector/cost             -> engineering inspector + BOQ/cost
floating HUD elements            -> view controls, metrics, timeline
plan/3D switching                -> plan / 3D / section modes
furniture library                -> construction systems (layers)
furniture object                 -> building/site semantic element
capacity                         -> quantities/utilization metrics
fire egress                      -> safety/regulatory constraints
cost estimate                    -> BOQ + cost estimate
placed items                     -> solution elements
static template                  -> construction state + timeline
```

Visual language to retain: warm neutral background, compact professional
typography, restrained panels, floating HUDs, compact tool controls, clear
selected-state highlighting, live metrics. Adapted to professional
engineering — never Atelier branding, never the commercial-space domain.

## Construction scene

The abstract fixture is replaced by a believable small building/site
solution fixture containing real construction systems:

```
SITE (boundary, access, staging, excavation)
FOUNDATION (strip foundation, foundation bases, ground slab)
STRUCTURE (columns, beams, roof structure)
ENVELOPE (walls, doors, windows, roof)
MEP (electrical, lighting, plumbing, HVAC, drainage)
FINISHES (ceiling, floor, paint, fixtures)
```

Every visible component corresponds to an Epoch semantic entity (entityId,
entityType, label, material, dimensions, quantity, phase, status, cost,
constraints). The semantic entity belongs to Epoch; the renderer mesh is
only its presentation.

## Required navigation & interaction

3D orbit/pan/zoom/focus/reset · true top-down PLAN · SECTION cutaway ·
optional walk mode where the runtime supports it cleanly · selection
producing the canonical semantic entityId · isolation (only foundations /
structure / MEP / envelope / finishes) · measure between semantic entities ·
annotations attached to semantic entities · agent follow. All through the
existing typed Epoch interaction path — NO renderer becomes semantic
authority.

## Timeline

Construction time visibly represented (Site → Excavation → Foundation →
Structure → Walls → Roof → MEP → Finishes); a scrubber changes the presented
construction state; reuses the existing Epoch world/timeline semantics. No
second lifecycle, no second timeline authority.

## Agent presence

At least two visible agents (e.g. Structural Engineer, Site Coordinator,
Surveyor, MEP Engineer) inhabiting the world — spatially meaningful
representations; see/select/inspect-task/follow; see the element each is
working on. The target feeling: watching AI/human engineering agents operate
inside a shared engineering game world.

## Inspection / BOQ / constraints / variants

- Inspector = engineering projection of the semantic entity (identity,
  material, dimensions, quantity, status, cost, constraints, evidence) —
  never a second semantic ledger.
- BOQ/cost surface (Foundations/Structure/Envelope/MEP/Finishes → subtotal/
  contingency/total) with BOQ-item ↔ world-entity cross-selection, using the
  existing construction/domain/solution-delivery structures. No second BOQ
  authority.
- Constraints/findings visibly exposed (✓/⚠), spatially discoverable;
  selecting a finding focuses the relevant element(s).
- Solution variants (Current/Alternative A/Alternative B) with
  cost/days/risk comparison; selecting a variant CHANGES THE WORLD
  REPRESENTATION — never a table-only feature. Uses existing
  branch/simulation/solution concepts.

## Renderer architecture

Reuse the existing fabric: Three.js + Babylon.js (both required), reference
renderer as fallback only. Renderer switching preserves tenant, scene
identity, world digest, semantic entity identity, focused entity, layers,
annotations, measurements, timeline position where portable, agent
references. The renderer selector stays Epoch-owned. No renderer-local
semantic authority. Blender NOT required for this program.

## Web + Desktop parity

Web `/world` and the Desktop world section render the SAME construction
solution fixture (semantic entities, world digest, scene structure, layers,
timeline, agents, variants, quantities, constraints, BOQ references).
Differences only where the platform genuinely requires. The desktop world
must be the DEFAULT problem-solving surface, not a buried tab.

## Scope discipline (explicit OUT list)

Mobile · marketplace · billing · developer portal · autonomous capability
discovery · new AI models · new LLM orchestration · new lifecycle
authorities · new database authorities · Blender integration · deployment
redesign. None of these are this program.

## Work Orders

- **W071 — Construction Solution World Fixture** (serialized first; freezes
  the shared fixture contract; runs ALONE on its surface)
- **W072 — Web Construction Solution Workspace** (depends W071; owns
  `apps/web` world surfaces + web journeys)
- **W073 — Desktop Construction Solution Workspace** (depends W071; owns
  `apps/desktop` surfaces + desktop journeys; parallel with W072 —
  pairwise-disjoint)

## Acceptance

ACR-012 is NOT complete merely because tests pass. The 20 web acceptance
criteria (see W072) and their desktop equivalents (W073) must be VISIBLY
true in the actual product, evidenced by real browser and real desktop
screenshots/recordings. The governing success criterion:

**web + desktop can open, navigate and explore a real construction solution
as an interactive engineering world.**

Completion is reported only when the running product visibly provides the
construction solution exploration experience — never merely because renderer
adapters mount or tests go green.
