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

## W057 — the interactive world WORKSPACE (the primary surface)

W057 extends this module from a projection library into the interactive
world WORKSPACE — the game-like engineering surface where the spatial
world is the PRIMARY problem-solving view:

- `workspace-contracts.ts` — the WORKSPACE DRIVER + view-model contracts:
  structural mirrors of the exact `@epoch/world-runtime` public surface
  (`WorldWorkspaceRuntime` satisfies `WorldWorkspaceDriver` as-is; pinned
  by qa/world-experience). The module still imports no workspace package
  (the frozen-manifest constraint above still binds).
- `workspace-handlers.ts` — the pure event→command wiring
  (`createWorkspaceHandlers`): pointer/wheel input forwards into the
  driver's fabric seam (semantic picking), drags/keys drive the
  presentation-only navigation, and every panel action issues the
  driver's typed-intent command. `normalizePointer` maps viewport pixels
  into the normalized [0,1] pointer space.
- `components/WorldWorkspace.tsx` — the workspace shell: the central
  VIEWPORT is the primary region (top-left, largest), with the tool rail,
  inspect, layers, presence, renderer selector, controls
  (branch/simulate/annotation composer), timeline, and intent journal as
  SECONDARY context surfaces.
- `components/WorldViewport.tsx` — the renderer-agnostic viewport: a
  structured spatial projection (SVG) of the canonical scene entities the
  active presenter presents (the contract-only reference presenter by
  default; W058/W059 real engines mount behind the same seam). Focus
  rings, isolation frames, hidden ghosts, measurement lines, annotation
  pins, agent presence chips, the navigation HUD, and the renderer
  health/fallback banner all render from the view model — never from
  renderer internals.
- `components/WorldWorkspacePanels.tsx` — the secondary panels (pure).
- `workspace.test.tsx` — the feature battery: primary-surface structure,
  canonical-data rendering, and the full handler→driver command wiring.

### Wiring contract (W057)

The desktop host binds the REAL runtime directly (`apps/desktop`,
`@epoch/world-runtime` + `@epoch/renderer-fabric` behind its world
section). The WEB app binds it when its manifest unfreezes:

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
