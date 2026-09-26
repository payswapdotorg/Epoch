// NAMED NEGATIVES (DeliveryRecord): actualization from an UNACCEPTED
// observation; cross-tenant intake; lifecycle conflicts (accepting a
// rejected observation, rejecting an accepted/actualized one, intake into
// a closed delivery); duplicate intake; tampered state digest; dangling
// observation references.
import { describe, expect, it } from 'vitest';
import {
  acceptObservation,
  actualizeObservation,
  closeDeliveryRecord,
  openDeliveryRecord,
  recordObservation,
  rejectObservation,
  verifySealedDeliveryRecord,
} from '../src/index';
import {
  observationContent,
  openedDelivery,
  sealedObservation,
  sealedV1,
  T4,
  T5,
  T6,
  OTHER_TENANT,
} from './fixtures';

describe('NAMED NEGATIVE: actualization from an UNACCEPTED observation (unaccepted-actualization-rejected)', () => {
  it('a PROPOSED observation cannot be actualized', () => {
    const delivery = openedDelivery(sealedV1());
    const withObservation = recordObservation(delivery, sealedObservation());
    expect(withObservation.ok).toBe(true);
    if (!withObservation.ok) return;
    const actualized = actualizeObservation(withObservation.value, 'observation:pit-volume', {
      actualId: 'actual:pit-volume',
      actualizedBy: 'principal:delivery-lead',
      actualizedAt: T5,
    });
    expect(actualized.ok).toBe(false);
    if (!actualized.ok) {
      expect(actualized.error.code).toBe('unaccepted-actualization-rejected');
      if (actualized.error.code === 'unaccepted-actualization-rejected') {
        expect(actualized.error.observationState).toBe('proposed');
      }
    }
  });

  it('a REJECTED observation cannot be actualized', () => {
    const delivery = openedDelivery(sealedV1());
    const withObservation = recordObservation(delivery, sealedObservation());
    if (!withObservation.ok) return;
    const rejected = rejectObservation(withObservation.value, 'observation:pit-volume', {
      rejectedBy: 'principal:delivery-lead',
      rejectedAt: T4,
      reason: 'inconsistent with gauge evidence',
    });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    const actualized = actualizeObservation(rejected.value, 'observation:pit-volume', {
      actualId: 'actual:pit-volume',
      actualizedBy: 'principal:delivery-lead',
      actualizedAt: T5,
    });
    expect(actualized.ok).toBe(false);
    if (!actualized.ok) {
      expect(actualized.error.code).toBe('unaccepted-actualization-rejected');
      if (actualized.error.code === 'unaccepted-actualization-rejected') {
        expect(actualized.error.observationState).toBe('rejected');
      }
    }
  });

  it('an unrecorded observation cannot be actualized', () => {
    const delivery = openedDelivery(sealedV1());
    const actualized = actualizeObservation(delivery, 'observation:ghost', {
      actualId: 'actual:ghost',
      actualizedBy: 'principal:delivery-lead',
      actualizedAt: T5,
    });
    expect(actualized.ok).toBe(false);
    if (!actualized.ok) {
      expect(actualized.error.code).toBe('unaccepted-actualization-rejected');
      if (actualized.error.code === 'unaccepted-actualization-rejected') {
        expect(actualized.error.observationState).toBe('missing');
      }
    }
  });
});

describe('NAMED NEGATIVE: cross-tenant intake (cross-tenant-denied)', () => {
  it('an observation from another tenant is rejected', () => {
    const delivery = openedDelivery(sealedV1());
    const foreign = {
      ...sealedObservation(),
      tenantId: OTHER_TENANT,
    };
    const recorded = recordObservation(delivery, foreign);
    expect(recorded.ok).toBe(false);
    if (!recorded.ok) {
      expect(recorded.error.code).toBe('cross-tenant-denied');
    }
  });
});

