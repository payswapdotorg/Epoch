// PaymentPort NEGATIVES: malformed requests (typed validation); vendor
// fields rejected; a free-with-primed-state edge stays record-first.
import { describe, expect, it } from 'vitest';
import { InMemoryPaymentPort, parsePaymentCheckRequest } from '../src/index';
import { typedPaymentCheckRequest, paymentCheckRequest, BUYER, ZERO } from './fixtures';

describe('payment port negatives', () => {
  it('a malformed check request is a typed validation rejection', () => {
    const port = new InMemoryPaymentPort('port:reference');
    const outcome = port.checkPayment({
      ...typedPaymentCheckRequest(),
      listingId: 'listing:BAD SLUG',
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('validation');
    }
  });

  it('NAMED NEGATIVE: vendor/provider fields on check requests are rejected', () => {
    const parsed = parsePaymentCheckRequest({
      ...paymentCheckRequest(),
      gatewayBrand: 'not-a-real-brand',
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('vendor-fields-rejected');
    }
  });

  it('an invalid pricing model inside a check request is rejected as invalid-pricing-model', () => {
    const parsed = parsePaymentCheckRequest({
      ...paymentCheckRequest(),
      pricing: { kind: 'barter' },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('invalid-pricing-model');
    }
  });

  it('the port never grants or revokes: its outcome carries no entitlement fields', () => {
    const port = new InMemoryPaymentPort('port:reference');
    port.settle({ listingVersionDigest: ZERO, tenantId: BUYER, portReference: 'ref-42' });
    const outcome = port.checkPayment(typedPaymentCheckRequest());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      const keys = Object.keys(outcome.value).sort();
      expect(keys).toEqual(['checkedAt', 'portId', 'portReference', 'result']);
    }
  });
});
