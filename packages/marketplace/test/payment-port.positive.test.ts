// PaymentPort positives: checks and record-shaped outcomes ONLY; free →
// not-required; primed states → settled/refunded/declined; unpaid
// otherwise; deterministic, no clock reads.
import { describe, expect, it } from 'vitest';
import {
  InMemoryPaymentPort,
  parsePaymentCheckOutcome,
  parsePaymentCheckRequest,
} from '../src/index';
import { typedPaymentCheckRequest, BUYER, ZERO } from './fixtures';

describe('payment port positives (checks + record-shaped outcomes only)', () => {
  it('a free listing requires no payment (not-required)', () => {
    const port = new InMemoryPaymentPort('port:reference', '2026-02-10T09:00:03.000Z');
    const outcome = port.checkPayment({ ...typedPaymentCheckRequest(), pricing: { kind: 'free' } });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.result).toBe('not-required');
      expect(outcome.value.portId).toBe('port:reference');
    }
  });

  it('an unprimed paid listing reports unpaid', () => {
    const port = new InMemoryPaymentPort('port:reference');
    const outcome = port.checkPayment(typedPaymentCheckRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.result).toBe('unpaid');
    }
  });

  it('a primed settled payment reports settled with the port reference', () => {
    const port = new InMemoryPaymentPort('port:reference');
    port.settle({ listingVersionDigest: ZERO, tenantId: BUYER, portReference: 'ref-42' });
    const outcome = port.checkPayment(typedPaymentCheckRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.result).toBe('settled');
      expect(outcome.value.portReference).toBe('ref-42');
    }
  });

  it('primed refunded and declined states report their typed results', () => {
    const port = new InMemoryPaymentPort('port:reference');
    port.refund({ listingVersionDigest: ZERO, tenantId: BUYER, portReference: 'ref-42' });
    const refunded = port.checkPayment(typedPaymentCheckRequest());
    expect(refunded.ok).toBe(true);
    if (refunded.ok) {
      expect(refunded.value.result).toBe('refunded');
    }
    const declinedPort = new InMemoryPaymentPort('port:other');
    declinedPort.decline({ listingVersionDigest: ZERO, tenantId: BUYER, portReference: 'ref-43' });
    const outcome = declinedPort.checkPayment(typedPaymentCheckRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.result).toBe('declined');
    }
  });

  it('state is pinned to the exact (version digest, tenant) pair', () => {
    const port = new InMemoryPaymentPort('port:reference');
    port.settle({ listingVersionDigest: ZERO, tenantId: BUYER, portReference: 'ref-42' });
    const otherTenant = port.checkPayment({ ...typedPaymentCheckRequest(), tenantId: 'tenant:initech' });
    expect(otherTenant.ok).toBe(true);
    if (otherTenant.ok) {
      expect(otherTenant.value.result).toBe('unpaid');
    }
  });

  it('a free listing with primed state reports the primed state (record-first)', () => {
    const port = new InMemoryPaymentPort('port:reference');
    port.refund({ listingVersionDigest: ZERO, tenantId: BUYER, portReference: 'ref-42' });
    const outcome = port.checkPayment({ ...typedPaymentCheckRequest(), pricing: { kind: 'free' } });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.result).toBe('refunded');
    }
  });

  it('outcomes are deterministic (no clocks, no randomness)', () => {
    const port = new InMemoryPaymentPort('port:reference', '2026-02-10T09:00:03.000Z');
    port.settle({ listingVersionDigest: ZERO, tenantId: BUYER, portReference: 'ref-42' });
    const first = port.checkPayment(typedPaymentCheckRequest());
    const second = port.checkPayment(typedPaymentCheckRequest());
    expect(second).toEqual(first);
  });

  it('check requests and outcomes parse through the published validators', () => {
    const request = parsePaymentCheckRequest(typedPaymentCheckRequest());
    expect(request.ok).toBe(true);
    const port = new InMemoryPaymentPort('port:reference');
    port.settle({ listingVersionDigest: ZERO, tenantId: BUYER, portReference: 'ref-42' });
    const outcome = port.checkPayment(typedPaymentCheckRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      const parsed = parsePaymentCheckOutcome(outcome.value);
      expect(parsed.ok).toBe(true);
    }
  });

  it('the port count surface is deterministic', () => {
    const port = new InMemoryPaymentPort('port:reference');
    expect(port.size).toBe(0);
    port.settle({ listingVersionDigest: ZERO, tenantId: BUYER, portReference: 'r1' });
    port.decline({ listingVersionDigest: 'f'.repeat(64), tenantId: BUYER, portReference: 'r2' });
    expect(port.size).toBe(2);
  });
});
