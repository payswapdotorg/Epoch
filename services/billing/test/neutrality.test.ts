// NEUTRALITY: the billing host surface carries no payment-vendor
// vocabulary; the emitted event payloads and typed outputs stay
// brand-free (external settlement systems live BEHIND the SettlementPort
// seam — never named).
import { describe, expect, it } from 'vitest';
import { BillingHost } from '../src/index';
import { AUTH, TENANT, T0, PRINCIPAL, unwrap } from './helpers';

const BLOCKLIST = [
  'stripe',
  'paypal',
  'braintree',
  'adyen',
  'checkout.com',
  'checkout-com',
  'klarna',
  'razorpay',
  'worldpay',
  'mollie',
  'payoneer',
  'venmo',
  'alipay',
  'wechat-pay',
  'apple-pay',
  'google-pay',
  'amazon-pay',
  'authorizenet',
];

describe('billing host provider neutrality', () => {
  it('the describe surface carries no vendor tokens', () => {
    const host = new BillingHost();
    const description = JSON.stringify(host.describe());
    for (const token of BLOCKLIST) {
      expect(description.toLowerCase().includes(token), `describe() contains "${token}"`).toBe(false);
    }
  });

  it('emitted events carry no vendor tokens in their payloads', () => {
    const host = new BillingHost();
    const account = unwrap(
      host.openAccount({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'account-key-1',
        currency: 'EUR',
        displayName: 'Globex EUR billing account',
        openedAt: T0,
        openedBy: PRINCIPAL,
      }),
    );
    const stream = unwrap(
      host.readStream({
        asTenant: TENANT,
        authorization: AUTH,
        streamId: `stream:billing-${account.account.accountId.slice('billing-account:'.length)}`,
      }),
    );
    const serialized = JSON.stringify(stream);
    for (const token of BLOCKLIST) {
      expect(serialized.toLowerCase().includes(token), `event payload contains "${token}"`).toBe(false);
    }
  });

  it('the health projection stays brand-free', () => {
    const host = new BillingHost();
    const serialized = JSON.stringify(host.health());
    for (const token of BLOCKLIST) {
      expect(serialized.toLowerCase().includes(token)).toBe(false);
    }
  });
});
