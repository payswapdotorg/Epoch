/**
 * Presentational component: the developer's entitlement adoption table
 * (who has the developer's listings, active or revoked). Pure function of
 * the view models.
 */
import type { EntitlementAdoptionViewModel } from '../contracts';

const COLUMNS = ['Entitlement', 'Listing', 'Acquiring tenant', 'Scope', 'Seats', 'Granted', 'Status'] as const;

export function EntitlementAdoptionsView({
  adoptions,
  emptyLabel = 'No entitlements adopted for this developer tenant yet.',
}: {
  readonly adoptions: readonly EntitlementAdoptionViewModel[];
  readonly emptyLabel?: string;
}) {
  if (adoptions.length === 0) {
    return <p role="status">{emptyLabel}</p>;
  }
  return (
    <table>
      <caption>Entitlement adoptions</caption>
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
        {adoptions.map((adoption) => (
          <tr key={adoption.entitlementId}>
            <th scope="row">{adoption.entitlementId}</th>
            <td>{adoption.listingId}</td>
            <td>{adoption.acquiringTenantId}</td>
            <td>{adoption.scopeLabel}</td>
            <td>{adoption.seatsLabel === null ? '—' : adoption.seatsLabel}</td>
            <td>
              <time dateTime={adoption.grantedAt}>{adoption.grantedAt}</time>
            </td>
            <td>{adoption.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
