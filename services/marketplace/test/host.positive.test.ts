// Host positives: the full happy path — listing lifecycle (draft ->
// submitted -> published; immutable chained versions), entitlement
// grant/check/revoke with immediate effect, usage intake + deterministic
// account, revenue records, payment sync, health/describe.
import { describe, expect, it } from 'vitest';
import { InMemoryPaymentPort } from '@epoch/marketplace';
import {
  BUYER,
  BUYER_PRINCIPAL,
  grantedEntitlement,
  hostWithRegistry,
  PRINCIPAL,
  publicDraft,
  publishedListing,
  T1,
  T2,
  T3,
  T4,
  VENDOR,
} from './fixtures';

describe('listing lifecycle (host)', () => {
  it('creates a draft, submits, and publishes the sealed immutable version', () => {
    const host = hostWithRegistry();
    const created = host.createListing({
      asTenant: VENDOR,
      idempotencyKey: 'list-a',
      draft: publicDraft(),
    });
    expect(created.ok ? 'ok' : JSON.stringify(created.error)).toBe('ok');
    if (!created.ok) return;
    expect(created.value.lifecycle).toBe('draft');
    expect(created.value.duplicate).toBe(false);

    const submitted = host.submitListing({ asTenant: VENDOR, listingId: created.value.listingId });
    expect(submitted.ok ? 'ok' : JSON.stringify(submitted.error)).toBe('ok');
    if (submitted.ok) {
      expect(submitted.value.lifecycle).toBe('submitted');
    }

    const published = host.publishListingVersion({
      asTenant: VENDOR,
      listingId: created.value.listingId,
      version: '1.0.0',
      publishedAt: T1,
    });
    expect(published.ok ? 'ok' : JSON.stringify(published.error)).toBe('ok');
    if (published.ok) {
      expect(published.value.contentDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(published.value.previousVersionDigest).toBeNull();
      expect(published.value.chainLength).toBe(1);
      expect(published.value.duplicate).toBe(false);
    }
  });

  it('publishes a second version: the chain grows, the first stays immutable', () => {
    const host = hostWithRegistry();
    const { listingId, receipt } = publishedListing(host);
    const second = host.publishListingVersion({
      asTenant: VENDOR,
      listingId,
      version: '1.1.0',
      publishedAt: T2,
    });
    expect(second.ok ? 'ok' : JSON.stringify(second.error)).toBe('ok');
    if (second.ok) {
      expect(second.value.previousVersionDigest).toBe(receipt.contentDigest);
      expect(second.value.chainLength).toBe(2);
    }
    const chain = host.verifyListingChain({ asTenant: VENDOR, listingId });
    expect(chain.ok).toBe(true);
    if (chain.ok) {
      expect(chain.value.versionCount).toBe(2);
      expect(chain.value.headVersion).toBe('1.1.0');
    }
    // The first version still verifies (immutable).
    const first = host.getListingVersion({ asTenant: VENDOR, listingId, version: '1.0.0' });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.value.contentDigest).toBe(receipt.contentDigest);
    }
  });

  it('the catalog lists public listings sorted by listingId', () => {
    const host = hostWithRegistry();
    publishedListing(host, { idempotencyKey: 'list-z', version: '1.0.0' });
    publishedListing(host, { idempotencyKey: 'list-a', version: '1.0.0' });
    const catalog = host.listListings({ asTenant: BUYER });
    expect(catalog).toHaveLength(2);
    expect(catalog[0]!.listingId < catalog[1]!.listingId).toBe(true);
    expect(catalog[0]!.lifecycle).toBe('published');
    expect(catalog[0]!.headVersion).toBe('1.0.0');
  });

  it('retiring a listing removes it from the catalog but keeps the chain', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host);
    const retired = host.retireListing({ asTenant: VENDOR, listingId });
    expect(retired.ok).toBe(true);
    if (retired.ok) {
      expect(retired.value.lifecycle).toBe('retired');
    }
    expect(host.listListings({ asTenant: BUYER })).toHaveLength(0);
    const chain = host.verifyListingChain({ asTenant: VENDOR, listingId });
    expect(chain.ok).toBe(true);
  });
});

