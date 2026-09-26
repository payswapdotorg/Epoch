// POSITIVE: the acquisition package — the commercial projection of a
// W036 acquisition request (exact digest grounding), and the extension
// points: ALL SEVEN W036 acquisition variants project without new
// authorities.
import { describe, expect, it } from 'vitest';
import { ACQUISITION_VARIANTS, admitAcquisitionRequest } from '@epoch/solution-delivery';
import {
  admitAcquisitionPackage,
  canonicalDigest,
  emptyPackageStore,
  foldAcquisitionPackages,
  packageHead,
  sealAcquisitionPackage,
  verifySealedAcquisitionPackage,
} from '../src/index';
import { PACKAGE_ID, SOLUTION_ID, TENANT, T2, unwrap } from './fixtures';

const DETAILS: Record<string, Record<string, unknown>> = {
  'external-procurement': {
    variant: 'external-procurement',
    lines: [
      { description: 'Anchor bolts M24', quantity: '80', unit: 'piece', solutionLineId: 'line:earthworks' },
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

describe('the acquisition package (positive)', () => {
  it('wraps a REAL W036 acquisition request (digest-grounded, admitted)', () => {
    const request = unwrap(admitAcquisitionRequest(requestContent()));
    const sealed = unwrap(sealAcquisitionPackage(packageBody(request)));
    const store = unwrap(admitAcquisitionPackage([request], emptyPackageStore(), sealed));
    expect(store.packages).toHaveLength(1);
    expect(store.packages[0]!.acquisitionRequestDigest).toBe(canonicalDigest(request));
    expect(verifySealedAcquisitionPackage(sealed).ok).toBe(true);
  });

  it('EXTENSION POINTS: every W036 acquisition variant projects (no new authorities)', () => {
    for (const variant of ACQUISITION_VARIANTS) {
      const request = unwrap(
        admitAcquisitionRequest({
          ...requestContent(),
          acquisitionId: `acquisition:${variant}`,
          detail: DETAILS[variant]!,
        }),
      );
      const lines =
        variant === 'external-procurement'
          ? [
              { description: 'Anchor bolts M24', quantity: '80', unit: 'piece', solutionLineId: 'line:earthworks' },
              { description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne' },
            ]
          : [];
      const sealed = unwrap(
        sealAcquisitionPackage({
          ...packageBody(request, `acquisition:${variant}`, variant),
          packageId: `package:${variant}`,
          lines,
        }),
      );
      const store = unwrap(admitAcquisitionPackage([request], emptyPackageStore(), sealed));
      expect(store.packages[0]!.variant, variant).toBe(variant);
    }
  });

  it('exact re-admission is idempotent and the fold/head are deterministic', () => {
    const request = unwrap(admitAcquisitionRequest(requestContent()));
    const sealed = unwrap(sealAcquisitionPackage(packageBody(request)));
    const store = unwrap(admitAcquisitionPackage([request], emptyPackageStore(), sealed));
    const again = admitAcquisitionPackage([request], store, sealed);
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value.packages).toHaveLength(1);
    }
    expect(packageHead(store, PACKAGE_ID)!.contentDigest).toBe(sealed.contentDigest);
    expect(foldAcquisitionPackages(store)).toHaveLength(1);
  });
});

function requestContent(): Record<string, unknown> {
  return {
    schema: 'epoch.solution-delivery.acquisition-request',
    schemaVersion: 1,
    acquisitionId: 'acquisition:earthworks-materials',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    detail: {
      variant: 'external-procurement',
      lines: [
        { description: 'Anchor bolts M24', quantity: '80', unit: 'piece', solutionLineId: 'line:earthworks' },
        { description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne' },
      ],
    },
    requestedAt: T2,
    requestedBy: 'principal:procurement-lead',
  };
}

function packageBody(
  request: unknown,
  acquisitionId: string = 'acquisition:earthworks-materials',
  variant: string = 'external-procurement',
): Record<string, unknown> {
  return {
    schema: 'epoch.procurement.acquisition-package',
    schemaVersion: 1,
    packageId: PACKAGE_ID,
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    acquisitionId,
    acquisitionRequestDigest: canonicalDigest(request as never),
    variant,
    lines: [
      { description: 'Anchor bolts M24', quantity: '80', unit: 'piece', solutionLineId: 'line:earthworks' },
      { description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne' },
    ],
    assembledAt: T2,
    assembledBy: 'principal:procurement-lead',
  };
}
