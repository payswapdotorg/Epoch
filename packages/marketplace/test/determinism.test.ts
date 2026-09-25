// Determinism: canonical JSON key order never changes digests; equivalent
// fixtures serialize identically; decimal totals are order-independent.
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  computeListingVersionDigest,
  parseListingVersionContent,
  sealListingVersion,
  foldUsageEvents,
  addNonNegativeDecimals,
} from '../src/index';
import { BUYER, listingContent, sealedUsage, usageEvent } from './fixtures';

describe('marketplace determinism', () => {
  it('key order never changes the listing version digest', () => {
    const straight = parseListingVersionContent(listingContent());
    const shuffled = parseListingVersionContent({
      publishedAt: '2026-02-10T09:00:01.000Z',
      previousVersionDigest: null,
      privateAllowList: [],
      visibility: 'public',
      trustEvidence: listingContent().trustEvidence,
      pricing: listingContent().pricing,
      capabilityReferences: listingContent().capabilityReferences,
      description: listingContent().description,
      displayName: 'Stress Analysis Suite',
      developerTenantId: 'tenant:acme-tools',
      version: '1.0.0',
      listingId: 'listing:stress-suite',
      schemaVersion: 1,
      schema: 'epoch.marketplace.listing-version',
    });
    expect(straight.ok && shuffled.ok).toBe(true);
    if (straight.ok && shuffled.ok) {
      expect(computeListingVersionDigest(shuffled.value)).toBe(computeListingVersionDigest(straight.value));
    }
  });

  it('sealing is a pure function of the canonical content', () => {
    const base = listingContent();
    const a = sealListingVersion(base);
    // Reverse the top-level key order: canonical JSON makes it irrelevant.
    const reversedKeys = Object.fromEntries(
      Object.entries(base as Record<string, unknown>).reverse(),
    );
    const b = sealListingVersion(reversedKeys);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(b.value.contentDigest).toBe(a.value.contentDigest);
    }
  });

  it('decimal addition is commutative (fold totals never depend on order)', () => {
    expect(addNonNegativeDecimals('0.1', '0.2')).toBe(addNonNegativeDecimals('0.2', '0.1'));
    expect(addNonNegativeDecimals('0.1', '0.2')).toBe('0.3');
  });

  it('usage fold totals are independent of event order', () => {
    const build = (units: string, sequence: number) =>
      sealedUsage(
        usageEvent({
          sequence,
          payload: {
            discriminator: 'marketplace:usage',
            data: {
              entitlementId: 'entitlement:grant-001',
              listingId: 'listing:stress-suite',
              listingVersionDigest: '0'.repeat(64),
              units,
              meteredAt: '2026-02-10T09:00:03.000Z',
            },
          },
        }),
      );
    const events = [build('0.1', 1), build('0.2', 2), build('0.3', 3)];
    const reversed = [...events].reverse();
    const forward = foldUsageEvents(events, { entitlementId: 'entitlement:grant-001', tenantId: BUYER });
    const backward = foldUsageEvents(reversed, { entitlementId: 'entitlement:grant-001', tenantId: BUYER });
    expect(forward.ok && backward.ok).toBe(true);
    if (forward.ok && backward.ok) {
      expect(backward.value.totalUnits).toBe(forward.value.totalUnits);
      expect(backward.value.totalUnits).toBe('0.6');
    }
  });

  it('canonical digest machinery is the shared agent-protocol discipline', () => {
    // Same canonical JSON rules as every kernel: sorted keys, no whitespace.
    expect(canonicalDigest({ b: 1, a: 2 })).toBe(canonicalDigest({ a: 2, b: 1 }));
    expect(canonicalDigest({ b: 1, a: 2 })).not.toBe(canonicalDigest({ a: 2, b: 2 }));
  });
});