describe('entitlement evaluation (host)', () => {
  it('grant -> check passes with the exact version digest', () => {
    const host = hostWithRegistry();
    const { listingId, receipt } = publishedListing(host);
    const granted = grantedEntitlement(host, listingId);
    expect(granted.entitlement.listingVersionDigest).toBe(receipt.contentDigest);
    const check = host.checkEntitlementHost({ asTenant: BUYER, listingId });
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.value.entitlement.entitlementId).toBe(granted.entitlement.entitlementId);
    }
  });

  it('usage intake meters units and the account folds deterministically', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host);
    const granted = grantedEntitlement(host, listingId);
    const first = host.recordUsage({
      asTenant: BUYER,
      entitlementId: granted.entitlement.entitlementId,
      idempotencyKey: 'usage-001',
      units: '2.5',
      unitName: 'simulation-run',
      meteredAt: T3,
      actor: BUYER_PRINCIPAL,
    });
    expect(first.ok ? 'ok' : JSON.stringify(first.error)).toBe('ok');
    if (first.ok) {
      expect(first.value.sequence).toBe(1);
      expect(first.value.streamId).toMatch(/^stream:usage-/);
    }
    const second = host.recordUsage({
      asTenant: BUYER,
      entitlementId: granted.entitlement.entitlementId,
      idempotencyKey: 'usage-002',
      units: '1.25',
      meteredAt: T4,
      actor: BUYER_PRINCIPAL,
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.sequence).toBe(2);
    }
    const account = host.usageAccountHost({
      asTenant: BUYER,
      entitlementId: granted.entitlement.entitlementId,
    });
    expect(account.ok ? 'ok' : JSON.stringify(account.error)).toBe('ok');
    if (account.ok) {
      expect(account.value.eventCount).toBe(2);
      expect(account.value.totalUnits).toBe('3.75');
    }
  });

  it('revenue records keep provenance and list deterministically', () => {
    const host = hostWithRegistry();
    const { listingId, receipt } = publishedListing(host);
    const granted = grantedEntitlement(host, listingId);
    const recorded = host.recordRevenue({
      asTenant: VENDOR,
      idempotencyKey: 'rev-001',
      acquiringTenantId: BUYER,
      listingId,
      listingVersionDigest: receipt.contentDigest,
      entitlementId: granted.entitlement.entitlementId,
      basis: 'one-time',
      amount: '199.00',
      currency: 'USD',
      recordedAt: T4,
      recordedBy: PRINCIPAL,
      provenance: { kind: 'entitlement', entitlementId: granted.entitlement.entitlementId },
    });
    expect(recorded.ok ? 'ok' : JSON.stringify(recorded.error)).toBe('ok');
    const ledger = host.listRevenue({ asTenant: VENDOR });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.amount).toBe('199.00');
    expect(ledger[0]!.provenance.kind).toBe('entitlement');
  });

  it('payment sync proposes a grant record with payment-sync provenance', () => {
    const host = hostWithRegistry();
    const { listingId, receipt } = publishedListing(host);
    const port = new InMemoryPaymentPort('port:reference');
    port.settle({ listingVersionDigest: receipt.contentDigest, tenantId: BUYER, portReference: 'ref-42' });
    expect(host.registerPaymentPort(port).ok).toBe(true);
    const synced = host.syncEntitlementFromPayment({
      asTenant: BUYER,
      idempotencyKey: 'sync-001',
      listingId,
      portId: 'port:reference',
      scope: { kind: 'tenant' },
      grantedAt: T2,
      grantedBy: PRINCIPAL,
    });
    expect(synced.ok ? 'ok' : JSON.stringify(synced.error)).toBe('ok');
    if (synced.ok) {
      expect(synced.value.entitlement.provenance.kind).toBe('payment-sync');
      const check = host.checkEntitlementHost({ asTenant: BUYER, listingId });
      expect(check.ok).toBe(true);
    }
  });

  it('a free listing syncs without any primed port state (not-required)', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host, { draft: publicDraft({ pricing: { kind: 'free' } }) });
    expect(host.registerPaymentPort(new InMemoryPaymentPort('port:free')).ok).toBe(true);
    const synced = host.syncEntitlementFromPayment({
      asTenant: BUYER,
      idempotencyKey: 'sync-free',
      listingId,
      portId: 'port:free',
      scope: { kind: 'tenant' },
      grantedAt: T2,
      grantedBy: PRINCIPAL,
    });
    expect(synced.ok ? 'ok' : JSON.stringify(synced.error)).toBe('ok');
  });

  it('health and describeService are typed data', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host);
    grantedEntitlement(host, listingId);
    const health = host.health();
    expect(health.service).toBe('epoch.marketplace-host');
    expect(health.status).toBe('ready');
    expect(health.listingCount).toBe(1);
    expect(health.listingsByLifecycle.published).toBe(1);
    expect(health.publishedVersionCount).toBe(1);
    expect(health.entitlementCount).toBe(1);
    expect(health.activeEntitlementCount).toBe(1);
    const described = host.describeService();
    expect(described.service).toBe('epoch.marketplace-host');
    expect(described.contractVersion).toBe('1.0.0');
    expect(described.invariants.length).toBeGreaterThan(0);
  });
});
