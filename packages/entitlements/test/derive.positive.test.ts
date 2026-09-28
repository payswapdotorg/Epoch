// Positive coverage of billable-line derivation: the four W023 pricing
// components, usage allowance arithmetic, W036 validated actuals (cost
// and quantity measures), the hybrid classifier, and exact decimal sums.
import { describe, expect, it } from 'vitest';
import {
  classifyPricingForBilling,
  deriveDeliveryActualLines,
  deriveOneTimeLine,
  deriveSeatLine,
  deriveSubscriptionLine,
  deriveUsageLine,
  sumLineAmounts,
} from '../src/index';
import {
  ENTITLEMENT,
  ONE_TIME_PRICING,
  SEAT_PRICING,
  SUBSCRIPTION_PRICING,
  TENANT,
  T0,
  T1,
  USAGE_PRICING,
  deliveredActual,
  deliveredCostActual,
  unwrap,
  usageAccount,
} from './fixtures';

describe('pricing derivations (positive)', () => {
  it('derives the one-time acquisition line (quantity 1)', () => {
    const line = unwrap(
      deriveOneTimeLine({
        pricing: ONE_TIME_PRICING,
        entitlementId: ENTITLEMENT,
        lineId: 'line:acquisition',
      }),
    );
    expect(line.basis).toBe('one-time');
    expect(line.quantity).toBe('1');
    expect(line.unitAmount).toBe('2400.00');
    expect(line.amount).toBe('2400.00');
    expect(line.currency).toBe('EUR');
  });

  it('derives the subscription line with period bounds', () => {
    const line = unwrap(
      deriveSubscriptionLine({
        pricing: SUBSCRIPTION_PRICING,
        entitlementId: ENTITLEMENT,
        periodStart: T0,
        periodEnd: T1,
        lineId: 'line:subscription-april',
      }),
    );
    expect(line.basis).toBe('subscription');
    expect(line.amount).toBe('99.50');
    expect(line.periodStart).toBe(T0);
    expect(line.periodEnd).toBe(T1);
  });

  it('derives the seat line: active seats x per-seat amount', () => {
    const line = unwrap(
      deriveSeatLine({
        pricing: SEAT_PRICING,
        entitlementId: ENTITLEMENT,
        activeSeatCount: 2,
        lineId: 'line:seats-april',
      }),
    );
    expect(line.quantity).toBe('2');
    expect(line.unitAmount).toBe('30');
    expect(line.amount).toBe('60');
  });

  it('a zero-seat line is legitimate record-keeping (amount 0)', () => {
    const line = unwrap(
      deriveSeatLine({
        pricing: SEAT_PRICING,
        entitlementId: ENTITLEMENT,
        activeSeatCount: 0,
        lineId: 'line:seats-april',
      }),
    );
    expect(line.quantity).toBe('0');
    expect(line.amount).toBe('0');
  });

  it('derives the usage line: (total - included) x unit amount', () => {
    const line = unwrap(
      deriveUsageLine({
        pricing: USAGE_PRICING,
        account: usageAccount(),
        lineId: 'line:usage-april',
      }),
    );
    expect(line.quantity).toBe('2500');
    expect(line.unitAmount).toBe('0.025');
    expect(line.amount).toBe('62.5');
    expect(line.usageEventDigests).toEqual(usageAccount().eventDigests);
    expect(line.entitlementId).toBe(ENTITLEMENT);
    expect(line.listingId).toBe('listing:stress-suite');
  });

  it('usage inside the included allowance bills an exact zero line', () => {
    const line = unwrap(
      deriveUsageLine({
        pricing: USAGE_PRICING,
        account: usageAccount({ totalUnits: '900' }),
        lineId: 'line:usage-april',
      }),
    );
    expect(line.quantity).toBe('0');
    expect(line.amount).toBe('0');
  });

  it('usage without an included allowance bills every unit', () => {
    const line = unwrap(
      deriveUsageLine({
        pricing: { ...USAGE_PRICING, includedUnits: undefined },
        account: usageAccount(),
        lineId: 'line:usage-april',
      }),
    );
    expect(line.quantity).toBe('3500');
    expect(line.amount).toBe('87.5');
  });

  it('sumLineAmounts is exact and order-free', () => {
    const one = unwrap(
      deriveOneTimeLine({ pricing: ONE_TIME_PRICING, entitlementId: ENTITLEMENT, lineId: 'line:acquisition' }),
    );
    const usage = unwrap(
      deriveUsageLine({ pricing: USAGE_PRICING, account: usageAccount(), lineId: 'line:usage-april' }),
    );
    expect(sumLineAmounts([one, usage])).toBe('2462.5');
    expect(sumLineAmounts([usage, one])).toBe('2462.5');
  });
});

