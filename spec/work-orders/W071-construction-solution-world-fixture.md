# Work Order W071 — Construction Solution World Fixture (ACR-012)

Worker Count: 1
W071 runs ALONE first — it freezes the contract W072/W073 consume.

One Work Order = one branch = one PR. Workers never merge.

## Depends

— (base: main at the ACR-012 activation merge). W072 + W073 become eligible
only when this order's contract is frozen (merged).

## Purpose

Replace the abstract plant-room fixture basis with the shared CONSTRUCTION
SOLUTION fixture: one believable small building/site solution — a canonical
`WorldScene` (W016 admission) composed with real construction semantic
entities, renderer-neutral geometry, construction layers, phases/timeline,
agents, solution variants, quantities/BOQ references, and constraints/
findings — served from ONE shared package both hosts consume.

## Owned surfaces

- `packages/construction-world-fixture/*` (NEW package, all of it)
- `qa/construction-solution/*` (NEW battery directory, all of it)
- `pnpm-lock.yaml` + root manifest ONLY to the extent required to register
  the new workspace package (no other dependency changes; disclosed in the
  PR body)

## No-go surfaces

- `apps/web/*`, `apps/desktop/*` (W072/W073 surfaces)
- `adapters/renderers/*`, `contracts/renderers/*`, `packages/renderer-fabric/*`,
  `packages/renderer-runtime/*` (frozen — consume as-is)
- `packages/world-experience/*`, `packages/world-runtime/*`,
  `packages/progressive-scene/*` (frozen — consume as-is; if richer
  projection data is needed, it lives IN THE FIXTURE as fixture-owned
  renderer-neutral data, not as contract changes)
- `packs/construction/*`, `packages/solution-delivery/*` (consume as-is)
- No governance-state edits, no docs/journeys edits (TL records at merge)

## Deliverables

1. **The semantic entity set** — every construction system of the ACR-012
   scene tree is present: SITE (boundary, access, staging, excavation),
   FOUNDATION (strip foundation, foundation bases, ground slab), STRUCTURE
   (columns, beams, roof structure), ENVELOPE (walls, doors, windows, roof),
   MEP (electrical, lighting, plumbing, HVAC, drainage), FINISHES (ceiling,
   floor, paint, fixtures). Entities carry the ACR-012 §4 fields
   (entityId like `COL-04`, entityType like `structure:column`, label,
   material/grade, dimensions, quantity+unit, phase, status, cost reference,
   constraints). Realistic counts (dozens, not hundreds): e.g. ≥4 columns,
   ≥2 beams, walls with ≥1 door + ≥2 windows, ≥1 element per MEP subsystem.
2. **Renderer-neutral geometry/projection data** — per entity: position,
   bbox/size, rotation, a primitive shape description (box/cylinder/etc.),
   layer membership, phase visibility, and variant deltas — enough for both
   Three.js and Babylon.js to present equivalent geometry without
   renderer-local authority.
3. **Construction layers** — the six canonical layers (site, foundation,
   structure, envelope, mep, finishes) as the layer navigator data.
4. **Phases/timeline inputs** — the ACR-012 §7 construction sequence
   (site → excavation → foundation → structure → walls → roof → mep →
   finishes) expressed with the EXISTING world-experience timeline/marker
   semantics (reused, not re-invented), including per-entity phase
   membership so a timeline position determines presented state.
5. **Agents** — ≥2 agents (e.g. Structural Engineer, Site Coordinator)
   with spatial positions, tasks, current-work entity references, and
   movement scripts compatible with the existing agent-presence
   infrastructure.
6. **Solution variants** — Current + Alternative A + Alternative B:
   world-state deltas (added/removed/changed entities), cost, days, risk
   level, and variant-level constraints — expressed through existing
   branch/simulation concepts.
7. **Quantities/BOQ references** — per-layer quantity rollups and BOQ line
   items referencing the existing construction pack / solution-delivery
   structures (reference shapes; no second BOQ authority).
8. **Constraints/findings** — ≥5 constraint records (✓ and ⚠ severities,
   e.g. budget, programme, door clearance, structural spacing, material
   availability, an MEP clash finding) each referencing its entity IDs so
   the world can spatially focus them.
9. **The composed fixture API** (frozen at merge): a deterministic factory
   (e.g. `createConstructionSolutionFixture()`) returning the complete
   world — scene, device snapshot, renderer registrations (Three.js +
   Babylon.js + reference fallback, the W061 pattern), layers, timeline,
   agents, variants, BOQ, constraints — plus typed exports for every data
   shape. Fixed seeds; no network; identical digests across runs.
10. **Shared verification battery** (`qa/construction-solution/`): entity/
    layer/timeline/variant/BOQ/constraint assertions, digest stability,
    the frozen-API typecheck, and admission/seal verification of the
    composed scene through the REAL world-experience admission.

## Rules

- REUSE the existing contracts (WorldScene admission, world-experience
  timeline, agent presence, construction pack, solution-delivery); do not
  introduce any new semantic authority, second lifecycle, second timeline,
  or second BOQ authority.
- Deterministic: same input → same digests, always.
- Package must typecheck + lint green; its battery green; the touched
  existing batteries stay green (no regressions in world-experience /
  renderer-fabric / renderer-conformance).
- PR body states: Work Order, dispatch base SHA, final head SHA, owned
  paths, the FROZEN public API surface (exact export list — W072/W073
  compile against it), verification commands + counts, evidence,
  limitations, architecture questions.

## Acceptance

- The fixture battery is green and proves: every ACR-012 §4 system present;
  six layers; timeline scrubbing changes presented state; variants differ
  in world deltas + cost/days/risk; BOQ rollups match entity quantities;
  findings reference real entity IDs; digest stability across two
  compositions.
- No-go surfaces untouched (the TL's 7-gate review enforces).

## Visual acceptance (fixture level)

The fixture itself renders equivalent geometry under Three.js and
Babylon.js through the existing conformance harness (qa/foundation-renderers
pattern) — asserted at composition level; the HOST visual acceptance is
W072/W073's scope.
