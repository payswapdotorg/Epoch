# Journey: The Interactive World Workspace (W057)

Platform: web (feature components + shell world route/mount) and desktop
(Tauri host, world section) — the workspaces driven by the
`@epoch/world-runtime` over the W056 `RendererFabric`.
Persona: an Epoch problem-solver (engineer/coordinator) working a real
fixture problem IN the spatial world.
Product version: ACR-007 / X2.0 (W057 — interactive world workspace).
Source commit: this branch (`work/W057-interactive-world-workspace`).
Environment: deterministic node test batteries (vitest) — no GPU, no
browser; the reference presenter is contract-only by design (W056).
Fixture: the Riverside plant-room riser coordination problem
(`qa/world-experience/world-fixture.ts`; the compact desktop slice at
`apps/desktop/app/components/world-host/world-fixture.ts`).

## The journey thesis (the work-order acceptance)

A user can enter a real fixture problem and **solve it through the
spatial world** — the viewport is the PRIMARY problem-solving surface
(the lifecycle/project panels are secondary context) — and **every
interaction produces an EXISTING typed Epoch intent**
(`epoch.world.interaction.*`, the W016 vocabulary), admitted and applied
through the canonical authorities. No table/status representation is
required to work the problem.

## Preconditions

- The canonical W016 world scene (the fixture problem) is admitted and
  sealed; the RendererFabric holds two registered reference renderers
  (full + reduced) behind the frozen W056 seam.
- The web shell registers the world route (`/world`) and the world
  feature mounts (scene + controls); the desktop product opens the
  world section as its DEFAULT surface.

## Steps

| # | User action | Expected | Observed | Result |
|---|---|---|---|---|
| 1 | Enter the fixture problem (open the workspace) | The canonical revision presents: 7 entities across 3 semantic layers, the world digest + tenant in the viewport banner, healthy session | `world-journey.test.ts` "opens the workspace…" — session active on the full renderer, digest = the sealed scene digest, layers derived, both renderers listed | PASS |
| 2 | Orbit / pan / zoom / desktop keys | The presentation camera moves; the canonical camera record is untouched; wheel zoom issues the typed `zoom` intent | "orbit/pan/zoom…" — azimuth/elevation/target change, `camera` equals the fixture record, journal carries `zoom:applied`; keys W/A/S/D/Q/E/R/F/+/- mapped | PASS |
| 3 | Pick an entity in the viewport | The pick resolves the CANONICAL semantic entity through the fabric seam (adapter hit-test → W016 admission → W013 receipt) | "picks the CANONICAL semantic entity…" — receipt names the entity + `epoch.world.interaction.select`, focus moves spatially | PASS |
| 4 | Inspect the picked entity | The canonical record (id/type/digest/position/visibility) shows in the inspect panel; an `inspect-requested` effect is surfaced for the world model — never executed by the UI | "inspects the picked entity…" — effect present, scene revision unchanged, panel shows canonical data | PASS |
| 5 | Isolate / reveal layers | ONLY a layer's entities stay visible (the typed `filter` intent); reveal restores the world (`show`) | "isolates and reveals…" — MEP isolation shows exactly the MEP entities, the HIDDEN legacy duct (the clash risk) returns to the world, journal carries `filter`/`show` | PASS |
| 6 | Measure (two picks) | The typed `measure` intent composes between the two picks; the declared measurement overlay applies in the world | "measures the riser run…" — `measure-requested` effect + the ruled overlay `ovl-measure-riser-run` renders between panel and riser | PASS |
| 7 | Annotate | The typed `annotate` intent adds the annotation overlay to the canonical revision | "annotates…" — the annotation pin renders on the focused entity; journal `annotate:applied` | PASS |
| 8 | See and follow an agent | Presence markers show the agents; follow issues the typed `follow-agent` intent (the canonical camera switches) | "sees and follows…" — both agents visible; camera mode `follow-agent`, marker marked following | PASS |
| 9 | Replay/seek the timeline | Scrub issues the typed `replay` intent; pause/resume toggle; branch-point marker presented; out-of-bounds scrub is a typed rejection | "scrubs, pauses, and resumes…" — position/paused state moves through intents; `invalid-replay-position` on 999999ms | PASS |
| 10 | Branch / simulate entry | The scene controls issue the typed `branch`/`simulate` intents and surface their request effects — the scene is NOT mutated | "enters branch and simulation…" — `branch-requested@5000` + `simulate-requested` effects; digest unchanged | PASS |
| 11 | Switch renderers (both ways) | The REAL fabric switching invariant: world digest carries, portable fields restore, undeclared fields are skipped (typed, listed) | "switches renderers…" — full→reduced→full with digest continuity, camera skipped on reduced / restored on full, switch receipt surfaced | PASS |
| 12 | Watch the world live (host loop) | The wall-clock host loop advances the presentation clock + frames while the canonical timeline moves ONLY through typed intents | "the wall-clock host loop…" — presentation clock advances, canonical position unchanged | PASS |
| 13 | Trust the architecture | The input scene is never mutated; every journal entry is an existing typed intent; effects await their authorities; sessions are ephemeral | "the architectural invariants…" — fixture object unchanged, all journal ids match `epoch.world.interaction.*`, effects all `*-requested` | PASS |

