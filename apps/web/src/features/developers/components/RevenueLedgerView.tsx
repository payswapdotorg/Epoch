/**
 * Presentational component: the developer's revenue ledger table. Pure
 * function of the view models.
 */
import type { RevenueEntryViewModel } from '../contracts';

const COLUMNS = ['Revenue record', 'Listing', 'Acquiring tenant', 'Basis', 'Amount', 'Recorded'] as const;

export function RevenueLedgerView({
  entries,
  emptyLabel = 'No developer revenue records adopted yet.',
}: {
  readonly entries: readonly RevenueEntryViewModel[];
  readonly emptyLabel?: string;
}) {
  if (entries.length === 0) {
    return <p role="status">{emptyLabel}</p>;
  }
  return (
    <table>
      <caption>Developer revenue ledger</caption>
      <thead>
        <tr>
          {COLUMNS.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.revenueId}>
            <th scope="row">{entry.revenueId}</th>
            <td>{entry.listingId}</td>
            <td>{entry.acquiringTenantId}</td>
            <td>{entry.basis}</td>
            <td>{entry.amountLabel}</td>
            <td>
              <time dateTime={entry.recordedAt}>{entry.recordedAt}</time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