describe('NAMED NEGATIVE: lifecycle conflicts (lifecycle-conflict)', () => {
  it('a rejected observation cannot be accepted', () => {
    const delivery = openedDelivery(sealedV1());
    const withObservation = recordObservation(delivery, sealedObservation());
    if (!withObservation.ok) return;
    const rejected = rejectObservation(withObservation.value, 'observation:pit-volume', {
      rejectedBy: 'principal:delivery-lead',
      rejectedAt: T4,
    });
    if (!rejected.ok) return;
    const accepted = acceptObservation(rejected.value, 'observation:pit-volume', {
      acceptedBy: 'principal:delivery-lead',
      acceptedAt: T5,
    });
    expect(accepted.ok).toBe(false);
    if (!accepted.ok) {
      expect(accepted.error.code).toBe('lifecycle-conflict');
    }
  });

  it('an accepted observation cannot be rejected', () => {
    const delivery = openedDelivery(sealedV1());
    const withObservation = recordObservation(delivery, sealedObservation());
    if (!withObservation.ok) return;
    const accepted = acceptObservation(withObservation.value, 'observation:pit-volume', {
      acceptedBy: 'principal:delivery-lead',
      acceptedAt: T4,
    });
    if (!accepted.ok) return;
    const rejected = rejectObservation(accepted.value, 'observation:pit-volume', {
      rejectedBy: 'principal:delivery-lead',
      rejectedAt: T5,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error.code).toBe('lifecycle-conflict');
    }
  });

  it('a closed delivery rejects further intake', () => {
    const delivery = openedDelivery(sealedV1());
    const closed = closeDeliveryRecord(delivery, {
      closedBy: 'principal:delivery-lead',
      closedAt: T6,
    });
    if (!closed.ok) return;
    const recorded = recordObservation(closed.value, sealedObservation());
    expect(recorded.ok).toBe(false);
    if (!recorded.ok) {
      expect(recorded.error.code).toBe('lifecycle-conflict');
    }
  });

  it('closing twice is rejected', () => {
    const delivery = openedDelivery(sealedV1());
    const closed = closeDeliveryRecord(delivery, {
      closedBy: 'principal:delivery-lead',
      closedAt: T6,
    });
    if (!closed.ok) return;
    const again = closeDeliveryRecord(closed.value, {
      closedBy: 'principal:delivery-lead',
      closedAt: T6,
    });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.code).toBe('lifecycle-conflict');
    }
  });
});

describe('NAMED NEGATIVE: duplicate intake and reuse (version-conflict)', () => {
  it('re-recording the same observation id is rejected', () => {
    const delivery = openedDelivery(sealedV1());
    const withObservation = recordObservation(delivery, sealedObservation());
    if (!withObservation.ok) return;
    const again = recordObservation(withObservation.value, sealedObservation());
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.code).toBe('version-conflict');
    }
  });

  it('an accepted observation converts exactly once', () => {
    const delivery = openedDelivery(sealedV1());
    const withObservation = recordObservation(delivery, sealedObservation());
    if (!withObservation.ok) return;
    const accepted = acceptObservation(withObservation.value, 'observation:pit-volume', {
      acceptedBy: 'principal:delivery-lead',
      acceptedAt: T4,
    });
    if (!accepted.ok) return;
    const first = actualizeObservation(accepted.value, 'observation:pit-volume', {
      actualId: 'actual:pit-volume',
      actualizedBy: 'principal:delivery-lead',
      actualizedAt: T5,
    });
    if (!first.ok) return;
    const second = actualizeObservation(first.value, 'observation:pit-volume', {
      actualId: 'actual:pit-volume-2',
      actualizedBy: 'principal:delivery-lead',
      actualizedAt: T6,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe('version-conflict');
    }
  });
});

describe('NAMED NEGATIVE: tampered state / malformed content', () => {
  it('a tampered delivery state digest is rejected', () => {
    const delivery = openedDelivery(sealedV1());
    const tampered = { ...delivery, openedBy: 'principal:someone-else' };
    const verified = verifySealedDeliveryRecord(tampered);
    expect(verified.ok).toBe(false);
    if (!verified.ok) {
      expect(verified.error.code).toBe('digest-mismatch');
    }
  });

  it('vendor fields on the delivery content are rejected', () => {
    const delivery = openedDelivery(sealedV1());
    const opened = openDeliveryRecord({
      ...delivery,
      sapDeliveryNumber: 'SAP-001',
    });
    expect(opened.ok).toBe(false);
    if (!opened.ok) {
      expect(opened.error.code).toBe('vendor-fields-rejected');
    }
  });

  it('an observation belonging to another delivery is rejected', () => {
    const delivery = openedDelivery(sealedV1());
    const basePayload = observationContent().payload as Record<string, unknown>;
    const foreign = {
      ...observationContent(),
      payload: {
        ...basePayload,
        deliveryId: 'delivery:elsewhere',
      },
    };
    const recorded = recordObservation(delivery, foreign);
    expect(recorded.ok).toBe(false);
    if (!recorded.ok) {
      expect(recorded.error.code).toBe('validation');
    }
  });
});
