// Host NEGATIVES (named rejections): cross-tenant denied across every op;
// unknown listing references (including private out-of-audience); version-
// not-published; lifecycle-conflict; version-conflict (mutation of a
// published version); dangling capability references; invalid pricing;
// payment-port-unavailable; unknown-entitlement.
import { describe, expect, it } from 'vitest';
import { InMemoryPaymentPort } from '@epoch/marketplace';
import {
  BUYER,
  grantedEntitlement,
  hostWithRegistry,
  OTHER_TENANT,
  PRINCIPAL,
  publicDraft,
  publishedListing,
  T1,
  T2,
  T3,
  VENDOR,
} from './fixtures';

describe('tenant isolation (R12) — every op is tenant-scoped', () => {
  it('NAMED NEGATIVE: another tenant cannot submit/publish/retire a listing (cross-tenant-denied)', () => {
    const host = hostWithRegistry();
    const created = host.createListing({
      asTenant: VENDOR,
      idempotencyKey: 'list-a',
      draft: publicDraft(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const listingId = created.value.listingId;
    const submitted = host.submitListing({ asTenant: OTHER_TENANT, listingId });
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      expect(submitted.error.code).toBe('cross-tenant-denied');
    }
    const published = host.publishListingVersion({
      asTenant: OTHER_TENANT,
      listingId,
      version: '1.0.0',
      publishedAt: T1,
    });
    expect(published.ok).toBe(false);
    if (!published.ok) {
      expect(published.error.code).toBe('cross-tenant-denied');
    }
  });

  it('NAMED NEGATIVE: another tenant cannot revoke or meter a foreign entitlement', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host);
    const granted = grantedEntitlement(host, listingId);
    const revoked = host.revokeEntitlement({
      asTenant: OTHER_TENANT,
      entitlementId: granted.entitlement.entitlementId,
      revokedAt: T3,
      revokedBy: PRINCIPAL,
    });
    expect(revoked.ok).toBe(false);
    if (!revoked.ok) {
      expect(revoked.error.code).toBe('cross-tenant-denied');
    }
    const usage = host.recordUsage({
      asTenant: OTHER_TENANT,
      entitlementId: granted.entitlement.entitlementId,
      idempotencyKey: 'usage-foreign',
      units: '1',
      meteredAt: T3,
      actor: PRINCIPAL,
    });
    expect(usage.ok).toBe(false);
    if (!usage.ok) {
      expect(usage.error.code).toBe('cross-tenant-denied');
    }
  });

  it('NAMED NEGATIVE: another tenant cannot record revenue against a foreign developer listing', () => {
    const host = hostWithRegistry();
    const { listingId, receipt } = publishedListing(host);
    const recorded = host.recordRevenue({
      asTenant: OTHER_TENANT,
      idempotencyKey: 'rev-foreign',
      acquiringTenantId: BUYER,
      listingId,
      listingVersionDigest: receipt.contentDigest,
      basis: 'one-time',
      amount: '1.00',
      currency: 'USD',
      recordedAt: T3,
      recordedBy: PRINCIPAL,
      provenance: { kind: 'manual-entry', reference: 'route:x' },
    });
    expect(recorded.ok).toBe(false);
    if (!recorded.ok) {
      expect(recorded.error.code).toBe('cross-tenant-denied');
    }
  });

  it('private listings are INVISIBLE to out-of-audience tenants (existence not disclosed)', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host, {
      draft: publicDraft({
        visibility: 'private',
        privateAllowList: [BUYER],
        pricing: {
          kind: 'enterprise-private',
          contactRoute: 'route:acme-enterprise-desk',
          audienceTenantIds: [BUYER],
        },
      }),
    });
    // The buyer (on the allow-list) sees it; the vendor sees it.
    expect(host.getListing({ asTenant: BUYER, listingId }).ok).toBe(true);
    expect(host.getListing({ asTenant: VENDOR, listingId }).ok).toBe(true);
    // An out-of-audience tenant gets unknown-listing-reference (privacy).
    const invisible = host.getListing({ asTenant: OTHER_TENANT, listingId });
    expect(invisible.ok).toBe(false);
    if (!invisible.ok) {
      expect(invisible.error.code).toBe('unknown-listing-reference');
    }
    expect(host.listListings({ asTenant: OTHER_TENANT })).toHaveLength(0);
    expect(host.listListings({ asTenant: BUYER })).toHaveLength(1);
  });
});

