/**
 * @epoch/web shell route surfaces (W014).
 *
 * The content the shell's routes render inside the frame's content region:
 * the home surface (shell overview + empty mounted surfaces) and the
 * navigator stage surfaces (one per lifecycle stage — the Solution
 * Navigator skeleton, with every mounted surface EMPTY: W013 renderer
 * wiring and W016 interactive UX fill them in later waves).
 *
 * These are server components over typed shell data — the shell adds no
 * domain semantics: stage titles/positions come from the route registry
 * and the navigator vocabulary, never from a domain model.
 */
import type { ReactNode } from 'react';
import { Panel, PanelTitle } from '../shared/components';
import { SHELL_SPACING } from '../shared/tokens';
import type { ReferenceShell } from './bootstrap';
import { ExperienceSurfaces, FeatureMountsRegion } from './frame';
import { STAGE_TITLES } from './routes';
import type { NavigatorStage } from './version';

/** Page metadata of the home route. */
export function homeMetadata(): { readonly title: string } {
  return { title: 'Epoch — Solution Navigator' };
}

/** The home route surface: shell overview + the empty mounted surfaces. */
export function HomeRouteSurface({ shell }: { readonly shell: ReferenceShell }): ReactNode {
  const stageRoutes = shell.routes.listRoutes().filter((route) => route.stage !== undefined);
  return (
    <div data-route-surface="route:home" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}>
      <Panel title="Epoch Solution Navigator">
        <p style={{ marginTop: 0 }}>
          The universal engineering lifecycle — Understand, Decide, Plan, Acquire, Realize,
          Observe/Actualize, Verify, Forecast, Close, Learn — as one synchronized projection.
          The shell hosts projections; the world model stays the single authority.
        </p>
        <ul style={{ margin: 0, paddingLeft: `${SHELL_SPACING.xl}px` }}>
          {stageRoutes.map((route) => (
            <li key={route.routeId} data-stage-link={route.stage}>
              <a href={route.path}>{route.title}</a>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Experience surfaces">
        <ExperienceSurfaces mounts={shell.mounts} />
      </Panel>
      <Panel title="Feature mounts">
        <FeatureMountsRegion mounts={shell.mounts} features={shell.features} mountId="mount:content" />
      </Panel>
    </div>
  );
}

/** Page metadata of one navigator stage route. */
export function stageMetadata(stage: NavigatorStage): { readonly title: string } {
  return { title: `${STAGE_TITLES[stage]} — Epoch` };
}

/** The navigator stage route surface: stage header + empty mounted surfaces. */
export function NavigatorStageRoute({
  shell,
  stage,
}: {
  readonly shell: ReferenceShell;
  readonly stage: NavigatorStage;
}): ReactNode {
  const route = shell.routes.resolveStage(stage);
  if (!route.ok) {
    return (
      <Panel title="Unavailable stage">
        <p style={{ marginTop: 0 }}>
          The navigator stage &apos;{stage}&apos; is not wired in this shell.
        </p>
      </Panel>
    );
  }
  const stageIndex = shell.routes
    .listRoutes()
    .filter((candidate) => candidate.stage !== undefined)
    .findIndex((candidate) => candidate.stage === stage);
  const stageCount = shell.routes.listRoutes().filter((candidate) => candidate.stage !== undefined)
    .length;
  return (
    <div
      data-route-surface={route.value.routeId}
      data-stage={stage}
      style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}
    >
      <Panel>
        <PanelTitle>{`Stage ${stageIndex + 1} of ${stageCount}`}</PanelTitle>
        <h1
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 600,
          }}
        >
          {route.value.title}
        </h1>
        <p style={{ marginBottom: 0 }}>
          {STAGE_TITLES[stage]} — a synchronized projection of the universal lifecycle. This
          surface is mounted by the shell and filled by later waves.
        </p>
      </Panel>
      <Panel title="Experience surfaces">
        <ExperienceSurfaces mounts={shell.mounts} />
      </Panel>
      <Panel title="Feature mounts">
        <FeatureMountsRegion mounts={shell.mounts} features={shell.features} mountId="mount:content" />
      </Panel>
    </div>
  );
}
