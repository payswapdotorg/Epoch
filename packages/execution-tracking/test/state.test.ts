// WORK-PACKAGE/ACTIVITY STATE TRACKING: typed, sealed, append-only state
// records referencing ProgramOfWork items by OPAQUE ID; transitions are
// recorded events with provenance; the schedule authority STAYS in
// ProgramOfWork (schedule fields are authority violations); the chain is
// append-only (illegal arcs and discontinuous chains are typed
// lifecycle-conflicts).
import { describe, expect, it } from 'vitest';
import {
  admitTrackingState,
  currentTrackingState,
  deriveWorkPackageState,
  foldTrackingStates,
  sealTrackingStateRecord,
  verifySealedTrackingStateRecord,
} from '../src/index';
import {
  ACTIVITY_ID,
  OBSERVER,
  SOLUTION_ID,
  T3,
  T4,
  TENANT,
  WORK_PACKAGE_ID,
  uncertainty,
  trackingStore,
} from './fixtures';
import { expectError, unwrap } from './helpers';

function trackingRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.execution-tracking.tracking-state',
    schemaVersion: 1,
    recordId: 'state:excavate-start',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    subject: { workPackageId: WORK_PACKAGE_ID, activityId: ACTIVITY_ID },
    fromState: 'not-started',
    toState: 'in-progress',
    cause: 'crew mobilized and digging',
    observedAt: T3,
    recordedAt: T3,
    recordedBy: OBSERVER,
    evidenceLinks: [],
    uncertainty: uncertainty(),
    ...overrides,
  };
}

describe('tracking-state admission (positive)', () => {
  it('admits a legal genesis transition and folds the current state', () => {
    const store = trackingStore();
    const sealed = unwrap(sealTrackingStateRecord(trackingRecord()));
    const admitted = unwrap(admitTrackingState(store, sealed));
    expect(admitted.duplicate).toBe(false);
    expect(admitted.store.tracking).toHaveLength(1);
    expect(currentTrackingState(admitted.store.tracking, {
      workPackageId: WORK_PACKAGE_ID,
      activityId: ACTIVITY_ID,
    })).toBe('in-progress');
  });

  it('admits a legal chained transition (in-progress -> completed) and folds forward', () => {
    const store = trackingStore();
    const first = unwrap(admitTrackingState(store, unwrap(sealTrackingStateRecord(trackingRecord()))));
    const second = unwrap(
      admitTrackingState(
        first.store,
        unwrap(
          sealTrackingStateRecord(
            trackingRecord({
              recordId: 'state:excavate-done',
              fromState: 'in-progress',
              toState: 'completed',
              cause: 'pit at design depth',
              observedAt: T4,
              recordedAt: T4,
            }),
          ),
        ),
      ),
    );
    const fold = foldTrackingStates(second.store.tracking);
    expect(fold).toHaveLength(1);
    expect(fold[0]!.state).toBe('completed');
    expect(fold[0]!.recordCount).toBe(2);
    expect(fold[0]!.lastRecordId).toBe('state:excavate-done');
  });

  it('an exact re-admission is idempotent (same digest, state unchanged)', () => {
    const store = trackingStore();
    const sealed = unwrap(sealTrackingStateRecord(trackingRecord()));
    const first = unwrap(admitTrackingState(store, sealed));
    const again = unwrap(admitTrackingState(first.store, sealed));
    expect(again.duplicate).toBe(true);
    expect(again.store).toBe(first.store);
  });

  it('work-package-level records track the package itself (no activity)', () => {
    const store = trackingStore();
    const admitted = unwrap(
      admitTrackingState(
        store,
        unwrap(
          sealTrackingStateRecord(
            trackingRecord({
              recordId: 'state:earthworks-start',
              subject: { workPackageId: WORK_PACKAGE_ID },
            }),
          ),
        ),
      ),
    );
    const fold = foldTrackingStates(admitted.store.tracking);
    expect(fold[0]!.activityId).toBeUndefined();
    expect(fold[0]!.state).toBe('in-progress');
  });

  it('deriveWorkPackageState derives the package state from activity states', () => {
    expect(deriveWorkPackageState(['completed', 'completed'])).toBe('completed');
    expect(deriveWorkPackageState(['completed', 'blocked'])).toBe('blocked');
    expect(deriveWorkPackageState(['completed', 'in-progress'])).toBe('in-progress');
    expect(deriveWorkPackageState(['not-started', 'not-started'])).toBe('not-started');
    expect(deriveWorkPackageState([])).toBe('not-started');
  });

  it('the fold walks the chain, not recordId order (deterministic current state)', () => {
    // Two records where recordId order REVERSES chain order: the fold must
    // still land on the chain head (state:z is the genesis, state:a the successor).
    const store = trackingStore();
    const genesis = unwrap(
      admitTrackingState(
        store,
        unwrap(
          sealTrackingStateRecord(
            trackingRecord({ recordId: 'state:z-genesis', toState: 'in-progress' }),
          ),
        ),
      ),
    );
    const successor = unwrap(
      admitTrackingState(
        genesis.store,
        unwrap(
          sealTrackingStateRecord(
            trackingRecord({
              recordId: 'state:a-successor',
              fromState: 'in-progress',
              toState: 'completed',
              observedAt: T4,
              recordedAt: T4,
            }),
          ),
        ),
      ),
    );
    const fold = foldTrackingStates(successor.store.tracking);
    expect(fold[0]!.state).toBe('completed');
    expect(fold[0]!.lastRecordId).toBe('state:a-successor');
  });
});