describe('listing admission negatives', () => {
  it('NAMED NEGATIVE: a dangling capability reference is rejected at publication', () => {
    const host = hostWithRegistry();
    const created = host.createListing({
      asTenant: VENDOR,
      idempotencyKey: 'list-dangling',
      draft: publicDraft({
        capabilityReferences: [{ capabilityId: 'engineering.stress-analysis', version: '9.9.9' }],
      }),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const submitted = host.submitListing({ asTenant: VENDOR, listingId: created.value.listingId });
    expect(submitted.ok).toBe(true);
    const published = host.publishListingVersion({
      asTenant: VENDOR,
      listingId: created.value.listingId,
      version: '1.0.0',
      publishedAt: T1,
    });
    expect(published.ok).toBe(false);
    if (!published.ok) {
      expect(published.error.code).toBe('unknown-capability-reference');
    }
  });

  it('NAMED NEGATIVE: an invalid pricing model is rejected at draft admission', () => {
    const host = hostWithRegistry();
    const created = host.createListing({
      asTenant: VENDOR,
      idempotencyKey: 'list-bad-pricing',
      draft: publicDraft({ pricing: { kind: 'freemium-tiers' } as never }),
    });
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error.code).toBe('invalid-pricing-model');
    }
  });

  it('NAMED NEGATIVE: vendor fields in the draft are rejected', () => {
    const host = hostWithRegistry();
    const created = host.createListing({
      asTenant: VENDOR,
      idempotencyKey: 'list-vendor-fields',
      draft: { ...publicDraft(), portal: 'not-a-real-brand' } as never,
    });
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error.code).toBe('vendor-fields-rejected');
    }
  });

  it('publishing from draft state is a typed lifecycle-conflict', () => {
    const host = hostWithRegistry();
    const created = host.createListing({
      asTenant: VENDOR,
      idempotencyKey: 'list-skip',
      draft: publicDraft(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const published = host.publishListingVersion({
      asTenant: VENDOR,
      listingId: created.value.listingId,
      version: '1.0.0',
      publishedAt: T1,
    });
    expect(published.ok).toBe(false);
    if (!published.ok) {
      expect(published.error.code).toBe('lifecycle-conflict');
    }
  });

  it('NAMED NEGATIVE: publishing the same version with different content is version-conflict', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host, { publishedAt: T1 });
    // Replay the IDENTICAL publication (same version, same instant, same
    // draft): idempotent duplicate, not a conflict.
    const replay = host.publishListingVersion({
      asTenant: VENDOR,
      listingId,
      version: '1.0.0',
      publishedAt: T1,
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.value.duplicate).toBe(true);
    }
    // Now mutate the draft and re-publish the SAME version: conflict.
    const updated = host.updateDraft({
      asTenant: VENDOR,
      listingId,
      draft: publicDraft({ displayName: 'Renamed Suite' }),
    });
    expect(updated.ok).toBe(true);
    const mutated = host.publishListingVersion({
      asTenant: VENDOR,
      listingId,
      version: '1.0.0',
      publishedAt: T2,
    });
    expect(mutated.ok).toBe(false);
    if (!mutated.ok) {
      expect(mutated.error.code).toBe('version-conflict');
    }
  });

  it('publishing a version below the head is version-conflict', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host, { version: '2.0.0' });
    const published = host.publishListingVersion({
      asTenant: VENDOR,
      listingId,
      version: '1.9.0',
      publishedAt: T2,
    });
    expect(published.ok).toBe(false);
    if (!published.ok) {
      expect(published.error.code).toBe('version-conflict');
    }
  });

  it('an unknown listing reference is typed', () => {
    const host = hostWithRegistry();
    const result = host.getListing({ asTenant: VENDOR, listingId: 'listing:nope' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unknown-listing-reference');
    }
  });

  it('a missing version pin is a typed validation rejection', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host);
    const result = host.getListingVersion({ asTenant: VENDOR, listingId });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
    }
  });
});

