// Provider-neutrality evidence (service surface): the typed host surface
// and descriptions carry no payment-vendor tokens.
import { describe, expect, it } from 'vitest';
import { MarketplaceHost } from '../src/index';

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
  'venmo',
  'alipay',
  'wechat-pay',
  'apple-pay',
  'google-pay',
];

describe('marketplace host provider neutrality', () => {
  it('describeService invariants carry no vendor tokens', () => {
    const described = MarketplaceHost.create().describeService();
    const text = JSON.stringify(described).toLowerCase();
    for (const token of BLOCKLIST) {
      expect(text.includes(token), `describeService contains "${token}"`).toBe(false);
    }
  });

  it('health output is vendor-free typed data', () => {
    const health = MarketplaceHost.create().health();
    const text = JSON.stringify(health).toLowerCase();
    for (const token of BLOCKLIST) {
      expect(text.includes(token), `health contains "${token}"`).toBe(false);
    }
  });
});
