// CHANGES, DELAYS, REWORK, DEFECTS AND BLOCKERS: typed record families
// with severity + impact references (opaque ProgramOfWork ids) +
// resolution state; rework references the ORIGINAL work records;
// blockers carry dependency semantics; exactly one resolution per issue.
import { describe, expect, it } from 'vitest';
import {
  admitIssue,
  admitIssueResolution,
  foldIssues,
  sealIssueRecord,
  sealIssueResolution,
  verifySealedIssueRecord,
  admitTrackingState,
  sealTrackingStateRecord,
} from '../src/index';
import {
  ACTIVITY_ID,
  FOREMAN,
  SOLUTION_ID,
  T3,
  T4,
  TENANT,
  WORK_PACKAGE_ID,
  trackingStore,
  uncertainty,
} from './fixtures';
import { expectError, unwrap } from './helpers';

function issueRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.execution-tracking.issue-record',
    schemaVersion: 1,
    recordId: 'defect:pit-oversize',
    tenantId: TENANT,
    solutionId: SOLUTION_ID,
    issueKind: 'defect',
    title: 'Pit excavated 300mm oversize',
    description: 'North-east corner exceeds tolerance',
    severity: 'moderate',
    impact: {
      workPackageIds: [WORK_PACKAGE_ID],
      activityIds: [ACTIVITY_ID],
      milestoneIds: [],
    },
    raisedAt: T3,
    raisedBy: FOREMAN,
    recordedAt: T3,
    evidenceLinks: [],
    uncertainty: uncertainty(),
    ...overrides,
  };
}

describe('execution issues (positive)', () => {
  it('admits each of the five families with kind-prefixed ids', () => {
    const store = trackingStore();
    const cases = [
      issueRecord({ issueKind: 'change', recordId: 'change:pit-lining' }),
      issueRecord({ issueKind: 'delay', recordId: 'delay:crane-availability' }),
      issueRecord({
        issueKind: 'rework',
        recordId: 'rework:pit-backfill',
        reworkOf: { workPackageId: WORK_PACKAGE_ID, activityId: ACTIVITY_ID, reason: 'compaction failed the density check' },
      }),
      issueRecord({ issueKind: 'defect', recordId: 'defect:pit-oversize' }),
      issueRecord({
        issueKind: 'blocker',
        recordId: 'blocker:utility-strike',
        blocked: {
          workPackageId: WORK_PACKAGE_ID,
          activityId: ACTIVITY_ID,
          blockedByRef: 'ref:utility-shutdown-clearance',
          reason: 'live cable found; awaiting utility clearance',
        },
      }),
    ];
    let current = store;
    for (const record of cases) {
      const admitted = unwrap(admitIssue(current, unwrap(sealIssueRecord(record))));
      expect(admitted.duplicate).toBe(false);
      current = admitted.store;
    }
    expect(current.issues).toHaveLength(5);
  });

  it('a resolution settles an issue and the fold derives the resolution state', () => {
    const store = trackingStore();
    const withIssue = unwrap(admitIssue(store, unwrap(sealIssueRecord(issueRecord()))));
    const resolved = unwrap(
      admitIssueResolution(
        withIssue.store,
        unwrap(
          sealIssueResolution({
            schema: 'epoch.execution-tracking.issue-resolution',
            schemaVersion: 1,
            recordId: 'issue-resolution:pit-oversize-1',
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            issueRecordId: 'defect:pit-oversize',
            resolution: 'resolved',
            resolvedAt: T4,
            resolvedBy: FOREMAN,
            note: 'grouted and re-inspected',
            evidenceLinks: [],
          }),
        ),
      ),
    );
    const folded = foldIssues(resolved.store.issues, resolved.store.resolutions);
    expect(folded).toHaveLength(1);
    expect(folded[0]!.resolutionState).toBe('resolved');
    expect(folded[0]!.resolution?.recordId).toBe('issue-resolution:pit-oversize-1');
  });

  it('an unresolved issue folds open', () => {
    const store = trackingStore();
    const withIssue = unwrap(admitIssue(store, unwrap(sealIssueRecord(issueRecord()))));
    const folded = foldIssues(withIssue.store.issues, withIssue.store.resolutions);
    expect(folded[0]!.resolutionState).toBe('open');
    expect(folded[0]!.resolution).toBeNull();
  });

  it('rework references the original work records (id and tracking record)', () => {
    const store = trackingStore();
    const tracked = unwrap(
      admitTrackingState(
        store,
        unwrap(
          sealTrackingStateRecord({
            schema: 'epoch.execution-tracking.tracking-state',
            schemaVersion: 1,
            recordId: 'state:excavate-start',
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            subject: { workPackageId: WORK_PACKAGE_ID, activityId: ACTIVITY_ID },
            fromState: 'not-started',
            toState: 'in-progress',
            cause: 'crew mobilized',
            observedAt: T3,
            recordedAt: T3,
            recordedBy: FOREMAN,
            evidenceLinks: [],
            uncertainty: uncertainty(),
          }),
        ),
      ),
    );
    const admitted = unwrap(
      admitIssue(
        tracked.store,
        unwrap(
          sealIssueRecord(
            issueRecord({
              issueKind: 'rework',
              recordId: 'rework:pit-backfill',
              reworkOf: {
                workPackageId: WORK_PACKAGE_ID,
                activityId: ACTIVITY_ID,
                originalTrackingRecordId: 'state:excavate-start',
                reason: 'compaction failed the density check',
              },
            }),
          ),
        ),
      ),
    );
    expect(admitted.store.issues[0]!.reworkOf?.originalTrackingRecordId).toBe('state:excavate-start');
  });
});

