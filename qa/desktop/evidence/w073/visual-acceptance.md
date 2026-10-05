# W073 — Visual acceptance: local-run screenshot evidence (ACR-012)

Work order: `spec/work-orders/W073-desktop-construction-solution-workspace.md`
(§ Visual acceptance — "local-run screenshot evidence … file paths in the PR
description or `qa/desktop/journey-records.md` notes").

- **Branch / head at capture**: `work/w073-desktop-construction-solution-workspace`
  @ `11578c4` (chunks 1–3: ad7a9d7 → 38e5339 → 11578c4).
- **Capture date**: 2026-10-05.
- **Runner**: headless Chromium 153 (agent-browser CLI), viewport 1680×1000
  (the desktop non-compact layout), the static export of `apps/desktop` served
  locally at `http://127.0.0.1:4310/` (the W073 desktop port convention).
- **All captures are REAL UI states** driven through the product's own
  affordances (the `cs-*` controls), over the REAL
  `WorldWorkspaceRuntime` + `RendererFabric` + the frozen W071 fixture —
  exactly the composition the DEFAULT desktop surface mounts. Every state was
  verified in the live DOM (accessibility tree / data attributes) at capture
  time; three key frames were additionally re-verified by a vision model
  (notes below).

## Honest environment notes (read first)

1. **Engine GL surfaces did not come up in the capture environment.** The
   workspace's GL probes read `data-gl-three=false` / `data-gl-babylon=false`
   from mount onward, and the engine canvases were verified blank by
   `readPixels` sampling (pre- and post-revision). Raw WebGL2 context creation
   *succeeds* in this browser (SwiftShader-class software GL,
   `RENDERER "WebKit WebGL"`, MAX_TEXTURE_SIZE 8192), so this is not a
   missing-GL environment: the surface factory binds against viewport canvases
   whose refs are still `null` while the workspace renders its composing
   placeholder (the initial fabric session therefore attaches headless), and
   the `glLive` flag is snapshotted once at mount and never re-read after a
   fresh session on later canonical revisions. **Advisory to the desktop
   component owner (follow-up, no code changed in this evidence chunk):**
   bind the GL surfaces after the ready phase (or re-probe per session) so a
   live-GL webview presents engine pixels.
2. **Consequence for the 3D frames**: the 3D presentation renders the
   reference projection — the *designed honest degradation* (`cs-world-viewport
   data-spatial-overlay="reference"`): the same frozen fixture entities,
   canonical identity, layers, selection focus ring, cross-highlights,
   overlays and agent markers at their NDC-projected positions, drawn as the
   reference glyphs. No frame in this set is a placeholder panel; each shows
   the real world state machine. **Plan and section frames are full-fidelity**
   deterministic SVG projections of the same fixture geometry (unaffected by
   GL availability).
3. **Engine-level renderer equivalence** (Three.js ↔ Babylon.js presenting
   equivalent construction geometry) is *not* pixels-verifiable in this
   environment (both engines attach headless — note 1); it is evidenced
   headlessly by the existing desktop world battery + the journey composition
   (CJ01 step `cj01-4-renderer-chain`: the fabric offers
   `rr-threejs`, `rr-babylonjs-embedded`, `rr-construction-solution-reference`),
   and the *Epoch-owned switch itself* (with the world preserved) is captured
   live in frame 12.
4. **Native Tauri shell not covered**: cargo/rustc/webkit2gtk-4.1 absent —
   see `qa/desktop/evidence/w073/toolchain-audit.txt` (chunk 3 record).
   The captures exercise the desktop web UI composition (the same code path
   the Tauri webview loads).
5. **Measurement cadence**: against the REAL engine adapters the two-pick
   measurement composes on the fourth pick (the documented every-second-click
   cadence — `packages/world-runtime/src/workspace.ts` § measurement
   composition note). In this environment the engine-presented compose did
   not complete (occlusion-sensitive hit path under the reference-camera
   mapping); the captured measurement frame (10) was therefore composed
   through the **reference presenter's stateless two-pick path** — a
   first-class renderer choice in the same Epoch-owned selector — issuing the
   SAME typed `epoch.world.interaction.measure` intent, which applied the
   fixture-declared `ovl-cs-measure-structure-span` overlay ("Beam span B1",
   COL-01 ↔ COL-02). The engine-path compose is evidenced headlessly by CJ09
   (`cj09-1-measure=pass`, adapter anchor/arm/orbit/complete dance).

## Screenshot manifest

All files in `qa/desktop/evidence/w073/`. AC pointers reference the sweep in
`qa/desktop/evidence/w073/ac-sweep.md`.

| # | File | What it shows (verified live at capture) | AC evidenced |
|---|------|------------------------------------------|--------------|
| 01 | `01-default-surface-world-first.png` | The product opens DIRECTLY into the construction solution world: world viewport dominant (~60% of the window — VLM-verified), LEFT construction-layers navigator, RIGHT engineering inspector + BOQ/cost + constraints + variants, compact solution bar on top (renderer selector, variant chip, demoted lifecycle links), floating HUDs (view controls, live metrics, 8-phase timeline). Arrival selection COL-04 with the focus ring; agents-on-site cards; 33/34 entities visible. | AC-1, AC-2, AC-3, AC-4 |
| 02 | `02-plan-view-aa-cut.png` | PLAN mode — true top-down, north-up presentation: 1m footprint grid, site boundary, phase-gated layer-colored entity footprints, the draggable SECTION A–A cut line, measurement/annotation overlay lanes. | AC-8 |
| 03 | `03-section-view-cut-hud.png` | SECTION mode — the cutaway exposing internal systems (elevation levels, cut-projected entities) + the live cut HUD (`x = 1.50 m` after driving the −X cut control twice from the default cut). | AC-9 |
| 04 | `04-selection-inspector-evidence.png` | Entity selection through a real world pick (COL-01 plan footprint click): the inspector carries the CANONICAL entityId (`COL-01`) with the §9 evidence trail (BOQ lines, findings, working agents), and the world→BOQ cross-highlight engages (`data-source=world`). | AC-11, AC-12, AC-18 |
| 05 | `05-layer-isolated-mep.png` | Layer isolation through the typed filter intent: the MEP layer isolated (`data-isolated=true`, "Isolated" affordance) — only MEP entities present in the world, returning the hidden clash conduit (CJ02 behavior). | AC-10 |
| 06 | `06-timeline-later-phase-finishes.png` | Timeline scrubbed to a later phase (Finishes) via the phase chip: the presented world visibly changed — live metrics read "Finishes · built 34/34", all entities built vs the excavation-era default. | AC-17 |
| 07 | `07-variant-alt-a-world-changed.png` | Solution variant Alternative A (reroute HVAC) selected: variant chip "Alternative A — reroute HVAC", the world re-presented with 3 variant-delta badges (changed/removed) at the affected entities, through the typed branch intent at the programme branch point. | AC-20 |
| 08 | `08-variant-alt-b-simulate.png` | Alternative B (split-system HVAC) active (3 deltas) + the programme-simulation affordance fired: "simulate-requested · scenario scope-epoch-pioneer-block-a · world digest unchanged" (effect-only; the canonical world never mutated). | AC-20 |
| 09 | `09-boq-world-cross-highlight.png` | BOQ → world bidirectional cross-selection: the "HVAC supply duct run" BOQ line clicked (View BOQ open) → `data-source=boq`, the line itself highlighted, its world entity selected + highlighted in the plan, the inspector carrying the entity. | AC-18 |
| 10 | `10-measurement-overlay-beam-span.png` | The measurement overlay in use: the two-pick typed measure intent (reference presenter path — note 5) applied the fixture-declared overlay — the dashed "Beam span B1" span COL-01 ↔ COL-02 with endpoints and label over the world. | AC-13 |
| 11 | `11-annotation-overlay.png` | The annotation overlay in use (PLAN): "Verify AAC blockwork coursing at…" composed through the typed annotate intent onto the picked element; the measurement span from frame 10 persists (portable view state). | AC-14 |
| 12 | `12-babylon-renderer-active.png` | The second real renderer ACTIVE through the Epoch-owned selector: banner "rr-babylonjs-embedded · health healthy · session active", Babylon chip pressed in the top-bar selector; the world (entities, measurement, annotation, selection) PRESERVED across the switch. | AC-5, AC-6 |
| 13 | `13-mep-clash-finding-focus.png` | Constraints/findings from the world: the ⚠ "MEP clash — HVAC duct vs legacy conduit L2" finding clicked (after hiding the MEP layer) → the typed show intent REVEALED the layer returning the hidden conduit into the plan (`data-cs-plan-entity=cs-mep-legacy-conduit-l2` present), cross-highlight "finding focus · 3 entities", the duct selected with its §9 finding evidence. | AC-19 |
| 13b | `13b-mep-clash-conduit-revealed-isolation.png` | Bonus (spatial discovery): the same clash focus with the MEP layer ISOLATED — the hidden legacy conduit FOUND in the world, the three clash entities highlighted. | AC-10, AC-19 |
| 14 | `14-agent-follow-structural-engineer.png` | Agent presence: both agents visible (markers + navigator cards), "A. Reyes — Structural Engineer" FOLLOWED through the typed follow-agent intent (navigator affordance reads "Following"), current-work element (COL-04) ⌖-marked. | AC-15, AC-16 |

### Vision-model spot verification (honesty check)

Frames 01, 10 and 13 were re-described by a vision model (GLM-5V) after
capture, confirming: frame 01 — "a large 3D viewport (approximately 60% of the
screen) … left panel Construction Layers … right panel Engineering Inspector
and BOQ … Column COL-04 (SE) … selected and highlighted with an orange
circle"; frame 10 — the dashed measurement line labeled "Beam span B1" in the
world viewport; frame 13 — the HVAC duct inspector with the "MEP clash — HVAC
duct vs legacy conduit L2" finding, clashing entities highlighted in the plan,
and the status bar reading "finding focus · 3 entities".

### What could NOT be captured here (and where it IS evidenced)

- Live Three.js/Babylon.js engine pixels (GL surfaces dead in this
  environment — note 1): evidenced headlessly by the desktop world battery +
  the journey composition (CJ01 `cj01-4-renderer-chain`); recorded as an
  environment limitation + the GL-binding advisory above.
- The engine-path (four-pick) measurement compose live: CJ09
  `cj09-1-measure=pass` (adapter anchor/arm/orbit/complete over the real
  engine core); the live frame (10) shows the same typed intent + declared
  overlay through the reference presenter.
- Orbit/pan/zoom as a *still* image cannot show motion; the gestures were
  exercised live during the session (camera re-projected the reference
  glyphs) and the typed navigation path is covered by the desktop battery;
  AC-7 verdict rests on those, not on a frame.
- The native Tauri window chrome (toolchain absent — `toolchain-audit.txt`).

## Reproduction

```bash
cd apps/desktop && pnpm build          # static export (out/)
python3 -m http.server 4310 --directory out --bind 127.0.0.1
# open http://127.0.0.1:4310/ at 1680×1000 and drive the cs-* affordances
```
