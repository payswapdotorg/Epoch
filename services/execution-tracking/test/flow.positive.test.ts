// THE GOLDEN PATH (positive): register the program + delivery, poll the
// FieldCapturePort (the single-call low-friction intake), record tracking
// states, raise + resolve an issue, propose + apply the reconciliation
// through the W036 authority path, and project the execution state —
// THE SERVICE-LEVEL ACCEPTANCE FIXTURE: partial observations record
// without destructive overwrites, then reconcile into delivery state
// without bypassing authority or verification boundaries.
import { describe, expect, it } from 'vitest';
import { ExecutionTrackingRuntime } from '../src/index';
import {
  sealTrackingStateRecord,
  sealIssueRecord,
  sealIssueResolution,
} from '@epoch/execution-tracking';
import {
  ACTIVITY_ID,
  DELIVERY_ID,
  FOREMAN,
  MILESTONE_ID,
  PRINCIPAL,
  SOLUTION_ID,
  T3,
  T4,
  T5,
  T6,
  TENANT,
  WORK_PACKAGE_ID,
  allowContext,
  captureSeed,
  openedDelivery,
  reconciliationProposal,
  sealedProgram,
  seededAdapter,
  uncertainty,
  unwrap,
} from './helpers';

describe('the service golden path (intake -> observation -> reconciliation -> projection)', () => {
  it('register -> poll captures -> track -> issue -> reconcile -> project', () => {
    const host = new ExecutionTrackingRuntime({ fieldCapturePort: seededAdapter() });
    const auth = { principalId: PRINCIPAL, context: allowContext() };

    // 1. Register the schedule authority input + the delivery state.
    const program = unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }));
    expect(program.store.programIndex.workPackages).toHaveLength(2);
    const delivery = unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: auth, delivery: openedDelivery() }));
    expect(delivery.delivery.deliveryId).toBe(DELIVERY_ID);

    // 2. Poll the field-capture port: the single-call intake runs with
    //    linkage inference, uncertainty, and idempotency.
    const outcomes = unwrap(
      host.pollFieldCaptures({ tenantId: TENANT, authorization: auth, requestedAt: T3 }),
    );
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.linkedWorkPackageId).toBe(WORK_PACKAGE_ID);
    expect(outcomes[0]!.observation.kind).toBe('admitted');
    expect(outcomes[0]!.resourceObservationCount).toBe(1);
    expect(outcomes[0]!.evidenceLinkCount).toBe(1);

    // 3. Record a tracking-state transition (append-only chain).
    unwrap(
      host.recordTrackingState({
        tenantId: TENANT,
        authorization: auth,
        record: unwrap(
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
      }),
    );

    // 4. Raise + resolve an execution issue.
    unwrap(
      host.raiseIssue({
        tenantId: TENANT,
        authorization: auth,
        record: unwrap(
          sealIssueRecord({
            schema: 'epoch.execution-tracking.issue-record',
            schemaVersion: 1,
            recordId: 'defect:pit-oversize',
            tenantId: TENANT,
            solutionId: SOLUTION_ID,
            issueKind: 'defect',
            title: 'Pit excavated 300mm oversize',
            severity: 'moderate',
            impact: { workPackageIds: [WORK_PACKAGE_ID], activityIds: [], milestoneIds: [] },
            raisedAt: T3,
            raisedBy: FOREMAN,
            recordedAt: T3,
            evidenceLinks: [],
            uncertainty: uncertainty(),
          }),
        ),
      }),
    );
    unwrap(
      host.resolveIssue({
        tenantId: TENANT,
        authorization: auth,
        resolution: unwrap(
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
      }),
    );

    // 5. THE ACCEPTANCE FIXTURE (service level): partial observations are
    //    recorded (still PROPOSED — the delivery state has no actuals and
    //    nothing overwritten), then the reconciliation proposal applies
    //    EXCLUSIVELY through the W036 authority path.
    const intakeObservation = host.snapshot().stores[0]!.store.observations[0]!;
    expect(intakeObservation.kind).toBe('observation');
    // The hosted delivery state still has NO actuals (partial observation).
    const hostedDelivery = unwrap(
      host.registerDeliveryRecord({ tenantId: TENANT, authorization: auth, delivery: delivery.delivery }),
    );
    expect(hostedDelivery.delivery.actuals).toHaveLength(0);
    expect(hostedDelivery.delivery.acceptedObservationIds).toHaveLength(0);

    const proposal = reconciliationProposal([intakeObservation.recordId]);
    unwrap(host.proposeReconciliation({ tenantId: TENANT, authorization: auth, proposal }));
    const applied = unwrap(
      host.applyReconciliation({
        tenantId: TENANT,
        authorization: auth,
        proposalId: proposal.recordId,
        application: { acceptedBy: PRINCIPAL, acceptedAt: T5, actualizedBy: PRINCIPAL, actualizedAt: T6 },
      }),
    );
    expect(applied.actualizedCount).toBe(1);
    expect(applied.alreadyActualizedCount).toBe(0);
    // The hosted delivery advanced: the W036 authority minted ONE actual
    // from the ACCEPTED observation (the authority path, never a bypass).
    const snapshot = host.snapshot();
    const advancedDelivery = snapshot.deliveries[0]!.delivery;
    expect(advancedDelivery.actuals).toHaveLength(1);
    expect(advancedDelivery.acceptedObservationIds).toEqual([intakeObservation.recordId]);
    expect(advancedDelivery.actuals[0]!.payload.derivedFromObservationId).toBe(intakeObservation.recordId);
    expect(advancedDelivery.actuals[0]!.measure).toEqual(intakeObservation.measure);

    // 6. Project the execution state.
    const projection = unwrap(
      host.projectState({ tenantId: TENANT, authorization: auth, solutionId: SOLUTION_ID, asOf: T6 }),
    );
    expect(projection.workPackages).toHaveLength(2);
    const earthworks = projection.workPackages[0]!;
    expect(earthworks.workPackageState).toBe('in-progress');
    expect(earthworks.observationCount).toBe(1);
    expect(earthworks.issues[0]!.resolutionState).toBe('resolved');

    // 7. The events flowed (one stream per work package).
    const stream = unwrap(
      host.eventStream({ tenantId: TENANT, authorization: auth, workPackageId: WORK_PACKAGE_ID }),
    );
    expect(stream.length).toBeGreaterThanOrEqual(8);
    const discriminators = stream.map((event) => event.payload.discriminator);
    expect(discriminators).toContain('execution:observation-recorded');
    expect(discriminators).toContain('execution:resource-observation-recorded');
    expect(discriminators).toContain('execution:evidence-linked');
    expect(discriminators).toContain('execution:tracking-recorded');
    expect(discriminators).toContain('execution:issue-raised');
    expect(discriminators).toContain('execution:issue-resolved');
    expect(discriminators).toContain('execution:reconciliation-proposed');
    expect(discriminators).toContain('execution:reconciliation-applied');
    expect(discriminators).toContain('execution:state-projected');
    // Sequences are contiguous per stream (the W010 discipline).
    expect(stream.map((event) => event.sequence)).toEqual(
      stream.map((_, index) => index + 1),
    );
    // The causal chain is strictly increasing.
    for (let i = 1; i < stream.length; i += 1) {
      expect(stream[i]!.causalParent?.sequence).toBe(stream[i - 1]!.sequence);
    }

    // 8. Health as typed data.
    const health = host.health();
    expect(health.status).toBe('healthy');
    expect(health.observationCount).toBe(1);
    expect(health.issueCount).toBe(1);
    expect(health.eventCount).toBeGreaterThanOrEqual(8);
  });

  it('re-polling the same seeded captures replays idempotently (duplicate-observation admissions, no new events)', () => {
    const host = new ExecutionTrackingRuntime({ fieldCapturePort: seededAdapter() });
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }));
    const first = unwrap(host.pollFieldCaptures({ tenantId: TENANT, authorization: auth, requestedAt: T3 }));
    expect(first[0]!.observation.kind).toBe('admitted');
    const eventsAfterFirst = host.health().eventCount;
    const second = unwrap(host.pollFieldCaptures({ tenantId: TENANT, authorization: auth, requestedAt: T4 }));
    expect(second[0]!.observation.kind).toBe('duplicate-observation');
    // The state AND the event streams are unchanged by the replay.
    expect(host.health().observationCount).toBe(1);
    expect(host.health().eventCount).toBe(eventsAfterFirst);
  });

  it('the direct intake path mirrors the port path', () => {
    const host = new ExecutionTrackingRuntime();
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }));
    const outcome = unwrap(
      host.intakeFieldCapture({ tenantId: TENANT, authorization: auth, capture: captureSeed() }),
    );
    expect(outcome.linkedWorkPackageId).toBe(WORK_PACKAGE_ID);
    expect(outcome.observation.kind).toBe('admitted');
    const stream = unwrap(
      host.eventStream({ tenantId: TENANT, authorization: auth, workPackageId: WORK_PACKAGE_ID }),
    );
    expect(stream.length).toBe(3);
  });

  it('a capture anchored on a milestone in one package links correctly', () => {
    const host = new ExecutionTrackingRuntime();
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }));
    const outcome = unwrap(
      host.intakeFieldCapture({
        tenantId: TENANT,
        authorization: auth,
        capture: captureSeed({ subjectRef: { kind: 'milestone', id: MILESTONE_ID } }),
      }),
    );
    expect(outcome.linkedWorkPackageId).toBe(WORK_PACKAGE_ID);
    expect(host.health().observationCount).toBe(1);
  });

  it('registering the same program and delivery again is idempotent', () => {
    const host = new ExecutionTrackingRuntime();
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    const program = sealedProgram();
    const first = unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program }));
    const second = unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program }));
    expect(second).toBe(first);
    const delivery = openedDelivery();
    const firstDelivery = unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: auth, delivery }));
    const secondDelivery = unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: auth, delivery }));
    expect(secondDelivery).toBe(firstDelivery);
  });
});
