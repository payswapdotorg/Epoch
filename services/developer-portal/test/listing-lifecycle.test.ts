// The Developer Portal listing lifecycle sessions (W025): draft
// creation -> draft updates -> submission -> publication (the sealed,
// immutable, hash-chained version through the REAL W023 kernel) ->
// chain verification -> retirement. Every record the host stores or
// returns is a REAL kernel record; every transition follows the REAL
// lifecycle table.
import { describe, expect, it } from 'vitest';
import { DeveloperPortalHost } from '../src/index';
import { portalListingStreamIdOf } from '../src/index';
import {
  AUTH,
  DEVELOPER,
  T0,
  T1,
  T2,
  T3,
  T4,
  T5,
  draft,
  fixtureRegistry,
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

function submitAndPublish(
  target: DeveloperPortalHost,
  listingId: string,
  version = '1.0.0',
  publishedAt = T2,
) {
  unwrap(
    target.submitListing({
      asTenant: DEVELOPER,
      authorization: AUTH,
      listingId,
      submittedAt: T1,
    }),
  );
  return unwrap(
    target.publishListingVersion({
      asTenant: DEVELOPER,
      authorization: AUTH,
      listingId,
      version,
      publishedAt,
    }),
  );
}

describe('developer portal listing lifecycle sessions', () => {
  it('creates a listing draft with the derived id and draft digest', () => {
    const portal = host();
    const receipt = createListing(portal);
    expect(receipt.duplicate).toBe(false);
    expect(receipt.lifecycle).toBe('draft');
    expect(receipt.listingId).toMatch(/^listing:[a-z0-9-]+$/);
    expect(receipt.draftDigest).toMatch(/^[0-9a-f]{64}$/);
    const snapshot = unwrap(
      portal.getListing({ asTenant: DEVELOPER, authorization: AUTH, listingId: receipt.listingId }),
    );
    expect(snapshot.lifecycle).toBe('draft');
    expect(snapshot.displayName).toBe('Stress Simulation Suite');
    expect(snapshot.publishedVersionCount).toBe(0);
    expect(snapshot.headVersion).toBeNull();
    expect(snapshot.headDigest).toBeNull();
  });

  it('updates the mutable draft fields while unpublished', () => {
    const portal = host();
    const created = createListing(portal);
    const updated = unwrap(
      portal.updateListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        draft: draft({ displayName: 'Stress Simulation Suite Pro' }),
        updatedAt: T1,
      }),
    );
    expect(updated.duplicate).toBe(false);
    expect(updated.draftDigest).not.toBe(created.draftDigest);
    expect(
      unwrap(
        portal.getListing({ asTenant: DEVELOPER, authorization: AUTH, listingId: created.listingId }),
      ).displayName,
    ).toBe('Stress Simulation Suite Pro');
  });

  it('submits the listing (draft -> submitted)', () => {
    const portal = host();
    const created = createListing(portal);
    const snapshot = unwrap(
      portal.submitListing({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        submittedAt: T1,
      }),
    );
    expect(snapshot.lifecycle).toBe('submitted');
  });

  it('publishes the sealed immutable version and chains a second version', () => {
    const portal = host();
    const created = createListing(portal);
    const first = submitAndPublish(portal, created.listingId, '1.0.0', T2);
    expect(first.duplicate).toBe(false);
    expect(first.version).toBe('1.0.0');
    expect(first.previousVersionDigest).toBeNull();
    expect(first.chainLength).toBe(1);

    const second = unwrap(
      portal.publishListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        version: '1.1.0',
        publishedAt: T3,
      }),
    );
    expect(second.chainLength).toBe(2);
    expect(second.previousVersionDigest).toBe(first.contentDigest);

    const chain = unwrap(
      portal.verifyListingChain({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
      }),
    );
    expect(chain.versionCount).toBe(2);
    expect(chain.headVersion).toBe('1.1.0');
    expect(chain.headDigest).toBe(second.contentDigest);

    const versions = unwrap(
      portal.listListingVersions({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
      }),
    );
    expect(versions.map((version) => version.version)).toEqual(['1.0.0', '1.1.0']);
    // The sealed envelopes are REAL kernel records.
    expect(versions[0]!.schema).toBe('epoch.marketplace.listing-version');
    expect(versions[0]!.developerTenantId).toBe(DEVELOPER);
    expect(versions[0]!.capabilityReferences).toHaveLength(2);
  });

  it('reads a published version by pin and by content digest', () => {
    const portal = host();
    const created = createListing(portal);
    const first = submitAndPublish(portal, created.listingId, '1.0.0', T2);
    const byPin = unwrap(
      portal.getListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        version: '1.0.0',
      }),
    );
    expect(byPin.contentDigest).toBe(first.contentDigest);
    const byDigest = unwrap(
      portal.getListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        contentDigest: first.contentDigest,
      }),
    );
    expect(byDigest.version).toBe('1.0.0');
  });

  it('publishes again from the published state (no re-submission needed)', () => {
    const portal = host();
    const created = createListing(portal);
    submitAndPublish(portal, created.listingId, '1.0.0', T2);
    const second = unwrap(
      portal.publishListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        version: '2.0.0',
        publishedAt: T3,
      }),
    );
    expect(second.version).toBe('2.0.0');
  });

  it('retires a published listing (published -> retired) and freezes edits', () => {
    const portal = host();
    const created = createListing(portal);
    submitAndPublish(portal, created.listingId, '1.0.0', T2);
    const retired = unwrap(
      portal.retireListing({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        retiredAt: T4,
      }),
    );
    expect(retired.lifecycle).toBe('retired');
    const edit = expectError(
      portal.updateListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        draft: draft({ displayName: 'zombie' }),
        updatedAt: T5,
      }),
    );
    expect(edit.code).toBe('lifecycle-conflict');
  });

  it('lists only the developer\'s own listings, sorted by listing id', () => {
    const portal = host();
    const first = createListing(portal, 'listing-key-a');
    const second = createListing(portal, 'listing-key-b');
    const listed = unwrap(portal.listListings({ asTenant: DEVELOPER, authorization: AUTH }));
    expect(listed).toHaveLength(2);
    expect(listed.map((listing) => listing.listingId)).toEqual(
      [first.listingId, second.listingId].sort(),
    );
  });

  it('emits the portal lifecycle events on one stream per listing', () => {
    const portal = host();
    const created = createListing(portal);
    submitAndPublish(portal, created.listingId, '1.0.0', T2);
    const events = unwrap(
      portal.readStream({
        asTenant: DEVELOPER,
        authorization: AUTH,
        streamId: portalListingStreamIdOf(created.listingId),
      }),
    );
    expect(events.map((event) => event.payload.discriminator)).toEqual([
      'portal:listing-created',
      'portal:listing-submitted',
      'portal:version-published',
    ]);
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    expect(events[1]!.causalParent).toEqual({ streamId: events[1]!.streamId, sequence: 1 });
    expect(events[2]!.occurredAt).toBe(T2);
  });
});
