/**
 * Presentational component: the developer's listing table. Pure function
 * of the view models (already sorted deterministically by the projector).
 */
import type { DeveloperListingViewModel } from '../contracts';

const COLUMNS = ['Listing', 'State', 'Visibility', 'Versions', 'Head'] as const;

export function DeveloperListingsView({
  listings,
  emptyLabel = 'No listings authored by this developer tenant yet.',
}: {
  readonly listings: readonly DeveloperListingViewModel[];
  readonly emptyLabel?: string;
}) {
  if (listings.length === 0) {
    return <p role="status">{emptyLabel}</p>;
  }
  return (
    <table>
      <caption>Developer listings</caption>
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
        {listings.map((listing) => (
          <tr key={listing.listingId}>
            <th scope="row">{listing.displayName}</th>
            <td>{listing.lifecycle}</td>
            <td>{listing.visibility}</td>
            <td>{listing.publishedVersionCount}</td>
            <td>{listing.headVersion === null ? '—' : listing.headVersion}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
