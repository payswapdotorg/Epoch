// Determinism: identical inputs produce identical derived ids and digests;
// equal hosts produce equal snapshots; health is a pure projection.
import { describe, expect, it } from 'vitest';
import {
  BUYER,
  grantedEntitlement,
  hostWithRegistry,
  PRINCIPAL,
  publicDraft,
  publishedListing,
  T1,
  T2,
  VENDOR,
} from './fixtures';

describe('host determinism', () => {
  it('two hosts given identical inputs derive identical listing ids and digests', () => {
    const runOne = () => {
      const host = hostWithRegistry();
      const { listingId, receipt } = publishedListing(host, {
        idempotencyKey: 'list-det',
        version: '1.0.0',
        publishedAt: T1,
      });
      const granted = grantedEntitlement(host, listingId, {
        idempotencyKey: 'grant-det',
        grantedAt: T2,
      });
      return {
        listingId,
        digest: receipt.contentDigest,
        entitlementId: granted.entitlement.entitlementId,
        catalog: host.listListings({ asTenant: BUYER }),
      };
    };
    const first = runOne();
    const second = runOne();
    expect(second.listingId).toBe(first.listingId);
    expect(second.digest).toBe(first.digest);
    expect(second.entitlementId).toBe(first.entitlementId);
    expect(second.catalog).toEqual(first.catalog);
  });

  it('listing ids derive from (key, tenant): different keys, different ids', () => {
    const host = hostWithRegistry();
    const a = host.createListing({ asTenant: VENDOR, idempotencyKey: 'key-a', draft: publicDraft() });
    const b = host.createListing({ asTenant: VENDOR, idempotencyKey: 'key-b', draft: publicDraft() });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value.listingId).not.toBe(b.value.listingId);
    }
  });

  it('health is a pure projection of state (no clock reads)', () => {
    const host = hostWithRegistry();
    publishedListing(host);
    const first = host.health();
    const second = host.health();
    expect(second).toEqual(first);
  });

  it('usage streams derive deterministically from entitlement ids', () => {
    const host = hostWithRegistry();
    const { listingId } = publishedListing(host);
    const granted = grantedEntitlement(host, listingId);
    const usage = host.recordUsage({
      asTenant: BUYER,
      entitlementId: granted.entitlement.entitlementId,
      idempotencyKey: 'usage-det',
      units: '1',
      meteredAt: T2,
      actor: PRINCIPAL,
    });
    expect(usage.ok).toBe(true);
    if (usage.ok) {
      expect(usage.value.streamId).toBe(
        `stream:usage-${granted.entitlement.entitlementId.slice('entitlement:'.length)}`,
      );
    }
  });
});