describe('tracking-state admission (negative)', () => {
  it('an illegal arc is rejected at sealing (completed -> in-progress is not a legal transition)', () => {
    const sealed = sealTrackingStateRecord(
      trackingRecord({ fromState: 'completed', toState: 'in-progress' }),
    );
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('validation');
      expect(JSON.stringify(sealed.error)).toContain('illegal tracking transition');
    }
  });

  it('a self-transition is rejected at sealing (in-progress -> in-progress is not a legal arc)', () => {
    const sealed = sealTrackingStateRecord(
      trackingRecord({ fromState: 'in-progress', toState: 'in-progress' }),
    );
    expect(sealed.ok).toBe(false);
  });

  it('a discontinuous chain (wrong fromState) is a typed lifecycle-conflict (broken chain)', () => {
    const store = trackingStore();
    const first = unwrap(admitTrackingState(store, unwrap(sealTrackingStateRecord(trackingRecord()))));
    const broken = unwrap(
      sealTrackingStateRecord(
        trackingRecord({
          recordId: 'state:excavate-broken',
          fromState: 'blocked',
          toState: 'completed',
          observedAt: T4,
          recordedAt: T4,
        }),
      ),
    );
    const error = expectError(admitTrackingState(first.store, broken));
    expect(error.code).toBe('lifecycle-conflict');
    expect((error as { from?: string }).from).toBe('blocked');
  });

  it('admitting work beyond a terminal state is a broken-chain lifecycle-conflict', () => {
    const store = trackingStore();
    const first = unwrap(
      admitTrackingState(
        store,
        unwrap(sealTrackingStateRecord(trackingRecord({ toState: 'completed' }))),
      ),
    );
    const late = unwrap(
      sealTrackingStateRecord(
        trackingRecord({
          recordId: 'state:excavate-late',
          fromState: 'blocked',
          toState: 'completed',
          observedAt: T4,
          recordedAt: T4,
        }),
      ),
    );
    const error = expectError(admitTrackingState(first.store, late));
    expect(error.code).toBe('lifecycle-conflict');
    expect((error as { from?: string }).from).toBe('blocked');
  });

  it('a dangling work-package reference is a typed dangling-reference-rejected', () => {
    const store = trackingStore();
    const sealed = unwrap(
      sealTrackingStateRecord(
        trackingRecord({
          subject: { workPackageId: 'work-package:not-in-program' },
        }),
      ),
    );
    const error = expectError(admitTrackingState(store, sealed));
    expect(error.code).toBe('dangling-reference-rejected');
    expect((error as { referenceKind?: string }).referenceKind).toBe('work-package');
  });

  it('a dangling activity reference (wrong package) is a typed dangling-reference-rejected', () => {
    const store = trackingStore();
    const sealed = unwrap(
      sealTrackingStateRecord(
        trackingRecord({
          subject: {
            workPackageId: WORK_PACKAGE_ID,
            activityId: 'activity:brace-frame',
          },
        }),
      ),
    );
    const error = expectError(admitTrackingState(store, sealed));
    expect(error.code).toBe('dangling-reference-rejected');
    expect((error as { referenceKind?: string }).referenceKind).toBe('activity');
  });

  it('cross-tenant tracking records are tenant-isolation-rejected', () => {
    const store = trackingStore();
    const sealed = unwrap(
      sealTrackingStateRecord(
        trackingRecord({ tenantId: 'tenant:initech', recordId: 'state:foreign' }),
      ),
    );
    const error = expectError(admitTrackingState(store, sealed));
    expect(error.code).toBe('tenant-isolation-rejected');
    expect((error as { encounteredTenantId?: string }).encounteredTenantId).toBe('tenant:initech');
  });

  it('a same-id different-content re-admission is version-conflict (never an overwrite)', () => {
    const store = trackingStore();
    const first = unwrap(admitTrackingState(store, unwrap(sealTrackingStateRecord(trackingRecord()))));
    const conflicting = unwrap(
      sealTrackingStateRecord(
        trackingRecord({
          fromState: 'not-started',
          toState: 'blocked',
          cause: 'conflicting content under the same id',
        }),
      ),
    );
    const error = expectError(admitTrackingState(first.store, conflicting));
    expect(error.code).toBe('version-conflict');
  });

  it('declaring a schedule field is authority-violation-rejected (tracking OBSERVES, never re-schedules)', () => {
    const store = trackingStore();
    const error = expectError(
      admitTrackingState(store, {
        ...trackingRecord(),
        plannedFinish: T4,
      }),
    );
    expect(error.code).toBe('authority-violation-rejected');
    expect((error as { field?: string }).field).toBe('plannedFinish');
  });

  it('declaring a forbidden authority field is authority-violation-rejected', () => {
    const store = trackingStore();
    const error = expectError(
      admitTrackingState(store, {
        ...trackingRecord(),
        scheduleAuthority: 'tracking',
      }),
    );
    expect(error.code).toBe('authority-violation-rejected');
    expect((error as { field?: string }).field).toBe('scheduleAuthority');
  });

  it('a missing uncertainty state is uncertainty-missing-rejected (BEFORE schema validation)', () => {
    const store = trackingStore();
    const error = expectError(
      admitTrackingState(store, {
        ...trackingRecord(),
        uncertainty: undefined,
      }),
    );
    expect(error.code).toBe('uncertainty-missing-rejected');
  });

  it('a partial uncertainty state (missing freshness) is uncertainty-missing-rejected', () => {
    const store = trackingStore();
    const error = expectError(
      admitTrackingState(store, {
        ...trackingRecord(),
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'observed' },
          confidence: { method: 'stated', value: 0.9 },
        },
      }),
    );
    expect(error.code).toBe('uncertainty-missing-rejected');
    expect((error as { missing?: readonly string[] }).missing).toContain('freshness');
  });

  it('a vendor field is vendor-fields-rejected', () => {
    const store = trackingStore();
    const error = expectError(
      admitTrackingState(store, {
        ...trackingRecord(),
        ganttProvider: 'acme-scheduler',
      }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a tampered digest is digest-mismatch', () => {
    const sealed = unwrap(sealTrackingStateRecord(trackingRecord()));
    const tampered = { ...sealed, contentDigest: 'f'.repeat(64) };
    const error = expectError(verifySealedTrackingStateRecord(tampered));
    expect(error.code).toBe('digest-mismatch');
  });

  it('a tampered content field is digest-mismatch after sealing', () => {
    const sealed = unwrap(sealTrackingStateRecord(trackingRecord()));
    const tampered = { ...sealed, cause: 'tampered after sealing' };
    const error = expectError(verifySealedTrackingStateRecord(tampered));
    expect(error.code).toBe('digest-mismatch');
  });
});
