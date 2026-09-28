// Determinism: canonical JSON key order never changes digests; equivalent
// derivations produce identical lines; decimal arithmetic is exact,
// commutative, and canonical (trailing-zero trimming); identical input
// sequences produce byte-identical records.
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  addNonNegativeDecimals,
  compareNonNegativeDecimals,
  deriveOneTimeLine,
  deriveSeatLine,
  multiplyNonNegativeDecimals,
  openInvoice,
  sealSeatAssignment,
  sealEntitlementsEvent,
  sealBillingAccount,
  subtractNonNegativeDecimalsClamped,
} from '../src/index';
import {
  ENTITLEMENT,
  ONE_TIME_PRICING,
  SEAT_PRICING,
  billingAccountContent,
  seatAssignmentContent,
  unwrap,
} from './fixtures';

describe('decimal arithmetic (determinism)', () => {
  it('addition is commutative and canonical', () => {
    expect(addNonNegativeDecimals('1.10', '2.5')).toBe('3.6');
    expect(addNonNegativeDecimals('2.5', '1.10')).toBe('3.6');
    expect(addNonNegativeDecimals('0', '0')).toBe('0');
    expect(addNonNegativeDecimals('0.1', '0.2')).toBe('0.3');
  });

  it('multiplication is exact and trims trailing zeros', () => {
    expect(multiplyNonNegativeDecimals('2500', '0.025')).toBe('62.5');
    expect(multiplyNonNegativeDecimals('118.5', '18.50')).toBe('2192.25');
    expect(multiplyNonNegativeDecimals('0.5', '0.5')).toBe('0.25');
    expect(multiplyNonNegativeDecimals('10', '0')).toBe('0');
    expect(multiplyNonNegativeDecimals('2', '2.500')).toBe('5');
    expect(multiplyNonNegativeDecimals('0.001', '0.001')).toBe('0.000001');
  });

  it('multiplication is commutative', () => {
    expect(multiplyNonNegativeDecimals('118.5', '18.50')).toBe(
      multiplyNonNegativeDecimals('18.50', '118.5'),
    );
  });

  it('clamped subtraction never goes below zero', () => {
    expect(subtractNonNegativeDecimalsClamped('3500', '1000')).toBe('2500');
    expect(subtractNonNegativeDecimalsClamped('900', '1000')).toBe('0');
    expect(subtractNonNegativeDecimalsClamped('1000', '1000')).toBe('0');
    expect(subtractNonNegativeDecimalsClamped('10.5', '0.5')).toBe('10');
  });

  it('comparison is exact', () => {
    expect(compareNonNegativeDecimals('1.10', '1.1')).toBe(0);
    expect(compareNonNegativeDecimals('2', '1.9')).toBe(1);
    expect(compareNonNegativeDecimals('0.001', '0.01')).toBe(-1);
  });
});

describe('sealed records (determinism)', () => {
  it('key order never changes the seat-assignment digest', () => {
    const content = seatAssignmentContent();
    const straight = unwrap(sealSeatAssignment(content));
    const reversed = unwrap(
      sealSeatAssignment(Object.fromEntries(Object.entries(content).reverse())),
    );
    expect(reversed.contentDigest).toBe(straight.contentDigest);
  });

  it('key order never changes the billing-account digest', () => {
    const content = billingAccountContent();
    const straight = unwrap(sealBillingAccount(content));
    const reversed = unwrap(
      sealBillingAccount(Object.fromEntries(Object.entries(content).reverse())),
    );
    expect(reversed.contentDigest).toBe(straight.contentDigest);
  });

  it('identical derivations produce identical lines', () => {
    const a = unwrap(
      deriveOneTimeLine({ pricing: ONE_TIME_PRICING, entitlementId: ENTITLEMENT, lineId: 'line:acquisition' }),
    );
    const b = unwrap(
      deriveOneTimeLine({ pricing: ONE_TIME_PRICING, entitlementId: ENTITLEMENT, lineId: 'line:acquisition' }),
    );
    expect(a).toEqual(b);
    expect(canonicalDigest(a as never)).toBe(canonicalDigest(b as never));
  });

  it('seat lines derive identically for identical counts', () => {
    const a = unwrap(
      deriveSeatLine({
        pricing: SEAT_PRICING,
        entitlementId: ENTITLEMENT,
        activeSeatCount: 3,
        lineId: 'line:seats-april',
      }),
    );
    const b = unwrap(
      deriveSeatLine({
        pricing: SEAT_PRICING,
        entitlementId: ENTITLEMENT,
        activeSeatCount: 3,
        lineId: 'line:seats-april',
      }),
    );
    expect(a).toEqual(b);
  });

  it('two runs of the same invoice admission produce byte-identical records', () => {
    const content = {
      schema: 'epoch.billing.invoice',
      schemaVersion: 1,
      invoiceId: 'invoice:globex-2026-04-001',
      tenantId: 'tenant:globex',
      accountId: 'billing-account:globex-eur',
      currency: 'EUR',
      lines: [
        {
          lineId: 'line:acquisition',
          basis: 'one-time',
          description: 'One-time acquisition',
          quantity: '1',
          unitAmount: '2400.00',
          amount: '2400.00',
          currency: 'EUR',
          entitlementId: ENTITLEMENT,
        },
      ],
      status: 'draft',
      createdAt: '2026-04-01T08:00:02.000Z',
      createdBy: 'principal:billing-admin',
    };
    const a = unwrap(openInvoice(content));
    const b = unwrap(openInvoice(content));
    expect(a).toEqual(b);
  });

  it('event sealing is a pure function of the canonical content', () => {
    const event = {
      schemaVersion: 1,
      streamId: 'stream:billing-globex-eur',
      sequence: 1,
      tenantId: 'tenant:globex',
      actor: 'principal:billing-admin',
      causalParent: null,
      payload: {
        discriminator: 'billing:account-opened',
        data: {
          accountId: 'billing-account:globex-eur',
          accountDigest: 'a'.repeat(64),
          currency: 'EUR',
          openedAt: '2026-04-01T08:00:00.000Z',
        },
      },
      occurredAt: '2026-04-01T08:00:00.000Z',
    };
    const a = unwrap(sealEntitlementsEvent(event));
    const reversed = unwrap(
      sealEntitlementsEvent({
        occurredAt: event.occurredAt,
        payload: {
          data: Object.fromEntries(Object.entries(event.payload.data).reverse()),
          discriminator: event.payload.discriminator,
        },
        causalParent: null,
        actor: event.actor,
        tenantId: event.tenantId,
        sequence: event.sequence,
        streamId: event.streamId,
        schemaVersion: event.schemaVersion,
      }),
    );
    expect(reversed.contentDigest).toBe(a.contentDigest);
  });
});
