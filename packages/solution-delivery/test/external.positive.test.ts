// POSITIVE: provider-neutral external request/event envelope round-trips,
// correlation, and the reference adapter step (external observation-report
// -> sealed observation record).
import { describe, expect, it } from 'vitest';
import {
  admitExternalEvent,
  admitExternalRequest,
  computeExternalEventDigest,
  correlateExternalEvent,
  externalEventToObservation,
  verifySealedDistinctionRecord,
  UncertaintyStateSchema,
  type UncertaintyState,
} from '../src/index';
import { OBSERVER, PRINCIPAL, T1, T2, T3, TENANT, uncertainty } from './fixtures';

function request() {
  return {
    schema: 'epoch.solution-delivery.external-request',
    schemaVersion: 1,
    requestId: 'external-request:steel-order-1',
    tenantId: TENANT,
    solutionId: 'solution:tower-retrofit',
    kind: 'acquisition-order',
    targetSystemRef: 'external:supplier-portal',
    correlationKey: 'corr:steel-1',
    payload: { lines: [{ description: 'steel', quantity: '4' }] },
    issuedAt: T1,
    issuedBy: PRINCIPAL,
  };
}

function event() {
  return {
    schema: 'epoch.solution-delivery.external-event',
    schemaVersion: 1,
    eventId: 'external-event:steel-ack-1',
    tenantId: TENANT,
    kind: 'observation-report',
    sourceSystemRef: 'external:supplier-portal',
    correlationKey: 'corr:steel-1',
    payload: { deliveredQuantity: '4', unit: 'tonne' },
    occurredAt: T2,
  };
}

describe('external request/event envelope round-trips', () => {
  it('admits a provider-neutral outbound request envelope', () => {
    const admitted = admitExternalRequest(request());
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value.kind).toBe('acquisition-order');
      expect(admitted.value.targetSystemRef).toBe('external:supplier-portal');
    }
  });

  it('admits a provider-neutral inbound event envelope', () => {
    const admitted = admitExternalEvent(event());
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value.kind).toBe('observation-report');
    }
  });

  it('both envelopes round-trip through JSON serialization', () => {
    const requestAdmitted = admitExternalRequest(request());
    const eventAdmitted = admitExternalEvent(event());
    expect(requestAdmitted.ok && eventAdmitted.ok).toBe(true);
    if (!requestAdmitted.ok || !eventAdmitted.ok) return;
    const roundTripRequest = admitExternalRequest(
      JSON.parse(JSON.stringify(requestAdmitted.value)) as unknown,
    );
    const roundTripEvent = admitExternalEvent(
      JSON.parse(JSON.stringify(eventAdmitted.value)) as unknown,
    );
    expect(roundTripRequest.ok && roundTripEvent.ok).toBe(true);
    if (roundTripRequest.ok) {
      expect(roundTripRequest.value).toEqual(requestAdmitted.value);
    }
    if (roundTripEvent.ok) {
      expect(roundTripEvent.value).toEqual(eventAdmitted.value);
    }
  });

  it('the external event digest is stable (content addressing)', () => {
    const admitted = admitExternalEvent(event());
    if (!admitted.ok) return;
    expect(computeExternalEventDigest(admitted.value)).toBe(
      computeExternalEventDigest(admitted.value),
    );
  });
});

describe('correlation', () => {
  it('correlates a matching inbound event with its outbound request', () => {
    const requestAdmitted = admitExternalRequest(request());
    const eventAdmitted = admitExternalEvent(event());
    if (!requestAdmitted.ok || !eventAdmitted.ok) return;
    const correlated = correlateExternalEvent(requestAdmitted.value, eventAdmitted.value);
    expect(correlated.ok).toBe(true);
    if (correlated.ok) {
      expect(correlated.value.event.correlationKey).toBe('corr:steel-1');
    }
  });
});

describe('the reference adapter step (external event -> observation)', () => {
  it('converts a correlated observation-report into a sealed observation record', () => {
    const requestAdmitted = admitExternalRequest(request());
    const eventAdmitted = admitExternalEvent(event());
    if (!requestAdmitted.ok || !eventAdmitted.ok) return;
    const correlated = correlateExternalEvent(requestAdmitted.value, eventAdmitted.value);
    if (!correlated.ok) return;
    const uncertaintyState: UncertaintyState = UncertaintyStateSchema.parse(uncertainty());
    const observation = externalEventToObservation(correlated.value, {
      observationRecordId: 'observation:steel-delivery',
      deliveryId: 'delivery:tower-retrofit-v1',
      subject: {
        solutionId: 'solution:tower-retrofit',
        subjectKind: 'activity',
        subjectId: 'activity:brace-frame',
      },
      measure: { kind: 'quantity', value: '4', unit: 'tonne' },
      observedBy: OBSERVER,
      observedAt: T3,
      uncertainty: uncertaintyState,
    });
    expect(observation.ok).toBe(true);
    if (observation.ok) {
      expect(observation.value.kind).toBe('observation');
      // the external event's content digest becomes the evidence reference:
      expect(observation.value.payload.evidence[0]!.digest).toBe(
        computeExternalEventDigest(eventAdmitted.value),
      );
      const verified = verifySealedDistinctionRecord(observation.value);
      expect(verified.ok).toBe(true);
    }
  });
});
