/**
 * Presentational component: the timeline/replay status (position, frame,
 * pause state, markers). Pure function of the view model.
 */
import type { TimelineStatusViewModel } from '../contracts';

export function TimelineStatusView({ timeline }: { readonly timeline: TimelineStatusViewModel }) {
  return (
    <dl aria-label="Timeline status">
      <div>
        <dt>Track</dt>
        <dd>{timeline.trackLabel}</dd>
      </div>
      <div>
        <dt>Position</dt>
        <dd>
          {timeline.positionLabel} · {timeline.frameLabel} · {timeline.progressLabel}
        </dd>
      </div>
      <div>
        <dt>Playback</dt>
        <dd>{timeline.paused ? 'paused' : 'playing'}</dd>
      </div>
      <div>
        <dt>Markers</dt>
        <dd>
          {timeline.markerCount} total · {timeline.branchPointCount} branch points
        </dd>
      </div>
    </dl>
  );
}
