/**
 * Presentational component: a typed developer-portal error notice. Pure
 * function of the view model.
 */
import type { DeveloperPortalErrorViewModel } from '../contracts';

export function DeveloperPortalErrorNotice({ error }: { readonly error: DeveloperPortalErrorViewModel }) {
  return (
    <p role="alert">
      <strong>{error.code}</strong>: {error.message}
    </p>
  );
}
