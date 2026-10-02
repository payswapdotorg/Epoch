# qa/world-experience — the W057 interactive-world workspace harness

The acceptance battery of the interactive world workspace (Work Order
W057, ACR-007/X2.0): the proof that a user can **enter a real fixture
problem and solve it through the spatial world** — the viewport as the
PRIMARY problem-solving surface, the lifecycle/project panels as
secondary context — and that **every interaction produces an EXISTING
typed Epoch intent** (`epoch.world.interaction.*`, the W016 vocabulary).

## The fixture problem

`world-fixture.ts` — **the Riverside plant-room riser coordination
problem**: a REAL canonical W016 `WorldScene` (admitted + sealed through
the real W016 admission) with

- seven entities across three semantic layers (`site:structure`,
  `mep:*`, `delivery:zone`),
- one deliberately **hidden clash risk** (the legacy duct run the riser
  route crosses — findable only by isolating/revealing the MEP layer
  *in the world*),
- a declared measurement overlay (the panel-to-riser run), a state
  overlay, a highlight overlay,
- a delivery replay track with a **branch-point marker** at 12s,
- two agents (the surveyor to follow, the coordinator),
- candidate/action controls (branch / simulate / pause — the R30 scene
  controls),
- and TWO distinguishable contract-only reference renderers behind the
  REAL `RendererFabric` (full + reduced — the same seam W058/W059's
  Three.js/Babylon.js adapters occupy; zero engines).

## The batteries

- `world-journey.test.ts` — the acceptance journey over the REAL
  `@epoch/world-runtime` `WorldWorkspaceRuntime`: enter the problem,
  orbit/pan/zoom (+ desktop keys), semantic picking, inspect,
  layer isolate/reveal (finding the hidden clash risk), two-pick
  measurement (the declared overlay applies), annotation, agent
  follow, timeline scrub/pause/resume, branch/simulation entry,
  renderer switching both directions with world-digest continuity,
  the wall-clock host loop, and the architecture invariants (the input
  scene is never mutated; every journal entry is an existing typed
  intent; effects are surfaced, never executed).
- `web-driver-parity.test.ts` — the seam pin between the web feature
  and the runtime: (type-level) the REAL runtime satisfies the web
  feature's `WorldWorkspaceDriver` structural mirror and its view
  models are the web view-model records; (runtime) the web
  `WorldWorkspace` component renders the REAL driver's spatial world
  and re-renders after real interactions and a real renderer switch.
- `w016-marker-time-known-issue.test.ts` — the KNOWN-ISSUE record
  (W061, ledgered): the precise repro of the W016 mixed-width
  marker-time ordering defect against the REAL `admitWorldScene`
  surface. It deliberately PINS the current (defective) behavior so it
  is green while the defect stands; the W016 comparator fix (a future
  ACR on the `packages/world-experience` surface) flips it and forces
  the ledger update.

## Honest scope (what is test-proven here vs. what the later waves closed)

Proven here, deterministically, without engines: the full workspace
loop — mount, present, navigate, pick, inspect, isolate/reveal,
measure, annotate, follow, replay, branch/simulate entry, renderer
switch/fallback, digest continuity — through the REAL fabric seam and
the REAL W016 admission/reducer, rendered by the REAL web component.

Closed by the later waves (their surfaces): real engine rendering —
W058 (Three.js) and W059 (Babylon.js) adapters slotted into the same
fabric registry mount; the external foundation path — W060 (the
Blender sidecar + the glTF interchange bridge); browser E2E over real
pixels, the Action-Gateway approval legs, and the program closure —
W061 (the `j13-world` battery over real software GL; see
`docs/journeys/interactive-world.md` and `docs/rendering/closure.md`).

## Running

The harness rides `packages/world-runtime` (its vitest config includes
`../../qa/world-experience/*.test.ts`; the `link-world-harness.mjs`
globalSetup creates the node_modules symlink after a fresh install —
idempotent, gitignored, CI-safe):

```
corepack pnpm --filter @epoch/world-runtime test
```

The cold type-check path (`@epoch/world-runtime`'s `typecheck` script
runs this config; nothing depends on the symlink):

```
corepack pnpm --filter @epoch/world-runtime typecheck
```

## Advisory notes (filed to the TL)

- **W016 marker ordering is lexicographic**: the scene-timeline
  refinement compares `${atMs}\u0000${markerId}` as STRINGS, so marker
  times of mixed digit width (e.g. 5000 vs 12000) mis-sort and fail
  admission. The fixture uses same-digit-width marker times; the
  PRECISE REPRO (both symptoms: ascending refused + descending admitted
  with a wrong end bound) is `w016-marker-time-known-issue.test.ts`;
  the fix belongs to the W016 package surface (a future ACR — advisory
  only for W061).
- The journey battery found and pinned a real world-runtime defect
  (portable focus/hidden disjointness) — see the regression test in
  `packages/world-runtime/test/workspace-runtime.test.ts` and the
  defect table in `docs/journeys/interactive-world.md`.
