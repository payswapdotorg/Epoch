// THE ACCEPTANCE PATH: synthetic schedules prove due/late/blocker
// transitions with append-only alert revisions, alert idempotency, and
// policy-controlled escalation — WITHOUT requiring any external
// provider (the W043 Work Order acceptance, verbatim).
//
// The synthetic schedule window (a controlled clock):
//   excavate: 03-01 .. 03-03   grade: 03-03 .. 03-05   pour: 03-05 .. 03-10
//   PASS 1 evaluates 03-02 (excavate in-window: DUE)
//   PASS 2 evaluates 03-06 (excavate+grade past finish: LATE; pour in-window: DUE)
//   PASS 3 evaluates 03-06 with an open W038 blocker on excavate (BLOCKED)
import { describe, expect, it } from 'vitest';
import { SupervisionRuntime } from '../src/index';
import {
  ACTIVITY_ID,
  DELIVERY_ID,
  EVAL_IN_WINDOW,
  EVAL_PAST_FINISH,
  HOST_STREAM,
  POLICY_ID,
  PRINCIPAL,
  PROGRAM_ID,
  SUPERVISION_STREAM,
  TENANT,
  T3,
  allowContext,
  expectError,
  issueSummary,
  leadTimeInput,
  openedDelivery,
  policyContent,
  sealedProgram,
  unwrap,
} from './helpers';

/** A host with the standard fixtures registered. */
function seededHost() {
  const host = new SupervisionRuntime();
  const auth = { principalId: PRINCIPAL, context: allowContext() };
  unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }));
  unwrap(host.registerDelivery({ tenantId: TENANT, authorization: auth, delivery: openedDelivery() }));
  unwrap(host.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));
  return { host, auth };
}

describe('the synthetic-schedule acceptance (due -> late -> blocked with alert revisions)', () => {
  it('PASS 1 (in-window): the in-window finding is DUE, its alert raises, a notification dispatches', () => {
    const { host, auth } = seededHost();
    const outcome = unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-1',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    // Only excavate is inside its plan window at EVAL_IN_WINDOW.
    expect(outcome.pass.findingCounts.byStatus['due']).toBe(1);
    expect(outcome.pass.findingCounts.byStatus['late']).toBe(0);
    expect(outcome.alertOutcomes).toHaveLength(1);
    expect(outcome.alertOutcomes[0]!.admission).toBe('raised');
    expect(outcome.alertOutcomes[0]!.alert.revision).toBe(1);
    expect(outcome.alertOutcomes[0]!.alert.findingStatus).toBe('due');
    expect(outcome.alertOutcomes[0]!.alert.severity).toBe('major');
    expect(outcome.notifications).toHaveLength(1);
    expect(outcome.notifications[0]!.channelKind).toBe('in-app');
  });

  it('PASS 2 (past finish): late findings upgrade their alerts via APPENDED revisions; new findings raise new chains', () => {
    const { host, auth } = seededHost();
    unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-1',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    const outcome = unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-2',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_PAST_FINISH,
      }),
    );
    // excavate + grade are past their planned finishes (late, including their
    // critical-path-drift findings); pour is in-window (due, with the two
    // threatened missing-prerequisite findings).
    expect(outcome.pass.findingCounts.byStatus['late']).toBe(4);
    expect(outcome.pass.findingCounts.byStatus['due']).toBe(3);
    // 7 findings at pass 2: 3 planned-vs-actual + 2 critical-path-drift + 2 missing-prerequisite.
    expect(outcome.pass.findings).toHaveLength(7);
    const raised = outcome.alertOutcomes.filter((entry) => entry.admission === 'raised');
    const duplicates = outcome.alertOutcomes.filter((entry) => entry.admission === 'duplicate');
    // The excavate chain appended revision 2 (due -> late); the other 6 findings raised new chains.
    expect(raised).toHaveLength(7);
    expect(duplicates).toHaveLength(0);
    const excavate = raised.find(
      (entry) => entry.alert.findingId === 'finding:planned-vs-actual-activity-activity-excavate',
    )!;
    expect(excavate.alert.revision).toBe(2);
    expect(excavate.alert.previousRevisionDigest).not.toBeNull();
    expect(excavate.alert.findingStatus).toBe('late');
    // Every raised/revised alert dispatched a notification through the port.
    expect(outcome.notifications).toHaveLength(7);
  });

  it('PASS 3 (blocker): the blocked finding appends revision 3 at CRITICAL severity through the exact policy rule', () => {
    const { host, auth } = seededHost();
    unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-1',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-2',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_PAST_FINISH,
      }),
    );
    const outcome = unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-3',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_PAST_FINISH,
        executionIssues: [issueSummary()],
      }),
    );
    const blocked = outcome.pass.findings.find(
      (finding) =>
        finding.findingClass === 'planned-vs-actual' &&
        finding.subject.subjectId === ACTIVITY_ID &&
        finding.status === 'blocked',
    );
    expect(blocked).toBeDefined();
    const blockedAlert = outcome.alertOutcomes.find(
      (entry) => entry.alert.findingId === blocked!.findingId,
    )!;
    expect(blockedAlert.admission).toBe('raised');
    expect(blockedAlert.alert.revision).toBe(3); // due -> late -> blocked
    expect(blockedAlert.alert.severity).toBe('critical'); // exact (class, status) rule
    expect(blockedAlert.alert.findingStatus).toBe('blocked');
    // The untouched findings at the same instant are duplicates (idempotent).
    const duplicates = outcome.alertOutcomes.filter((entry) => entry.admission === 'duplicate');
    expect(duplicates.length).toBe(5);
  });

  it('ALERT IDEMPOTENCY: re-running the same pass id is replay-conflict; a new pass with UNCHANGED state duplicates', () => {
    const { host, auth } = seededHost();
    unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-1',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    const replay = expectError(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-1',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    expect(replay.code).toBe('replay-conflict');
    const second = unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-1b',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    expect(second.alertOutcomes.every((entry) => entry.admission === 'duplicate')).toBe(true);
    expect(second.notifications).toHaveLength(0);
    expect(host.health().alertChainCount).toBe(1);
  });

  it('the derived projection folds the full transition history', () => {
    const { host, auth } = seededHost();
    unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-1',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-2',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_PAST_FINISH,
      }),
    );
    const state = unwrap(
      host.supervisionState({ tenantId: TENANT, authorization: auth, programId: PROGRAM_ID }),
    );
    expect(state.supervision.passCount).toBe(2);
    expect(state.supervision.counts.byStatus['late']).toBe(4);
    expect(state.alerts.chains).toHaveLength(7);
    const excavate = state.alerts.chains.find(
      (chain) => chain.findingId === 'finding:planned-vs-actual-activity-activity-excavate',
    );
    expect(excavate).toBeDefined();
    expect(excavate!.revisionCount).toBe(2);
    expect(excavate!.findingStatus).toBe('late');
    expect(excavate!.severity).toBe('major');
    expect(state.alerts.counts).toEqual({ raised: 7, escalated: 0, resolved: 0 });
    expect(state.notifications).toHaveLength(8); // 1 (pass 1) + 7 (pass 2)
  });

  it('the sibling-kernel inputs feed through (issues, lead times, unknowns)', () => {
    const { host, auth } = seededHost();
    const outcome = unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-full',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_PAST_FINISH,
        executionIssues: [issueSummary()],
        leadTimeInputs: [leadTimeInput()],
        infoRequests: [
          {
            schema: 'epoch.solution-delivery.info-request',
            schemaVersion: 1,
            requestId: 'info-request:soil-bearing-capacity',
            tenantId: TENANT,
            solutionId: 'solution:tower-retrofit',
            requestedInformation: 'the verified soil bearing capacity',
            decisionImpact: {
              stage: 'realize',
              decisionKind: 'verification-result',
              materiality: 'material',
              rationale: 'verification depends on it',
            },
            freshnessRequirement: { state: 'stale', assessedAt: T3 },
            issuedAt: T3,
            issuedBy: PRINCIPAL,
            status: 'open',
          },
        ],
      }),
    );
    const classes = [...new Set(outcome.pass.findings.map((finding) => finding.findingClass))];
    expect(classes).toContain('lead-time-risk');
    expect(classes).toContain('unresolved-unknown');
    expect(classes).toContain('planned-vs-actual');
    expect(classes).toContain('critical-path-drift');
    expect(classes).toContain('missing-prerequisite');
  });
});

