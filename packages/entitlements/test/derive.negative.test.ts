// Negative coverage of billable-line derivation: unsealable line ids,
// inverted periods, bad seat counts, tampered W036 delivery records
// (only VALIDATED actuals may bill), missing unit rates, unknown actual
// references, and non-billable measures.
import { describe, expect, it } from 'vitest';
import {
  acceptObservation,
  actualizeObservation,
  openDeliveryRecord,
  recordObservation,
  sealDistinctionRecord,
  sealSolutionVersion,
} from '@epoch/solution-delivery';
import {
  deriveDeliveryActualLines,
  deriveOneTimeLine,
  deriveSeatLine,
  deriveSubscriptionLine,
  unsupportedPricingModelError,
} from '../src/index';
import {
  ENTITLEMENT,
  ONE_TIME_PRICING,
  SEAT_PRICING,
  SUBSCRIPTION_PRICING,
  T0,
  T1,
  T2,
  deliveredActual,
  expectError,
  unwrap,
} from './fixtures';

describe('pricing derivations (negative)', () => {
  it('a malformed line id is a typed validation rejection', () => {
    const error = expectError(
      deriveOneTimeLine({
        pricing: ONE_TIME_PRICING,
        entitlementId: ENTITLEMENT,
        lineId: 'not-a-line-id',
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('inverted subscription period bounds are rejected', () => {
    const error = expectError(
      deriveSubscriptionLine({
        pricing: SUBSCRIPTION_PRICING,
        entitlementId: ENTITLEMENT,
        periodStart: T1,
        periodEnd: T0,
        lineId: 'line:subscription-april',
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('a non-integer or negative seat count is rejected', () => {
    const error = expectError(
      deriveSeatLine({
        pricing: SEAT_PRICING,
        entitlementId: ENTITLEMENT,
        activeSeatCount: 1.5,
        lineId: 'line:seats-april',
      }),
    );
    expect(error.code).toBe('validation');
    const negative = expectError(
      deriveSeatLine({
        pricing: SEAT_PRICING,
        entitlementId: ENTITLEMENT,
        activeSeatCount: -1,
        lineId: 'line:seats-april',
      }),
    );
    expect(negative.code).toBe('validation');
  });
});

describe('delivery-actual derivation (negative)', () => {
  it('a tampered (digest-mismatched) delivery record NEVER bills', () => {
    const delivery = deliveredActual();
    const tampered = { ...delivery, tenantId: 'tenant:initech' };
    const error = expectError(deriveDeliveryActualLines({ delivery: tampered }));
    expect(error.code).toBe('digest-mismatch');
  });

  it('a delivery record with an overwritten actuals list NEVER bills', () => {
    const delivery = deliveredActual();
    const tampered = {
      ...delivery,
      actuals: delivery.actuals.map((actual) => ({
        ...actual,
        measure: { kind: 'cost' as const, amount: '1', currency: 'EUR' },
      })),
    };
    const error = expectError(deriveDeliveryActualLines({ delivery: tampered }));
    expect(error.code).toBe('digest-mismatch');
  });

  it('a quantity actual without a unit rate is rejected (never a silent zero)', () => {
    const error = expectError(deriveDeliveryActualLines({ delivery: deliveredActual() }));
    expect(error.code).toBe('delivery-actual-rejected');
    expect((error as { actualRecordId?: string }).actualRecordId).toBe('actual:excavation-done');
  });

  it('a quantity actual whose unit label has no rate in the card is rejected', () => {
    const error = expectError(
      deriveDeliveryActualLines({
        delivery: deliveredActual(),
        options: { unitRates: { tonnes: { unitAmount: '2400.00', currency: 'EUR' } } },
      }),
    );
    expect(error.code).toBe('delivery-actual-rejected');
  });

  it('an unknown actual-record reference is rejected', () => {
    const error = expectError(
      deriveDeliveryActualLines({
        delivery: deliveredActual(),
        options: { actualRecordIds: ['actual:not-recorded'] },
      }),
    );
    expect(error.code).toBe('delivery-actual-rejected');
    expect((error as { actualRecordId?: string }).actualRecordId).toBe('actual:not-recorded');
  });

  it('an invalid delivery envelope (validation failure) is rejected', () => {
    const error = expectError(deriveDeliveryActualLines({ delivery: { nope: true } as never }));
    expect(error.code).toBe('delivery-actual-rejected');
  });
});

describe('unsupported pricing (negative)', () => {
  it('the unsupported-pricing-model rejection is typed', () => {
    const error = unsupportedPricingModelError('free');
    expect(error.code).toBe('unsupported-pricing-model');
    expect(error.pricingKind).toBe('free');
  });

  it('the unsupported-pricing-model rejection names enterprise-private', () => {
    const error = unsupportedPricingModelError('enterprise-private');
    expect(error.message).toContain('enterprise-private');
  });
});

describe('instant-measure actuals (edge)', () => {
  it('a delivery with only non-billable measures derives ZERO lines (not an error)', () => {
    // Build a delivery whose only actual is an instant-measure actual by
    // converting an instant-measure observation through the REAL pipeline.
    const sealed = unwrap(
      sealSolutionVersion({
        schema: 'epoch.solution-delivery.solution-version',
        schemaVersion: 1,
        solutionId: 'solution:tower-retrofit',
        version: '1.0.0',
        tenantId: 'tenant:globex',
        title: 'Tower retrofit solution',
        solutionLines: [
          {
            lineId: 'line:earthworks',
            title: 'Excavation and grading',
            quantity: { value: '120', unit: 'm3' },
            unitCost: { amount: '18.50', currency: 'EUR' },
            acquisitionVariant: 'external-procurement',
          },
        ],
        worldReferences: [{ entityId: 'site-tower-a' }],
        constraintReferences: [{ constraintId: 'max-height-limit' }],
        previousVersionDigest: null,
        createdAt: T0,
        createdBy: 'principal:billing-admin',
      }),
    );
    let delivery = unwrap(
      openDeliveryRecord({
        schema: 'epoch.solution-delivery.delivery-record',
        schemaVersion: 1,
        deliveryId: 'delivery:instant-only',
        tenantId: 'tenant:globex',
        solutionId: 'solution:tower-retrofit',
        solutionVersion: sealed.version,
        solutionVersionDigest: sealed.contentDigest,
        openedAt: T0,
        openedBy: 'principal:billing-admin',
        status: 'open',
        observations: [],
        acceptedObservationIds: [],
        rejectedObservationIds: [],
        actuals: [],
      }),
    );
    delivery = unwrap(
      recordObservation(delivery, unwrap(sealDistinctionRecord({
        schema: 'epoch.solution-delivery.distinction-record',
        schemaVersion: 1,
        kind: 'observation',
        recordId: 'observation:milestone-reached',
        tenantId: 'tenant:globex',
        subject: { solutionId: 'solution:tower-retrofit', subjectKind: 'activity', subjectId: 'activity:excavate' },
        measure: { kind: 'instant', at: T2 },
        payload: {
          deliveryId: 'delivery:instant-only',
          observedAt: T2,
          observedBy: 'principal:field-engineer',
          evidence: [],
        },
        recordedAt: T2,
        recordedBy: 'principal:field-engineer',
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'observed', sourceRef: 'source:field-report', actor: 'principal:field-engineer' },
          freshness: { state: 'fresh', assessedAt: T1 },
          confidence: { method: 'stated', value: 0.9, rationale: 'direct observation' },
        },
      }))),
    );
    delivery = unwrap(
      acceptObservation(delivery, 'observation:milestone-reached', {
        acceptedBy: 'principal:billing-admin',
        acceptedAt: T2,
      }),
    );
    delivery = unwrap(
      actualizeObservation(delivery, 'observation:milestone-reached', {
        actualId: 'actual:milestone-reached',
        actualizedBy: 'principal:billing-admin',
        actualizedAt: T2,
      }),
    );
    const lines = unwrap(deriveDeliveryActualLines({ delivery }));
    expect(lines).toHaveLength(0);
  });
});
