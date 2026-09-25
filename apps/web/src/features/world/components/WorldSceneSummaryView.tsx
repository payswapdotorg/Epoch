/**
 * Presentational component: the interactive world scene overview
 * (identity, scope, revision digest, aspect counts). Pure function of
 * the view model.
 */
import type { WorldSceneOverviewViewModel } from '../contracts';

export function WorldSceneSummaryView({ overview }: { readonly overview: WorldSceneOverviewViewModel }) {
  return (
    <article aria-label={`World scene ${overview.sceneName}`}>
      <h3>{overview.sceneName}</h3>
      <dl>
        <div>
          <dt>Scene</dt>
          <dd>
            <code>{overview.sceneId}</code>
          </dd>
        </div>
        <div>
          <dt>Scope</dt>
          <dd>{overview.scopeLabel}</dd>
        </div>
        <div>
          <dt>Revision digest</dt>
          <dd>
            <code>{overview.digestLabel}</code>
          </dd>
        </div>
        <div>
          <dt>Entities</dt>
          <dd>
            {overview.entityCount} ({overview.focusedCount} focused)
          </dd>
        </div>
        <div>
          <dt>Applied overlays</dt>
          <dd>{overview.appliedOverlayCount}</dd>
        </div>
        <div>
          <dt>Narrative blocks</dt>
          <dd>{overview.narrativeBlockCount}</dd>
        </div>
        <div>
          <dt>Presence</dt>
          <dd>
            {overview.participantCount} participants · {overview.agentCount} agents
          </dd>
        </div>
        <div>
          <dt>Candidate controls</dt>
          <dd>{overview.controlCount}</dd>
        </div>
      </dl>
    </article>
  );
}
