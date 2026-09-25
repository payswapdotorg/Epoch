/**
 * Presentational component: the narrative/status feed (blocks with tone
 * and evidence citations). Pure function of the view models.
 */
import type { NarrativeFeedEntryViewModel } from '../contracts';

export function NarrativeFeedView({ entries }: { readonly entries: readonly NarrativeFeedEntryViewModel[] }) {
  if (entries.length === 0) {
    return <p role="status">No narrative blocks.</p>;
  }
  return (
    <ul aria-label="Narrative feed">
      {entries.map((entry) => (
        <li key={entry.blockId}>
          <strong>{entry.title}</strong> <span>({entry.tone})</span>
          {entry.hasBody ? <span> · full body</span> : <span> · headline</span>}
          {entry.evidenceCount > 0 ? <span> · {entry.evidenceCount} evidence citations</span> : null}
        </li>
      ))}
    </ul>
  );
}
