/**
 * Presentational component: one published listing version card (immutable,
 * content-addressed). Pure function of the view model.
 */
import type { ListingVersionViewModel } from '../contracts';

export function ListingVersionCard({ version }: { readonly version: ListingVersionViewModel }) {
  return (
    <article aria-label={`Listing version ${version.listingId} ${version.version}`}>
      <h3>
        {version.displayName} <span aria-hidden="true">·</span> {version.version}
      </h3>
      <dl>
        <div>
          <dt>Published</dt>
          <dd>
            <time dateTime={version.publishedAt}>{version.publishedAt}</time>
          </dd>
        </div>
        <div>
          <dt>Content digest</dt>
          <dd>
            <code>{version.contentDigest}</code>
          </dd>
        </div>
        <div>
          <dt>Capability references</dt>
          <dd>{version.capabilityCount}</dd>
        </div>
        <div>
          <dt>Trust evidence records</dt>
          <dd>{version.trustEvidenceCount}</dd>
        </div>
        <div>
          <dt>Visibility</dt>
          <dd>{version.visibility}</dd>
        </div>
      </dl>
    </article>
  );
}
