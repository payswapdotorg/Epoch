// DETERMINISM: same inputs -> same digests; input order never leaks into
// folds (tracking chains, usage totals, issue folds, the state
// projection, the contract emission, the idempotency keys).
import { describe, expect, it } from 'vitest';
import {
  deriveExecutionEventKey,
  deriveObservationReplayKey,
  foldIssues,
  foldResourceUsage,
  foldTrackingStates,
  intakeFieldObservation,
  projectExecutionState,
  renderExecutionTrackingContractFiles,
  renderExecutionTrackingPublicContractFiles,
  sealExecutionEvent,
  sealIssueRecord,
  sealResourceObservation,
  sealTrackingStateRecord,
  admitTrackingState,
  admitResourceObservation,
  executionStreamIdOf,
} from '../src/index';
import {
  ACTIVITY_ID,
  FOREMAN,
  PRINCIPAL,
  SOLUTION_ID,
  T3,
  TENANT,
  WORK_PACKAGE_ID,
  fieldCapture,
  trackingStore,
  uncertainty,
} from './fixtures';
import { unwrap } from './helpers';

describe('determinism (same inputs -> same digests; no input-order leaks)', () => {
  it('sealing the same content twice yields the same digest for every family', () => {
    const tracking = unwrap(
      sealTrackingStateRecord({
        schema: 'epoch.execution-tracking.tracking-state',
        schemaVersion: 1,
        recordId: 'state:det',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        subject: { workPackageId: WORK_PACKAGE_ID, activityId: ACTIVITY_ID },
        fromState: 'not-started',
        toState: 'in-progress',
        cause: 'started',
        observedAt: T3,
        recordedAt: T3,
        recordedBy: PRINCIPAL,
        evidenceLinks: [],
        uncertainty: uncertainty(),
      }),
    );
    const trackingAgain = unwrap(
      sealTrackingStateRecord({
        schema: 'epoch.execution-tracking.tracking-state',
        schemaVersion: 1,
        recordId: 'state:det',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        subject: { workPackageId: WORK_PACKAGE_ID, activityId: ACTIVITY_ID },
        fromState: 'not-started',
        toState: 'in-progress',
        cause: 'started',
        observedAt: T3,
        recordedAt: T3,
        recordedBy: PRINCIPAL,
        evidenceLinks: [],
        uncertainty: uncertainty(),
      }),
    );
    expect(trackingAgain.contentDigest).toBe(tracking.contentDigest);

    const resource = unwrap(
      sealResourceObservation({
        schema: 'epoch.execution-tracking.resource-observation',
        schemaVersion: 1,
        recordId: 'resource-observation:det',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        workPackageId: WORK_PACKAGE_ID,
        resourceKind: 'labor',
        resourceId: 'resource:crew-alpha',
        quantity: '8',
        unit: 'hour',
        usageAt: T3,
        observedBy: PRINCIPAL,
        recordedAt: T3,
        recordedBy: PRINCIPAL,
        evidenceLinks: [],
        uncertainty: uncertainty(),
      }),
    );
    const resourceAgain = unwrap(
      sealResourceObservation({
        schema: 'epoch.execution-tracking.resource-observation',
        schemaVersion: 1,
        recordId: 'resource-observation:det',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        workPackageId: WORK_PACKAGE_ID,
        resourceKind: 'labor',
        resourceId: 'resource:crew-alpha',
        quantity: '8',
        unit: 'hour',
        usageAt: T3,
        observedBy: PRINCIPAL,
        recordedAt: T3,
        recordedBy: PRINCIPAL,
        evidenceLinks: [],
        uncertainty: uncertainty(),
      }),
    );
    expect(resourceAgain.contentDigest).toBe(resource.contentDigest);
  });

  it('the idempotency keys are pure functions of their scope', () => {
    expect(deriveObservationReplayKey({ tenantId: TENANT, idempotencyKey: 'a' })).toBe(
      deriveObservationReplayKey({ tenantId: TENANT, idempotencyKey: 'a' }),
    );
    expect(deriveObservationReplayKey({ tenantId: TENANT, idempotencyKey: 'a' })).not.toBe(
      deriveObservationReplayKey({ tenantId: TENANT, idempotencyKey: 'b' }),
    );
    expect(deriveExecutionEventKey({ streamId: 'stream:execution-x', sequence: 1, contentDigest: 'a'.repeat(64) })).toBe(
      deriveExecutionEventKey({ streamId: 'stream:execution-x', sequence: 1, contentDigest: 'a'.repeat(64) }),
    );
  });

  it('the same field capture produces byte-identical records (replay stability)', () => {
    const storeA = trackingStore();
    const storeB = trackingStore();
    const intakeA = unwrap(intakeFieldObservation(storeA, fieldCapture()));
    const intakeB = unwrap(intakeFieldObservation(storeB, fieldCapture()));
    expect(intakeA.store.observations[0]!.contentDigest).toBe(intakeB.store.observations[0]!.contentDigest);
    expect(intakeA.store.resourceObservations.map((r) => r.contentDigest)).toEqual(
      intakeB.store.resourceObservations.map((r) => r.contentDigest),
    );
    expect(intakeA.store.evidenceLinks.map((r) => r.contentDigest)).toEqual(
      intakeB.store.evidenceLinks.map((r) => r.contentDigest),
    );
  });

  it('the tracking fold is invariant under store-order permutation (chain walking)', () => {
    const store = trackingStore();
    const genesis = unwrap(
      admitTrackingState(
        store,
        unwrap(
          sealTrackingStateRecord({
            schema: 'epoch.execution-tracking.tracking-state',
            schemaVersion: 1,
            recordId: 'state:z-first',
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            subject: { workPackageId: WORK_PACKAGE_ID, activityId: ACTIVITY_ID },
            fromState: 'not-started',
            toState: 'in-progress',
            cause: 'started',
            observedAt: T3,
            recordedAt: T3,
            recordedBy: PRINCIPAL,
            evidenceLinks: [],
            uncertainty: uncertainty(),
          }),
        ),
      ),
    );
    const successor = unwrap(
      admitTrackingState(
        genesis.store,
        unwrap(
          sealTrackingStateRecord({
            schema: 'epoch.execution-tracking.tracking-state',
            schemaVersion: 1,
            recordId: 'state:a-second',
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            subject: { workPackageId: WORK_PACKAGE_ID, activityId: ACTIVITY_ID },
            fromState: 'in-progress',
            toState: 'completed',
            cause: 'done',
            observedAt: T3,
            recordedAt: T3,
            recordedBy: PRINCIPAL,
            evidenceLinks: [],
            uncertainty: uncertainty(),
          }),
        ),
      ),
    );
    const records = successor.store.tracking;
    expect(foldTrackingStates([...records].reverse())).toEqual(foldTrackingStates(records));
  });

  it('the issue fold is invariant under permutation', () => {
    const issue = unwrap(
      sealIssueRecord({
        schema: 'epoch.execution-tracking.issue-record',
        schemaVersion: 1,
        recordId: 'defect:det',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        issueKind: 'defect',
        title: 'det defect',
        severity: 'minor',
        impact: { workPackageIds: [WORK_PACKAGE_ID], activityIds: [], milestoneIds: [] },
        raisedAt: T3,
        raisedBy: FOREMAN,
        recordedAt: T3,
        evidenceLinks: [],
        uncertainty: uncertainty(),
      }),
    );
    const issues = [issue, { ...issue, recordId: 'defect:det-2', title: 'second' } as typeof issue];
    expect(foldIssues([...issues].reverse(), [])).toEqual(foldIssues(issues, []));
  });

  it('the state projection is invariant under record-order permutation', () => {
    const store = trackingStore();
    const intake = unwrap(intakeFieldObservation(store, fieldCapture()));
    const projection = projectExecutionState(intake.store);
    const permutedStore = {
      ...intake.store,
      observations: [...intake.store.observations].reverse(),
      resourceObservations: [...intake.store.resourceObservations].reverse(),
      evidenceLinks: [...intake.store.evidenceLinks].reverse(),
    };
    expect(projectExecutionState(permutedStore)).toEqual(projection);
  });

  it('the derived stream id is deterministic per work package', () => {
    expect(executionStreamIdOf(WORK_PACKAGE_ID)).toBe('stream:execution-earthworks');
    expect(executionStreamIdOf('work-package:structure')).toBe('stream:execution-structure');
  });

  it('the contract emission is deterministic (two renders are byte-identical)', () => {
    expect(renderExecutionTrackingContractFiles()).toEqual(renderExecutionTrackingContractFiles());
    expect(renderExecutionTrackingPublicContractFiles()).toEqual(
      renderExecutionTrackingPublicContractFiles(),
    );
  });

  it('event sealing is deterministic for identical content', () => {
    const content = {
      schemaVersion: 1 as const,
      streamId: 'stream:execution-earthworks',
      sequence: 1,
      tenantId: TENANT,
      actor: PRINCIPAL,
      causalParent: null,
      payload: {
        discriminator: 'execution:state-projected',
        data: {
          workPackageId: WORK_PACKAGE_ID,
          state: 'in-progress',
          milestoneIds: [],
          asOf: T3,
        },
      },
      occurredAt: T3,
    };
    const first = unwrap(sealExecutionEvent(content));
    const second = unwrap(sealExecutionEvent({ ...content }));
    expect(second.contentDigest).toBe(first.contentDigest);
  });

  it('admission order never leaks into the store arrays (canonical recordId order)', () => {
    const store = trackingStore();
    const a = unwrap(
      admitResourceObservation(
        store,
        unwrap(
          sealResourceObservation({
            schema: 'epoch.execution-tracking.resource-observation',
            schemaVersion: 1,
            recordId: 'resource-observation:zzz',
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            workPackageId: WORK_PACKAGE_ID,
            resourceKind: 'material',
            resourceId: 'resource:concrete',
            quantity: '10',
            unit: 'm3',
            usageAt: T3,
            observedBy: PRINCIPAL,
            recordedAt: T3,
            recordedBy: PRINCIPAL,
            evidenceLinks: [],
            uncertainty: uncertainty(),
          }),
        ),
      ),
    );
    const b = unwrap(
      admitResourceObservation(
        a.store,
        unwrap(
          sealResourceObservation({
            schema: 'epoch.execution-tracking.resource-observation',
            schemaVersion: 1,
            recordId: 'resource-observation:aaa',
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            workPackageId: WORK_PACKAGE_ID,
            resourceKind: 'material',
            resourceId: 'resource:concrete',
            quantity: '5',
            unit: 'm3',
            usageAt: T3,
            observedBy: PRINCIPAL,
            recordedAt: T3,
            recordedBy: PRINCIPAL,
            evidenceLinks: [],
            uncertainty: uncertainty(),
          }),
        ),
      ),
    );
    expect(b.store.resourceObservations.map((r) => r.recordId)).toEqual([
      'resource-observation:aaa',
      'resource-observation:zzz',
    ]);
    expect(foldResourceUsage(b.store.resourceObservations)[0]!.total).toBe('15');
  });
});