Web parity (the same journey through the REAL web component):
`web-driver-parity.test.ts` renders `WorldWorkspace` (apps/web) with the
REAL runtime driver — the spatial glyphs/focus/overlays/presence/
selector render from the canonical view model, re-render after real
interactions (pick/isolate/annotate) and after a real renderer switch.

Desktop parity (the same wiring in the Tauri host): the world section
(`apps/desktop/app/components/sections/world-section.tsx`) composes the
real runtime with `SystemHostClock` + `TimeoutFrameScheduler` (the
wall-clock host loop) over the full-fidelity desktop device descriptor;
`apps/desktop/test/world-host.test.ts` drives its interaction script.

## Defects

| Defect | Severity | Reproduction | Fix | Regression test | Status |
|---|---|---|---|---|---|
| Hiding the layer of the FOCUSED entity killed the renderer session (`invalid-fabric-record`: the portable view state forbids focus∩hidden while the canonical W016 projection permits it) | high (found by this journey's invariant battery) | pick an entity, then toggle its layer off | `portableViewStateOf` now carries the focus MINUS the hidden set (presented focus); canonical focus untouched | `workspace-runtime.test.ts` "hiding the layer of the FOCUSED entity keeps the session live" | FIXED |
| Mixed-width marker times (e.g. 5000 vs 12000) fail W016 scene admission — the marker ordering compares `${atMs}\0${markerId}` LEXICOGRAPHICALLY | low (fixture authoring trap; W016 surface, not fixable here) | build a scene with markers at 5000 and 12000 | fixture uses same-digit-width times; advisory filed for the TL | `world-fixture.ts` (TRACK note) | ADVISORY |
| The W050 release-identity checksums (X-06, `qa/cross-platform`) pinned the pre-W057 `apps/desktop/package.json`, so this work order's legitimate desktop dependency additions (`@epoch/world-runtime`, `@epoch/renderer-fabric`, `@epoch/world-experience`, `@epoch/capability-registry`) broke the three desktop-platform checksum recomputations | medium (cross-surface: `release/clients` is W050's surface; the trigger is W057's own) | `corepack pnpm --filter @epoch/web... run test` → X-06 "release identity" fails on `apps/desktop/package.json` sha256 | regenerated `release/clients/release-manifest.json` with W050's own deterministic generator (`generate-manifest.py <W057-commit>`) at the W057 commit — checksums, tree SHAs and sourceCommit re-stamped mechanically | X-06 re-run green ("the release/clients record set…" passes) | FIXED (flagged for TL review — unowned-surface touch) |

## Evidence

- Runtime battery: `packages/world-runtime` — 51 tests (mount, picking,
  layers, measurement/annotation, presence, timeline, controls,
  switching/fallback, host loop, invariants).
- Journey + parity batteries: `qa/world-experience` — 16 tests
  (13 journey + 3 web-driver parity) via
  `corepack pnpm --filter @epoch/world-runtime test`.
- Web feature battery: `apps/web/src/features/world/workspace.test.tsx`
  (9 tests) + the shell world route/mount tests (4 tests).
- Desktop wiring battery: `apps/desktop/test/world-host.test.ts`
  (3 tests) inside the 192-test desktop suite.

## What is test-proven vs. what awaits later waves (honest scope)

**Test-proven now (deterministic, no engines):** the complete workspace
loop — enter a real fixture problem, navigate (orbit/pan/zoom/keys),
semantic picking, inspect, layer isolation/reveal (including the hidden
clash-risk discovery), measurement (with the declared overlay),
annotation, agent presence/follow, timeline scrub/pause/resume,
branch/simulation entry, renderer switching with digest continuity and
typed fallback, the wall-clock host loop, and the architecture
invariants (no second semantic store, no direct durable mutation, typed
intents only) — all through the REAL fabric seam, the REAL W016
admission/reducer, and the REAL web/desktop presenters over the
contract-only reference adapter.

**Awaiting later waves (exactly their surfaces):**
- real GPU rendering — W058 (Three.js) and W059 (Babylon.js) adapters
  slot into the same fabric registry mount; the reference presenter
  draws no pixels;
- the external foundation path — W060 (Blender sidecar, interchange);
- browser/desktop E2E over real pixels and input — W061 (visual smoke,
  Playwright/wdio), including the Action-Gateway approval leg of the
  closure battery;
- the web App Router PAGE for `/world` — the app-owner surface
  (W014/W047 conventions; the shell route/mount + the feature component
  are the W057 surfaces, and the page is one thin segment that composes
  them — W061 closes it);
- lockfile registration of `@epoch/world-runtime` (+ the four
  `apps/desktop` dependency additions) — a serialized TL pass
  (the repo precedent: CI regenerates the lockfile per run, so CI is
  green; frozen installs on main need the registration). The W050
  release-identity manifest was re-stamped in this PR for the desktop
  definition-file change (see Defects);

## Rerun

Result: all listed batteries green on this branch (see the PR body for
the exact commands and pass counts).
Notes: rerun with
`corepack pnpm --filter @epoch/world-runtime test` (the qa harness rides
the runtime's vitest via the idempotent node_modules link script).
