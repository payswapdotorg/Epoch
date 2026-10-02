// THE W057 WEB-DRIVER PARITY PIN — the seam contract between the web
// feature (apps/web/src/features/world — frozen-manifest, cannot import
// the workspace packages) and the REAL @epoch/world-runtime:
//
// 1. TYPE-LEVEL: the REAL WorldWorkspaceRuntime satisfies the web
//    feature's WorldWorkspaceDriver structural mirror, and the REAL
//    workspace view models are the web feature's view-model records —
//    pinned by pure assignment checks (drift fails THIS file's
//    typecheck, which packages/world-runtime's typecheck script runs).
// 2. RUNTIME: the web WorldWorkspace component renders the REAL
//    runtime's spatial world (react-dom/server over the real driver) and
//    re-renders after real interactions — the same acceptance lens as
//    the feature's own tests, but against the REAL engine.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WorldWorkspace } from '../../apps/web/src/features/world/components/WorldWorkspace';
import type {
  DriverResult,
  SwitchSummaryInput,
  ViewportInputOutcomeInput,
  WorldWorkspaceDriver,
  WorkspaceViewModelInput,
} from '../../apps/web/src/features/world/workspace-contracts';
import type { WorldWorkspaceRuntime } from '../../packages/world-runtime/src/workspace';
import type { WorkspaceViewModel } from '../../packages/world-runtime/src/view-models';
import {
  ENTITY_IDS,
  FULL_RENDERER_ID,
  HIDDEN_ENTITY_ID,
  REDUCED_RENDERER_ID,
  openWorkspace,
  pointerXOf,
} from './world-fixture';

// ---------------------------------------------------------------------------
// 1. The type-level parity pins (compile-time; see the harness tsconfig).
// ---------------------------------------------------------------------------

/** The REAL runtime IS a web workspace driver (structural, no adapter). */
const runtimeIsDriver: WorldWorkspaceDriver = null as unknown as WorldWorkspaceRuntime;

/** The REAL view model IS the web view model. */
const viewModelParity: WorkspaceViewModelInput = null as unknown as WorkspaceViewModel;

/** A REAL runtime result IS a web driver result (receipt + switch shapes). */
const pointerOutcomeParity: DriverResult<ViewportInputOutcomeInput> =
  null as unknown as Awaited<ReturnType<WorldWorkspaceRuntime['dispatchPointerDown']>>;
const switchParity: DriverResult<SwitchSummaryInput> =
  null as unknown as Awaited<ReturnType<WorldWorkspaceRuntime['selectRenderer']>>;

// The pins are compile-time only; reference them so runtime lint keeps them.
void runtimeIsDriver;
void viewModelParity;
void pointerOutcomeParity;
void switchParity;

// ---------------------------------------------------------------------------
// 2. The runtime render battery (the REAL driver behind the REAL component).
// ---------------------------------------------------------------------------

describe('the web workspace component renders the REAL runtime (driver parity)', () => {
  it('the primary spatial surface renders the canonical fixture world', async () => {
    const { runtime } = await openWorkspace();
    try {
      const html = renderToStaticMarkup(
        createElement(WorldWorkspace, { driver: runtime }),
      );
      // The canonical identity of the presented revision.
      expect(html).toContain('data-workspace="world"');
      expect(html).toContain('data-world-digest=');
      expect(html).toContain('Riverside plant-room riser coordination');
      // The SPATIAL projection: every canonical entity glyph, the focused
      // riser ring, the hidden duct ghost.
      for (const entityId of Object.values(ENTITY_IDS)) {
        expect(html).toContain(`data-viewport-entity="${entityId}"`);
      }
      expect(html).toContain('data-entity-state="focused"');
      expect(html).toContain('data-entity-state="hidden"');
      expect(html).toContain('Chilled-water riser');
      // The applied state overlay + the declared (unapplied) measurement.
      expect(html).toContain('data-viewport-overlay="ovl-state-slab-pour"');
      // Both agents present; both renderers selectable; healthy session.
      expect(html).toContain('data-presence-agent="agent:riverside-surveyor"');
      expect(html).toContain('data-presence-agent="agent:riverside-coordinator"');
      expect(html).toContain(`data-renderer-choice="${REDUCED_RENDERER_ID}"`);
      expect(html).toContain('data-health="healthy"');
      // The timeline surface carries the branch-point marker.
      expect(html).toContain('data-marker-kind="branch-point"');
      // The inspect panel shows the focused canonical entity.
      expect(html).toContain(`data-inspect="entityId"`);
      expect(html).toContain(ENTITY_IDS.riser);
    } finally {
      await runtime.close();
    }
  });

  it('real interactions re-render the spatial world through the same component', async () => {
    const { runtime } = await openWorkspace();
    try {
      // Pick the panel through the fabric seam (semantic picking).
      const picked = await runtime.dispatchPointerDown({
        x: pointerXOf(ENTITY_IDS.panel),
        y: 0.5,
      });
      expect(picked.ok).toBe(true);
      // Orbit the presentation camera.
      runtime.applyGesture({ kind: 'orbit', deltaX: 0.5, deltaY: 0.1 });
      // Isolate the MEP layer — the hidden legacy duct returns to the world.
      const isolated = await runtime.isolateLayer('lyr-mep');
      expect(isolated.ok && isolated.value).toBe(true);
      // Annotate the focused entity.
      const annotated = await runtime.composeAnnotation('Clash: reroute riser');
      expect(annotated.ok && annotated.value).toBe(true);

      const html = renderToStaticMarkup(
        createElement(WorldWorkspace, { driver: runtime }),
      );
      // The pick focused the panel (the focus state moved spatially).
      expect(html).toContain(`data-viewport-entity="${ENTITY_IDS.panel}"`);
      // The hidden duct is now a VISIBLE glyph of the isolated layer.
      expect(html).toContain(`data-viewport-entity="${HIDDEN_ENTITY_ID}"`);
      // The annotation overlay renders on the world.
      expect(html).toContain('data-overlay-kind="annotation"');
      expect(html).toContain('Clash: reroute riser');
      // The intent journal shows the typed intents of this session.
      expect(html).toContain('epoch.world.interaction.filter');
      expect(html).toContain('epoch.world.interaction.annotate');
    } finally {
      await runtime.close();
    }
  });

  it('a real renderer switch re-renders the Epoch-owned selector + evidence', async () => {
    const { runtime } = await openWorkspace();
    try {
      const switched = await runtime.selectRenderer(REDUCED_RENDERER_ID);
      expect(switched.ok).toBe(true);
      const html = renderToStaticMarkup(
        createElement(WorldWorkspace, { driver: runtime }),
      );
      // The selector marks the reduced renderer active (the choice button
      // renders its id then the active flag).
      expect(html).toContain(
        `data-renderer-choice="${REDUCED_RENDERER_ID}" data-renderer-active="true"`,
      );
      expect(html).toContain(
        `data-renderer-choice="${FULL_RENDERER_ID}" data-renderer-active="false"`,
      );
      // The switch receipt evidence renders (continuity).
      expect(html).toContain('Last switch receipt');
      // The world itself is unchanged: the same canonical entities.
      expect(html).toContain(`data-viewport-entity="${ENTITY_IDS.slab}"`);
    } finally {
      await runtime.close();
    }
  });
});
