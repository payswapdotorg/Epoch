/**
 * Presentational component: the metered-usage summary. Pure function of
 * the view model.
 */
import type { UsageSummaryViewModel } from '../contracts';

export function UsageSummaryView({ usage }: { readonly usage: UsageSummaryViewModel }) {
  return (
    <section aria-label={`Usage account ${usage.entitlementId}`}>
      <dl>
        <div>
          <dt>Entitlement</dt>
          <dd>
            <code>{usage.entitlementId}</code>
          </dd>
        </div>
        <div>
          <dt>Listing</dt>
          <dd>
            <code>{usage.listingId}</code>
          </dd>
        </div>
        <div>
          <dt>Metered events</dt>
          <dd>{usage.eventCount}</dd>
        </div>
        <div>
          <dt>Total units</dt>
          <dd>{usage.totalUnits}</dd>
        </div>
        <div>
          <dt>Metering window</dt>
          <dd>{usage.windowLabel === null ? '—' : usage.windowLabel}</dd>
        </div>
        <div>
          <dt>Stream</dt>
          <dd>
            <code>{usage.streamId}</code>
          </dd>
        </div>
      </dl>
    </section>
  );
}
