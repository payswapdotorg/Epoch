// Usage-accounting positives: W010-shaped append-only events; seal/verify;
// deterministic fold (order independence, exact decimal totals); the
// marketplace:usage payload family; idempotent content addressing.
import { describe, expect, it } from 'vitest';
import {
  addNonNegativeDecimals,
  computeUsageEventDigest,
  foldUsageEvents,
  parseUsageEventData,
  parseUsageEventContent,

  verifySealedUsageEvent,
  usageStreamIdOf,
} from '../src/index';
import { BUYER, FIXTURE_USAGE_STREAM, sealedUsage, usageEvent } from './fixtures';

describe('usage event positives (W010 event shapes)', () => {
  it('a usage event content parses (W010 shape, marketplace:usage family)', () => {
    const parsed = parseUsageEventContent(usageEvent());
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.streamId).toBe(FIXTURE_USAGE_STREAM);
      expect(parsed.value.sequence).toBe(1);
    }
  });

  it('sealing content-addresses the event; identical content seals identically', () => {
    const first = sealedUsage(usageEvent());
    const second = sealedUsage(usageEvent());
    expect(second).toEqual(first);
    const content = parseUsageEventContent(usageEvent());
    expect(content.ok).toBe(true);
    if (content.ok) {
      expect(first.contentDigest).toBe(computeUsageEventDigest(content.value));
    }
    expect(verifySealedUsageEvent(first).ok).toBe(true);
  });

  it('the typed payload family parses from the generic event payload', () => {
    const content = parseUsageEventContent(usageEvent());
    expect(content.ok).toBe(true);
    if (content.ok) {
      const data = parseUsageEventData(content.value.payload);
      expect(data.ok).toBe(true);
      if (data.ok) {
        expect(data.value.units).toBe('2.5');
        expect(data.value.entitlementId).toBe('entitlement:grant-001');
      }
    }
  });

  it('causal parents chain within the entitlement stream', () => {
    const first = sealedUsage(usageEvent());
    const second = sealedUsage(
      usageEvent({
        sequence: 2,
        causalParent: { streamId: FIXTURE_USAGE_STREAM, sequence: 1 },
        payload: {
          discriminator: 'marketplace:usage',
          data: {
            entitlementId: 'entitlement:grant-001',
            listingId: 'listing:stress-suite',
            listingVersionDigest: '0'.repeat(64),
            units: '1.25',
            meteredAt: '2026-02-10T09:00:04.000Z',
          },
        },
        occurredAt: '2026-02-10T09:00:04.000Z',
      }),
    );
    expect(verifySealedUsageEvent(second).ok).toBe(true);
    expect(second.causalParent).toEqual({ streamId: FIXTURE_USAGE_STREAM, sequence: 1 });
    void first;
  });

  it('the usage stream id is derived deterministically from the entitlement id', () => {
    expect(usageStreamIdOf('entitlement:grant-001')).toBe('stream:usage-grant-001');
    expect(usageStreamIdOf('entitlement:grant-001')).toBe(FIXTURE_USAGE_STREAM);
  });
});

describe('deterministic usage fold', () => {
  function threeEvents() {
    const units = ['2.5', '1.25', '0.005'];
    return units.map((unitValue, index) =>
      sealedUsage(
        usageEvent({
          sequence: index + 1,
          causalParent:
            index === 0
              ? null
              : { streamId: FIXTURE_USAGE_STREAM, sequence: index },
          payload: {
            discriminator: 'marketplace:usage',
            data: {
              entitlementId: 'entitlement:grant-001',
              listingId: 'listing:stress-suite',
              listingVersionDigest: '0'.repeat(64),
              units: unitValue,
              meteredAt: `2026-02-10T09:00:0${index + 3}.000Z`,
            },
          },
          occurredAt: `2026-02-10T09:00:0${index + 3}.000Z`,
        }),
      ),
    );
  }

  it('folds exact decimal totals (3.755) with counts and instants', () => {
    const events = threeEvents();
    const account = foldUsageEvents(events, {
      entitlementId: 'entitlement:grant-001',
      tenantId: BUYER,
    });
    expect(account.ok, JSON.stringify(account)).toBe(true);
    if (account.ok) {
      expect(account.value.eventCount).toBe(3);
      expect(account.value.totalUnits).toBe('3.755');
      expect(account.value.firstEventAt).toBe('2026-02-10T09:00:03.000Z');
      expect(account.value.lastEventAt).toBe('2026-02-10T09:00:05.000Z');
      expect(account.value.eventDigests).toHaveLength(3);
    }
  });

  it('the fold is order-independent (no insertion-order leaks)', () => {
    const events = threeEvents();
    const forward = foldUsageEvents(events, {
      entitlementId: 'entitlement:grant-001',
      tenantId: BUYER,
    });
    const backward = foldUsageEvents([...events].reverse(), {
      entitlementId: 'entitlement:grant-001',
      tenantId: BUYER,
    });
    expect(forward.ok && backward.ok).toBe(true);
    if (forward.ok && backward.ok) {
      expect(backward.value).toEqual(forward.value);
    }
  });

  it('decimal addition is exact and canonical (trailing-zero trimming)', () => {
    expect(addNonNegativeDecimals('0', '0')).toBe('0');
    expect(addNonNegativeDecimals('2.5', '1.25')).toBe('3.75');
    expect(addNonNegativeDecimals('1.10', '2.90')).toBe('4');
    expect(addNonNegativeDecimals('0.005', '0.005')).toBe('0.01');
    expect(addNonNegativeDecimals('99999999999999999999', '1')).toBe('100000000000000000000');
  });
});
