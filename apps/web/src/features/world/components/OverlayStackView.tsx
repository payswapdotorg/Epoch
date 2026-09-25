/**
 * Presentational component: the applied-overlay stack in deterministic
 * application order. Pure function of the view models.
 */
import type { OverlayStackEntryViewModel } from '../contracts';

export function OverlayStackView({ entries }: { readonly entries: readonly OverlayStackEntryViewModel[] }) {
  if (entries.length === 0) {
    return <p role="status">No overlays applied.</p>;
  }
  return (
    <ol aria-label="Applied overlays (application order)">
      {entries.map((entry) => (
        <li key={entry.overlayId} value={entry.orderIndex + 1}>
          <code>{entry.overlayId}</code> <span>({entry.overlayKind})</span> — {entry.targetLabel}
        </li>
      ))}
    </ol>
  );
}
