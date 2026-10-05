# W072 — Acceptance-criteria sweep record (ACR-012, web)

The work order's acceptance block: "visibly true in the running web app" —
the 20 criteria of `spec/work-orders/W072-web-construction-solution-workspace.md`
§ Acceptance, enumerated AC-1…AC-20 in the WO's order. Each verdict cites:

- **journey** — a committed browser journey in `apps/web/e2e/`
  (j14 `j14-world-arrival`, j15 `j15-world-inspection`,
  j16 `j16-world-drawings`, j17 `j17-world-solution` — real software GL
  via SwiftShader ANGLE, production build, green at the delivery head);
- **live** — a screenshot in `qa/web/evidence/w072/` (manifest:
  `visual-acceptance.md`; every frame exists at the 1680×1000 sibling
  canvas AND the 1280×720 battery canvas unless noted);
- **component** — the W072 component battery (`vitest`, green at the
  delivery head: the construction-solution + workspace suites).

Environment qualification for every "live" pointer: real browser WebGL
through software GL (SwiftShader — the renderer string is asserted in-run);
the Three.js massing renders unlit (no lights in the frozen W058 scene
graph — an adapter-owner advisory, geometry equivalence battery-asserted);
see `visual-acceptance.md` notes 1–3.

| AC | Criterion (WO) | Verdict | Pointers |
|----|----------------|---------|----------|
| AC-1 | `/world` opens a construction solution | **PASS** | journey j14 (world-host ready, `data-workspace-kind=construction-solution`, the solution bar names "Construction solution — Pioneer Block-A", the sealed fixture digest); live 01; component (workspace: canonical digest + Epoch-owned chrome) |
| AC-2 | An actual building/site is visible immediately | **PASS** | journey j14 (the frozen entity set incl. slab/columns/walls/roof/HVAC/staging at the ready flip; real GL pixels BEFORE any interaction — massing forensics); live 01; component (construction-solution: "presents the Current baseline exactly (34 entities)") |
| AC-3 | Three.js displays actual construction geometry | **PASS** | journey j14 (the SwiftShader renderer string + the live drawing-buffer forensics: 54 distinct colors, 6.87% non-ground massing — re-proven identical after the renderer round trip and the whole drawing-set round trip); live 01/17/18; PNG-level corroboration: 3.9–6.3% massing share inside the world card at all four sizes |
| AC-4 | Babylon.js displays equivalent construction geometry | **PASS** | journey j14 (the switched-to Babylon surface live: LIT pixels — 30 distinct colors, channel spread 204 — over the same frozen entity set); live 02. Honest shading divergence: the Three.js adapter declares no lights (unlit silhouettes) vs Babylon's hemispheric light — equivalent geometry, different shading; adapter-owner advisory, `adapters/*` frozen for W072 |
| AC-5 | Renderer switching preserves the same semantic world | **PASS** | journey j14 (digest, entity set, selection, timeline position preserved across three→babylon→three + the surfaced switch receipt; the full interactive-continuity proof is the j13 battery's switching legs); live 02/17; component ("the renderer-switch preservation contract at component level", "registers the REAL engines + the reference fallback in the declared preference order") |
| AC-6 | Orbit/pan/zoom works | **PASS** | journey j15 (reset → 2× orbit → pan → typed wheel zoom: the navigation HUD readout changes at every step, `zoom applied` journaled); live 08 (the post-navigation camera — stills cannot show motion, `visual-acceptance.md` note 5); component (workspace: "classifies drags (orbit vs shift-pan) and scales them to gestures", "navigation keys reach the driver") |
| AC-7 | Plan view works | **PASS** | journey j16 (true top-down: every default-visible footprint, the labelled A–A cut line, a REAL plan pick through the component's own projector + hit-test); live 03; component ("projects the true top-down plan and hit-tests the presented footprints") |
| AC-8 | Section/cutaway works | **PASS** | journey j16 (the internals THROUGH the envelope at the default cut; the cut is INTERACTIVE — the steppers re-project; a REAL section pick of the duct at the stepped cut); live 04; component ("cuts the section at the labelled plane and exposes the MEP clash zone", "parameterizes the section cut"); live 18 (the stable-stage round trip back in 3D) |
| AC-9 | Construction layers work | **PASS** | journey j16 (MEP isolation through the typed filter intent — the navigator state AND the spatial truth: only MEP entities remain; reveal-all restores through the typed show intent); live 05; component ("derives the isolated layer from the layer visibility state", "the navigator layer affordances issue the typed driver commands") |
| AC-10 | Selecting an element reveals its canonical identity | **PASS** | journey j15 (a REAL 3D pick through the fabric seam → the canonical `cs-site-staging-yard`), j16 (the same from the plan AND the section drawings); live 03/04/06 |
| AC-11 | Inspecting an element shows meaningful construction data | **PASS** | journey j15 (the §9 engineering card of the front door: identity, type, material, dimensions, quantity, phase, status, cost, constraints + the evidence trail: BOQ line, ⚠ finding, layer, phase — a fixture projection, never a second ledger); live 06; component ("the inspector renders the §9 engineering projection + the evidence trail", "projects the §9 engineering evidence trail per entity") |
| AC-12 | Measurement works | **PASS** | journey j15 (the documented four-pick cadence over the real measurement affordance: anchor → arm → re-anchor → the composed typed measure intent, 4 journal entries + `measure-requested` + the live hint HUD); live 07 |
| AC-13 | Annotation works | **PASS** | journey j15 (the typed annotate intent attaches to the focused entity — a CANONICAL revision: the world digest changes and the note renders in the world overlay); live 07 |
| AC-14 | Agents are visible inside the world | **PASS** | journey j17 (≥2 agents: the presence rail + the projected markers in the 3D chrome AND both agents on the plan at their world positions); live 09; component ("interpolates the agent movement scripts deterministically", "the navigator renders the six construction layers + the agents through the typed path") |
| AC-15 | Agent follow works | **PASS** | journey j17 (the typed follow-agent intent: the camera mode switches — the HUD names it, the presence flag sets, the agent's task inspects with its current-work element, and that element highlights IN the world); live 09; component ("wires the agent current-work highlight hooks") |
| AC-16 | Timeline changes construction state | **PASS** | journey j16 (the phase scrubbers move the programme head: position, phase HUD, built-count metrics, and the DRAWING truth — future phases dashed, arrived phases solid, all solid at Finishes); live 10/11; component ("phase-gates the presented entities", "the viewport timeline HUD renders the programme phases + the scrubber, and phase clicks issue the typed scrub") |
| AC-17 | BOQ/cost explored from the world | **PASS** | journey j17 (per-layer rollups → subtotal → contingency → total + the fixture grand total; [View BOQ] opens every identity-mapped line; BOQ line → its world entity selected + stroked; world pick → its line cross-highlighted — BIDIRECTIONAL, persistent until cleared); live 12; component ("maps the BOQ line items 1:1 onto the world entities", "resolves the bidirectional BOQ <-> world cross-selection", "the BOQ tab renders the per-layer rollups") |
| AC-18 | Constraints/findings explored from the world | **PASS** | journey j17 (the ✓/⚠ records; with Structure isolated the MEP-clash ⚠ selection focuses its elements AND reveals the hidden owning layer through the typed show intent — the duct, the riser AND the hidden legacy conduit become discoverable IN the world); live 13; component ("presents the constraints/findings surface", "the findings tab renders the fixture findings with severity") |
| AC-19 | Solution variants compared THROUGH the world | **PASS** | journey j17 (Alt A: the typed branch intent at the programme branch marker, the clash-source conduit REMOVED, the duct rerouted, the 3D delta badges; Alt B: the NEW interior AHU with its success ring; Current: the world restored — the representation itself changes, never a table-only comparison); live 14/15/16; component ("applies the Alternative A variant deltas", "applies the Alternative B variant deltas (the added interior AHU)", "issues the typed branch intent at the fixture branch point") |
| AC-20 | No dashboard/table mistaken for the spatial world | **PASS** | journey j14 (the dominance class asserted live: the world viewport is the PRIMARY surface, the rails flank it at restrained shares, the HUDs float OVER the canvas, the default state never scrolls; row-share ∈ [0.60, 0.80] asserted at the battery canvas); live 01 at ALL FOUR canonical sizes + the four-size dominance matrix (`visual-acceptance.md`): row-share 63.92/68.14/70.90/71.24% — inside the 60–75% band at every size, every card edge PNG-verified; component (workspace: "renders the WORLD VIEWPORT as the primary surface flanked by the secondary rails") |

**Sweep verdict: 20/20 PASS.** Honest qualifications, none affecting a
verdict: (1) software GL (SwiftShader) — real browser WebGL, renderer
string asserted; (2) the Three.js unlit-massing / Babylon lit-massing
shading divergence (AC-3/AC-4) — geometry equivalence battery-asserted,
recorded as an adapter-owner advisory (`adapters/*` frozen for W072);
(3) orbit/pan/zoom motion is proven by the live journey assertions, not by
the still (AC-6); (4) the 1280×720 whole-workspace dominance reading is
59.48% (0.52pp under the 60% floor on that supplementary basis — in band
on the declared row basis at every size; `visual-acceptance.md` note 6);
(5) the j13 battery's own degradation legs (no-GL forced degradation,
Blender-live) are honest env-gated project-self-skips in the default
chromium project — outside the 20-AC scope, documented in the battery.

Verification behind the pointers (the delivery head, this evidence leg's
final re-verification): the full web battery j01–j17 at `:3210`, vitest
unit suite, typecheck and lint — counts and durations in the worklog entry
(WORK-W072-R-C) and the journey records.
