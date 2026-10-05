# W072 — Visual acceptance: local-run screenshot evidence (ACR-012, web)

Work order: `spec/work-orders/W072-web-construction-solution-workspace.md`
(§ Visual acceptance — "local-run screenshot evidence … file paths in the PR
description or `qa/web/journey-records.md` notes").

- **Branch / head at capture**: `work/w072-web-construction-solution-workspace`
  @ `b294597` (product code identical to the phase-B delivery head `c929bbc`;
  `b294597` is the e2e-harness port move only).
- **Capture date**: 2026-10-05 (16:09–16:11 UTC).
- **Runner**: Playwright 1.x / headless Chromium, the PRODUCTION build
  (`next start` on the battery port `:3210`, `BUILD_ID gsHpU5FVgX3EsJLzrQos2`
  postdating every source edit), deviceScaleFactor 1.
- **All captures are REAL UI states** driven through the product's own
  affordances by a TEMPORARY evidence spec (the `zevidence` probe — the
  j14–j17 journey composition, same selectors, same honest-basis pick
  derivations, same assertions, re-driven once per canvas with the capture
  moments chosen for best evidentiary value). Every state below was
  ASSERTED GREEN in the live DOM at capture time; the spec was deleted
  before the evidence commit (the probe convention). Nothing here is a
  product change.

## Honest environment notes (read first)

1. **Real software GL, no GPU.** This sandbox has no GPU; the browser
   composites through ANGLE/SwiftShader. This is REAL browser WebGL: the
   specs assert the actual renderer string
   (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (SubZero) (0x0000C0DE)),
   SwiftShader driver)`) and the drawing-buffer pixel forensics (below)
   read the live engine output. Software GL is recorded as exactly that.
2. **The 3D geometry reads in the stills.** The Three.js clear color is the
   host's warm paper ground; the construction massing renders on top of it:
   54 distinct colors and 6.87% non-ground pixels at the live drawing
   buffer (battery-asserted), PNG-level massing share 3.9–6.3% of the world
   card across the four sizes (1273–1734 distinct sampled colors inside the
   card). The Babylon.js surface is LIT (its adapter mounts a
   HemisphericLight): 30 distinct colors, channel spread 204 — visibly
   shaded geometry in frame 02.
3. **Renderer-equivalence divergence (advisory, no code changed).** The
   Three.js adapter's W058 scene graph declares no lights, so its
   MeshStandardMaterial massing renders as unlit silhouettes against the
   warm ground, while the Babylon adapter's is lit — equivalent geometry
   (same frozen entity set, battery-asserted), visibly different shading.
   `adapters/*` is frozen for W072; recorded for the adapter owner (the
   phase-B ledger advisory).
4. **The square engine stage is letterboxed inside the world card.** The
   engine canvas keeps aspect 1 (the `meet` doctrine — the stage that
   battery-asserted outweighs every side panel), centered in the world
   card with `viewportGround` bands around it. The DOMINANCE measurement
   uses the WORLD CARD (the whole world surface incl. bands + floating
   HUDs) — the thing a reviewer sees as "the world" — never the bare
   canvas.
5. **Stills cannot show motion.** Orbit/pan/zoom (frame 08) is captured at
   the post-navigation camera; the proof of motion is the live run: the
   navigation HUD readout changed at every step and the typed zoom intent
   hit the journal (`zoom applied`) — asserted in the spec, re-proven by
   the j15 journey at every battery run.
6. **The 1280×720 whole-workspace reading is 59.48%** — 0.52pp under the
   60% floor on that SUPPLEMENTARY basis (see the matrix below). On the
   declared main-surface basis (the workspace row) every size is in band.
   Recorded honestly, with the chrome arithmetic: the workspace carries a
   39px compact solution bar + an 18px status footer around the row.

## The AC-20 dominance measurement (four canonical sizes)

Bases (all measured, never asserted from config):

- **row-share** — the world card area over the WORKSPACE ROW
  (navigator | world | inspector) — the main work surface the WO's 60–75%
  band governs (the j14 spec's declared basis; `data-workspace-row`).
- **workspace-share** — the world card over the whole workspace block
  (row + the compact solution bar + the status footer) — the supplementary
  reading (phase-A's record quoted this construction; its published
  numbers 63.9/68.1/70.9/71.2% are the row-share basis — they match this
  table's row column to ±0.1pp, the deltas being the `b307248` 2px chrome
  fix).
- **window-share** — the world card over the full browser window (the
  158px app-shell chrome included). For context: the desktop sibling W073
  passed its review at ~50% full window; the web ships 46.4–58.2%.
- **PNG row-share** — the rendered-pixel share measured from the PNG
  itself: the card's four 1px border edges (`#ddd6c9`) detected in a ±6px
  window around each DOM-claimed edge (border-coverage scan), every edge
  VERIFIED within 2px, the share computed from the PNG-detected card
  (method + raw output: `pixel-forensics.json`; DOM-rect raw record:
  `dominance-measurements.json`).

| Viewport | row-share (DOM) | row-share (PNG, edge-verified) | workspace-share | window-share | HUDs float over canvas | no page scroll |
|----------|----------------:|-------------------------------:|----------------:|-------------:|:---------------------:|:--------------:|
| 1280×720 (battery) | **63.92%** | 63.92% (card 844×507 @(186,163), edges VERIFIED) | 59.48% | 46.43% | yes | yes |
| 1440×900 | **68.14%** | 68.14% (card 1004×687 @(186,163), edges VERIFIED) | 64.55% | 53.22% | yes | yes |
| 1680×1000 (sibling) | **70.90%** | 70.88% (card 1215×787 @(199,163), edges VERIFIED) | 67.62% | 56.93% | yes | yes |
| 1920×1080 | **71.24%** | 71.24% (card 1393×867 @(225,163), edges VERIFIED) | 68.22% | 58.24% | yes | yes |

**Verdict: the world occupies 63.9–71.2% of the main surface — inside the
60–75% band at ALL FOUR canonical sizes** (the j14 battery asserts
row-share ∈ [0.60, 0.80] live at the battery canvas). Rails stay
restrained (navigator 10.7–12.9% of the row, inspector 14.6–17.7%), the
navigator flanks left / inspector flanks right, all three HUDs (view
controls, live metrics, timeline) float INSIDE the world card, and the
default state never scrolls the page at any size (scrollHeight ==
innerHeight, measured). GL liveness at every size: 54 distinct colors /
6.87% non-ground at the drawing buffer; PNG-level card content 10.5–15.9%
incl. HUD ink, pure massing 3.9–6.3%.

## ACR-012 adaptation check (L66–91 of the ACR, the reference of record)

| Reference structure | Epoch construction adaptation | Evidenced |
|---------------------|-------------------------------|-----------|
| strong central canvas (60–75%) | world viewport, measured 63.9–71.2% of the row at four sizes | 01 (all sizes) + the matrix above |
| compact top bar | 39px solution bar: solution name, renderer selector, 3D/Plan/Section, session context | 01 |
| left library/navigation | LEFT construction layers navigator (six layers, agents, tools) | 01, 05, 09 |
| right inspector/cost | RIGHT engineering inspector + BOQ/cost + constraints ✓/⚠ | 01, 06, 12, 13 |
| floating HUD elements | view controls, live metrics, timeline scrubber — asserted INSIDE the viewport card | 01 (structure check), 07, 10 |
| plan/3D switching | 3D / Plan / Section modes over the same semantic world | 01, 03, 04, 18 |
| furniture library | construction systems (the six layers) | 01, 05 |
| furniture object | building/site semantic elements (canonical entityIds) | 03, 04, 06 |
| capacity | quantities/utilization live metrics ("built N/N") | 10, 11 |
| fire egress | safety/regulatory constraints ✓/⚠ (the MEP clash ⚠ spatially discoverable) | 13 |
| cost estimate | BOQ per-layer rollups → subtotal → contingency → total, bidirectional with the world | 12 |
| placed items | solution elements (the presented fixture entities) | 01, 03 |
| static template | construction state + timeline (dashed future → solid built) | 10, 11 |

Visual language retained: warm neutral background (`#f2efe9` page /
`#faf8f4` panels / `#e9e4da` world ground), compact professional typography
(10–18px scale), restrained panels (1px `#ddd6c9` borders), floating HUDs,
compact tool controls, clear selected-state (the burnt-sienna selection
ring — battery-asserted stroke). No reference branding, no commercial-space
domain (the "design-language reference" only).

## Screenshot manifest

All files in `qa/web/evidence/w072/`. Every frame exists at BOTH canvases —
the 1680×1000 sibling canvas and the 1280×720 battery canvas (identical
states; `-1680x1000` / `-1280x720` suffixes) — plus the default state at
1440×900 and 1920×1080 for the dominance matrix. AC pointers reference
`ac-sweep.md`.

| # | File (base name) | What it shows (asserted live at capture) | AC evidenced |
|---|------------------|------------------------------------------|--------------|
| 01 | `01-default-surface-world-first` (×4 sizes) | The DEFAULT `/world` state at the ready flip: Three.js active (`data-gl-three=true`, `data-engine-spatial=true`), SwiftShader renderer string, real massing pixels (54 colors, 6.87% non-ground), the frozen fixture digest + entity set, the dominance class asserted (primary/secondary surface roles, rails flanking, HUDs inside, no scroll) and measured (the matrix above). | AC-1, AC-2, AC-3, AC-20 |
| 02 | `02-babylon-renderer-active` | Babylon.js ACTIVE through the Epoch-owned selector: `data-active-renderer=rr-babylonjs-embedded`, real LIT pixels (30 colors, spread 204), the SAME semantic world (digest, entity set, selection preserved; the switch receipt surfaced). | AC-4, AC-5 |
| 03 | `03-plan-view-aa-cut` | PLAN — true top-down: every default-visible fixture entity footprint, the labelled A–A cut line at the fixture cut, the staging yard picked through the component's own projector/hit-test → canonical `cs-site-staging-yard` in the inspector. | AC-7, AC-10 |
| 04 | `04-section-view-cut-hud` | SECTION A–A at the INTERACTIVE stepped cut (x=2.25 after `+X`): internals exposed through the envelope (foundation strip, slab, cut wall, beams, ceiling, MEP duct + riser), the duct picked at the live cut → selected. | AC-8, AC-10 |
| 05 | `05-layer-isolated-mep` | MEP isolated through the typed filter intent (`filter applied`): only MEP entities left in the world (spatially verified — every plan footprint is `lyr-mep`), the navigator showing the isolated layer. | AC-9 |
| 06 | `06-selection-inspector-evidence` | Selection + inspection: the staging yard picked in 3D (canonical id), the inspect tool on the front door — the §9 engineering card (identity, type, material, dimensions, quantity, status, cost, constraints) + the evidence trail (BOQ line €780.00, the ⚠ clearance finding, layer + phase). | AC-10, AC-11 |
| 07 | `07-measure-annotate-overlay` | The four-pick measure cadence (anchor → arm → re-anchor → composed; 4 journal entries, `measure-requested`, the live hint HUD) + the annotation ("Verify riser penetration before pour" — a CANONICAL revision: the world digest changed, the note renders in the world overlay). | AC-12, AC-13 |
| 08 | `08-navigate-orbit-pan-zoom` | The camera after the full navigation leg (reset → 2× orbit → pan → wheel zoom): the HUD readout changed at every step, the typed zoom intent journaled (`zoom applied`). Still-image caveat: note 5. | AC-6 |
| 09 | `09-agent-follow-structural-engineer` | Agents: both present (3D chrome + plan), A. Reyes FOLLOWED (`follow-agent applied`, the HUD names the mode, the presence flag set), the agent card (task + current work COL-04), the current-work element selected + selection-stroked in the world. | AC-14, AC-15 |
| 10 | `10-timeline-phase-structure` | The programme scrubbed to Structure (6.0s): position + phase HUD + built-count metrics follow; the DRAWING truth — future MEP dashed vs the arrived solid slab. | AC-16 |
| 11 | `11-timeline-phase-finishes` | The programme scrubbed to Finishes: the whole world solid (built), the metrics reading the full build. | AC-16 |
| 12 | `12-boq-world-cross-highlight` | BOQ explored FROM the world: the per-layer rollups + subtotal → contingency → total + the fixture grand total, [View BOQ] open (every identity-mapped line), a BOQ line click → its world entity selected + stroked, then a world pick → ITS line cross-highlighted (bidirectional, captured at the world→BOQ moment). | AC-17 |
| 13 | `13-findings-clash-spatial-discovery` | Findings explored FROM the world: the ✓/⚠ records, the MEP-clash ⚠; with Structure isolated (every MEP entity gone) selecting the finding REVEALS the hidden MEP layer through the typed show intent — the duct, the riser AND the hidden legacy conduit back in the world, the duct selected, the riser cross-stroked. | AC-18 |
| 14 | `14-variant-alt-a-world-changed` | Alt A selected (€43,000 / 58 days / risk low / 2Δ 1✕): the typed branch intent at the programme branch marker, the clash-source conduit REMOVED from the world, the 3D variant-delta badges (removed ✕ / changed ●) at the affected entities. | AC-19 |
| 15 | `15-variant-alt-b-ahu-added` | Alt B selected: the NEW interior AHU entity appears in the world (footprint + success ring). | AC-19 |
| 16 | `16-variant-current-restored` | Back to Current: the conduit back in the world — the baseline restored (the world representation itself changed both ways, never a table-only comparison). | AC-19 |
| 17 | `17-renderer-round-trip-three` | Back on Three.js after the Babylon round trip: the SAME world (digest, entity set), the GL binding still live (massing identical to the pre-switch reading). | AC-5, AC-3 |
| 18 | `18-stable-stage-back-to-3d` | After the whole drawing-set round trip (plan → section → cuts → scrubs → isolation → reveal), back in 3D: the engine stage never unmounted, the GL pixels still alive (the stable-stage doctrine). | AC-3, AC-8, AC-16 |

### Journey-run corroboration (not duplicated here)

The same states were shot by the COMMITTED j14–j17 journeys at the battery
canvas at `c929bbc` (gitignored run artifacts, 18 files):
`apps/web/e2e-results/world-journeys/j14-arrival-{three,babylon,back-to-three}.png`,
`j15-{inspect-door,annotate,navigate}.png`,
`j16-{plan,section,phase-structure,phase-finishes,isolate-mep,back-to-3d}.png`,
`j17-{agent-follow,boq,findings,variant-alt-a,variant-alt-b,variant-current}.png`.
The committed evidence set is the fresh class set above (both canvases);
the journey shots corroborate the identical states from the battery run.

### What could NOT be captured here (and where it IS evidenced)

- Camera MOTION (orbit/pan/zoom): frame 08 is the end state; the motion is
  proven live by the j15 journey assertions (HUD deltas + the zoom journal)
  at every battery run.
- The Babylon.js surface in the DEFAULT state: the fixture prefers
  Three.js; Babylon is the switch target (frame 02 + the j14 switch
  assertions).
- GPU-grade rendering: software GL only (note 1) — real browser WebGL,
  honestly recorded.
- The degradation paths (no-GL / reference fallback): NOT part of this
  class set — they are the j12/j13 battery's own legs (two honest
  project-self-skips in the default chromium project: the `chromium-no-gl`
  forced-degradation legs, which run only in their dedicated Playwright
  project; and the Blender-live leg, env-gated on the operator-supplied
  official binary per the W064/W068 method).

## Reproduction

```bash
cd /home/z/workspace/epoch
npx pnpm@10.34.5 --filter web build      # production build (next start serves it)
cd apps/web
npx playwright test                       # the j01–j17 battery at :3210
# the evidence frames were captured by the TEMP zevidence spec (deleted
# after the run, per the probe convention): the j14–j17 composition driven
# once per canvas — 1680x1000 + 1280x720 full class set, 1440x900 +
# 1920x1080 default-state dominance — emitting dominance-measurements.json
# (DOM rects) alongside the PNGs; pixel-forensics.json holds the PNG-side
# card-edge verification of the four dominance frames.
```
