// NAMED NEGATIVES (external seam): correlation mismatches, cross-tenant
// events, vendor fields, and non-observation-report adaptation.
import { describe, expect, it } from 'vitest';
import {
  admitExternalEvent,
  admitExternalRequest,
  correlateExternalEvent,
  externalEventToObservation,
  UncertaintyStateSchema,
} from '../src/index';
import { OBSERVER, PRINCIPAL, T1, T2, TENANT, OTHER_TENANT, uncertainty } from './fixtures';

function request(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

function event(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

describe('NAMED NEGATIVE: correlation mismatches (validation)', () => {
  it('a mismatched correlation key is rejected', () => {
    const requestAdmitted = admitExternalRequest(request());
    const eventAdmitted = admitExternalEvent(event({ correlationKey: 'corr:other' }));
    if (!requestAdmitted.ok || !eventAdmitted.ok) return;
    const correlated = correlateExternalEvent(requestAdmitted.value, eventAdmitted.value);
    expect(correlated.ok).toBe(false);
    if (!correlated.ok) {
      expect(correlated.error.code).toBe('validation');
    }
  });

  it('a mismatched system reference is rejected', () => {
    const requestAdmitted = admitExternalRequest(request());
    const eventAdmitted = admitExternalEvent(event({ sourceSystemRef: 'external:other-portal' }));
    if (!requestAdmitted.ok || !eventAdmitted.ok) return;
    const correlated = correlateExternalEvent(requestAdmitted.value, eventAdmitted.value);
    expect(correlated.ok).toBe(false);
    if (!correlated.ok) {
      expect(correlated.error.code).toBe('validation');
    }
  });

  it('an event preceding its request is rejected', () => {
    const requestAdmitted = admitExternalRequest(request());
    const eventAdmitted = admitExternalEvent(event({ occurredAt: '2026-01-01T00:00:00.000Z' }));
    if (!requestAdmitted.ok || !eventAdmitted.ok) return;
    const correlated = correlateExternalEvent(requestAdmitted.value, eventAdmitted.value);
    expect(correlated.ok).toBe(false);
    if (!correlated.ok) {
      expect(correlated.error.code).toBe('validation');
    }
  });
});

describe('NAMED NEGATIVE: cross-tenant external events (cross-tenant-denied)', () => {
  it('an event from another tenant cannot correlate', () => {
    const requestAdmitted = admitExternalRequest(request());
    const eventAdmitted = admitExternalEvent(event({ tenantId: OTHER_TENANT }));
    if (!requestAdmitted.ok || !eventAdmitted.ok) return;
    const correlated = correlateExternalEvent(requestAdmitted.value, eventAdmitted.value);
    expect(correlated.ok).toBe(false);
    if (!correlated.ok) {
      expect(correlated.error.code).toBe('cross-tenant-denied');
    }
  });
});

describe('NAMED NEGATIVE: vendor fields (vendor-fields-rejected)', () => {
  it('a vendor webhook field on the event envelope is rejected', () => {
    const admitted = admitExternalEvent(event({ webhookSecret: 'sk-123' }));
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('vendor-fields-rejected');
    }
  });

  it('a vendor endpoint field on the request envelope is rejected', () => {
    const admitted = admitExternalRequest(request({ apiUrl: 'https://vendor.example' }));
    expect(admitted.ok).toBe(false);
    if (!admitted.ok) {
      expect(admitted.error.code).toBe('vendor-fields-rejected');
    }
  });
});

describe('NAMED NEGATIVE: non-observation reports cannot adapt', () => {
  it('a status-update event cannot become an observation', () => {
    const requestAdmitted = admitExternalRequest(request());
    const eventAdmitted = admitExternalEvent(event({ kind: 'status-update' }));
    if (!requestAdmitted.ok || !eventAdmitted.ok) return;
    const correlated = correlateExternalEvent(requestAdmitted.value, eventAdmitted.value);
    if (!correlated.ok) return;
    const observation = externalEventToObservation(correlated.value, {
      observationRecordId: 'observation:status',
      deliveryId: 'delivery:tower-retrofit-v1',
      subject: {
        solutionId: 'solution:tower-retrofit',
        subjectKind: 'activity',
        subjectId: 'activity:brace-frame',
      },
      measure: { kind: 'quantity', value: '4', unit: 'tonne' },
      observedBy: OBSERVER,
      observedAt: T2,
      uncertainty: UncertaintyStateSchema.parse(uncertainty()),
    });
    expect(observation.ok).toBe(false);
    if (!observation.ok) {
      expect(observation.error.code).toBe('validation');
    }
  });
});
