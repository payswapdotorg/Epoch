// EVENT PARITY with the REAL W010 machinery (devDependencies only — no
// runtime coupling; the W036/W037/W038 pattern): every event the host
// emits is admitted by the REAL sealEvent and digests identically
// through the REAL computeEventDigest; the stream grammar is
// pattern-identical; one stream per delivery.
import { describe, expect, it } from 'vitest';
import { computeEventDigest, sealEvent, EVENT_STREAM_ID_PATTERN } from '@epoch/event-log';
import { actualizationStreamIdOf, parseActualizationEventData } from '@epoch/actualization';
import { ActualizationRuntime } from '../src/index';
import {
  ACTIVITY_ID,
  DELIVERY_ID,
  PRINCIPAL,
  SOLUTION_ID,
  TENANT,
  T4,
  T5,
  T6,
  T7,
  allowContext,
  openedDelivery,
  sealedComparisonFact,
  sealedObservation,
  tuesdayObservation,
  unwrap,
} from './helpers';

const AUTH = { principalId: PRINCIPAL, context: allowContext() };

/** The full flow over a fresh host (the parity fixture). */
function fullFlow(): ActualizationRuntime {
  const host = new ActualizationRuntime();
  unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
  unwrap(
    host.intakeObservation({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      observation: sealedObservation(),
    }),
  );
  unwrap(
    host.intakeObservation({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      observation: tuesdayObservation(),
    }),
  );
  const assessments = unwrap(
    host.assessValidation({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      policy: { mode: 'exact' },
      assessedAt: T4,
    }),
  );
  unwrap(
    host.applyActualization({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      assessment: assessments[0]!,
      application: { acceptedBy: PRINCIPAL, acceptedAt: T4, actualizedBy: PRINCIPAL, actualizedAt: T5 },
    }),
  );
  unwrap(
    host.admitComparisonFact({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      fact: sealedComparisonFact(),
    }),
  );
  unwrap(
    host.foldCalibration({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      subjectKind: 'activity',
      subjectId: ACTIVITY_ID,
      foldedAt: T6,
    }),
  );
  unwrap(
    host.projectState({
      tenantId: TENANT,
      authorization: AUTH,
      deliveryId: DELIVERY_ID,
      policy: { mode: 'exact' },
      projectedAt: T7,
    }),
  );
  return host;
}

describe('W010 event parity (runtime)', () => {
  it('the derived delivery stream satisfies the W010 stream grammar (one stream per delivery)', () => {
    const streamId = actualizationStreamIdOf(DELIVERY_ID);
    expect(streamId).toBe('stream:actualization-tower-retrofit-v1');
    expect(new RegExp(EVENT_STREAM_ID_PATTERN).test(streamId)).toBe(true);
  });

  it('every host event is admitted by the REAL W010 sealEvent and digests identically', () => {
    const host = fullFlow();
    const stream = unwrap(host.eventStream({ tenantId: TENANT, authorization: AUTH, deliveryId: DELIVERY_ID }));
    expect(stream.length).toBeGreaterThanOrEqual(7);
    for (const event of stream) {
      const { contentDigest, ...content } = event;
      // The REAL W010 digest of the same content agrees with the sealed digest.
      expect(computeEventDigest(content as never)).toBe(contentDigest);
      // The REAL W010 seal path admits the same content with the same digest.
      const sealed = sealEvent(content);
      expect(sealed.ok, JSON.stringify(sealed)).toBe(true);
      if (!sealed.ok) continue;
      expect(sealed.value.digest).toBe(contentDigest);
    }
  });

  it('the events cover the whole actualization vocabulary over the flow', () => {
    const host = fullFlow();
    const stream = unwrap(host.eventStream({ tenantId: TENANT, authorization: AUTH, deliveryId: DELIVERY_ID }));
    const discriminators = new Set(stream.map((event) => event.payload.discriminator));
    for (const expected of [
      'actualization:observation-intaken',
      'actualization:validation-assessed',
      'actualization:actuals-minted',
      'actualization:calibration-folded',
      'actualization:state-projected',
    ]) {
      expect(discriminators.has(expected), `missing ${expected}`).toBe(true);
    }
  });

  it('the stream sequences are contiguous and causal parents strictly earlier', () => {
    const host = fullFlow();
    const stream = unwrap(host.eventStream({ tenantId: TENANT, authorization: AUTH, deliveryId: DELIVERY_ID }));
    stream.forEach((event, index) => {
      expect(event.sequence).toBe(index + 1);
      if (event.causalParent !== null) {
        expect(event.causalParent.sequence).toBeLessThan(event.sequence);
      }
    });
  });

  it('every typed event payload parses through the kernel vocabulary parser', () => {
    const host = fullFlow();
    const stream = unwrap(host.eventStream({ tenantId: TENANT, authorization: AUTH, deliveryId: DELIVERY_ID }));
    for (const event of stream) {
      const parsed = parseActualizationEventData(event.payload);
      expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    }
  });
});

void SOLUTION_ID;
