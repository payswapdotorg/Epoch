// NEUTRALITY: the developer portal surface carries no payment-vendor,
// cloud-vendor, or provider vocabulary; the emitted event payloads and
// typed outputs stay provider-neutral (external systems live behind the
// upstream adapter seams — never named here).
import { describe, expect, it } from 'vitest';
import { DeveloperPortalHost } from '../src/index';
import { renderDeveloperPortalContractFiles } from '../src/index';
import {
  AUTH,
  DEVELOPER,
  T0,
  T1,
  T2,
  billingAccount,
  draft,
  fixtureRegistry,
  grant,
  revenue,
  unwrap,
} from './helpers';

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
  'aws',
  'azure',
  'gcp',
  'github.com/stripe',
];

function host(): DeveloperPortalHost {
  return new DeveloperPortalHost({ registry: fixtureRegistry() });
}

describe('developer portal provider neutrality', () => {
  it('the describe surface carries no vendor tokens', () => {
    const portal = host();
    const description = JSON.stringify(portal.describe());
    for (const token of BLOCKLIST) {
      expect(description.toLowerCase().includes(token), `describe() contains "${token}"`).toBe(false);
    }
  });

  it('emitted events carry no vendor tokens in their payloads', () => {
    const portal = host();
    const created = unwrap(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'key-a',
        draft: draft(),
        createdAt: T0,
      }),
    );
    unwrap(
      portal.submitListing({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        submittedAt: T1,
      }),
    );
    unwrap(
      portal.publishListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        version: '1.0.0',
        publishedAt: T2,
      }),
    );
    unwrap(
      portal.adoptEntitlementGrant({
        asTenant: DEVELOPER,
        authorization: AUTH,
        grant: grant({ listingId: created.listingId }),
      }),
    );
    unwrap(
      portal.adoptRevenueRecord({
        asTenant: DEVELOPER,
        authorization: AUTH,
        record: revenue({ listingId: created.listingId }),
      }),
    );
    unwrap(
      portal.adoptBillingAccount({ asTenant: DEVELOPER, authorization: AUTH, account: billingAccount() }),
    );
    const dashboard = unwrap(
      portal.getDeveloperDashboard({ asTenant: DEVELOPER, authorization: AUTH }),
    );
    const serialized = JSON.stringify(dashboard) + JSON.stringify(portal.health());
    for (const token of BLOCKLIST) {
      expect(serialized.toLowerCase().includes(token), `outputs contain "${token}"`).toBe(false);
    }
  });

  it('the emitted contract files carry no vendor tokens', () => {
    const files = renderDeveloperPortalContractFiles();
    const serialized = JSON.stringify(Object.keys(files)) + Object.values(files).join('');
    for (const token of BLOCKLIST) {
      expect(serialized.toLowerCase().includes(token), `contracts contain "${token}"`).toBe(false);
    }
  });
});
