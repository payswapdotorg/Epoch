// IDEMPOTENCY + REPLAY coverage: draft creation is idempotent by
// (idempotencyKey, tenant); publication replays of the head version with
// identical content are duplicates while mutations are typed conflicts;
// record adoptions are idempotent by record identity with typed
// idempotency-conflict on same-id-different-content.
import { describe, expect, it } from 'vitest';
import { DeveloperPortalHost } from '../src/index';
import {
  ACQUIRER,
  AUTH,
  DEVELOPER,
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
  expectError,
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

describe('developer portal idempotency and replay', () => {
  it('returns the original receipt for a replayed draft creation (same key, same draft)', () => {
    const portal = host();
    const first = createListing(portal);
    const replay = createListing(portal);
    expect(replay.duplicate).toBe(true);
    expect(replay.listingId).toBe(first.listingId);
    expect(replay.draftDigest).toBe(first.draftDigest);
    expect(portal.health().listingCount).toBe(1);
  });

  it('rejects a replayed draft creation with the same key but different content', () => {
    const portal = host();
    createListing(portal);
    const error = expectError(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft({ displayName: 'Different' }),
        createdAt: T1,
      }),
    );
    expect(error.code).toBe('idempotency-conflict');
  });

  it('treats a publication replay of the head with identical content as a duplicate', () => {
    const portal = host();
    const created = createListing(portal);
    unwrap(
      portal.submitListing({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        submittedAt: T1,
      }),
    );
    const first = unwrap(
      portal.publishListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        version: '1.0.0',
        publishedAt: T2,
      }),
    );
    const replay = unwrap(
      portal.publishListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        version: '1.0.0',
        publishedAt: T2,
      }),
    );
    expect(replay.duplicate).toBe(true);
    expect(replay.contentDigest).toBe(first.contentDigest);
    expect(replay.chainLength).toBe(1);
    // No extra version was appended.
    expect(
      unwrap(
        portal.listListingVersions({
          asTenant: DEVELOPER,
          authorization: AUTH,
          listingId: created.listingId,
        }),
      ),
    ).toHaveLength(1);
  });

  it('rejects a same-key grant adoption replay with different content', () => {
    const portal = host();
    const created = createListing(portal);
    unwrap(
      portal.adoptEntitlementGrant({
        asTenant: DEVELOPER,
        authorization: AUTH,
        grant: grant({ listingId: created.listingId }),
      }),
    );
    const error = expectError(
      portal.adoptEntitlementGrant({
        asTenant: DEVELOPER,
        authorization: AUTH,
        grant: grant({ listingId: created.listingId, seats: 5 }),
      }),
    );
    expect(error.code).toBe('idempotency-conflict');
    // The identical record is still a duplicate.
    const replay = unwrap(
      portal.adoptEntitlementGrant({
        asTenant: DEVELOPER,
        authorization: AUTH,
        grant: grant({ listingId: created.listingId }),
      }),
    );
    expect(replay.duplicate).toBe(true);
  });

  it('is idempotent by revocation id', () => {
    const portal = host();
    const created = createListing(portal);
    const grantRecord = grant({ listingId: created.listingId });
    unwrap(portal.adoptEntitlementGrant({ asTenant: DEVELOPER, authorization: AUTH, grant: grantRecord }));
    const revocation = {
      schemaVersion: 1,
      revocationId: 'revocation:globex-stress',
      entitlementId: grantRecord.entitlementId,
      tenantId: ACQUIRER,
      revokedAt: T3,
      revokedBy: 'principal:portal-ops',
      reason: 'contract ended',
    };
    const first = unwrap(
      portal.adoptEntitlementRevocation({ asTenant: DEVELOPER, authorization: AUTH, revocation }),
    );
    const replay = unwrap(
      portal.adoptEntitlementRevocation({ asTenant: DEVELOPER, authorization: AUTH, revocation }),
    );
    expect(first.duplicate).toBe(false);
    expect(replay.duplicate).toBe(true);
  });

  it('rejects a revocation for an unadopted entitlement', () => {
    const portal = host();
    const error = expectError(
      portal.adoptEntitlementRevocation({
        asTenant: DEVELOPER,
        authorization: AUTH,
        revocation: {
          schemaVersion: 1,
          revocationId: 'revocation:ghost',
          entitlementId: 'entitlement:never-adopted',
          tenantId: ACQUIRER,
          revokedAt: T3,
          revokedBy: 'principal:portal-ops',
        },
      }),
    );
    expect(error.code).toBe('unknown-entitlement');
  });

  it('is idempotent by revenue id with typed conflict on mutation', () => {
    const portal = host();
    const created = createListing(portal);
    const record = revenue({ listingId: created.listingId });
    unwrap(portal.adoptRevenueRecord({ asTenant: DEVELOPER, authorization: AUTH, record }));
    const replay = unwrap(
      portal.adoptRevenueRecord({ asTenant: DEVELOPER, authorization: AUTH, record }),
    );
    expect(replay.duplicate).toBe(true);
    const error = expectError(
      portal.adoptRevenueRecord({
        asTenant: DEVELOPER,
        authorization: AUTH,
        record: revenue({ listingId: created.listingId, amount: '99.99' }),
      }),
    );
    expect(error.code).toBe('idempotency-conflict');
  });

  it('is idempotent by billing-account identity; a second, different account is a conflict', () => {
    const portal = host();
    const first = unwrap(
      portal.adoptBillingAccount({
        asTenant: DEVELOPER,
        authorization: AUTH,
        account: billingAccount(),
      }),
    );
    expect(first.duplicate).toBe(false);
    const replay = unwrap(
      portal.adoptBillingAccount({
        asTenant: DEVELOPER,
        authorization: AUTH,
        account: billingAccount(),
      }),
    );
    expect(replay.duplicate).toBe(true);
    const error = expectError(
      portal.adoptBillingAccount({
        asTenant: DEVELOPER,
        authorization: AUTH,
        account: billingAccount({
          accountId: 'billing-account:acme-payout-2',
          displayName: 'Another account',
        }),
      }),
    );
    expect(error.code).toBe('idempotency-conflict');
  });

  it('emits no duplicate events for replayed operations', () => {
    const portal = host();
    createListing(portal);
    createListing(portal);
    expect(portal.health().eventCount).toBe(1);
  });
});
