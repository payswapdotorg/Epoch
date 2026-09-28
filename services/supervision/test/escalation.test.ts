// THE ESCALATION PATH through the runtime: typed W003 proposals,
// verifiable gateway decisions (all three outcomes), the escalated
// alert revision, escalation-tier notifications, resolution, and the
// re-notify cadence sweep.
import { describe, expect, it } from 'vitest';
import { buildEscalationProposal, computeProposalDigest, planEscalation } from '@epoch/alerts';
import { SupervisionRuntime } from '../src/index';
import {
  DELIVERY_ID,
  EVAL_IN_WINDOW,
  EVAL_PAST_FINISH,
  PRINCIPAL,
  PROGRAM_ID,
  TENANT,
  T5,
  T6,
  T7,
  allowContext,
  expectError,
  openedDelivery,
  policyContent,
  sealedProgram,
  unwrap,
} from './helpers';

const ALERT_ID = 'alert:planned-vs-actual-activity-activity-excavate';

function seededHost() {
  const host = new SupervisionRuntime();
  const auth = { principalId: PRINCIPAL, context: allowContext() };
  unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }));
  unwrap(host.registerDelivery({ tenantId: TENANT, authorization: auth, delivery: openedDelivery() }));
  unwrap(host.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));
  const pass = unwrap(
    host.runEvaluationPass({
      tenantId: TENANT,
      authorization: auth,
      passId: 'pass:week-1',
      programId: PROGRAM_ID,
      deliveryId: DELIVERY_ID,
      evaluatedAt: EVAL_IN_WINDOW,
    }),
  );
  return { host, auth, pass };
}

/** One W003 proposal + decision pair bound to the alert head. */
function proposalAndDecision(host: SupervisionRuntime, level = 1) {
  const state = unwrap(
    host.supervisionState({ tenantId: TENANT, authorization: { principalId: PRINCIPAL, context: allowContext() }, programId: PROGRAM_ID }),
  );
  const chain = state.alerts.chains.find((row) => row.alertId === ALERT_ID)!;
  const alert = {
    alertId: chain.alertId,
    revision: chain.revisionCount,
    severity: chain.severity,
    findingClass: 'planned-vs-actual',
    findingStatus: chain.findingStatus,
    subjectKind: 'activity',
    subjectId: 'activity:excavate',
    contentDigest: chain.headDigest,
    escalationLevel: 0,
    tenantId: TENANT,
    findingId: chain.findingId,
    findingDigest: 'a'.repeat(64),
    policyId: 'alert-policy:standard-escalation',
    policyDigest: 'b'.repeat(64),
    status: 'raised',
    title: 'Activity activity:excavate is due',
    raisedAt: EVAL_IN_WINDOW,
    raisedBy: PRINCIPAL,
  } as never;
  const proposal = unwrap(
    buildEscalationProposal({
      alert,
      plan: planEscalation({
        alert,
        delaySeconds: '1800',
        reNotifyCadenceSeconds: '43200',
        notify: [{ targetKind: 'role', targetRef: 'role:site-manager' }],
        escalateTo: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
      }),
      proposalId: `proposal-escalate-excavate-${level}`,
      messageId: `message-escalate-excavate-${level}`,
      proposedBy: 'agent:supervision-runtime',
      createdAt: T6,
    }),
  );
  return { alert, proposal };
}

function decisionFor(proposal: ReturnType<typeof proposalAndDecision>['proposal'], overrides: Record<string, unknown> = {}) {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'action.authorization-decision',
    messageId: `message-decision-${proposal.proposalId}`,
    createdAt: T6,
    requestId: `message-request-${proposal.proposalId}`,
    proposalRef: { proposalId: proposal.proposalId, canonicalDigest: computeProposalDigest(proposal) },
    decidedBy: { id: 'gateway:action-gateway', role: 'action-gateway' },
    decision: { kind: 'authorized', conditions: [] },
    ...overrides,
  } as never;
}

