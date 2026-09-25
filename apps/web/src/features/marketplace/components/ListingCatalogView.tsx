/**
 * Presentational component: the marketplace catalog table. Pure function
 * of the view models (already sorted deterministically by the projector).
 */
import type { ListingSummaryViewModel } from '../contracts';

const COLUMNS = ['Listing', 'Developer', 'State', 'Visibility', 'Versions', 'Head'] as const;

export function ListingCatalogView({
  listings,
  emptyLabel = 'No listings visible to this tenant.',
}: {
  readonly listings: readonly ListingSummaryViewModel[];
  readonly emptyLabel?: string;
}) {
  if (listings.length === 0) {
    return <p role="status">{emptyLabel}</p>;
  }
  return (
    <table>
      <caption>Marketplace catalog</caption>
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
            <td>{listing.developerTenantId}</td>
            <td>{listing.lifecycle}</td>
            <td>{listing.visibility}</td>
            <td>{listing.publishedVersionCount}</td>
            <td>
              {listing.headVersion === null
                ? '—'
                : `${listing.headVersion}${
                    listing.pricingHeadline === null ? '' : ` (${listing.pricingHeadline})`
                  }`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
