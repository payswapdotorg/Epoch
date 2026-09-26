// POSITIVE: the observation -> acceptance -> actualization flow (USL1.0:
// Observation is evidence capture; Actualization converts ACCEPTED
// observations into authoritative delivery facts), plus the deterministic
// delivery folds and the closing transition.
import { describe, expect, it } from 'vitest';
import {
  acceptObservation,
  actualizeObservation,
  closeDeliveryRecord,
  foldDeliveryActuals,
  recordObservation,
  verifySealedDeliveryRecord,
} from '../src/index';
import { openedDelivery, sealedObservation, sealedV1, T3, T4, T5, T6 } from './fixtures';

describe('observation intake', () => {
  it('records a sealed observation into the delivery (immutable append)', () => {
    const delivery = openedDelivery(sealedV1());
    const recorded = recordObservation(delivery, sealedObservation());
    expect(recorded.ok).toBe(true);
    if (recorded.ok) {
      expect(recorded.value.observations).toHaveLength(1);
      expect(recorded.value.observations[0]!.recordId).toBe('observation:pit-volume');
      expect(recorded.value.contentDigest).not.toBe(delivery.contentDigest);
    }
  });

  it('every state transition yields a new sealed state (content addressing)', () => {
    const delivery = openedDelivery(sealedV1());
    const withObservation = recordObservation(delivery, sealedObservation());
    expect(withObservation.ok).toBe(true);
    if (!withObservation.ok) return;
    const roundTripped = JSON.parse(JSON.stringify(withObservation.value)) as unknown;
    const verified = verifySealedDeliveryRecord(roundTripped);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(withObservation.value);
    }
  });
});

describe('acceptance transition', () => {
  it('accepts a recorded observation (review state on the delivery, never on the record)', () => {
    const delivery = openedDelivery(sealedV1());
    const withObservation = recordObservation(delivery, sealedObservation());
    expect(withObservation.ok).toBe(true);
    if (!withObservation.ok) return;
    const accepted = acceptObservation(withObservation.value, 'observation:pit-volume', {
      acceptedBy: 'principal:delivery-lead',
      acceptedAt: T4,
    });
    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(accepted.value.acceptedObservationIds).toContain('observation:pit-volume');
      // the observation record itself is untouched:
      expect(accepted.value.observations[0]).toEqual(withObservation.value.observations[0]);
    }
  });

  it('re-accepting an accepted observation is idempotent', () => {
    const delivery = openedDelivery(sealedV1());
    const withObservation = recordObservation(delivery, sealedObservation());
    if (!withObservation.ok) return;
    const accepted = acceptObservation(withObservation.value, 'observation:pit-volume', {
      acceptedBy: 'principal:delivery-lead',
      acceptedAt: T4,
    });
    if (!accepted.ok) return;
    const again = acceptObservation(accepted.value, 'observation:pit-volume', {
      acceptedBy: 'principal:delivery-lead',
      acceptedAt: T5,
    });
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value).toEqual(accepted.value);
    }
  });
});

describe('actualization (ACCEPTED observations only)', () => {
  it('converts an accepted observation into an actual (the full flow)', () => {
    const delivery = openedDelivery(sealedV1());
    const withObservation = recordObservation(delivery, sealedObservation());
    if (!withObservation.ok) return;
    const accepted = acceptObservation(withObservation.value, 'observation:pit-volume', {
      acceptedBy: 'principal:delivery-lead',
      acceptedAt: T4,
    });
    if (!accepted.ok) return;
    const actualized = actualizeObservation(accepted.value, 'observation:pit-volume', {
      actualId: 'actual:pit-volume',
      actualizedBy: 'principal:delivery-lead',
      actualizedAt: T5,
    });
    expect(actualized.ok).toBe(true);
    if (actualized.ok) {
      expect(actualized.value.actuals).toHaveLength(1);
      const actual = actualized.value.actuals[0]!;
      expect(actual.recordId).toBe('actual:pit-volume');
      expect(actual.payload.derivedFromObservationId).toBe('observation:pit-volume');
      // the actual inherits the observation's measure and uncertainty:
      expect(actual.measure).toEqual(sealedObservation().measure);
      expect(actual.uncertainty).toEqual(sealedObservation().uncertainty);
      expect(actual.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('the folded delivery state totals the actualized facts', () => {
    const delivery = openedDelivery(sealedV1());
    const withObservation = recordObservation(delivery, sealedObservation());
    if (!withObservation.ok) return;
    const accepted = acceptObservation(withObservation.value, 'observation:pit-volume', {
      acceptedBy: 'principal:delivery-lead',
      acceptedAt: T4,
    });
    if (!accepted.ok) return;
    const actualized = actualizeObservation(accepted.value, 'observation:pit-volume', {
      actualId: 'actual:pit-volume',
      actualizedBy: 'principal:delivery-lead',
      actualizedAt: T5,
    });
    if (!actualized.ok) return;
    const summary = foldDeliveryActuals(actualized.value);
    expect(summary.actualCount).toBe(1);
    expect(summary.observationCounts).toEqual({ total: 1, accepted: 1, rejected: 0, proposed: 0 });
    expect(summary.totals).toEqual([
      {
        subjectKind: 'activity',
        subjectId: 'activity:excavate',
        measureKind: 'quantity',
        unit: 'm3',
        currency: undefined,
        total: '118.5',
      },
    ]);
  });
});

describe('closing', () => {
  it('closes an open delivery', () => {
    const delivery = openedDelivery(sealedV1());
    const closed = closeDeliveryRecord(delivery, {
      closedBy: 'principal:delivery-lead',
      closedAt: T6,
    });
    expect(closed.ok).toBe(true);
    if (closed.ok) {
      expect(closed.value.status).toBe('closed');
      expect(closed.value.closedAt).toBe(T6);
    }
  });
});

describe('determinism', () => {
  it('the intake keeps observations canonically ordered', () => {
    const delivery = openedDelivery(sealedV1());
    const second = {
      ...sealedObservation(),
      recordId: 'observation:aaa-early',
      payload: {
        ...sealedObservation().payload,
        observedAt: T3,
      },
    };
    const first = recordObservation(delivery, sealedObservation());
    if (!first.ok) return;
    const both = recordObservation(first.value, second);
    expect(both.ok).toBe(true);
    if (both.ok) {
      expect(both.value.observations.map((observation) => observation.recordId)).toEqual([
        'observation:aaa-early',
        'observation:pit-volume',
      ]);
    }
  });
});
