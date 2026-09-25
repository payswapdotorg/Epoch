/**
 * Presentational component: a typed marketplace error notice. Pure
 * function of the view model — errors are always rendered with their typed
 * code so failures stay diagnosable in the UI (never swallowed).
 */
import type { MarketplaceErrorViewModel } from '../contracts';

export function MarketplaceErrorNotice({ error }: { readonly error: MarketplaceErrorViewModel }) {
  return (
    <aside role="alert">
      <p>
        <strong>
          <code>{error.code}</code>
        </strong>
      </p>
      <p>{error.message}</p>
    </aside>
  );
}
