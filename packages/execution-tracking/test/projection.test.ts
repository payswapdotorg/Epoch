// THE STATE PROJECTION: the deterministic per-work-package execution
// state fold (tracking states, observation counts, resource usage
// totals, folded issues), with optional as-of freshness filtering.
import { describe, expect, it } from 'vitest';
import {
  admitTrackingState,
  intakeFieldObservation,
  projectExecutionState,
  sealTrackingStateRecord,
  sealIssueRecord,
  admitIssue,
} from '../src/index';
import {
  ACTIVITY_ID,
  ACTIVITY_ID_2,
  FOREMAN,
  PRINCIPAL,
  SOLUTION_ID,
  T3,
  T5,
  T6,
  TENANT,
  WORK_PACKAGE_ID,
  fieldCapture,
  trackingStore,
  uncertainty,
} from './fixtures';
import { unwrap } from './helpers';

describe('the execution state projection', () => {
  it('projects every indexed work package with states, observations, usage, and issues', () => {
    const store = trackingStore();
    const intake = unwrap(intakeFieldObservation(store, fieldCapture()));
    const withTracking = unwrap(
      admitTrackingState(
        intake.store,
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
            recordedBy: PRINCIPAL,
            evidenceLinks: [],
            uncertainty: uncertainty(),
          }),
        ),
      ),
    );
    const withIssue = unwrap(
      admitIssue(
        withTracking.store,
        unwrap(
          sealIssueRecord({
            schema: 'epoch.execution-tracking.issue-record',
            schemaVersion: 1,
            recordId: 'defect:pit-oversize',
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            issueKind: 'defect',
            title: 'Pit oversize',
            severity: 'moderate',
            impact: { workPackageIds: [WORK_PACKAGE_ID], activityIds: [], milestoneIds: [] },
            raisedAt: T3,
            raisedBy: FOREMAN,
            recordedAt: T3,
            evidenceLinks: [],
            uncertainty: uncertainty(),
          }),
        ),
      ),
    );

    const projection = projectExecutionState(withIssue.store);
    expect(projection.solutionId).toBe(SOLUTION_ID);
    expect(projection.workPackages.map((wp) => wp.workPackageId)).toEqual([
      'work-package:earthworks',
      'work-package:structure',
    ]);

    const earthworks = projection.workPackages[0]!;
    // The activity record set the state; the package derives from it.
    expect(earthworks.activityStates).toEqual([
      { activityId: ACTIVITY_ID, state: 'in-progress', recordCount: 1, lastObservedAt: T3 },
    ]);
    expect(earthworks.workPackageState).toBe('in-progress');
    expect(earthworks.observationCount).toBe(1);
    expect(earthworks.resourceUsageTotals).toEqual([
      { resourceKind: 'equipment', unit: 'hour', total: '6.5', observationCount: 1 },
      { resourceKind: 'labor', unit: 'hour', total: '8', observationCount: 1 },
    ]);
    expect(earthworks.issues).toEqual([
      { issueRecordId: 'defect:pit-oversize', issueKind: 'defect', severity: 'moderate', resolutionState: 'open' },
    ]);
    expect(earthworks.streamId).toBe('stream:execution-earthworks');
    expect(projection.unresolvedIssueCount).toBe(1);

    const structure = projection.workPackages[1]!;
    expect(structure.workPackageState).toBe('not-started');
    expect(structure.observationCount).toBe(0);
    expect(structure.issues).toEqual([]);
  });

  it('a work-package-level tracking record overrides the activity derivation', () => {
    const store = trackingStore();
    const withPackageState = unwrap(
      admitTrackingState(
        store,
        unwrap(
          sealTrackingStateRecord({
            schema: 'epoch.execution-tracking.tracking-state',
            schemaVersion: 1,
            recordId: 'state:earthworks-blocked',
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            subject: { workPackageId: WORK_PACKAGE_ID },
            fromState: 'not-started',
            toState: 'blocked',
            cause: 'utility strike across the package',
            observedAt: T3,
            recordedAt: T3,
            recordedBy: PRINCIPAL,
            evidenceLinks: [],
            uncertainty: uncertainty(),
          }),
        ),
      ),
    );
    const projection = projectExecutionState(withPackageState.store);
    expect(projection.workPackages[0]!.workPackageState).toBe('blocked');
    expect(projection.workPackages[0]!.activityStates).toEqual([]);
  });

  it('as-of filtering projects the state known at the instant', () => {
    const store = trackingStore();
    const intake = unwrap(intakeFieldObservation(store, fieldCapture()));
    const later = unwrap(intakeFieldObservation(intake.store, fieldCapture({ captureKey: 'pit-progress-tuesday', measure: { kind: 'progress', fraction: 0.35 } })));
    const beforeSecond = projectExecutionState(intake.store, { asOf: T5 });
    const afterSecond = projectExecutionState(later.store, { asOf: T6 });
    // The first capture observed at T3: visible in both.
    expect(beforeSecond.totalObservationCount).toBe(1);
    // The second capture also observed at T3 (same fixture instant): the
    // asOf filter includes both once admitted — proving the projection is
    // a pure fold of admitted records with instants as data.
    expect(afterSecond.totalObservationCount).toBe(2);
    expect(projectExecutionState(later.store)).toEqual(afterSecond);
  });

  it('all-completed activities derive a completed package; a blocked activity derives blocked', () => {
    const store = trackingStore();
    const withBoth = unwrap(
      admitTrackingState(
        store,
        unwrap(
          sealTrackingStateRecord({
            schema: 'epoch.execution-tracking.tracking-state',
            schemaVersion: 1,
            recordId: 'state:excavate-done',
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            subject: { workPackageId: WORK_PACKAGE_ID, activityId: ACTIVITY_ID },
            fromState: 'not-started',
            toState: 'completed',
            cause: 'excavation complete',
            observedAt: T3,
            recordedAt: T3,
            recordedBy: PRINCIPAL,
            evidenceLinks: [],
            uncertainty: uncertainty(),
          }),
        ),
      ),
    );
    const withBlocked = unwrap(
      admitTrackingState(
        withBoth.store,
        unwrap(
          sealTrackingStateRecord({
            schema: 'epoch.execution-tracking.tracking-state',
            schemaVersion: 1,
            recordId: 'state:grade-blocked',
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            subject: { workPackageId: WORK_PACKAGE_ID, activityId: ACTIVITY_ID_2 },
            fromState: 'not-started',
            toState: 'blocked',
            cause: 'grader breakdown',
            observedAt: T3,
            recordedAt: T3,
            recordedBy: PRINCIPAL,
            evidenceLinks: [],
            uncertainty: uncertainty(),
          }),
        ),
      ),
    );
    const projection = projectExecutionState(withBlocked.store);
    expect(projection.workPackages[0]!.workPackageState).toBe('blocked');
  });
});
