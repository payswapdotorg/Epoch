// POSITIVE: the delivery:* lifecycle event vocabulary over the W010 event
// shapes — event round-trips with digests, the typed payload family
// parser, and the deterministic stream derivation.
import { describe, expect, it } from 'vitest';
import {
  DELIVERY_EVENT_DATA_SCHEMAS,
  DELIVERY_EVENT_DISCRIMINATORS,
  deliveryStreamIdOf,
  parseDeliveryEventData,
  sealDeliveryEvent,
  verifySealedDeliveryEvent,
} from '../src/index';
import { PRINCIPAL, T1, T2, TENANT } from './fixtures';

function deliveryEvent(discriminator: string, data: Record<string, unknown>) {
  return {
    schemaVersion: 1,
    streamId: 'stream:delivery-tower-retrofit-v1',
    sequence: 1,
    tenantId: TENANT,
    actor: PRINCIPAL,
    causalParent: null,
    payload: { discriminator, data },
    occurredAt: T2,
  };
}

describe('the delivery:* event vocabulary', () => {
  it('publishes the full lifecycle vocabulary over the W010 shapes', () => {
    expect(DELIVERY_EVENT_DISCRIMINATORS).toContain('delivery:stage-entered');
    expect(DELIVERY_EVENT_DISCRIMINATORS).toContain('delivery:observation-actualized');
    expect(DELIVERY_EVENT_DISCRIMINATORS).toContain('delivery:forecast-recorded');
    expect(DELIVERY_EVENT_DISCRIMINATORS).toHaveLength(15);
    for (const discriminator of DELIVERY_EVENT_DISCRIMINATORS) {
      expect(DELIVERY_EVENT_DATA_SCHEMAS[discriminator]).toBeDefined();
    }
  });

  it('seals and verifies a delivery event with its content digest', () => {
    const sealed = sealDeliveryEvent(
      deliveryEvent('delivery:baseline-approved', {
        solutionId: 'solution:tower-retrofit',
        version: '1.0.0',
        baselineDigest: 'a'.repeat(64),
        approvedBy: PRINCIPAL,
        approvedAt: T2,
      }),
    );
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      expect(sealed.value.contentDigest).toMatch(/^[0-9a-f]{64}$/);
      const roundTripped = JSON.parse(JSON.stringify(sealed.value)) as unknown;
      const verified = verifySealedDeliveryEvent(roundTripped);
      expect(verified.ok).toBe(true);
      if (verified.ok) {
        expect(verified.value).toEqual(sealed.value);
      }
    }
  });

  it('parses the typed payload of every family member', () => {
    const samples: Record<string, Record<string, string | null>> = {
      'delivery:stage-entered': {
        solutionId: 'solution:tower-retrofit',
        subjectId: 'solution:tower-retrofit',
        stage: 'plan',
        stageRecordId: 'stage:plan-1',
        enteredAt: T1,
      },
      'delivery:stage-transition': {
        solutionId: 'solution:tower-retrofit',
        subjectId: 'solution:tower-retrofit',
        relation: 'precedes',
        fromStageRecordId: 'stage:plan-1',
        toStageRecordId: 'stage:acquire-1',
        recordedAt: T2,
      },
      'delivery:baseline-revision': {
        solutionId: 'solution:tower-retrofit',
        version: '1.1.0',
        previousVersionDigest: 'a'.repeat(64),
        contentDigest: 'b'.repeat(64),
        createdAt: T2,
      },
      'delivery:observation-recorded': {
        deliveryId: 'delivery:tower-retrofit-v1',
        observationId: 'observation:pit-volume',
        at: T2,
      },
      'delivery:observation-accepted': {
        deliveryId: 'delivery:tower-retrofit-v1',
        observationId: 'observation:pit-volume',
        at: T2,
      },
      'delivery:observation-rejected': {
        deliveryId: 'delivery:tower-retrofit-v1',
        observationId: 'observation:pit-volume',
        at: T2,
      },
      'delivery:observation-actualized': {
        deliveryId: 'delivery:tower-retrofit-v1',
        observationId: 'observation:pit-volume',
        actualId: 'actual:pit-volume',
        actualizedAt: T2,
      },
      'delivery:acquisition-requested': {
        acquisitionId: 'acquisition:steel-supply',
        variant: 'external-procurement',
        requestedAt: T1,
      },
      'delivery:acquisition-fulfilled': {
        acquisitionId: 'acquisition:steel-supply',
        fulfilledAt: T2,
      },
      'delivery:milestone-reached': {
        programId: 'program:tower-retrofit-v1',
        milestoneId: 'milestone:earthworks-complete',
        reachedAt: T2,
      },
      'delivery:forecast-recorded': {
        forecastRecordId: 'forecast:brace-finish',
        asOf: T2,
        refines: null,
      },
      'delivery:outcome-recorded': {
        outcomeRecordId: 'outcome:tower-delivered',
        outcomeKind: 'delivered',
        recordedAt: T2,
      },
      'delivery:learning-recorded': {
        learningRecordId: 'learning:bracing-lesson',
        recordedAt: T2,
      },
      'delivery:info-request-issued': {
        requestId: 'info-request:soil-data',
        decisionImpact: 'material',
        issuedAt: T1,
      },
    };
    for (const [discriminator, data] of Object.entries(samples)) {
      const parsed = parseDeliveryEventData({ discriminator, data });
      expect(parsed.ok, discriminator).toBe(true);
    }
  });

  it('a causal parent chains events in the same stream', () => {
    const first = sealDeliveryEvent(
      deliveryEvent('delivery:observation-recorded', {
        deliveryId: 'delivery:tower-retrofit-v1',
        observationId: 'observation:pit-volume',
        at: T1,
      }),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = sealDeliveryEvent({
      ...deliveryEvent('delivery:observation-accepted', {
        deliveryId: 'delivery:tower-retrofit-v1',
        observationId: 'observation:pit-volume',
        at: T2,
      }),
      sequence: 2,
      causalParent: { streamId: 'stream:delivery-tower-retrofit-v1', sequence: 1 },
    });
    expect(second.ok).toBe(true);
  });

  it('the delivery stream id is derived deterministically', () => {
    expect(deliveryStreamIdOf('delivery:tower-retrofit-v1')).toBe(
      'stream:delivery-tower-retrofit-v1',
    );
  });
});

