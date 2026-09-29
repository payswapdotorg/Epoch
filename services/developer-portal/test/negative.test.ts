// NEGATIVE coverage: malformed inputs, unknown references, illegal
// lifecycle transitions, version conflicts (mutation of published
// versions), dangling capability references, vendor-field discipline —
// every failure is a TYPED rejection, never an exception.
import { describe, expect, it } from 'vitest';
import { DeveloperPortalHost } from '../src/index';
import {
  AUTH,
  CAPABILITY,
  DEVELOPER,
  T0,
  T1,
  T2,
  T3,
  T4,
  draft,
  fixtureRegistry,
  unwrap,
  expectError,
  trustEvidence,
  USAGE_PRICING,
} from './helpers';

function host(): DeveloperPortalHost {
  return new DeveloperPortalHost({ registry: fixtureRegistry() });
}

describe('developer portal negative paths', () => {
  it('rejects a malformed idempotency key', () => {
    const portal = host();
    const error = expectError(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'bad key!',
        draft: draft(),
        createdAt: T0,
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects unknown structural fields on the creation input (vendor discipline)', () => {
    const portal = host();
    const error = expectError(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft(),
        createdAt: T0,
        extraVendorField: true,
      } as never),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('rejects unknown draft fields (vendor discipline)', () => {
    const portal = host();
    const error = expectError(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft({ vendorField: 'nope' }),
        createdAt: T0,
      }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('rejects malformed drafts through the REAL kernel admission (pricing)', () => {
    const portal = host();
    const error = expectError(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft({ pricing: { kind: 'not-a-model' } }),
        createdAt: T0,
      }),
    );
    expect(['validation', 'invalid-pricing-model']).toContain(error.code);
  });

  it('rejects unsorted capability references through the REAL kernel admission', () => {
    const portal = host();
    const error = expectError(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft({
          capabilityReferences: [
            { capabilityId: CAPABILITY, version: '1.0.0' },
            { capabilityId: 'stress.ifc-source', version: '2.0.0' },
          ],
        }),
        createdAt: T0,
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects malformed trust evidence through the REAL kernel admission', () => {
    const portal = host();
    const error = expectError(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft({
          trustEvidence: [trustEvidence({ schemaVersion: 2 })],
        }),
        createdAt: T0,
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects a public draft carrying a private allow-list (kernel rule)', () => {
    const portal = host();
    const error = expectError(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft({ privateAllowList: ['tenant:globex'] }),
        createdAt: T0,
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects operations on an unknown listing', () => {
    const portal = host();
    const error = expectError(
      portal.getListing({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: 'listing:does-not-exist',
      }),
    );
    expect(error.code).toBe('unknown-listing-reference');
  });

  it('rejects publication from the draft state (lifecycle)', () => {
    const portal = host();
    const created = unwrap(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft(),
        createdAt: T0,
      }),
    );
    const error = expectError(
      portal.publishListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        version: '1.0.0',
        publishedAt: T2,
      }),
    );
    expect(error.code).toBe('lifecycle-conflict');
  });

  it('rejects retirement from the draft state (lifecycle)', () => {
    const portal = host();
    const created = unwrap(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft(),
        createdAt: T0,
      }),
    );
    const error = expectError(
      portal.retireListing({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        retiredAt: T1,
      }),
    );
    expect(error.code).toBe('lifecycle-conflict');
  });

  it('rejects re-submitting a submitted listing (lifecycle)', () => {
    const portal = host();
    const created = unwrap(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
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
    const error = expectError(
      portal.submitListing({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        submittedAt: T2,
      }),
    );
    expect(error.code).toBe('lifecycle-conflict');
  });

  it('rejects publishing the same version with different content (mutation)', () => {
    const portal = host();
    const created = unwrap(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
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
    // Change the draft, then try to republish 1.0.0 -> mutation rejection.
    unwrap(
      portal.updateListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        draft: draft({ displayName: 'Changed' }),
        updatedAt: T3,
      }),
    );
    const error = expectError(
      portal.publishListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        version: '1.0.0',
        publishedAt: T4,
      }),
    );
    expect(error.code).toBe('version-conflict');
  });

  it('rejects publishing a version at or below the head (ascending order)', () => {
    const portal = host();
    const created = unwrap(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
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
        version: '1.1.0',
        publishedAt: T2,
      }),
    );
    const error = expectError(
      portal.publishListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        version: '1.0.5',
        publishedAt: T3,
      }),
    );
    expect(error.code).toBe('version-conflict');
  });

  it('rejects a dangling capability reference at publication (W007 authority)', () => {
    const portal = host();
    const created = unwrap(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft({
          capabilityReferences: [{ capabilityId: 'stress.not-registered', version: '1.0.0' }],
        }),
        createdAt: T0,
      }),
    );
    // The draft-level probe does not resolve references (the marketplace
    // host precedent: admission resolves at publication).
    unwrap(
      portal.submitListing({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        submittedAt: T1,
      }),
    );
    const error = expectError(
      portal.publishListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        version: '1.0.0',
        publishedAt: T2,
      }),
    );
    expect(error.code).toBe('unknown-capability-reference');
  });

  it('rejects a version read without a pin or digest', () => {
    const portal = host();
    const created = unwrap(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft(),
        createdAt: T0,
      }),
    );
    const error = expectError(
      portal.getListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects a version read for an unpublished pin', () => {
    const portal = host();
    const created = unwrap(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft(),
        createdAt: T0,
      }),
    );
    const error = expectError(
      portal.getListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        version: '9.9.9',
      }),
    );
    expect(error.code).toBe('version-not-published');
  });

  it('rejects chain verification of a listing with no published versions', () => {
    const portal = host();
    const created = unwrap(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft(),
        createdAt: T0,
      }),
    );
    const error = expectError(
      portal.verifyListingChain({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects adoptions of malformed records through the REAL validators', () => {
    const portal = host();
    const grantError = expectError(
      portal.adoptEntitlementGrant({
        asTenant: DEVELOPER,
        authorization: AUTH,
        grant: { schemaVersion: 1, entitlementId: 'entitlement:x' },
      }),
    );
    expect(grantError.code).toBe('validation');
    const revenueError = expectError(
      portal.adoptRevenueRecord({
        asTenant: DEVELOPER,
        authorization: AUTH,
        record: { schemaVersion: 1, revenueId: 'revenue:x', amount: '-5' },
      }),
    );
    expect(revenueError.code).toBe('validation');
    const accountError = expectError(
      portal.adoptBillingAccount({
        asTenant: DEVELOPER,
        authorization: AUTH,
        account: { schemaVersion: 1, accountId: 'billing-account:x' },
      }),
    );
    expect(['validation', 'digest-mismatch']).toContain(accountError.code);
  });

  it('rejects a free-pricing draft with a malformed usage pricing hybrid (kernel discipline)', () => {
    const portal = host();
    const error = expectError(
      portal.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'listing-key-1',
        draft: draft({
          pricing: { ...USAGE_PRICING, unitAmount: 'not-a-decimal' },
        }),
        createdAt: T0,
      }),
    );
    expect(['validation', 'invalid-pricing-model']).toContain(error.code);
  });
});
