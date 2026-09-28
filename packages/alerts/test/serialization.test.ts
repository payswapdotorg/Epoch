// DETERMINISM + ROUND-TRIP SERIALIZATION for every public alerts type:
// identical inputs produce identical digests; JSON round-trips preserve
// digests; key reordering of the input never leaks (canonical JSON).
import { describe, expect, it } from 'vitest';
import {
  admitEscalationPolicy,
  buildNotification,
  buildEscalationProposal,
  computeProposalDigest,
  planEscalation,
  raiseAlert,
  recordEscalationOutcome,
  resolveAlert,
  verifySealedAlertRecord,
  verifySealedEscalationOutcome,
  verifySealedEscalationPolicy,
  verifySealedNotification,
} from '../src/index';
import {
  PRINCIPAL,
  PROPOSER,
  TENANT,
  T5,
  T6,
  alertChain,
  findingSummary,
  policyContent,
  sealedPolicy,
  unwrap,
} from './fixtures';

describe('determinism (identical inputs -> identical digests)', () => {
  it('policies: the same content seals to the same digest under key reordering', () => {
    const first = sealedPolicy();
    const reordered = {
      activatedBy: PRINCIPAL,
      activatedAt: policyContent()['activatedAt'],
      rules: policyContent()['rules'],
      defaultEscalation: policyContent()['defaultEscalation'],
      defaultSeverity: 'warning',
      title: 'Standard delivery-supervision escalation policy',
      policyVersion: '1.0.0',
      tenantId: TENANT,
      policyId: 'alert-policy:standard-escalation',
      schemaVersion: 1,
      schema: 'epoch.alerts.escalation-policy',
    };
    const second = unwrap(admitEscalationPolicy(reordered));
    expect(second.contentDigest).toBe(first.contentDigest);
  });

  it('alerts: the same finding under the same policy derives the same revision digest', () => {
    const one = unwrap(
      raiseAlert([], {
        alertId: 'alert:planned-vs-actual-activity-activity-excavate',
        tenantId: TENANT,
        summary: findingSummary(),
        policy: sealedPolicy(),
        raisedAt: T5,
        raisedBy: PRINCIPAL,
      }),
    );
    const two = unwrap(
      raiseAlert([], {
        alertId: 'alert:planned-vs-actual-activity-activity-excavate',
        tenantId: TENANT,
        summary: findingSummary(),
        policy: sealedPolicy(),
        raisedAt: T5,
        raisedBy: PRINCIPAL,
      }),
    );
    expect(two.alert.contentDigest).toBe(one.alert.contentDigest);
  });
});

describe('round-trip serialization + digest verification', () => {
  it('every public sealed type round-trips through JSON', () => {
    const policy = sealedPolicy();
    expect(unwrap(verifySealedEscalationPolicy(JSON.parse(JSON.stringify(policy)))).contentDigest).toBe(
      policy.contentDigest,
    );

    const chain = alertChain([
      findingSummary({ findingStatus: 'due' }),
      findingSummary({ findingStatus: 'late', findingDigest: 'b'.repeat(64) }),
    ]);
    for (const alert of chain) {
      expect(unwrap(verifySealedAlertRecord(JSON.parse(JSON.stringify(alert)))).contentDigest).toBe(
        alert.contentDigest,
      );
    }

    const resolved = unwrap(
      resolveAlert(chain, { resolvedAt: T6, resolvedBy: PRINCIPAL, resolutionKind: 'remediated' }),
    );
    expect(unwrap(verifySealedAlertRecord(JSON.parse(JSON.stringify(resolved)))).contentDigest).toBe(
      resolved.contentDigest,
    );

    const head = chain[chain.length - 1]!;
    const proposal = unwrap(
      buildEscalationProposal({
        alert: head,
        plan: planEscalation({
          alert: head,
          delaySeconds: '1800',
          reNotifyCadenceSeconds: '43200',
          notify: [{ targetKind: 'role', targetRef: 'role:site-manager' }],
          escalateTo: [],
        }),
        proposalId: 'proposal-escalate-1',
        messageId: 'message-escalate-1',
        proposedBy: PROPOSER,
        createdAt: T5,
      }),
    );
    const decision = {
      protocolVersion: '1.0.0',
      messageKind: 'action.authorization-decision',
      messageId: 'message-decision-1',
      createdAt: T6,
      requestId: 'message-request-1',
      proposalRef: { proposalId: proposal.proposalId, canonicalDigest: computeProposalDigest(proposal) },
      decidedBy: { id: 'gateway:action-gateway', role: 'action-gateway' },
      decision: { kind: 'authorized', conditions: [] },
    };
    const outcome = unwrap(
      recordEscalationOutcome({
        outcomeId: 'escalation:round-trip-1',
        tenantId: TENANT,
        alert: head,
        proposal,
        decision: decision as never,
        escalationLevel: 1,
        recordedAt: T6,
        recordedBy: PRINCIPAL,
      }),
    );
    expect(
      unwrap(verifySealedEscalationOutcome(JSON.parse(JSON.stringify(outcome)))).contentDigest,
    ).toBe(outcome.contentDigest);

    const notification = unwrap(
      buildNotification({
        notificationId: 'notification:round-trip-1',
        alert: head,
        channelKind: 'in-app',
        targets: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
        title: 'x',
        body: 'x',
        dispatchedAt: T5,
        dispatchedBy: PRINCIPAL,
      }),
    );
    expect(unwrap(verifySealedNotification(JSON.parse(JSON.stringify(notification)))).contentDigest).toBe(
      notification.contentDigest,
    );
  });
});
