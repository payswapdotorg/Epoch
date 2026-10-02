'use client';
/**
 * THE WORLD WORKSPACE (W057) — the game-like engineering workspace shell:
 * the central 3D VIEWPORT is the PRIMARY problem-solving surface, with
 * the lifecycle/project context demoted to secondary panels around it.
 *
 * Composition:
 * - PRIMARY: the world viewport (the spatial projection of the canonical
 *   scene entities — the active presenter mounted behind it through the
 *   RendererFabric seam; renderer-agnostic by construction);
 * - SECONDARY: tool rail, layer panel, inspect panel, presence (agents),
 *   renderer bar (Epoch-owned selector + health/fallback), controls
 *   (branch/simulate/annotation composer), timeline bar, and the intent
 *   journal (typed-intent evidence + effects awaiting authority).
 *
 * The workspace is a CLIENT component driven by a
 * {@link WorldWorkspaceDriver} (the structural seam the REAL
 * @epoch/world-runtime WorldWorkspaceRuntime satisfies — pinned by
 * qa/world-experience): it renders the driver's view model and routes
 * every interaction through the driver's command surface (raw viewport
 * input → the fabric seam; workspace commands → existing typed Epoch
 * intents). The host owns the driver lifecycle (open/close/host loop).
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { WorldWorkspaceDriver, WorkspaceViewModelInput } from '../workspace-contracts';
import { createWorkspaceHandlers } from '../workspace-handlers';
import { WorldViewport } from './WorldViewport';
import {
  WorldControlsPanel,
  WorldInspectPanel,
  WorldIntentJournal,
  WorldLayerPanel,
  WorldPresencePanel,
  WorldRendererBar,
  WorldTimelineBar,
  WorldToolRail,
} from './WorldWorkspacePanels';

/** The workspace props: the driver + an optional view-model override. */
export interface WorldWorkspaceProps {
  readonly driver: WorldWorkspaceDriver;
  /** The current view model (defaults to the driver's own projection). */
  readonly viewModel?: WorkspaceViewModelInput | undefined;
}

/** The world workspace: the primary spatial surface + secondary panels. */
export function WorldWorkspace({ driver, viewModel }: WorldWorkspaceProps): ReactNode {
  const [view, setView] = useState<WorkspaceViewModelInput>(() => viewModel ?? driver.viewModel());
  const [annotationDraft, setAnnotationDraft] = useState('');

  // The refresh contract: the host re-renders by passing a fresh view
  // model prop; without one, the workspace re-projects on every command
  // completion through this local refresh.
  const refresh = useCallback((): void => {
    setView(driver.viewModel());
  }, [driver]);

  // Every command settles into a refresh (sync immediately, async on the
  // microtask) so the workspace re-projects after each interaction; the
  // host loop's view-model notifications refresh through the prop.
  const handlers = useMemo(
    () =>
      createWorkspaceHandlers(driver, () => {
        refresh();
      }),
    [driver, refresh],
  );
  const annotationHandlers = useMemo(
    () => ({
      ...handlers,
      onAnnotationSubmit: (text: string): void => {
        handlers.onAnnotationSubmit(text);
        setAnnotationDraft('');
      },
    }),
    [handlers],
  );

  const current = viewModel ?? view;

  return (
    <div
      data-workspace="world"
      data-world-digest={current.viewport.worldDigest}
      data-active-tool={current.viewport.activeTool}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 320px',
        gap: 12,
        alignItems: 'start',
      }}
    >
      {/* THE PRIMARY SURFACE: the spatial world viewport. */}
      <div data-workspace-primary="" style={{ display: 'grid', gap: 12 }}>
        <WorldViewport
          viewport={current.viewport}
          health={current.renderers.health}
          fallbackApplied={current.renderers.fallbackApplied}
          failure={current.renderers.lastFailure}
          handlers={handlers}
        />
        <WorldTimelineBar timeline={current.timeline} handlers={handlers} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
          <WorldControlsPanel
            controls={current.controls}
            handlers={annotationHandlers}
            annotationDraft={annotationDraft}
            onAnnotationDraftChange={setAnnotationDraft}
          />
          <WorldIntentJournal viewModel={current} />
        </div>
      </div>

      {/* SECONDARY CONTEXT SURFACES. */}
      <div data-workspace-secondary="" style={{ display: 'grid', gap: 12 }}>
        <WorldToolRail activeTool={current.viewport.activeTool} handlers={handlers} />
        <WorldInspectPanel inspect={current.inspect} />
        <WorldLayerPanel layers={current.layers} handlers={handlers} />
        <WorldPresencePanel
          agents={current.viewport.agents}
          followedAgentId={current.viewport.followedAgentId}
          handlers={handlers}
        />
        <WorldRendererBar renderers={current.renderers} handlers={handlers} />
      </div>
    </div>
  );
}
