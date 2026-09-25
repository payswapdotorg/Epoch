/**
 * Presentational component: the developer revenue ledger table. Pure
 * function of the view models (already sorted deterministically).
 */
import type { RevenueEntryViewModel } from '../contracts';

const COLUMNS = ['Recorded', 'Acquiring tenant', 'Listing', 'Basis', 'Amount', 'Provenance'] as const;

export function RevenueLedgerView({
  entries,
  emptyLabel = 'No revenue records for this developer tenant.',
}: {
  readonly entries: readonly RevenueEntryViewModel[];
  readonly emptyLabel?: string;
}) {
  if (entries.length === 0) {
    return <p role="status">{emptyLabel}</p>;
  }
  return (
    <table>
      <caption>Developer revenue ledger (record-keeping only)</caption>
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
            <th scope="row">
              <time dateTime={entry.recordedAt}>{entry.recordedAt}</time>
            </th>
            <td>{entry.acquiringTenantId}</td>
            <td>
              <code>{entry.listingId}</code>
            </td>
            <td>{entry.basis}</td>
            <td>{entry.amountLabel}</td>
            <td>{entry.provenanceLabel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