describe('escalation through the gateway seam (all three outcomes at the runtime)', () => {
  it('AUTHORIZED: the outcome records, the chain escalates, the escalation tier is notified', () => {
    const { host, auth } = seededHost();
    const { proposal } = proposalAndDecision(host);
    const outcome = unwrap(
      host.recordGatewayDecision({
        tenantId: TENANT,
        authorization: auth,
        alertId: ALERT_ID,
        proposal,
        decision: decisionFor(proposal),
        recordedAt: T6,
      }),
    );
    expect(outcome.outcome.outcomeKind).toBe('dispatched');
    expect(outcome.outcome.escalationLevel).toBe(1);
    expect(outcome.alert).not.toBeNull();
    expect(outcome.alert!.status).toBe('escalated');
    expect(outcome.alert!.revision).toBe(2);
    expect(outcome.notifications).toHaveLength(1);
  });

  it('DENIED: the outcome records as blocked-by-gateway; the chain does NOT escalate', () => {
    const { host, auth } = seededHost();
    const { proposal } = proposalAndDecision(host);
    const outcome = unwrap(
      host.recordGatewayDecision({
        tenantId: TENANT,
        authorization: auth,
        alertId: ALERT_ID,
        proposal,
        decision: decisionFor(proposal, {
          decision: { kind: 'denied', code: 'policy-violation', reason: 'out of escalation window' },
        }),
        recordedAt: T6,
      }),
    );
    expect(outcome.outcome.outcomeKind).toBe('blocked-by-gateway');
    expect(outcome.alert).toBeNull();
    expect(outcome.notifications).toHaveLength(0);
  });

  it('ESCALATED (requires approval): the outcome records as awaiting-approval', () => {
    const { host, auth } = seededHost();
    const { proposal } = proposalAndDecision(host);
    const outcome = unwrap(
      host.recordGatewayDecision({
        tenantId: TENANT,
        authorization: auth,
        alertId: ALERT_ID,
        proposal,
        decision: decisionFor(proposal, {
          decidedBy: { id: 'principal:night-manager', role: 'human-approver' },
          decision: {
            kind: 'escalated',
            escalatedTo: { id: 'principal:night-manager', role: 'human-approver' },
            reason: 'major severity requires the night manager',
          },
        }),
        recordedAt: T6,
      }),
    );
    expect(outcome.outcome.outcomeKind).toBe('awaiting-approval');
    expect(outcome.outcome.decidedByRole).toBe('human-approver');
    expect(outcome.alert).toBeNull();
  });

  it('an UNBOUND decision (different proposal) is gateway-bypass-rejected at the kernel seam', () => {
    const { host, auth } = seededHost();
    const { proposal } = proposalAndDecision(host);
    const other = proposalAndDecision(host, 2).proposal;
    const error = expectError(
      host.recordGatewayDecision({
        tenantId: TENANT,
        authorization: auth,
        alertId: ALERT_ID,
        proposal,
        decision: decisionFor(other),
        recordedAt: T6,
      }),
    );
    expect(error.code).toBe('gateway-bypass-rejected');
  });

  it('resolution is terminal and emits alert-resolved', () => {
    const { host, auth } = seededHost();
    const resolved = unwrap(
      host.resolveAlertService({
        tenantId: TENANT,
        authorization: auth,
        alertId: ALERT_ID,
        resolvedAt: T7,
        resolutionKind: 'remediated',
      }),
    );
    expect(resolved.status).toBe('resolved');
    expect(resolved.revision).toBe(2);
    const error = expectError(
      host.resolveAlertService({
        tenantId: TENANT,
        authorization: auth,
        alertId: ALERT_ID,
        resolvedAt: T7,
        resolutionKind: 'withdrawn',
      }),
    );
    expect(error.code).toBe('lifecycle-conflict');
  });
});

describe('the re-notify cadence sweep (policy data drives re-notification)', () => {
  it('a sweep before the cadence elapses re-notifies nothing', () => {
    const { host, auth } = seededHost();
    // The policy cadence for planned-vs-actual is 43200s (12h); the pass
    // dispatched at EVAL_IN_WINDOW. Sweep 1h later: nothing.
    const receipts = unwrap(
      host.runNotificationSweep({
        tenantId: TENANT,
        authorization: auth,
        asOf: '2026-03-02T13:00:00.000Z',
      }),
    );
    expect(receipts).toHaveLength(0);
  });

  it('a sweep after the cadence elapses re-notifies the open alert', () => {
    const { host, auth } = seededHost();
    const receipts = unwrap(
      host.runNotificationSweep({
        tenantId: TENANT,
        authorization: auth,
        asOf: '2026-03-03T12:00:00.000Z', // > 12h after EVAL_IN_WINDOW
      }),
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0]!.notificationId).toContain('-n2'); // a NEW notification record
    // A second sweep at the SAME instant is time-idempotent (the cadence
    // restarts at the last dispatch): no duplicate dispatch.
    const replay = unwrap(
      host.runNotificationSweep({
        tenantId: TENANT,
        authorization: auth,
        asOf: '2026-03-03T12:00:00.000Z',
      }),
    );
    expect(replay).toHaveLength(0);
    // The next sweep after ANOTHER cadence window re-notifies again.
    const next = unwrap(
      host.runNotificationSweep({
        tenantId: TENANT,
        authorization: auth,
        asOf: '2026-03-04T12:00:00.000Z',
      }),
    );
    expect(next).toHaveLength(1);
    expect(next[0]!.notificationId).toContain('-n3');
  });

  it('a resolved alert is not re-notified', () => {
    const { host, auth } = seededHost();
    unwrap(
      host.resolveAlertService({
        tenantId: TENANT,
        authorization: auth,
        alertId: ALERT_ID,
        resolvedAt: T5,
        resolutionKind: 'remediated',
      }),
    );
    const receipts = unwrap(
      host.runNotificationSweep({
        tenantId: TENANT,
        authorization: auth,
        asOf: '2026-03-03T12:00:00.000Z',
      }),
    );
    expect(receipts).toHaveLength(0);
  });
});

describe('determinism (two hosts fed the same operations hold identical state)', () => {
  it('byte-identical snapshots + stream digests', () => {
    const build = () => {
      const host = new SupervisionRuntime();
      const auth = { principalId: PRINCIPAL, context: allowContext() };
      unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }));
      unwrap(host.registerDelivery({ tenantId: TENANT, authorization: auth, delivery: openedDelivery() }));
      unwrap(host.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));
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
      return host;
    };
    const one = build();
    const two = build();
    expect(JSON.stringify(one.snapshot())).toBe(JSON.stringify(two.snapshot()));
    const streamsOne = one.snapshot().streams;
    const streamsTwo = two.snapshot().streams;
    expect(streamsOne).toEqual(streamsTwo);
    const eventsOne = unwrap(
      one.readStream({
        tenantId: TENANT,
        authorization: { principalId: PRINCIPAL, context: allowContext() },
        streamId: 'stream:supervision-tower-retrofit-v1',
      }),
    );
    const eventsTwo = unwrap(
      two.readStream({
        tenantId: TENANT,
        authorization: { principalId: PRINCIPAL, context: allowContext() },
        streamId: 'stream:supervision-tower-retrofit-v1',
      }),
    );
    expect(eventsOne.map((event) => event.contentDigest)).toEqual(
      eventsTwo.map((event) => event.contentDigest),
    );
  });
});
