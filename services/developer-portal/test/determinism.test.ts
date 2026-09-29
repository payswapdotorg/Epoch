// DETERMINISM: the same inputs in different orders produce identical
// sorted projections, identical digests, and identical health reports;
// emissions are pure functions of state. ZERO wall-clock, ZERO
// randomness (the in-memory host discipline).
import { describe, expect, it } from 'vitest';
import { DeveloperPortalHost, renderDeveloperPortalContractFiles } from '../src/index';
import {
  ACQUIRER,
  AUTH,
  DEVELOPER,
  OTHER_ACQUIRER,
  T0,
  T1,
  T2,
  draft,
  fixtureRegistry,
  grant,
  revenue,
  unwrap,
} from './helpers';

function runScenario(order: 'a-first' | 'b-first') {
  const host = new DeveloperPortalHost({ registry: fixtureRegistry() });
  const keys = order === 'a-first' ? ['key-a', 'key-b'] : ['key-b', 'key-a'];
  for (const key of keys) {
    unwrap(
      host.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: key,
        draft: draft(),
        createdAt: T0,
      }),
    );
  }
  const listings = unwrap(host.listListings({ asTenant: DEVELOPER, authorization: AUTH }));
  // Publish + adopt in a fixed order regardless of creation order.
  for (const listing of listings) {
    unwrap(
      host.submitListing({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: listing.listingId,
        submittedAt: T1,
      }),
    );
    unwrap(
      host.publishListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: listing.listingId,
        version: '1.0.0',
        publishedAt: T2,
      }),
    );
  }
  // Adoption order flips with the scenario.
  const grants = order === 'a-first' ? ['entitlement:globex-stress', 'entitlement:initech-stress'] : ['entitlement:initech-stress', 'entitlement:globex-stress'];
  for (const [index, entitlementId] of grants.entries()) {
    unwrap(
      host.adoptEntitlementGrant({
        asTenant: DEVELOPER,
        authorization: AUTH,
        grant: grant({
          entitlementId,
          listingId: listings[index % listings.length]!.listingId,
          tenantId: index === 0 ? ACQUIRER : OTHER_ACQUIRER,
        }),
      }),
    );
  }
  return host;
}

describe('developer portal determinism', () => {
  it('different insertion orders produce identical sorted projections and digests', () => {
    const a = runScenario('a-first');
    const b = runScenario('b-first');
    const listingsA = unwrap(a.listListings({ asTenant: DEVELOPER, authorization: AUTH }));
    const listingsB = unwrap(b.listListings({ asTenant: DEVELOPER, authorization: AUTH }));
    expect(listingsA).toEqual(listingsB);
    const dashboardA = unwrap(a.getDeveloperDashboard({ asTenant: DEVELOPER, authorization: AUTH }));
    const dashboardB = unwrap(b.getDeveloperDashboard({ asTenant: DEVELOPER, authorization: AUTH }));
    expect(dashboardA).toEqual(dashboardB);
    expect(a.health()).toEqual(b.health());
    // The published version digests are identical (content addressing).
    const versionsA = unwrap(
      a.listListingVersions({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: listingsA[0]!.listingId,
      }),
    );
    const versionsB = unwrap(
      b.listListingVersions({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: listingsB[0]!.listingId,
      }),
    );
    expect(versionsA.map((version) => version.contentDigest)).toEqual(
      versionsB.map((version) => version.contentDigest),
    );
  });

  it('the same listing id derives from the same (idempotencyKey, tenant) on any host', () => {
    const first = new DeveloperPortalHost({ registry: fixtureRegistry() });
    const second = new DeveloperPortalHost({ registry: fixtureRegistry() });
    const fromFirst = unwrap(
      first.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'same-key',
        draft: draft(),
        createdAt: T0,
      }),
    );
    const fromSecond = unwrap(
      second.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'same-key',
        draft: draft(),
        createdAt: T1, // a different instant does not change the derived id
      }),
    );
    expect(fromFirst.listingId).toBe(fromSecond.listingId);
  });

  it('dashboard revenue folds are order-independent (exact decimal arithmetic)', () => {
    const host = new DeveloperPortalHost({ registry: fixtureRegistry() });
    const created = unwrap(
      host.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'key-a',
        draft: draft(),
        createdAt: T0,
      }),
    );
    // 0.1 + 0.2 must fold exactly to 0.3 — never a float artifact.
    unwrap(
      host.adoptRevenueRecord({
        asTenant: DEVELOPER,
        authorization: AUTH,
        record: revenue({ listingId: created.listingId, amount: '0.1' }),
      }),
    );
    unwrap(
      host.adoptRevenueRecord({
        asTenant: DEVELOPER,
        authorization: AUTH,
        record: revenue({
          revenueId: 'revenue:globex-002',
          listingId: created.listingId,
          amount: '0.2',
        }),
      }),
    );
    const dashboard = unwrap(
      host.getDeveloperDashboard({ asTenant: DEVELOPER, authorization: AUTH }),
    );
    expect(dashboard.revenueByCurrency.EUR).toBe('0.3');
  });

  it('contract emission is deterministic (two renders are byte-identical)', () => {
    expect(renderDeveloperPortalContractFiles()).toEqual(renderDeveloperPortalContractFiles());
  });

  it('health is a pure projection of state (no clock, no randomness)', () => {
    const host = new DeveloperPortalHost({ registry: fixtureRegistry() });
    const first = host.health();
    const second = host.health();
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
