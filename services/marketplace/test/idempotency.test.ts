// Idempotency + replay coverage: listing creation, publication, grants,
// usage intake (duplicate suppression), revenue records — same key + same
// content returns the ORIGINAL receipt (duplicate: true); same key +
// different content is the typed idempotency-conflict.
import { describe, expect, it } from 'vitest';
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

describe('idempotent listing creation', () => {
  it('the same (key, draft) re-derives the same listing with duplicate: true', () => {
    const host = hostWithRegistry();
    const first = host.createListing({
      asTenant: VENDOR,
      idempotencyKey: 'list-idem',
      draft: publicDraft(),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = host.createListing({
      asTenant: VENDOR,
      idempotencyKey: 'list-idem',
      draft: publicDraft(),
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.listingId).toBe(first.value.listingId);
      expect(second.value.duplicate).toBe(true);
    }
  });

  it('the same key with a different draft is idempotency-conflict', () => {
    const host = hostWithRegistry();
    const first = host.createListing({
      asTenant: VENDOR,
      idempotencyKey: 'list-idem-conflict',
      draft: publicDraft(),
    });
    expect(first.ok).toBe(true);
    const second = host.createListing({
      asTenant: VENDOR,
      idempotencyKey: 'list-idem-conflict',
      draft: publicDraft({ displayName: 'A Different Suite' }),
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe('idempotency-conflict');
    }
  });
});

describe('idempotent publication (replay)', () => {
  it('replaying an identical publication returns the original receipt', () => {
    const host = hostWithRegistry();
    const { listingId, receipt } = publishedListing(host, {
      idempotencyKey: 'list-replay',
      version: '1.0.0',
      publishedAt: T1,
    });
    const replay = host.publishListingVersion({
      asTenant: VENDOR,
      listingId,
      version: '1.0.0',
      publishedAt: T1,
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.value.duplicate).toBe(true);
      expect(replay.value.contentDigest).toBe(receipt.contentDigest);
      expect(replay.value.chainLength).toBe(1);
    }
  });
});

describe('idempotent grants', () => {
  it('the same grant inputs return the original grant record', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host);
    const first = host.grantEntitlement({
      asTenant: BUYER,
      idempotencyKey: 'grant-idem',
      listingId,
      scope: { kind: 'tenant' },
      grantedAt: T2,
      grantedBy: PRINCIPAL,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = host.grantEntitlement({
      asTenant: BUYER,
      idempotencyKey: 'grant-idem',
      listingId,
      scope: { kind: 'tenant' },
      grantedAt: T2,
      grantedBy: PRINCIPAL,
    });
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.duplicate).toBe(true);
      expect(second.value.entitlement.entitlementId).toBe(first.value.entitlement.entitlementId);
    }
    // No duplicate record was stored.
    expect(host.health().entitlementCount).toBe(1);
  });

  it('the same key with different grant content is idempotency-conflict', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host);
    const first = host.grantEntitlement({
      asTenant: BUYER,
      idempotencyKey: 'grant-idem-x',
      listingId,
      scope: { kind: 'tenant' },
      grantedAt: T2,
      grantedBy: PRINCIPAL,
    });
    expect(first.ok).toBe(true);
    const second = host.grantEntitlement({
      asTenant: BUYER,
      idempotencyKey: 'grant-idem-x',
      listingId,
      scope: { kind: 'workspace', workspaceId: 'workspace:globex-eng' },
      grantedAt: T3,
      grantedBy: PRINCIPAL,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe('idempotency-conflict');
    }
  });
});

describe('idempotent usage intake (duplicate suppression)', () => {
  it('the same (key, event) returns the ORIGINAL receipt; no second event', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host);
    const granted = grantedEntitlement(host, listingId);
    const input = {
      asTenant: BUYER,
      entitlementId: granted.entitlement.entitlementId,
      idempotencyKey: 'usage-idem',
      units: '2.5',
      meteredAt: T3,
      actor: BUYER_PRINCIPAL,
    };
    const first = host.recordUsage(input);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = host.recordUsage(input);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.duplicate).toBe(true);
      expect(second.value.contentDigest).toBe(first.value.contentDigest);
      expect(second.value.sequence).toBe(first.value.sequence);
    }
    const account = host.usageAccountHost({
      asTenant: BUYER,
      entitlementId: granted.entitlement.entitlementId,
    });
    expect(account.ok).toBe(true);
    if (account.ok) {
      expect(account.value.eventCount).toBe(1);
      expect(account.value.totalUnits).toBe('2.5');
    }
  });

  it('the same key with different units is idempotency-conflict', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host);
    const granted = grantedEntitlement(host, listingId);
    const first = host.recordUsage({
      asTenant: BUYER,
      entitlementId: granted.entitlement.entitlementId,
      idempotencyKey: 'usage-conflict',
      units: '2.5',
      meteredAt: T3,
      actor: BUYER_PRINCIPAL,
    });
    expect(first.ok).toBe(true);
    const second = host.recordUsage({
      asTenant: BUYER,
      entitlementId: granted.entitlement.entitlementId,
      idempotencyKey: 'usage-conflict',
      units: '9.5',
      meteredAt: T3,
      actor: BUYER_PRINCIPAL,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe('idempotency-conflict');
    }
  });
});

describe('idempotent revenue intake', () => {
  it('the same revenue inputs return the original record', () => {
    const host = hostWithRegistry();
    const { listingId, receipt } = publishedListing(host);
    const input = {
      asTenant: VENDOR,
      idempotencyKey: 'rev-idem',
      acquiringTenantId: BUYER,
      listingId,
      listingVersionDigest: receipt.contentDigest,
      basis: 'one-time' as const,
      amount: '199.00',
      currency: 'USD',
      recordedAt: T4,
      recordedBy: PRINCIPAL,
      provenance: { kind: 'manual-entry' as const, reference: 'route:ledger-7' },
    };
    const first = host.recordRevenue(input);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = host.recordRevenue(input);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.duplicate).toBe(true);
    }
    expect(host.listRevenue({ asTenant: VENDOR })).toHaveLength(1);
  });
});
