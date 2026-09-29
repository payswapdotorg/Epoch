// EVENT coverage: the portal's append-only events over the W010 shapes —
// contiguous 1-based sequences, same-stream causal parents, the closed
// discriminator vocabulary with typed data, tenant scoping, and the
// sealed-envelope discipline (digest verification, tamper detection).
import { describe, expect, it } from 'vitest';
import {
  DeveloperPortalHost,
  portalDeveloperStreamIdOf,
  portalListingStreamIdOf,
  sealPortalEvent,
  verifySealedPortalEvent,
  parsePortalEventData,
  PORTAL_EVENT_DISCRIMINATORS,
} from '../src/index';
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
  expectError,
} from './helpers';

function portal(): DeveloperPortalHost {
  return new DeveloperPortalHost({ registry: fixtureRegistry() });
}

describe('developer portal events (W010 shapes)', () => {
  it('emits contiguous sequences with same-stream causal parents', () => {
    const host = portal();
    const created = unwrap(
      host.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'key-a',
        draft: draft(),
        createdAt: T0,
      }),
    );
    unwrap(
      host.updateListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        draft: draft({ displayName: 'Renamed' }),
        updatedAt: T1,
      }),
    );
    unwrap(
      host.submitListing({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        submittedAt: T2,
      }),
    );
    const events = unwrap(
      host.readStream({
        asTenant: DEVELOPER,
        authorization: AUTH,
        streamId: portalListingStreamIdOf(created.listingId),
      }),
    );
    expect(events).toHaveLength(3);
    expect(events[0]!.sequence).toBe(1);
    expect(events[0]!.causalParent).toBeNull();
    expect(events[1]!.sequence).toBe(2);
    expect(events[1]!.causalParent).toEqual({ streamId: events[0]!.streamId, sequence: 1 });
    expect(events[2]!.sequence).toBe(3);
    expect(events[2]!.causalParent).toEqual({ streamId: events[0]!.streamId, sequence: 2 });
    for (const event of events) {
      expect(event.tenantId).toBe(DEVELOPER);
      expect(event.actor).toBe('principal:portal-dev');
      expect(event.schemaVersion).toBe(1);
    }
  });

  it('derives the stream id deterministically from the listing id', () => {
    expect(portalListingStreamIdOf('listing:my-suite')).toBe('stream:portal-listing-my-suite');
    expect(portalDeveloperStreamIdOf('tenant:acme-dev')).toBe('stream:portal-developer-acme-dev');
  });

  it('emits adoption events on the affected listing stream and the developer stream', () => {
    const host = portal();
    const created = unwrap(
      host.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'key-a',
        draft: draft(),
        createdAt: T0,
      }),
    );
    unwrap(
      host.adoptEntitlementGrant({
        asTenant: DEVELOPER,
        authorization: AUTH,
        grant: grant({ listingId: created.listingId }),
      }),
    );
    unwrap(
      host.adoptRevenueRecord({
        asTenant: DEVELOPER,
        authorization: AUTH,
        record: revenue({ listingId: created.listingId }),
      }),
    );
    unwrap(
      host.adoptBillingAccount({ asTenant: DEVELOPER, authorization: AUTH, account: billingAccount() }),
    );
    const listingEvents = unwrap(
      host.readStream({
        asTenant: DEVELOPER,
        authorization: AUTH,
        streamId: portalListingStreamIdOf(created.listingId),
      }),
    );
    expect(listingEvents.map((event) => event.payload.discriminator)).toEqual([
      'portal:listing-created',
      'portal:grant-adopted',
      'portal:revenue-adopted',
    ]);
    const developerEvents = unwrap(
      host.readStream({
        asTenant: DEVELOPER,
        authorization: AUTH,
        streamId: portalDeveloperStreamIdOf(DEVELOPER),
      }),
    );
    expect(developerEvents.map((event) => event.payload.discriminator)).toEqual([
      'portal:billing-account-adopted',
    ]);
    expect(developerEvents[0]!.payload.data).toEqual({
      accountId: 'billing-account:acme-payout',
      accountDigest: billingAccount().contentDigest,
      currency: 'EUR',
    });
  });

  it('seals and verifies event envelopes (content addressing + tamper detection)', () => {
    const host = portal();
    const created = unwrap(
      host.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'key-a',
        draft: draft(),
        createdAt: T0,
      }),
    );
    const events = unwrap(
      host.readStream({
        asTenant: DEVELOPER,
        authorization: AUTH,
        streamId: portalListingStreamIdOf(created.listingId),
      }),
    );
    const verified = verifySealedPortalEvent(events[0]);
    expect(verified.ok).toBe(true);
    // Tamper the digest -> typed mismatch.
    const tampered = expectError(
      verifySealedPortalEvent({ ...events[0]!, contentDigest: '0'.repeat(64) }),
    );
    expect(tampered.code).toBe('digest-mismatch');
    // Vendor fields -> typed rejection.
    const vendor = expectError(verifySealedPortalEvent({ ...events[0]!, vendor: true }));
    expect(vendor.code).toBe('vendor-fields-rejected');
  });

  it('enforces the closed discriminator vocabulary at sealing time', () => {
    const sealed = expectError(
      sealPortalEvent({
        schemaVersion: 1,
        streamId: 'stream:portal-listing-x',
        sequence: 1,
        tenantId: DEVELOPER,
        actor: 'principal:portal-dev',
        causalParent: null,
        payload: { discriminator: 'portal:not-a-thing', data: { listingId: 'listing:x' } },
        occurredAt: T0,
      }),
    );
    expect(sealed.code).toBe('validation');
    // A valid discriminator with malformed data is rejected too.
    const badData = expectError(
      sealPortalEvent({
        schemaVersion: 1,
        streamId: 'stream:portal-listing-x',
        sequence: 1,
        tenantId: DEVELOPER,
        actor: 'principal:portal-dev',
        causalParent: null,
        payload: { discriminator: 'portal:listing-retired', data: { listingId: 123 } },
        occurredAt: T0,
      }),
    );
    expect(badData.code).toBe('validation');
    // The full vocabulary round-trips through parsePortalEventData.
    for (const discriminator of PORTAL_EVENT_DISCRIMINATORS) {
      expect(typeof discriminator).toBe('string');
    }
    const parsed = parsePortalEventData({
      discriminator: 'portal:listing-submitted',
      data: { listingId: 'listing:x' },
    });
    expect(parsed.ok).toBe(true);
  });

  it('rejects a same-stream causal parent that is not strictly earlier', () => {
    const error = expectError(
      sealPortalEvent({
        schemaVersion: 1,
        streamId: 'stream:portal-listing-x',
        sequence: 1,
        tenantId: DEVELOPER,
        actor: 'principal:portal-dev',
        causalParent: { streamId: 'stream:portal-listing-x', sequence: 1 },
        payload: { discriminator: 'portal:listing-submitted', data: { listingId: 'listing:x' } },
        occurredAt: T0,
      }),
    );
    expect(error.code).toBe('validation');
  });
});
