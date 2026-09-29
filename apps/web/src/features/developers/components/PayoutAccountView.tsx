/**
 * Presentational component: the developer's adopted payout account card
 * (where marketplace revenue settles). Pure function of the view model.
 */
import type { PayoutAccountViewModel } from '../contracts';

export function PayoutAccountView({
  account,
  emptyLabel = 'No payout account adopted yet.',
}: {
  readonly account: PayoutAccountViewModel | null;
  readonly emptyLabel?: string;
}) {
  if (account === null) {
    return <p role="status">{emptyLabel}</p>;
  }
  return (
    <article aria-label={`Payout account ${account.accountId}`}>
      <h3>{account.displayName}</h3>
      <dl>
        <div>
          <dt>Account</dt>
          <dd>
            <code>{account.accountId}</code>
          </dd>
        </div>
        <div>
          <dt>Currency</dt>
          <dd>{account.currencyLabel}</dd>
        </div>
        <div>
          <dt>Opened</dt>
          <dd>
            <time dateTime={account.openedAt}>{account.openedAt}</time>
          </dd>
        </div>
        <div>
          <dt>Content digest</dt>
          <dd>
            <code>{account.contentDigest}</code>
          </dd>
        </div>
      </dl>
    </article>
  );
}