describe('execution issues (negative)', () => {
  it('a rework record without reworkOf is a validation failure (mandatory reference)', () => {
    const sealed = sealIssueRecord(issueRecord({ issueKind: 'rework', recordId: 'rework:pit-backfill' }));
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(JSON.stringify(sealed.error)).toContain('reworkOf');
    }
  });

  it('a blocker record without dependency semantics is a validation failure', () => {
    const sealed = sealIssueRecord(issueRecord({ issueKind: 'blocker', recordId: 'blocker:utility-strike' }));
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(JSON.stringify(sealed.error)).toContain('blocked');
    }
  });

  it('a record-id prefix that does not match the issueKind is a validation failure', () => {
    const sealed = sealIssueRecord(issueRecord({ issueKind: 'delay', recordId: 'change:wrong-prefix' }));
    expect(sealed.ok).toBe(false);
  });

  it('a dangling impact reference is dangling-reference-rejected', () => {
    const store = trackingStore();
    const sealed = unwrap(
      sealIssueRecord(
        issueRecord({ impact: { workPackageIds: ['work-package:not-in-program'], activityIds: [], milestoneIds: [] } }),
      ),
    );
    const error = expectError(admitIssue(store, sealed));
    expect(error.code).toBe('dangling-reference-rejected');
    expect((error as { referenceKind?: string }).referenceKind).toBe('work-package');
  });

  it('a rework reference to an unknown tracking record is dangling-reference-rejected', () => {
    const store = trackingStore();
    const sealed = unwrap(
      sealIssueRecord(
        issueRecord({
          issueKind: 'rework',
          recordId: 'rework:pit-backfill',
          reworkOf: {
            workPackageId: WORK_PACKAGE_ID,
            originalTrackingRecordId: 'state:not-recorded',
            reason: 'compaction failed',
          },
        }),
      ),
    );
    const error = expectError(admitIssue(store, sealed));
    expect(error.code).toBe('dangling-reference-rejected');
    expect((error as { referenceKind?: string }).referenceKind).toBe('tracking-state-record');
  });

  it('a second resolution for the same issue is lifecycle-conflict (history never rewrites)', () => {
    const store = trackingStore();
    const withIssue = unwrap(admitIssue(store, unwrap(sealIssueRecord(issueRecord()))));
    const first = unwrap(
      admitIssueResolution(
        withIssue.store,
        unwrap(
          sealIssueResolution({
            schema: 'epoch.execution-tracking.issue-resolution',
            schemaVersion: 1,
            recordId: 'issue-resolution:pit-oversize-1',
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            issueRecordId: 'defect:pit-oversize',
            resolution: 'resolved',
            resolvedAt: T4,
            resolvedBy: FOREMAN,
            evidenceLinks: [],
          }),
        ),
      ),
    );
    const second = unwrap(
      sealIssueResolution({
        schema: 'epoch.execution-tracking.issue-resolution',
        schemaVersion: 1,
        recordId: 'issue-resolution:pit-oversize-2',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        issueRecordId: 'defect:pit-oversize',
        resolution: 'dismissed',
        resolvedAt: T4,
        resolvedBy: FOREMAN,
        evidenceLinks: [],
      }),
    );
    const error = expectError(admitIssueResolution(first.store, second));
    expect(error.code).toBe('lifecycle-conflict');
  });

  it('a resolution for an unknown issue is dangling-reference-rejected', () => {
    const store = trackingStore();
    const sealed = unwrap(
      sealIssueResolution({
        schema: 'epoch.execution-tracking.issue-resolution',
        schemaVersion: 1,
        recordId: 'issue-resolution:ghost',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        issueRecordId: 'defect:not-raised',
        resolution: 'resolved',
        resolvedAt: T4,
        resolvedBy: FOREMAN,
        evidenceLinks: [],
      }),
    );
    const error = expectError(admitIssueResolution(store, sealed));
    expect(error.code).toBe('dangling-reference-rejected');
  });

  it('a resolution preceding the raise instant is a validation failure', () => {
    const store = trackingStore();
    const withIssue = unwrap(admitIssue(store, unwrap(sealIssueRecord(issueRecord()))));
    const sealed = unwrap(
      sealIssueResolution({
        schema: 'epoch.execution-tracking.issue-resolution',
        schemaVersion: 1,
        recordId: 'issue-resolution:too-early',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        issueRecordId: 'defect:pit-oversize',
        resolution: 'resolved',
        resolvedAt: '2026-03-02T08:00:00.000Z',
        resolvedBy: FOREMAN,
        evidenceLinks: [],
      }),
    );
    const error = expectError(admitIssueResolution(withIssue.store, sealed));
    expect(error.code).toBe('validation');
  });

  it('a missing uncertainty state is uncertainty-missing-rejected', () => {
    const store = trackingStore();
    const error = expectError(admitIssue(store, { ...issueRecord(), uncertainty: undefined }));
    expect(error.code).toBe('uncertainty-missing-rejected');
  });

  it('cross-tenant issues are tenant-isolation-rejected', () => {
    const store = trackingStore();
    const sealed = unwrap(sealIssueRecord(issueRecord({ tenantId: 'tenant:initech' })));
    const error = expectError(admitIssue(store, sealed));
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('a tampered issue digest is digest-mismatch', () => {
    const sealed = unwrap(sealIssueRecord(issueRecord()));
    const error = expectError(verifySealedIssueRecord({ ...sealed, severity: 'critical' }));
    expect(error.code).toBe('digest-mismatch');
  });
});
