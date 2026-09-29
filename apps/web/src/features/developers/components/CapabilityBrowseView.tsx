/**
 * Presentational component: the capability browse table (the W007
 * registry projection). Pure function of the view models.
 */
import type { CapabilityRowViewModel } from '../contracts';

const COLUMNS = ['Capability', 'Version', 'Category', 'Lifecycle', 'Descriptor'] as const;

export function CapabilityBrowseView({
  rows,
  emptyLabel = 'No registered capabilities match this browse.',
}: {
  readonly rows: readonly CapabilityRowViewModel[];
  readonly emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p role="status">{emptyLabel}</p>;
  }
  return (
    <table>
      <caption>Capability registry</caption>
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
        {rows.map((row) => (
          <tr key={`${row.capabilityId}@${row.version}`}>
            <th scope="row">{row.capabilityId}</th>
            <td>{row.version}</td>
            <td>{row.category}</td>
            <td>{row.lifecycle}</td>
            <td>{row.displayName}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
