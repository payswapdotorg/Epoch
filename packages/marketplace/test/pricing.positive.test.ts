// Pricing-model positives (acceptance: pricing models as typed data; the
// closed vocabulary round-trips through the validators).
import { describe, expect, it } from 'vitest';
import { parsePricingModel, PricingModelSchema } from '../src/index';
import { PRICING_SAMPLES } from './fixtures';

describe('pricing model positives (closed vocabulary)', () => {
  it.each(Object.keys(PRICING_SAMPLES))('kind "%s" round-trips', (kind) => {
    const parsed = parsePricingModel(PRICING_SAMPLES[kind]);
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.kind).toBe(kind);
      // The parsed value re-validates (idempotent admission).
      expect(PricingModelSchema.safeParse(parsed.value).success).toBe(true);
    }
  });

  it('the closed vocabulary has exactly the seven binding kinds', async () => {
    const { PRICING_MODEL_KINDS } = await import('../src/index');
    expect([...PRICING_MODEL_KINDS]).toEqual([
      'free',
      'one-time',
      'subscription',
      'seat-workspace',
      'usage-metered',
      'hybrid',
      'enterprise-private',
    ]);
  });

  it('per-model typed fields survive the round trip', () => {
    const one = parsePricingModel(PRICING_SAMPLES['one-time']!);
    expect(one.ok).toBe(true);
    if (one.ok && one.value.kind === 'one-time') {
      expect(one.value.amount).toBe('199.00');
      expect(one.value.currency).toBe('USD');
    }
    const sub = parsePricingModel(PRICING_SAMPLES.subscription!);
    expect(sub.ok).toBe(true);
    if (sub.ok && sub.value.kind === 'subscription') {
      expect(sub.value.recurringAmount).toBe('49.50');
      expect(sub.value.billingPeriod).toBe('monthly');
    }
    const seats = parsePricingModel(PRICING_SAMPLES['seat-workspace']!);
    expect(seats.ok).toBe(true);
    if (seats.ok && seats.value.kind === 'seat-workspace') {
      expect(seats.value.minSeats).toBe(1);
      expect(seats.value.maxSeats).toBe(500);
    }
    const metered = parsePricingModel(PRICING_SAMPLES['usage-metered']!);
    expect(metered.ok).toBe(true);
    if (metered.ok && metered.value.kind === 'usage-metered') {
      expect(metered.value.unitName).toBe('simulation-run');
    }
    const hybrid = parsePricingModel(PRICING_SAMPLES.hybrid!);
    expect(hybrid.ok).toBe(true);
    if (hybrid.ok && hybrid.value.kind === 'hybrid') {
      expect(hybrid.value.fixed.kind).toBe('subscription');
      expect(hybrid.value.metered.unitAmount).toBe('0.10');
    }
    const enterprise = parsePricingModel(PRICING_SAMPLES['enterprise-private']!);
    expect(enterprise.ok).toBe(true);
    if (enterprise.ok && enterprise.value.kind === 'enterprise-private') {
      expect(enterprise.value.audienceTenantIds).toEqual(['tenant:globex']);
    }
  });

  it('zero amounts are record-valid (pricing validation is shape, not monetization policy)', () => {
    const zero = parsePricingModel({ kind: 'one-time', amount: '0', currency: 'USD' });
    expect(zero.ok).toBe(true);
  });

  it('seat bounds equal at min === max are valid', () => {
    const seats = parsePricingModel({
      kind: 'seat-workspace',
      perSeatAmount: '10',
      currency: 'USD',
      billingPeriod: 'monthly',
      minSeats: 5,
      maxSeats: 5,
    });
    expect(seats.ok).toBe(true);
  });
});
