# apps/web/src/features/world — Interactive World feature module (W016)

A TYPED feature library inside the existing Next.js app: view-model
contracts + pure deterministic projections + presentational components
for the interactive world view (the Interactive World UX). It consumes
ONLY the `@epoch/world-experience` public surface — structurally.

## Why this module stands alone (the frozen-manifest constraint)

W016's owned surface is `apps/web/src/features/world/*` ONLY.
`apps/web/package.json` (and every other app file) belongs to W014's
surface and is frozen to this Work Order, so the module CANNOT declare
`@epoch/world-experience` as a dependency and cannot import it. The
record-facing input types in `contracts.ts` are therefore STRUCTURAL
MIRRORS of the exact world-experience public-surface subset the feature
consumes:

| Feature input (`contracts.ts`)     | Package type (`@epoch/world-experience`) |
| ---------------------------------- | ---------------------------------------- |
| `WorldSceneInput`                  | `WorldScene` (sealed scene envelope)     |
| `SceneEntityInput`                 | `SceneEntity`                            |
| `VisualOverlayInput`               | `VisualOverlay`                          |
| `OverlayApplicationInput`          | `OverlayApplication`                     |
| `SceneTimelineInput`               | `SceneTimeline` (+ markers/position)     |
| `CameraStateInput`                 | `CameraState` (orbit/free/follow-agent)  |
| `NarrativeBlockInput`              | `NarrativeStatusBlock`                   |
| `SceneControlInput`                | `SceneControl`                           |
| `InteractionKindInput`             | `WorldInteractionKind` (the 22 kinds)    |
| `FidelityLevelInput`               | `WorldFidelityLevel`                     |
| `FidelityReductionInput`           | `FidelityReduction`                      |
| `MountEnvelopeInput`               | `WorldMountGraphEnvelope`                |
| `AdvanceEnvelopeInput`             | `WorldAdvanceFrameEnvelope`              |
| `SubmitIntentInput`                | `WorldSubmitIntentEnvelope`              |
| `WorldErrorInput`                  | `WorldExperienceError`                   |

TypeScript structural typing makes the package records assignable to
these interfaces as-is. The projection functions (`project.ts`) never
fabricate kernel semantics: they render exactly what the records carry
(scene identity, focus/visibility/isolation view state, overlay
application order, timeline/replay status, camera mode and follow
detail, narrative tones and evidence citation counts, envelope digests
and declared usage).

## Wiring contract for W014

When the app shell (W014) wires features, it should:

1. add `@epoch/world-experience` to the app manifest and route scene
   records / compilations / errors to this module through the app's data
   layer;
2. feed world-experience records straight into the projectors
   (`toSceneOverview`, `toEntityRows`, `toOverlayStack`,
   `toTimelineStatus`, `toCameraStatus`, `toNarrativeFeed`,
   `toInteractionCatalog`, `toFidelityProfile`, `toMountSummary`,
   `toAdvanceSummary`, `toSubmitIntentSummary`, `toErrorNotice`);
3. render the returned view models with the presentational components in
   `components/`;
4. pin the structural compatibility (this module ↔ the
   world-experience surface) with a parity test once the app workspace
   gains a test harness — the mirrors live in one file (`contracts.ts`)
   precisely so that pin is cheap.

No route changes, no app-shell changes, no global provider changes were
made by this module. No imports from or references to the marketplace
(W023) or agents (W015) feature modules.

## W057 → W072 — the interactive world WORKSPACE → the CONSTRUCTION SOLUTION EXPLORER

W057 turned this module into the interactive world WORKSPACE; W072
(ACR-012) evolves it into the CONSTRUCTION SOLUTION EXPLORER — the
spatially dominated engineering workspace of `/world` (the world viewport
occupies 60–75% of the main surface) over the frozen W071
`@epoch/construction-world-fixture` (Pioneer Block-A):

- `workspace-contracts.ts` — the WORKSPACE DRIVER + view-model contracts:
  structural mirrors of the exact `@epoch/world-runtime` public surface
  (`WorldWorkspaceRuntime` satisfies `WorldWorkspaceDriver` as-is; pinned
  by qa/world-experience). The module still imports no workspace package
  (the frozen-manifest constraint above still binds — the fixture package
  is a W072-declared manifest addition).
- `workspace-handlers.ts` — the pure event→command wiring
  (`createWorkspaceHandlers`): pointer/wheel input forwards into the
  driver's fabric seam (semantic picking), drags/keys drive the
  presentation-only navigation, and every panel action issues the
  driver's typed-intent command. `normalizePointer` maps viewport pixels
  into the normalized [0,1] pointer space.
- `construction-solution.ts` — the pure, React-free projection of the
  FROZEN W071 fixture: the presented world under one solution variant
  (fixture deltas applied — never a second ledger), the true top-down
  PLAN projector, the SECTION cutaway projector + the live cut state, the
  agent movement interpolation, the BOQ/cost + constraints/findings
  projections, and the bidirectional BOQ ↔ world CROSS-SELECTION model.
- `construction-tokens.ts` — the warm-neutral design-language tokens
  (palette, layer colors, compact type scale) of the construction
  workspace.
- `components/WorldWorkspace.tsx` — the construction workspace shell: the
  compact solution/context bar (top), the LEFT construction navigator, the
  PRIMARY world viewport (three presentations of the same world: 3D /
  plan / section), the RIGHT engineering inspector + BOQ/cost +
  constraints + variants — with the view controls, live metrics, the
  programme timeline scrubber and the tool/measure state as floating
  HUDs OVER the world canvas.
- `components/ConstructionTopBar.tsx` / `ConstructionNavigator.tsx` /
  `ConstructionViewport.tsx` / `ConstructionInspector.tsx` — the four
  construction chrome surfaces (pure components over the driver's view
  model + the construction projection; every interaction routes through
  the EXISTING typed Epoch interaction path — no renderer-local semantic
  authority).
- `components/WorldWorkspacePanels.tsx` — the long-lived secondary
  evidence panels (the typed-intent journal + the W067 foundation-asset
  surface) composed into the rails.
- `workspace.test.tsx` + `construction-solution.test.tsx` — the feature
  battery: primary-surface structure, canonical-data rendering, the full
  handler→driver command wiring, and the construction projection + panel
  wiring (selection, cross-highlight, variants, timeline phases).
- `host/world-fixture.ts` — the CONSTRUCTION FIXTURE SEAM: every value
  re-exported from the frozen W071 package (the W061 host/battery import
  surface kept stable while the values became the construction
  fixture's).
- `host/world-host.tsx` — the REAL composition: `WorldWorkspaceRuntime`
  over the REAL fabric (Three.js + Babylon.js + the reference fallback)
  with the honest typed-pick helper for host-surface selections.

### Wiring contract (W057 → W072)

The desktop host binds the REAL runtime directly (`apps/desktop`,
`@epoch/world-runtime` + `@epoch/renderer-fabric` behind its world
section — the SAME construction fixture, W073). The web `/world` route
binds it through `host/world-host.tsx` (W061 → W072):

```tsx
const driver = new WorldWorkspaceRuntime({
  slug, fabric, scene, ontology, device,
  clock: new SystemHostClock(),
  scheduler: new TimeoutFrameScheduler(),
  rendererPreference: ['rr-...', 'rr-...'],
});
await driver.open();
driver.startHostLoop();
render(<WorldWorkspace driver={driver} />);
```

The shell's world route/mount (src/shell, W057's limited surface) carries
the typed route + feature descriptors; the app-owner wave adds the App
Router page that renders this component (one thin segment).