describe('event streams (every step emits supervision:* events)', () => {
  it('the program stream carries the full lifecycle in contiguous sequence', () => {
    const { host, auth } = seededHost();
    unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-1',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    const events = unwrap(
      host.readStream({ tenantId: TENANT, authorization: auth, streamId: SUPERVISION_STREAM }),
    );
    const discriminators = events.map((event) => event.payload.discriminator);
    expect(discriminators).toEqual([
      'supervision:program-registered',
      'supervision:delivery-registered',
      'supervision:pass-evaluated',
      'supervision:finding-produced',
      'supervision:alert-raised',
      'supervision:notification-dispatched',
      'supervision:projection-updated',
    ]);
    for (let i = 0; i < events.length; i += 1) {
      expect(events[i]!.sequence).toBe(i + 1);
      if (i > 0) {
        expect(events[i]!.causalParent).toEqual({ streamId: SUPERVISION_STREAM, sequence: i });
      }
    }
  });

  it('the tenant host stream carries policy registration', () => {
    const { host, auth } = seededHost();
    const events = unwrap(host.readStream({ tenantId: TENANT, authorization: auth, streamId: HOST_STREAM }));
    expect(events.map((event) => event.payload.discriminator)).toEqual([
      'supervision:policy-registered',
    ]);
  });
});

describe('policy-controlled escalation through the runtime', () => {
  it('swapping the active policy record changes alert severity (no code change)', () => {
    const host = new SupervisionRuntime();
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }));
    unwrap(host.registerDelivery({ tenantId: TENANT, authorization: auth, delivery: openedDelivery() }));
    unwrap(host.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));
    const before = unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-1',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    // Swap to a lenient policy v2 (default info, no rules).
    unwrap(
      host.registerPolicy({
        tenantId: TENANT,
        authorization: auth,
        policy: policyContent({
          policyVersion: '2.0.0',
          defaultSeverity: 'info',
          rules: [],
        }),
      }),
    );
    const after = unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-2',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_PAST_FINISH,
      }),
    );
    expect(before.alertOutcomes.every((entry) => entry.alert.severity === 'major')).toBe(true);
    const revised = after.alertOutcomes.filter((entry) => entry.admission === 'raised');
    expect(revised.length).toBeGreaterThan(0);
    for (const entry of revised) {
      expect(entry.alert.severity).toBe('info');
      expect(entry.alert.policyId).toBe(POLICY_ID);
    }
  });
});
