/**
 * Presentational component: the pricing model summary (headline + typed
 * lines). Pure function of the view model — no data fetching, no state.
 */
import type { PricingSummaryViewModel } from '../contracts';

export function PricingSummaryView({ summary }: { readonly summary: PricingSummaryViewModel }) {
  return (
    <section aria-label={`Pricing: ${summary.headline}`}>
      <p>
        <strong>{summary.headline}</strong>
      </p>
      {summary.lines.length > 0 ? (
        <dl>
          {summary.lines.map((line) => (
            <div key={line.label}>
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
