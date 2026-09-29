// DEVELOPER DASHBOARD coverage: the pure deterministic projection over
// the portal state — lifecycle counts, active/revoked entitlement
// analytics through the REAL marketplace check, revenue folds per
// currency through the REAL decimal arithmetic, the adopted payout
// account, and registry/stream counters.
import { describe, expect, it } from 'vitest';
import { DeveloperPortalHost } from '../src/index';
import {
  ACQUIRER,
  AUTH,
  DEVELOPER,
  OTHER_ACQUIRER,
  T0,
  T1,
  T2,
  T3,
  billingAccount,
  draft,
  fixtureRegistry,
  grant,
  revenue,
  unwrap,
} from './helpers';

function portal(): DeveloperPortalHost {
  return new DeveloperPortalHost({ registry: fixtureRegistry() });
}

function createListing(target: DeveloperPortalHost, key: string) {
  return unwrap(
    target.createListingDraft({
      asTenant: DEVELOPER,
      authorization: AUTH,
      idempotencyKey: key,
      draft: draft(),
      createdAt: T0,
    }),
  );
}

describe('developer portal dashboard projection', () => {
  it('projects an empty dashboard for a fresh developer tenant', () => {
    const host = portal();
    const dashboard = unwrap(
      host.getDeveloperDashboard({ asTenant: DEVELOPER, authorization: AUTH }),
    );
    expect(dashboard.developerTenantId).toBe(DEVELOPER);
    expect(dashboard.listingCount).toBe(0);
    expect(dashboard.listingsByLifecycle).toEqual({
      draft: 0,
      submitted: 0,
      published: 0,
      retired: 0,
    });
    expect(dashboard.publishedVersionCount).toBe(0);
    expect(dashboard.revenueByCurrency).toEqual({});
    expect(dashboard.payoutAccount).toBeNull();
    expect(dashboard.registeredCapabilityCount).toBe(3);
  });

  it('counts listings by lifecycle and published versions', () => {
    const host = portal();
    const first = createListing(host, 'key-a');
    const second = createListing(host, 'key-b');
    const third = createListing(host, 'key-c');
    unwrap(
      host.submitListing({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: first.listingId,
        submittedAt: T1,
      }),
    );
    unwrap(
      host.publishListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: first.listingId,
        version: '1.0.0',
        publishedAt: T2,
      }),
    );
    unwrap(
      host.publishListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: first.listingId,
        version: '1.1.0',
        publishedAt: T2,
      }),
    );
    unwrap(
      host.submitListing({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: second.listingId,
        submittedAt: T1,
      }),
    );
    const dashboard = unwrap(
      host.getDeveloperDashboard({ asTenant: DEVELOPER, authorization: AUTH }),
    );
    expect(dashboard.listingCount).toBe(3);
    expect(dashboard.listingsByLifecycle).toEqual({
      draft: 1, // third
      submitted: 1, // second
      published: 1, // first
      retired: 0,
    });
    expect(dashboard.publishedVersionCount).toBe(2);
    expect(third.listingId).not.toBe(second.listingId);
  });

  it('counts active and revoked entitlements through the REAL marketplace check', () => {
    const host = portal();
    const created = createListing(host, 'key-a');
    const grantA = grant({
      entitlementId: 'entitlement:globex-stress',
      listingId: created.listingId,
      tenantId: ACQUIRER,
    });
    const grantB = grant({
      entitlementId: 'entitlement:initech-stress',
      listingId: created.listingId,
      tenantId: OTHER_ACQUIRER,
    });
    unwrap(host.adoptEntitlementGrant({ asTenant: DEVELOPER, authorization: AUTH, grant: grantA }));
    unwrap(host.adoptEntitlementGrant({ asTenant: DEVELOPER, authorization: AUTH, grant: grantB }));
    unwrap(
      host.adoptEntitlementRevocation({
        asTenant: DEVELOPER,
        authorization: AUTH,
        revocation: {
          schemaVersion: 1,
          revocationId: 'revocation:initech-stress',
          entitlementId: grantB.entitlementId,
          tenantId: OTHER_ACQUIRER,
          revokedAt: T3,
          revokedBy: 'principal:portal-ops',
        },
      }),
    );
    const dashboard = unwrap(
      host.getDeveloperDashboard({ asTenant: DEVELOPER, authorization: AUTH }),
    );
    expect(dashboard.adoptedGrantCount).toBe(2);
    expect(dashboard.activeEntitlementCount).toBe(1);
    expect(dashboard.revokedEntitlementCount).toBe(1);
  });

  it('folds revenue per currency through the REAL decimal arithmetic', () => {
    const host = portal();
    const created = createListing(host, 'key-a');
    unwrap(
      host.adoptRevenueRecord({
        asTenant: DEVELOPER,
        authorization: AUTH,
        record: revenue({ listingId: created.listingId, amount: '43.75' }),
      }),
    );
    unwrap(
      host.adoptRevenueRecord({
        asTenant: DEVELOPER,
        authorization: AUTH,
        record: revenue({
          revenueId: 'revenue:globex-002',
          listingId: created.listingId,
          amount: '6.25',
        }),
      }),
    );
    unwrap(
      host.adoptRevenueRecord({
        asTenant: DEVELOPER,
        authorization: AUTH,
        record: revenue({
          revenueId: 'revenue:globex-003',
          listingId: created.listingId,
          amount: '100',
          currency: 'USD',
        }),
      }),
    );
    const dashboard = unwrap(
      host.getDeveloperDashboard({ asTenant: DEVELOPER, authorization: AUTH }),
    );
    expect(dashboard.revenueRecordCount).toBe(3);
    expect(dashboard.revenueByCurrency).toEqual({ EUR: '50', USD: '100' });
  });

  it('projects the adopted payout account', () => {
    const host = portal();
    const account = billingAccount();
    unwrap(host.adoptBillingAccount({ asTenant: DEVELOPER, authorization: AUTH, account }));
    const dashboard = unwrap(
      host.getDeveloperDashboard({ asTenant: DEVELOPER, authorization: AUTH }),
    );
    expect(dashboard.payoutAccount).toEqual({
      schemaVersion: 1,
      accountId: 'billing-account:acme-payout',
      currency: 'EUR',
      displayName: 'Acme developer payout account',
      openedAt: T1,
      contentDigest: account.contentDigest,
    });
  });

  it('counts portal events across streams', () => {
    const host = portal();
    const created = createListing(host, 'key-a');
    unwrap(host.adoptBillingAccount({ asTenant: DEVELOPER, authorization: AUTH, account: billingAccount() }));
    const dashboard = unwrap(
      host.getDeveloperDashboard({ asTenant: DEVELOPER, authorization: AUTH }),
    );
    // listing-created + billing-account-adopted = 2.
    expect(dashboard.eventCount).toBe(2);
    expect(created.duplicate).toBe(false);
  });

  it('reports health as typed data with the same counts', () => {
    const host = portal();
    createListing(host, 'key-a');
    const health = host.health();
    expect(health.service).toBe('epoch.developer-portal-host');
    expect(health.status).toBe('ready');
    expect(health.listingCount).toBe(1);
    expect(health.listingsByLifecycle).toEqual({
      draft: 1,
      submitted: 0,
      published: 0,
      retired: 0,
    });
    expect(health.registrySize).toBe(3);
    expect(health.eventCount).toBe(1);
    const description = host.describe();
    expect(description.operations).toContain('publishListingVersion');
    expect(description.operations).toContain('browseCapabilities');
    expect(description.invariants.length).toBeGreaterThan(0);
  });
});
