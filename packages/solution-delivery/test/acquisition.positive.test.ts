// POSITIVE: the acquisition-variant catalog — every variant validates
// (external procurement, internal allocation, subscription/license, cloud
// provisioning, fabrication, specialist capability, data/evidence) — plus
// fulfillment.
import { describe, expect, it } from 'vitest';
import {
  ACQUISITION_VARIANTS,
  admitAcquisitionFulfillment,
  admitAcquisitionRequest,
  type AcquisitionRequestRecord,
} from '../src/index';
import { PRINCIPAL, T1, T2, T3, TENANT } from './fixtures';

function requestFor(variant: string, overrides: Record<string, unknown> = {}) {
  const details: Record<string, unknown> = {
    'external-procurement': {
      variant: 'external-procurement',
      lines: [
        { description: 'Anchor bolts M24', quantity: '80', unit: 'piece', externalPartyRef: 'external:supplier-desk' },
        { description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne' },
      ],
    },
    'internal-allocation': {
      variant: 'internal-allocation',
      resourceRef: 'resource:crane-1',
      quantity: '1',
      unit: 'machine',
      fromScope: 'workspace:yard-a',
    },
    'subscription-license': {
      variant: 'subscription-license',
      licenseRef: 'license:structural-suite',
      seats: 5,
      termNote: 'annual term',
    },
    'cloud-service-provisioning': {
      variant: 'cloud-service-provisioning',
      serviceKind: 'simulation-cluster',
      capacityNote: '8 vCPU per run',
    },
    'fabrication-request': {
      variant: 'fabrication-request',
      designRef: 'design:brace-frame-r3',
      quantity: '4',
      unit: 'tonne',
    },
    'specialist-capability-assignment': {
      variant: 'specialist-capability-assignment',
      capabilityRef: 'capability:welding-inspection',
      assignee: 'principal:weld-inspector',
    },
    'data-evidence-acquisition': {
      variant: 'data-evidence-acquisition',
      subjectRef: 'dataset:soil-surveys',
    },
  };
  return {
    schema: 'epoch.solution-delivery.acquisition-request',
    schemaVersion: 1,
    acquisitionId: `acquisition:${variant}`,
    tenantId: TENANT,
    solutionId: 'solution:tower-retrofit',
    deliveryId: 'delivery:tower-retrofit-v1',
    detail: details[variant],
    requestedAt: T1,
    requestedBy: PRINCIPAL,
    neededBy: T2,
    ...overrides,
  };
}

describe('the acquisition-variant catalog (USL1.0, binding)', () => {
  it('covers exactly the seven universal variants', () => {
    expect([...ACQUISITION_VARIANTS]).toEqual([
      'external-procurement',
      'internal-allocation',
      'subscription-license',
      'cloud-service-provisioning',
      'fabrication-request',
      'specialist-capability-assignment',
      'data-evidence-acquisition',
    ]);
  });

  it('every variant validates across the full catalog', () => {
    for (const variant of ACQUISITION_VARIANTS) {
      const admitted = admitAcquisitionRequest(requestFor(variant));
      expect(admitted.ok, variant).toBe(true);
      if (admitted.ok) {
        expect(admitted.value.detail.variant).toBe(variant);
      }
    }
  });

  it('the request round-trips through JSON serialization', () => {
    const admitted = admitAcquisitionRequest(requestFor('external-procurement'));
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const roundTripped = JSON.parse(JSON.stringify(admitted.value)) as unknown;
    const reAdmitted = admitAcquisitionRequest(roundTripped);
    expect(reAdmitted.ok).toBe(true);
    if (reAdmitted.ok) {
      expect(reAdmitted.value).toEqual(admitted.value);
    }
  });
});

describe('acquisition fulfillment', () => {
  it('fulfills a known request (a distinct record referencing the request)', () => {
    const request = admitAcquisitionRequest(requestFor('fabrication-request'));
    expect(request.ok).toBe(true);
    if (!request.ok) return;
    const fulfilled = admitAcquisitionFulfillment([request.value], [], {
      schema: 'epoch.solution-delivery.acquisition-fulfillment',
      schemaVersion: 1,
      fulfillmentId: 'fulfillment:fab-1',
      tenantId: TENANT,
      acquisitionId: 'acquisition:fabrication-request',
      fulfilledAt: T3,
      fulfilledBy: PRINCIPAL,
      externalReference: 'external:workshop-order-9',
    });
    expect(fulfilled.ok).toBe(true);
    if (fulfilled.ok) {
      expect(fulfilled.value).toHaveLength(1);
    }
  });
});

describe('type-level catalog completeness', () => {
  it('the admitted record type carries the discriminated detail union', () => {
    const request: AcquisitionRequestRecord | null = (() => {
      const admitted = admitAcquisitionRequest(requestFor('data-evidence-acquisition'));
      return admitted.ok ? admitted.value : null;
    })();
    expect(request !== null).toBe(true);
    if (request !== null) {
      expect(request.detail.variant).toBe('data-evidence-acquisition');
    }
  });
});