describe('NAMED NEGATIVE: unknown discriminators and tampering', () => {
  it('a non-delivery discriminator is rejected by the family parser', () => {
    const parsed = parseDeliveryEventData({
      discriminator: 'marketplace:usage',
      data: {},
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe('validation');
    }
  });

  it('a tampered delivery event digest is rejected', () => {
    const sealed = sealDeliveryEvent(
      deliveryEvent('delivery:outcome-recorded', {
        outcomeRecordId: 'outcome:tower-delivered',
        outcomeKind: 'delivered',
        recordedAt: T2,
      }),
    );
    if (!sealed.ok) return;
    const tampered = {
      ...sealed.value,
      payload: {
        discriminator: 'delivery:outcome-recorded',
        data: { outcomeRecordId: 'outcome:other', outcomeKind: 'rejected', recordedAt: T2 },
      },
    };
    const verified = verifySealedDeliveryEvent(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('a same-stream causal parent that is not strictly earlier is rejected', () => {
    const sealed = sealDeliveryEvent({
      ...deliveryEvent('delivery:stage-entered', {
        solutionId: 'solution:tower-retrofit',
        subjectId: 'solution:tower-retrofit',
        stage: 'plan',
        stageRecordId: 'stage:plan-1',
        enteredAt: T2,
      }),
      causalParent: { streamId: 'stream:delivery-tower-retrofit-v1', sequence: 1 },
    });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
    }
  });
});