describe('the pricing classifier (positive)', () => {
  it('free and enterprise-private classify to nothing billable', () => {
    expect(classifyPricingForBilling({ kind: 'free' })).toEqual({});
    expect(
      classifyPricingForBilling({
        kind: 'enterprise-private',
        contactRoute: 'mailto:sales@example.com',
        audienceTenantIds: [TENANT],
      }),
    ).toEqual({});
  });

  it('hybrid classifies its fixed component PLUS the metered component', () => {
    const components = classifyPricingForBilling({
      kind: 'hybrid',
      fixed: SUBSCRIPTION_PRICING,
      metered: USAGE_PRICING,
    });
    expect(components.subscription).toBeDefined();
    expect(components.usage).toBeDefined();
    expect(components.oneTime).toBeUndefined();
  });

  it('each single-kind model classifies to its component', () => {
    expect(classifyPricingForBilling(ONE_TIME_PRICING).oneTime).toBeDefined();
    expect(classifyPricingForBilling(SUBSCRIPTION_PRICING).subscription).toBeDefined();
    expect(classifyPricingForBilling(SEAT_PRICING).seat).toBeDefined();
    expect(classifyPricingForBilling(USAGE_PRICING).usage).toBeDefined();
  });
});

describe('delivery-actual derivation (positive)', () => {
  it('bills a quantity-measure validated actual at the caller-supplied rate', () => {
    const lines = unwrap(
      deriveDeliveryActualLines({
        delivery: deliveredActual(),
        options: { unitRates: { m3: { unitAmount: '18.50', currency: 'EUR' } } },
      }),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]!.basis).toBe('delivery-actual');
    expect(lines[0]!.quantity).toBe('118.5');
    expect(lines[0]!.unitAmount).toBe('18.50');
    expect(lines[0]!.amount).toBe('2192.25');
    expect(lines[0]!.currency).toBe('EUR');
    expect(lines[0]!.delivery).toBeDefined();
    expect(lines[0]!.delivery!.actualRecordId).toBe('actual:excavation-done');
  });

  it('bills a cost-measure validated actual at its recorded amount', () => {
    const lines = unwrap(deriveDeliveryActualLines({ delivery: deliveredCostActual() }));
    expect(lines).toHaveLength(1);
    expect(lines[0]!.amount).toBe('12500.75');
    expect(lines[0]!.currency).toBe('EUR');
    expect(lines[0]!.delivery!.deliveryId).toBe('delivery:tower-retrofit-v2');
  });

  it('the line carries the exact-revision actual content digest', () => {
    const lines = unwrap(
      deriveDeliveryActualLines({
        delivery: deliveredActual(),
        options: { unitRates: { m3: { unitAmount: '18.50', currency: 'EUR' } } },
      }),
    );
    const actual = deliveredActual().actuals[0]!;
    expect(lines[0]!.delivery!.actualContentDigest).toBe(actual.contentDigest);
  });

  it('a line-id prefix keeps ids unique across deliveries', () => {
    const lines = unwrap(
      deriveDeliveryActualLines({
        delivery: deliveredActual(),
        options: {
          lineIdPrefix: 'tower-v1',
          unitRates: { m3: { unitAmount: '18.50', currency: 'EUR' } },
        },
      }),
    );
    expect(lines[0]!.lineId).toBe('line:tower-v1-excavation-done');
  });

  it('restricting to explicit actual record ids derives exactly those', () => {
    const lines = unwrap(
      deriveDeliveryActualLines({
        delivery: deliveredCostActual(),
        options: { actualRecordIds: ['actual:site-cost'] },
      }),
    );
    expect(lines).toHaveLength(1);
  });
});
