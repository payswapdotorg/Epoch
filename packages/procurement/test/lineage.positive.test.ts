// POSITIVE: requirement -> acquisition-package lineage — fan-out (one
// requirement, many acquisition attempts), provenance, tenant scope,
// idempotent re-admission.
import { describe, expect, it } from 'vitest';
import {
  acquisitionAttemptsOf,
  admitAcquisitionPackage,
  admitRequirementLineage,
  emptyLineageStore,
  emptyPackageStore,
  foldRequirementLineages,
  sealRequirementLineage,
  verifySealedRequirementLineage,
} from '../src/index';
import {
  PACKAGE_ID,
  PACKAGE_ID_B,
  PRINCIPAL,
  SOLUTION_ID,
  SOLUTION_LINE_ID,
  TENANT,
  T2,
  T3,
  WORK_PACKAGE_ID,
  acquisitionRequest,
  packageStore,
  sealedPackage,
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

/** A package store holding two packages over the SAME request (two attempts). */
function twoPackageStore() {
  const request = acquisitionRequest();
  const first = sealedPackage(request);
  const second = sealedPackage(request, { packageId: PACKAGE_ID_B, assembledAt: T3 });
  const store = unwrap(admitAcquisitionPackage([request], emptyPackageStore(), first));
  return unwrap(admitAcquisitionPackage([request], store, second));
}

describe('requirement lineage (positive)', () => {
  it('binds a ProgramOfWork requirement to an acquisition package (sealed + verified)', () => {
    const packages = packageStore();
    const sealed = unwrap(sealRequirementLineage(lineageContent()));
    const store = unwrap(
      admitRequirementLineage([WORK_PACKAGE_ID, SOLUTION_LINE_ID], packages, emptyLineageStore(), sealed),
    );
    expect(store.lineages).toHaveLength(1);
    expect(store.lineages[0]!.packageId).toBe(PACKAGE_ID);
    expect(verifySealedRequirementLineage(sealed).ok).toBe(true);
  });

  it('solution-line requirement references bind as well as work-package ones', () => {
    const packages = packageStore();
    const sealed = unwrap(
      sealRequirementLineage(
        lineageContent({ requirementRef: { kind: 'solution-line', solutionLineId: SOLUTION_LINE_ID } }),
      ),
    );
    const store = unwrap(
      admitRequirementLineage([WORK_PACKAGE_ID, SOLUTION_LINE_ID], packages, emptyLineageStore(), sealed),
    );
    expect(store.lineages).toHaveLength(1);
  });

  it('FAN-OUT: one requirement may drive many acquisition attempts', () => {
    const packages = twoPackageStore();
    expect(packages.packages).toHaveLength(2);
    const storeA = unwrap(
      admitRequirementLineage(
        [WORK_PACKAGE_ID],
        packages,
        emptyLineageStore(),
        unwrap(sealRequirementLineage(lineageContent())),
      ),
    );
    const storeB = unwrap(
      admitRequirementLineage(
        [WORK_PACKAGE_ID],
        packages,
        storeA,
        unwrap(
          sealRequirementLineage(
            lineageContent({
              lineageId: 'lineage:earthworks-steel-b',
              packageId: PACKAGE_ID_B,
              recordedAt: T3,
            }),
          ),
        ),
      ),
    );
    expect(storeB.lineages).toHaveLength(2);
    const attempts = acquisitionAttemptsOf(storeB, WORK_PACKAGE_ID);
    expect(attempts.map((record) => record.packageId).sort()).toEqual([PACKAGE_ID, PACKAGE_ID_B]);
  });

  it('exact re-admission is idempotent (the store does not grow)', () => {
    const packages = packageStore();
    const sealed = unwrap(sealRequirementLineage(lineageContent()));
    const store = unwrap(
      admitRequirementLineage([WORK_PACKAGE_ID], packages, emptyLineageStore(), sealed),
    );
    const again = admitRequirementLineage([WORK_PACKAGE_ID], packages, store, sealed);
    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.value.lineages).toHaveLength(1);
    }
  });

  it('the fold is sorted by lineage id (deterministic projection)', () => {
    const packages = twoPackageStore();
    const store = unwrap(
      admitRequirementLineage(
        [WORK_PACKAGE_ID],
        packages,
        emptyLineageStore(),
        unwrap(
          sealRequirementLineage(
            lineageContent({ lineageId: 'lineage:aaa-first', packageId: PACKAGE_ID }),
          ),
        ),
      ),
    );
    const storeB = unwrap(
      admitRequirementLineage(
        [WORK_PACKAGE_ID],
        packages,
        store,
        unwrap(
          sealRequirementLineage(
            lineageContent({ lineageId: 'lineage:zzz-second', packageId: PACKAGE_ID_B }),
          ),
        ),
      ),
    );
    const folded = foldRequirementLineages(storeB);
    expect(folded.map((record) => record.lineageId)).toEqual(['lineage:aaa-first', 'lineage:zzz-second']);
  });
});
