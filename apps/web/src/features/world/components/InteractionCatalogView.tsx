/**
 * Presentational component: the world-subset interaction catalog — every
 * universal interaction this view supports, with its typed ControlIntent
 * bridge id. Pure function of the view models.
 */
import type { InteractionCatalogEntryViewModel } from '../contracts';

export function InteractionCatalogView({
  entries,
}: {
  readonly entries: readonly InteractionCatalogEntryViewModel[];
}) {
  return (
    <ul aria-label="World interactions">
      {entries.map((entry) => (
        <li key={entry.kind}>
          <code>{entry.kind}</code> → <code>{entry.intentId}</code>
        </li>
      ))}
    </ul>
  );
}
