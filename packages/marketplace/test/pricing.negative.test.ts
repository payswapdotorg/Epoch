// Pricing-model NEGATIVES (named rejections with precise paths):
// invalid-pricing-model for unknown kinds and malformed per-model fields;
// vendor-fields-rejected for provider/vendor structural fields (blocklist).
import { describe, expect, it } from 'vitest';
import { parsePricingModel } from '../src/index';

describe('pricing model negatives', () => {
  it('an unknown pricing kind is rejected as invalid-pricing-model with a precise path', () => {
    const parsed = parsePricingModel({ kind: 'pay-what-you-want' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.code === 'invalid-pricing-model') {
      const issue = parsed.error.issues.find((candidate) => candidate.path.includes('kind'));
      expect(issue).toBeDefined();
    }
  });

  it('a missing kind is rejected as invalid-pricing-model', () => {
    const parsed = parsePricingModel({ amount: '10' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('invalid-pricing-model');
    }
  });

  it('a malformed one-time amount is rejected with the precise dotted path', () => {
    const parsed = parsePricingModel({ kind: 'one-time', amount: '-5.00', currency: 'USD' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.code === 'invalid-pricing-model') {
      expect(parsed.error.issues.some((issue) => issue.path === 'amount')).toBe(true);
    }
  });

  it('a malformed currency is rejected with the precise dotted path', () => {
    const parsed = parsePricingModel({ kind: 'subscription', recurringAmount: '10', currency: 'us-dollars', billingPeriod: 'monthly' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.code === 'invalid-pricing-model') {
      expect(parsed.error.issues.some((issue) => issue.path === 'currency')).toBe(true);
    }
  });

  it('a malformed billing period is rejected with the precise dotted path', () => {
    const parsed = parsePricingModel({ kind: 'subscription', recurringAmount: '10', currency: 'USD', billingPeriod: 'weekly' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.code === 'invalid-pricing-model') {
      expect(parsed.error.issues.some((issue) => issue.path === 'billingPeriod')).toBe(true);
    }
  });

  it('minSeats > maxSeats is rejected with the precise dotted path', () => {
    const parsed = parsePricingModel({
      kind: 'seat-workspace',
      perSeatAmount: '10',
      currency: 'USD',
      billingPeriod: 'monthly',
      minSeats: 10,
      maxSeats: 2,
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.code === 'invalid-pricing-model') {
      expect(parsed.error.issues.some((issue) => issue.path === 'minSeats')).toBe(true);
    }
  });

  it('hybrid rejects a metered component in the fixed slot with a precise path', () => {
    const parsed = parsePricingModel({
      kind: 'hybrid',
      fixed: { kind: 'usage-metered', unitAmount: '1', currency: 'USD', unitName: 'x' },
      metered: { kind: 'usage-metered', unitAmount: '1', currency: 'USD', unitName: 'y' },
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('invalid-pricing-model');
    }
  });

  it('enterprise-private rejects unsorted audiences (deterministic serialization)', () => {
    const parsed = parsePricingModel({
      kind: 'enterprise-private',
      contactRoute: 'route:desk',
      audienceTenantIds: ['tenant:zeta', 'tenant:alpha'],
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok && parsed.error.code === 'invalid-pricing-model') {
      expect(parsed.error.issues.some((issue) => issue.path === 'audienceTenantIds')).toBe(true);
    }
  });

  it('NAMED NEGATIVE: vendor/provider fields are rejected (blocklist)', () => {
    // A provider-specific payment token attempts to ride along on a
    // one-time pricing model: strict objects reject it with the typed
    // vendor-fields-rejected error.
    const parsed = parsePricingModel({
      kind: 'one-time',
      amount: '10',
      currency: 'USD',
      brand: 'not-a-real-brand',
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('vendor-fields-rejected');
    }
  });
});
