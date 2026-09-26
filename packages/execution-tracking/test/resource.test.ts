// LABOR/EQUIPMENT/MATERIAL/RESOURCE OBSERVATIONS: typed, content-addressed
// usage records (quantity + unit + time + provenance + the MANDATORY
// uncertainty state), linked to work-package references; deterministic
// usage folds.
import { describe, expect, it } from 'vitest';
import {
  admitResourceObservation,
  foldResourceUsage,
  sealResourceObservation,
  verifySealedResourceObservation,
} from '../src/index';
import {
  ACTIVITY_ID,
  OBSERVER,
  SOLUTION_ID,
  T3,
  TENANT,
  WORK_PACKAGE_ID,
  uncertainty,
  trackingStore,
} from './fixtures';
import { expectError, unwrap } from './helpers';

function resourceObservation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.execution-tracking.resource-observation',
    schemaVersion: 1,
    recordId: 'resource-observation:crew-alpha-shift',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    workPackageId: WORK_PACKAGE_ID,
    activityId: ACTIVITY_ID,
    resourceKind: 'labor',
    resourceId: 'resource:crew-alpha',
    quantity: '8',
    unit: 'hour',
    usageAt: T3,
    observedBy: OBSERVER,
    recordedAt: T3,
    recordedBy: OBSERVER,
    evidenceLinks: [],
    uncertainty: uncertainty(),
    ...overrides,
  };
}

describe('resource observations (positive)', () => {
  it('seals and admits a labor usage observation', () => {
    const store = trackingStore();
    const sealed = unwrap(sealResourceObservation(resourceObservation()));
    const admitted = unwrap(admitResourceObservation(store, sealed));
    expect(admitted.duplicate).toBe(false);
    expect(admitted.store.resourceObservations).toHaveLength(1);
  });

  it('an exact re-admission is idempotent', () => {
    const store = trackingStore();
    const sealed = unwrap(sealResourceObservation(resourceObservation()));
    const first = unwrap(admitResourceObservation(store, sealed));
    const again = unwrap(admitResourceObservation(first.store, sealed));
    expect(again.duplicate).toBe(true);
    expect(again.store).toBe(first.store);
  });

  it('the usage fold totals per (workPackage, kind, unit) exactly', () => {
    const store = trackingStore();
    const a = unwrap(admitResourceObservation(store, unwrap(sealResourceObservation(resourceObservation({ recordId: 'resource-observation:a', quantity: '8' })))));
    const b = unwrap(
      admitResourceObservation(
        a.store,
        unwrap(
          sealResourceObservation(
            resourceObservation({
              recordId: 'resource-observation:b',
              quantity: '6.5',
              resourceKind: 'equipment',
              resourceId: 'resource:excavator-1',
              unit: 'hour',
            }),
          ),
        ),
      ),
    );
    const c = unwrap(
      admitResourceObservation(
        b.store,
        unwrap(
          sealResourceObservation(
            resourceObservation({
              recordId: 'resource-observation:c',
              quantity: '40',
              resourceKind: 'material',
              resourceId: 'resource:concrete-c25',
              unit: 'm3',
            }),
          ),
        ),
      ),
    );
    const d = unwrap(
      admitResourceObservation(
        c.store,
        unwrap(
          sealResourceObservation(
            resourceObservation({
              recordId: 'resource-observation:d',
              quantity: '2.25',
            }),
          ),
        ),
      ),
    );
    const totals = foldResourceUsage(d.store.resourceObservations);
    expect(totals).toEqual([
      { workPackageId: WORK_PACKAGE_ID, resourceKind: 'equipment', unit: 'hour', total: '6.5', observationCount: 1 },
      { workPackageId: WORK_PACKAGE_ID, resourceKind: 'labor', unit: 'hour', total: '10.25', observationCount: 2 },
      { workPackageId: WORK_PACKAGE_ID, resourceKind: 'material', unit: 'm3', total: '40', observationCount: 1 },
    ]);
  });

  it('the fold is invariant under admission-order permutation (input order never leaks)', () => {
    const records = [1, 2, 3, 4].map((index) =>
      unwrap(
        sealResourceObservation(
          resourceObservation({
            recordId: `resource-observation:perm-${index}`,
            quantity: `${index}`,
          }),
        ),
      ),
    );
    const forward = foldResourceUsage(records);
    const reversed = foldResourceUsage([...records].reverse());
    expect(reversed).toEqual(forward);
  });
});

describe('resource observations (negative)', () => {
  it('a missing uncertainty state is uncertainty-missing-rejected', () => {
    const store = trackingStore();
    const error = expectError(
      admitResourceObservation(store, { ...resourceObservation(), uncertainty: undefined }),
    );
    expect(error.code).toBe('uncertainty-missing-rejected');
  });

  it('a dangling work-package reference is dangling-reference-rejected', () => {
    const store = trackingStore();
    const sealed = unwrap(
      sealResourceObservation(resourceObservation({ workPackageId: 'work-package:not-in-program' })),
    );
    const error = expectError(admitResourceObservation(store, sealed));
    expect(error.code).toBe('dangling-reference-rejected');
  });

  it('a dangling activity reference (wrong package) is dangling-reference-rejected', () => {
    const store = trackingStore();
    const sealed = unwrap(
      sealResourceObservation(resourceObservation({ activityId: 'activity:brace-frame' })),
    );
    const error = expectError(admitResourceObservation(store, sealed));
    expect(error.code).toBe('dangling-reference-rejected');
    expect((error as { referenceKind?: string }).referenceKind).toBe('activity');
  });

  it('cross-tenant records are tenant-isolation-rejected', () => {
    const store = trackingStore();
    const sealed = unwrap(
      sealResourceObservation(resourceObservation({ tenantId: 'tenant:initech' })),
    );
    const error = expectError(admitResourceObservation(store, sealed));
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('the same id with different content is version-conflict', () => {
    const store = trackingStore();
    const first = unwrap(admitResourceObservation(store, unwrap(sealResourceObservation(resourceObservation()))));
    const conflicting = unwrap(
      sealResourceObservation(resourceObservation({ quantity: '99' })),
    );
    const error = expectError(admitResourceObservation(first.store, conflicting));
    expect(error.code).toBe('version-conflict');
  });

  it('a tampered digest is digest-mismatch', () => {
    const sealed = unwrap(sealResourceObservation(resourceObservation()));
    const error = expectError(verifySealedResourceObservation({ ...sealed, contentDigest: 'e'.repeat(64) }));
    expect(error.code).toBe('digest-mismatch');
  });

  it('declaring a schedule field is authority-violation-rejected', () => {
    const store = trackingStore();
    const error = expectError(
      admitResourceObservation(store, { ...resourceObservation(), actualProgress: 0.4 }),
    );
    expect(error.code).toBe('authority-violation-rejected');
    expect((error as { field?: string }).field).toBe('actualProgress');
  });
});
