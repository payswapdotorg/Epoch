// NEGATIVE: the acquisition package — wrong request digest (drift), a
// variant outside the closed W036 catalog, commercial lines that do not
// mirror the request lines, cross-tenant packages, vendor/authority
// fields, tampered digests.
import { describe, expect, it } from 'vitest';
import { admitAcquisitionRequest } from '@epoch/solution-delivery';
import {
  admitAcquisitionPackage,
  canonicalDigest,
  emptyPackageStore,
  sealAcquisitionPackage,
  verifySealedAcquisitionPackage,
} from '../src/index';
import { PACKAGE_ID, SOLUTION_ID, TENANT, T2, unwrap } from './fixtures';

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
        { description: 'Anchor bolts M24', quantity: '80', unit: 'piece' },
        { description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne' },
      ],
    },
    requestedAt: T2,
    requestedBy: 'principal:procurement-lead',
  };
}

function packageBody(digest: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.procurement.acquisition-package',
    schemaVersion: 1,
    packageId: PACKAGE_ID,
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    acquisitionId: 'acquisition:earthworks-materials',
    acquisitionRequestDigest: digest,
    variant: 'external-procurement',
    lines: [
      { description: 'Anchor bolts M24', quantity: '80', unit: 'piece' },
      { description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne' },
    ],
    assembledAt: T2,
    assembledBy: 'principal:procurement-lead',
    ...overrides,
  };
}

describe('the acquisition package (negative)', () => {
  it('a package digest that drifts from the admitted request is digest-mismatch', () => {
    const request = unwrap(admitAcquisitionRequest(requestContent()));
    const sealed = unwrap(
      sealAcquisitionPackage(packageBody('0'.repeat(64))),
    );
    const admitted = admitAcquisitionPackage([request], emptyPackageStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('digest-mismatch');
    if (admitted.error.code === 'digest-mismatch') {
      expect(admitted.error.expected).toBe(canonicalDigest(request));
      expect(admitted.error.encountered).toBe('0'.repeat(64));
    }
  });

  it('a dangling acquisition request is dangling-reference-rejected (kind acquisition-request)', () => {
    const sealed = unwrap(sealAcquisitionPackage(packageBody('0'.repeat(64))));
    const admitted = admitAcquisitionPackage([], emptyPackageStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('dangling-reference-rejected');
    if (admitted.error.code === 'dangling-reference-rejected') {
      expect(admitted.error.referenceKind).toBe('acquisition-request');
    }
  });

  it('a variant outside the closed W036 catalog is validation (never a new lifecycle authority)', () => {
    const sealed = sealAcquisitionPackage(
      packageBody('0'.repeat(64), { variant: 'vendor-portal-acquisition' }),
    );
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('validation');
  });

  it('commercial lines that do NOT mirror the request lines are validation', () => {
    const request = unwrap(admitAcquisitionRequest(requestContent()));
    const sealed = unwrap(
      sealAcquisitionPackage(
        packageBody(canonicalDigest(request), {
          lines: [
            { description: 'Anchor bolts M24', quantity: '120', unit: 'piece' },
            { description: 'Structural steel HEB 200', quantity: '4', unit: 'tonne' },
          ],
        }),
      ),
    );
    const admitted = admitAcquisitionPackage([request], emptyPackageStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('validation');
  });

  it('a cross-tenant package over the request is tenant-isolation-rejected', () => {
    const request = unwrap(admitAcquisitionRequest(requestContent()));
    const sealed = unwrap(
      sealAcquisitionPackage(
        packageBody(canonicalDigest(request), { tenantId: 'tenant:initech' }),
      ),
    );
    const admitted = admitAcquisitionPackage([request], emptyPackageStore(), sealed);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('tenant-isolation-rejected');
  });

  it('vendor fields cannot enter a package (strict objects)', () => {
    const sealed = sealAcquisitionPackage(
      packageBody('0'.repeat(64), { supplierPortalUrl: 'https://vendor.example' }),
    );
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('vendor-fields-rejected');
  });

  it('authority-claim fields are authority-violation-rejected', () => {
    const sealed = sealAcquisitionPackage(
      packageBody('0'.repeat(64), { scheduleAuthority: 'procurement' }),
    );
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('authority-violation-rejected');
  });

  it('a tampered package digest is digest-mismatch at verification', () => {
    const request = unwrap(admitAcquisitionRequest(requestContent()));
    const sealed = unwrap(sealAcquisitionPackage(packageBody(canonicalDigest(request))));
    const tampered = { ...sealed, contentDigest: 'e'.repeat(64) };
    const verified = verifySealedAcquisitionPackage(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
  });
});
