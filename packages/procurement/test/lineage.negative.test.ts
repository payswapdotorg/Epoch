// NEGATIVE: requirement lineage — dangling requirement / dangling
// package, cross-tenant links, immutable-record conflicts, vendor and
// authority fields.
import { describe, expect, it } from 'vitest';
import {
  admitRequirementLineage,
  emptyLineageStore,
  sealRequirementLineage,
  verifySealedRequirementLineage,
} from '../src/index';
import {
  OTHER_TENANT,
  PACKAGE_ID,
  PRINCIPAL,
  SOLUTION_ID,
  TENANT,
  T2,
  WORK_PACKAGE_ID,
  packageStore,
  unwrap,
} from './fixtures';

function lineageContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.procurement.requirement-lineage',
    schemaVersion: 1,
    lineageId: 'lineage:earthworks-steel-a',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    requirementRef: { kind: 'work-package', workPackageId: WORK_PACKAGE_ID },
    packageId: PACKAGE_ID,
    recordedAt: T2,
    recordedBy: PRINCIPAL,
    ...overrides,
  };
}

describe('requirement lineage (negative)', () => {
  it('a dangling requirement reference is dangling-reference-rejected (kind requirement)', () => {
    const sealed = unwrap(sealRequirementLineage(lineageContent()));
    const admitted = admitRequirementLineage(
      ['work-package:some-other-requirement'],
      packageStore(),
      emptyLineageStore(),
      sealed,
    );
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('dangling-reference-rejected');
    if (admitted.error.code === 'dangling-reference-rejected') {
      expect(admitted.error.referenceKind).toBe('requirement');
      expect(admitted.error.referenceId).toBe(WORK_PACKAGE_ID);
    }
  });

  it('a dangling acquisition package is dangling-reference-rejected (kind acquisition-package)', () => {
    const sealed = unwrap(
      sealRequirementLineage(lineageContent({ packageId: 'package:does-not-exist' })),
    );
    const admitted = admitRequirementLineage(
      [WORK_PACKAGE_ID],
      packageStore(),
      emptyLineageStore(),
      sealed,
    );
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('dangling-reference-rejected');
    if (admitted.error.code === 'dangling-reference-rejected') {
      expect(admitted.error.referenceKind).toBe('acquisition-package');
    }
  });

  it('a cross-tenant lineage link is tenant-isolation-rejected', () => {
    const sealed = unwrap(
      sealRequirementLineage(
        lineageContent({
          lineageId: 'lineage:foreign',
          tenantId: OTHER_TENANT,
        }),
      ),
    );
    const admitted = admitRequirementLineage(
      [WORK_PACKAGE_ID],
      packageStore(),
      emptyLineageStore(),
      sealed,
    );
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('tenant-isolation-rejected');
  });

  it('the same lineage id with different content is version-conflict', () => {
    const packages = packageStore();
    const first = unwrap(sealRequirementLineage(lineageContent()));
    const store = unwrap(
      admitRequirementLineage([WORK_PACKAGE_ID], packages, emptyLineageStore(), first),
    );
    const second = unwrap(sealRequirementLineage(lineageContent({ note: 'changed content' })));
    const admitted = admitRequirementLineage([WORK_PACKAGE_ID], packages, store, second);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('version-conflict');
  });

  it('the same (requirement, package) pair under a new lineage id is version-conflict', () => {
    const packages = packageStore();
    const first = unwrap(sealRequirementLineage(lineageContent()));
    const store = unwrap(
      admitRequirementLineage([WORK_PACKAGE_ID], packages, emptyLineageStore(), first),
    );
    const secondSamePair = unwrap(
      sealRequirementLineage(lineageContent({ lineageId: 'lineage:duplicate-pair' })),
    );
    const admitted = admitRequirementLineage([WORK_PACKAGE_ID], packages, store, secondSamePair);
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('version-conflict');
  });

  it('vendor fields cannot enter a lineage record (strict objects)', () => {
    const sealed = sealRequirementLineage(
      lineageContent({ vendorPortal: 'supplier-portal.example' }),
    );
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('vendor-fields-rejected');
  });

  it('authority-claim fields are authority-violation-rejected BEFORE schema validation', () => {
    const sealed = sealRequirementLineage(lineageContent({ lifecycleAuthority: 'procurement' }));
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('authority-violation-rejected');
  });

  it('a tampered digest is digest-mismatch at verification', () => {
    const sealed = unwrap(sealRequirementLineage(lineageContent()));
    const tampered = { ...sealed, contentDigest: 'f'.repeat(64) };
    const verified = verifySealedRequirementLineage(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
  });
});
