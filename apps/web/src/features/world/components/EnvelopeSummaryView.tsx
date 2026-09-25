/**
 * Presentational component: the renderer invocation envelopes the world
 * view compiles (mount graphs, frame advances, intent submissions) —
 * pure typed data summaries, never a concrete renderer. Pure function of
 * the view models.
 */
import type { EnvelopeSummaryViewModel, MountSummaryViewModel } from '../contracts';

export function MountEnvelopeSummaryView({
  summaries,
}: {
  readonly summaries: readonly MountSummaryViewModel[];
}) {
  if (summaries.length === 0) {
    return <p role="status">No mount envelopes.</p>;
  }
  return (
    <ul aria-label="Mount envelopes">
      {summaries.map((summary) => (
        <li key={summary.invocationId}>
          <code>{summary.graphKindLabel}</code> graph — digest <code>{summary.digestLabel}</code> ·{' '}
          {summary.declaredUsageLabel}
        </li>
      ))}
    </ul>
  );
}

export function EnvelopeSummaryView({
  summary,
}: {
  readonly summary: EnvelopeSummaryViewModel;
}) {
  return (
    <p>
      <code>{summary.kindLabel}</code> — {summary.detailLabel}
    </p>
  );
}
