/**
 * Presentational component: the portal event feed (the lifecycle audit
 * trail, one row per sealed event). Pure function of the view models.
 */
import type { PortalEventRowViewModel } from '../contracts';

export function PortalEventFeedView({
  rows,
  emptyLabel = 'No portal events on this stream yet.',
}: {
  readonly rows: readonly PortalEventRowViewModel[];
  readonly emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p role="status">{emptyLabel}</p>;
  }
  return (
    <ol reversed start={rows[rows.length - 1]!.sequence}>
      {rows.map((row) => (
        <li key={row.sequence} value={row.sequence}>
          <time dateTime={row.occurredAt}>{row.occurredAt}</time> — {row.discriminatorLabel} by{' '}
          {row.actor}
        </li>
      ))}
    </ol>
  );
}
