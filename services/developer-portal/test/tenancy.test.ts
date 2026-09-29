// TENANCY coverage (R12): the single-tenant guard, cross-tenant listing
// access, cross-tenant record adoptions, and tenant-scoped stream reads.
// Cross-tenant access NEVER discloses existence of another tenant's
// listings beyond the typed carrier.
import { describe, expect, it } from 'vitest';
import { DeveloperPortalHost } from '../src/index';
import { portalListingStreamIdOf, portalDeveloperStreamIdOf } from '../src/index';
import {
  AUTH,
  ACQUIRER,
  DEVELOPER,
  OTHER_DEVELOPER,
  T0,
  T2,
  billingAccount,
  draft,
  fixtureRegistry,
  grant,
  revenue,
  unwrap,
  expectError,
  allowContext,
} from './helpers';

function host(): DeveloperPortalHost {
  return new DeveloperPortalHost({ registry: fixtureRegistry() });
}

function createListing(target: DeveloperPortalHost, key = 'listing-key-1') {
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

describe('developer portal tenant isolation (R12)', () => {
  it('rejects operations naming a foreign tenant when the host is single-tenant scoped', () => {
    const portal = new DeveloperPortalHost({
      expectedTenantId: DEVELOPER,
      registry: fixtureRegistry(),
    });
    const error = expectError(
      portal.createListingDraft({
        asTenant: OTHER_DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft(),
        createdAt: T0,
      }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('denies cross-tenant listing reads (the other developer cannot see the listing)', () => {
    const portal = host();
    const created = createListing(portal);
    const otherAuth = {
      principalId: 'principal:hooli-dev',
      context: allowContext('principal:hooli-dev', OTHER_DEVELOPER),
    };
    const readError = expectError(
      portal.getListing({ asTenant: OTHER_DEVELOPER, authorization: otherAuth, listingId: created.listingId }),
    );
    expect(readError.code).toBe('cross-tenant-denied');
    const publishError = expectError(
      portal.publishListingVersion({
        asTenant: OTHER_DEVELOPER,
        authorization: otherAuth,
        listingId: created.listingId,
        version: '1.0.0',
        publishedAt: T2,
      }),
    );
    expect(publishError.code).toBe('cross-tenant-denied');
  });

  it('does not list another developer\'s listings', () => {
    const portal = host();
    createListing(portal);
    const otherAuth = {
      principalId: 'principal:hooli-dev',
      context: allowContext('principal:hooli-dev', OTHER_DEVELOPER),
    };
    const listed = unwrap(
      portal.listListings({ asTenant: OTHER_DEVELOPER, authorization: otherAuth }),
    );
    expect(listed).toHaveLength(0);
  });

  it('denies adopting a grant referencing a listing the developer does not own', () => {
    const portal = host();
    const created = createListing(portal);
    // The grant references the DEVELOPER's listing but the caller acts
    // for another developer tenant.
    const otherAuth = {
      principalId: 'principal:hooli-dev',
      context: allowContext('principal:hooli-dev', OTHER_DEVELOPER),
    };
    const error = expectError(
      portal.adoptEntitlementGrant({
        asTenant: OTHER_DEVELOPER,
        authorization: otherAuth,
        grant: grant({ listingId: created.listingId }),
      }),
    );
    expect(error.code).toBe('unknown-listing-reference');
  });

  it('denies adopting revenue accruing to another developer tenant', () => {
    const portal = host();
    const created = createListing(portal);
    const error = expectError(
      portal.adoptRevenueRecord({
        asTenant: DEVELOPER,
        authorization: AUTH,
        record: revenue({
          listingId: created.listingId,
          developerTenantId: OTHER_DEVELOPER,
        }),
      }),
    );
    expect(error.code).toBe('cross-tenant-denied');
  });

  it('denies adopting a billing account of another tenant', () => {
    const portal = host();
    const error = expectError(
      portal.adoptBillingAccount({
        asTenant: DEVELOPER,
        authorization: AUTH,
        account: billingAccount({ tenantId: OTHER_DEVELOPER }),
      }),
    );
    expect(error.code).toBe('cross-tenant-denied');
  });

  it('scopes stream reads to the acting tenant', () => {
    const portal = host();
    const created = createListing(portal);
    const events = unwrap(
      portal.readStream({
        asTenant: DEVELOPER,
        authorization: AUTH,
        streamId: portalListingStreamIdOf(created.listingId),
      }),
    );
    expect(events).toHaveLength(1);
    // The same stream, read as another tenant, is empty (not an error —
    // the stream simply has no events scoped to that tenant).
    const otherAuth = {
      principalId: 'principal:hooli-dev',
      context: allowContext('principal:hooli-dev', OTHER_DEVELOPER),
    };
    const scoped = unwrap(
      portal.readStream({
        asTenant: OTHER_DEVELOPER,
        authorization: otherAuth,
        streamId: portalListingStreamIdOf(created.listingId),
      }),
    );
    expect(scoped).toHaveLength(0);
    // The developer stream of another tenant is empty too.
    expect(
      unwrap(
        portal.readStream({
          asTenant: OTHER_DEVELOPER,
          authorization: otherAuth,
          streamId: portalDeveloperStreamIdOf(DEVELOPER),
        }),
      ),
    ).toHaveLength(0);
  });

  it('keeps the acquiring tenant (the grant owner) distinct from the developer tenant', () => {
    const portal = host();
    const created = createListing(portal);
    const adopted = unwrap(
      portal.adoptEntitlementGrant({
        asTenant: DEVELOPER,
        authorization: AUTH,
        grant: grant({
          listingId: created.listingId,
          tenantId: ACQUIRER,
        }),
      }),
    );
    expect(adopted.duplicate).toBe(false);
    expect(adopted.recordKind).toBe('entitlement-grant');
    // The developer dashboard counts it; the acquirer's own dashboard is
    // a different tenant's surface (not visible here).
    const dashboard = unwrap(
      portal.getDeveloperDashboard({ asTenant: DEVELOPER, authorization: AUTH }),
    );
    expect(dashboard.adoptedGrantCount).toBe(1);
    expect(dashboard.activeEntitlementCount).toBe(1);
    expect(dashboard.developerTenantId).toBe(DEVELOPER);
  });
});