describe('entitlement + payment negatives', () => {
  it('NAMED NEGATIVE: payment-port-unavailable when no port is registered', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host);
    const check = host.checkPaymentHost({
      asTenant: BUYER,
      listingId,
      portId: 'port:missing',
    });
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.error.code).toBe('payment-port-unavailable');
    }
    const synced = host.syncEntitlementFromPayment({
      asTenant: BUYER,
      idempotencyKey: 'sync-noport',
      listingId,
      portId: 'port:missing',
      scope: { kind: 'tenant' },
      grantedAt: T2,
      grantedBy: PRINCIPAL,
    });
    expect(synced.ok).toBe(false);
    if (!synced.ok) {
      expect(synced.error.code).toBe('payment-port-unavailable');
    }
  });

  it('granting against an unpublished listing is version-not-published', () => {
    const host = hostWithRegistry();
    const created = host.createListing({
      asTenant: VENDOR,
      idempotencyKey: 'list-unpub',
      draft: publicDraft(),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const granted = host.grantEntitlement({
      asTenant: BUYER,
      idempotencyKey: 'grant-unpub',
      listingId: created.value.listingId,
      scope: { kind: 'tenant' },
      grantedAt: T2,
      grantedBy: PRINCIPAL,
    });
    expect(granted.ok).toBe(false);
    if (!granted.ok) {
      expect(granted.error.code).toBe('version-not-published');
    }
  });

  it('granting against a foreign digest is version-not-published', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host);
    const granted = host.grantEntitlement({
      asTenant: BUYER,
      idempotencyKey: 'grant-foreign-digest',
      listingId,
      listingVersionDigest: 'f'.repeat(64),
      scope: { kind: 'tenant' },
      grantedAt: T2,
      grantedBy: PRINCIPAL,
    });
    expect(granted.ok).toBe(false);
    if (!granted.ok) {
      expect(granted.error.code).toBe('version-not-published');
    }
  });

  it('revoking an unknown entitlement is unknown-entitlement', () => {
    const host = hostWithRegistry();
    const revoked = host.revokeEntitlement({
      asTenant: BUYER,
      entitlementId: 'entitlement:nope',
      revokedAt: T3,
      revokedBy: PRINCIPAL,
    });
    expect(revoked.ok).toBe(false);
    if (!revoked.ok) {
      expect(revoked.error.code).toBe('unknown-entitlement');
    }
  });

  it('metering an unknown entitlement is unknown-entitlement', () => {
    const host = hostWithRegistry();
    const usage = host.recordUsage({
      asTenant: BUYER,
      entitlementId: 'entitlement:nope',
      idempotencyKey: 'usage-nope',
      units: '1',
      meteredAt: T3,
      actor: PRINCIPAL,
    });
    expect(usage.ok).toBe(false);
    if (!usage.ok) {
      expect(usage.error.code).toBe('unknown-entitlement');
    }
  });

  it('NAMED NEGATIVE: an unpaid port outcome never grants (entitlement-denied)', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host);
    expect(host.registerPaymentPort(new InMemoryPaymentPort('port:unpaid')).ok).toBe(true);
    const synced = host.syncEntitlementFromPayment({
      asTenant: BUYER,
      idempotencyKey: 'sync-unpaid',
      listingId,
      portId: 'port:unpaid',
      scope: { kind: 'tenant' },
      grantedAt: T2,
      grantedBy: PRINCIPAL,
    });
    expect(synced.ok).toBe(false);
    if (!synced.ok) {
      expect(synced.error.code).toBe('entitlement-denied');
      expect(synced.error.message).toContain('never authorizes');
    }
    // And the check still denies (no grant record was created).
    const check = host.checkEntitlementHost({ asTenant: BUYER, listingId });
    expect(check.ok).toBe(false);
  });
});
