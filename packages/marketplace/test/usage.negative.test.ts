// Usage-accounting NEGATIVES: tampered digests; wrong payload family; mixed
// folds (cross-tenant, mixed entitlements); malformed records; vendor
// fields.
import { describe, expect, it } from 'vitest';
import {
  foldUsageEvents,
  parseUsageEventData,
  parseUsageEventContent,
  sealUsageEvent,
  verifySealedUsageEvent,
} from '../src/index';
import { BUYER, FIXTURE_USAGE_STREAM, OTHER_TENANT, sealedUsage, usageEvent } from './fixtures';

describe('usage event negatives', () => {
  it('NAMED NEGATIVE: tampered usage event digest is rejected (digest-mismatch)', () => {
    const sealed = sealedUsage(usageEvent());
    const tampered = { ...sealed, contentDigest: 'e'.repeat(64) };
    const verified = verifySealedUsageEvent(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('NAMED NEGATIVE: vendor/provider fields on usage events are rejected', () => {
    const sealed = sealUsageEvent({ ...usageEvent(), meterBrand: 'not-a-real-brand' });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('vendor-fields-rejected');
    }
  });

  it('a non-usage payload family does not parse as usage data', () => {
    const content = parseUsageEventContent(
      usageEvent({
        payload: { discriminator: 'acme:other-note', data: { note: 'hi' } },
      }),
    );
    expect(content.ok).toBe(true);
    if (content.ok) {
      const data = parseUsageEventData(content.value.payload);
      expect(data.ok).toBe(false);
      if (!data.ok) {
        expect(data.error.code).toBe('validation');
      }
    }
  });

  it('malformed units are rejected with a precise path', () => {
    const content = parseUsageEventContent(
      usageEvent({
        payload: {
          discriminator: 'marketplace:usage',
          data: {
            entitlementId: 'entitlement:grant-001',
            listingId: 'listing:stress-suite',
            listingVersionDigest: '0'.repeat(64),
            units: '2,5',
            meteredAt: '2026-02-10T09:00:03.000Z',
          },
        },
      }),
    );
    expect(content.ok).toBe(true);
    if (content.ok) {
      const data = parseUsageEventData(content.value.payload);
      expect(data.ok).toBe(false);
      if (!data.ok && data.error.code === 'validation') {
        expect(data.error.issues.some((issue) => issue.path === 'units')).toBe(true);
      }
    }
  });

  it('NAMED NEGATIVE: cross-tenant fold input is rejected (cross-tenant-denied)', () => {
    const foreign = sealedUsage(usageEvent({ tenantId: OTHER_TENANT }));
    const account = foldUsageEvents([foreign], {
      entitlementId: 'entitlement:grant-001',
      tenantId: BUYER,
    });
    expect(account.ok).toBe(false);
    if (!account.ok && account.error.code === 'cross-tenant-denied') {
      expect(account.error.expectedTenantId).toBe(BUYER);
      expect(account.error.encounteredTenantId).toBe(OTHER_TENANT);
    }
  });

  it('fold input mixing entitlements is rejected', () => {
    const a = sealedUsage(usageEvent());
    const b = sealedUsage(
      usageEvent({
        sequence: 2,
        payload: {
          discriminator: 'marketplace:usage',
          data: {
            entitlementId: 'entitlement:grant-999',
            listingId: 'listing:stress-suite',
            listingVersionDigest: '0'.repeat(64),
            units: '1',
            meteredAt: '2026-02-10T09:00:04.000Z',
          },
        },
      }),
    );
    const account = foldUsageEvents([a, b], {
      entitlementId: 'entitlement:grant-001',
      tenantId: BUYER,
    });
    expect(account.ok).toBe(false);
    if (!account.ok) {
      expect(account.error.code).toBe('validation');
    }
  });

  it('fold input mixing listing versions is rejected', () => {
    const a = sealedUsage(usageEvent());
    const b = sealedUsage(
      usageEvent({
        sequence: 2,
        causalParent: { streamId: FIXTURE_USAGE_STREAM, sequence: 1 },
        payload: {
          discriminator: 'marketplace:usage',
          data: {
            entitlementId: 'entitlement:grant-001',
            listingId: 'listing:stress-suite',
            listingVersionDigest: 'f'.repeat(64),
            units: '1',
            meteredAt: '2026-02-10T09:00:04.000Z',
          },
        },
        occurredAt: '2026-02-10T09:00:04.000Z',
      }),
    );
    const account = foldUsageEvents([a, b], {
      entitlementId: 'entitlement:grant-001',
      tenantId: BUYER,
    });
    expect(account.ok).toBe(false);
    if (!account.ok) {
      expect(account.error.code).toBe('validation');
    }
  });

  it('folding zero events is a typed unknown-entitlement rejection', () => {
    const account = foldUsageEvents([], {
      entitlementId: 'entitlement:grant-001',
      tenantId: BUYER,
    });
    expect(account.ok).toBe(false);
    if (!account.ok) {
      expect(account.error.code).toBe('unknown-entitlement');
    }
  });

  it('a malformed stream id grammar is rejected', () => {
    const sealed = sealUsageEvent({ ...usageEvent(), streamId: 'stream:BAD SLUG' });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
    }
  });

  it('schemaVersion skew reports at the schemaVersion path first', () => {
    const sealed = sealUsageEvent({ ...usageEvent(), schemaVersion: 3 });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok && sealed.error.code === 'validation') {
      expect(sealed.error.issues[0]?.path).toBe('schemaVersion');
    }
  });
});
