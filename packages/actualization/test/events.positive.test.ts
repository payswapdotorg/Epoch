// The `actualization:*` event vocabulary over the W010 shapes — seal,
// verify, parse, and tamper detection over the full vocabulary.
import { describe, expect, it } from 'vitest';
import {
  ACTUALIZATION_EVENT_DATA_SCHEMAS,
  ACTUALIZATION_EVENT_DISCRIMINATORS,
  actualizationStreamIdOf,
  computeActualizationEventDigest,
  parseActualizationEventData,
  sealActualizationEvent,
  verifySealedActualizationEvent,
} from '../src/index';
import { expectError, unwrap } from './helpers';
import { DELIVERY_ID, PRINCIPAL, TENANT, T1 } from './fixtures';

function eventContent(discriminator: string, data: Record<string, unknown>) {
  return {
    schemaVersion: 1,
    streamId: actualizationStreamIdOf(DELIVERY_ID),
    sequence: 1,
    tenantId: TENANT,
    actor: PRINCIPAL,
    causalParent: null,
    payload: { discriminator, data },
    occurredAt: T1,
  };
}

describe('the actualization:* event vocabulary', () => {
  it('derives one stream per delivery deterministically', () => {
    expect(actualizationStreamIdOf(DELIVERY_ID)).toBe('stream:actualization-tower-retrofit-v1');
  });

  it('seals and verifies one event of every vocabulary kind', () => {
    const samples: Array<[string, Record<string, unknown>]> = [
      [
        'actualization:observation-intaken',
        {
          deliveryId: DELIVERY_ID,
          observationId: 'observation:pit-volume-monday',
          subjectKind: 'activity',
          measureKind: 'quantity',
          admission: 'recorded',
          intakenAt: T1,
        },
      ],
      [
        'actualization:validation-assessed',
        {
          deliveryId: DELIVERY_ID,
          assessmentId: 'validation:pit-volume-quantity-abcdef01',
          state: 'corroborated',
          observationCount: 2,
          measureKind: 'quantity',
          deviationMagnitude: '0',
          assessedAt: T1,
        },
      ],
      [
        'actualization:conflict-resolved',
        {
          deliveryId: DELIVERY_ID,
          resolutionId: 'resolution:pit-volume-tuesday-wins',
          assessmentId: 'validation:pit-volume-quantity-abcdef01',
          selectedCount: 1,
          excludedCount: 1,
          resolvedAt: T1,
        },
      ],
      [
        'actualization:actuals-minted',
        {
          deliveryId: DELIVERY_ID,
          assessmentId: 'validation:pit-volume-quantity-abcdef01',
          mintedCount: 2,
          alreadyMintedCount: 0,
          deliveryDigest: 'a'.repeat(64),
          actualizedAt: T1,
        },
      ],
      [
        'actualization:lineage-linked',
        {
          solutionId: 'solution:tower-retrofit',
          edgeId: 'lineage:pit-prediction-baseline',
          realizationVariant: 'construction-build',
          fromKind: 'prediction',
          fromRecordId: 'prediction:pit-volume',
          toKind: 'baseline',
          toRecordId: 'baseline:pit-volume-v1',
          recordedAt: T1,
        },
      ],
      [
        'actualization:forecast-revised',
        {
          forecastRecordId: 'forecast:pit-volume-r2',
          subjectKind: 'activity',
          measureKind: 'quantity',
          atCompletion: '135',
          remaining: '60',
          asOf: T1,
          refines: 'forecast:pit-volume-r1',
        },
      ],
      [
        'actualization:calibration-folded',
        {
          calibrationId: 'calibration:pit-volume-quantity-abcdef01',
          comparisonCount: 3,
          overCount: 1,
          underCount: 1,
          exactCount: 1,
          totalAbsoluteDeviation: '16.5',
          foldedAt: T1,
        },
      ],
      [
        'actualization:state-projected',
        {
          deliveryId: DELIVERY_ID,
          deliveryDigest: 'a'.repeat(64),
          observationCount: 2,
          actualCount: 2,
          groupCount: 1,
          projectedAt: T1,
        },
      ],
    ];
    expect(ACTUALIZATION_EVENT_DISCRIMINATORS.length).toBe(samples.length);
    for (const [discriminator, data] of samples) {
      const sealed = unwrap(sealActualizationEvent(eventContent(discriminator, data)));
      expect(sealed.contentDigest).toBe(computeActualizationEventDigest(eventContent(discriminator, data) as never));
      const verified = verifySealedActualizationEvent(JSON.parse(JSON.stringify(sealed)));
      expect(verified.ok).toBe(true);
      const parsed = unwrap(parseActualizationEventData(sealed.payload));
      expect(parsed).toEqual(data);
    }
  });

  it('the typed data schemas cover the whole vocabulary', () => {
    for (const discriminator of ACTUALIZATION_EVENT_DISCRIMINATORS) {
      expect(ACTUALIZATION_EVENT_DATA_SCHEMAS[discriminator]).toBeDefined();
    }
  });

  it('an unknown discriminator is a typed validation rejection', () => {
    const error = expectError(
      parseActualizationEventData({
        discriminator: 'actualization:rogue-kind',
        data: {},
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('a malformed payload data shape is a typed validation rejection', () => {
    const error = expectError(
      parseActualizationEventData({
        discriminator: 'actualization:observation-intaken',
        data: { deliveryId: 'not-a-delivery-id' },
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('a tampered sealed event is a typed digest-mismatch', () => {
    const sealed = unwrap(
      sealActualizationEvent(
        eventContent('actualization:state-projected', {
          deliveryId: DELIVERY_ID,
          deliveryDigest: 'a'.repeat(64),
          observationCount: 2,
          actualCount: 2,
          groupCount: 1,
          projectedAt: T1,
        }),
      ),
    );
    const tampered = {
      ...sealed,
      payload: { ...sealed.payload, data: { ...sealed.payload.data, groupCount: 99 } },
    };
    const verified = verifySealedActualizationEvent(tampered);
    expect(verified.ok).toBe(false);
    expect(!verified.ok && verified.error.code).toBe('digest-mismatch');
  });

  it('a same-stream causal parent must be strictly earlier', () => {
    const error = expectError(
      sealActualizationEvent({
        ...eventContent('actualization:state-projected', {
          deliveryId: DELIVERY_ID,
          deliveryDigest: 'a'.repeat(64),
          observationCount: 2,
          actualCount: 2,
          groupCount: 1,
          projectedAt: T1,
        }),
        sequence: 2,
        causalParent: { streamId: actualizationStreamIdOf(DELIVERY_ID), sequence: 5 },
      }),
    );
    expect(error.code).toBe('validation');
  });
});
