/**
 * Presentational component: one entitlement status description list. Pure
 * function of the view model.
 */
import type { EntitlementStatusViewModel } from '../contracts';

export function EntitlementStatusView({
  entitlement,
}: {
  readonly entitlement: EntitlementStatusViewModel;
}) {
  return (
    <section aria-label={`Entitlement ${entitlement.entitlementId}`}>
      <p>
        <strong>Entitled</strong> to <code>{entitlement.listingId}</code> — {entitlement.scopeLabel}
        {entitlement.seatsLabel === null ? '' : ` (${entitlement.seatsLabel})`}
      </p>
      <dl>
        <div>
          <dt>Entitlement</dt>
          <dd>
            <code>{entitlement.entitlementId}</code>
          </dd>
        </div>
        <div>
          <dt>Tenant</dt>
          <dd>{entitlement.tenantId}</dd>
        </div>
        <div>
          <dt>Granted</dt>
          <dd>
            <time dateTime={entitlement.grantedAt}>{entitlement.grantedAt}</time> by{' '}
            {entitlement.grantedBy}
          </dd>
        </div>
        <div>
          <dt>Provenance</dt>
          <dd>{entitlement.provenanceLabel}</dd>
        </div>
        {entitlement.revokedRelatedCount > 0 ? (
          <div>
            <dt>Superseded grants</dt>
            <dd>{entitlement.revokedRelatedCount} revoked</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
