// Positive intake coverage: the authorization gate, the policy decision,
// statuses and the emitted action:* events.
import { describe, expect, it } from 'vitest';
import { ActionGateway, actionStreamIdOf } from '../src/index';
import {
  phaseOf,
  plainProposal,
  PRINCIPAL,
  submitOptions,
  TENANT_A,
  unwrap,
} from './helpers';

describe('submitAction — outcomes', () => {
  it('admits an allowed proposal: status authorized, proposed+authorized events', () => {
    const gateway = new ActionGateway();
    const intake = unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
    expect(intake.action.status).toBe('authorized');
    expect(intake.decision.outcome).toBe('allow');
    expect(intake.action.streamId).toBe('stream:action-reinforce-beam-b12');
    expect(actionStreamIdOf('action:reinforce-beam-b12')).toBe(intake.action.streamId);
    expect(intake.events.map(phaseOf)).toEqual(['proposed', 'authorized']);
    expect(intake.events[0]?.payload.data.detail).toMatchObject({
      decisionDigest: intake.decision.contentDigest,
      policySetDigest: intake.decision.policySetDigest,
      outcome: 'allow',
    });
    expect(intake.events[0]?.actor).toBe(PRINCIPAL);
    expect(intake.events[0]?.causalParent).toBeNull();
    expect(intake.events[1]?.causalParent).toEqual({
      streamId: intake.action.streamId,
      sequence: 1,
    });
  });

  it('admits a requires-approval proposal: status awaiting-approval, proposed event', () => {
    const gateway = new ActionGateway();
    const intake = unwrap(gateway.submitAction(submitOptions()));
    expect(intake.action.status).toBe('awaiting-approval');
    expect(intake.decision.outcome).toBe('requires-approval');
    expect(intake.events.map(phaseOf)).toEqual(['proposed']);
  });

  it('records a policy denial as typed data: status denied, proposed+rejected events', () => {
    const gateway = new ActionGateway();
    const intake = unwrap(gateway.submitAction(submitOptions({ spend: 150 })));
    expect(intake.action.status).toBe('denied');
    expect(intake.decision.outcome).toBe('deny');
    expect(intake.decision.denial?.code).toBe('constraint-blocked');
    expect(intake.events.map(phaseOf)).toEqual(['proposed', 'rejected']);
    expect(intake.events[1]?.payload.data.detail).toMatchObject({
      decisionDigest: intake.decision.contentDigest,
      via: 'policy-deny',
      denialCode: 'constraint-blocked',
    });
  });

  it('one action = one stream: the events accumulate per action', () => {
    const gateway = new ActionGateway();
    const intake = unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
    const stream = unwrap(gateway.actionStream({ tenantId: TENANT_A, actionId: intake.action.actionId }));
    expect(stream.map(phaseOf)).toEqual(['proposed', 'authorized']);
    expect(stream.map((event) => event.sequence)).toEqual([1, 2]);
  });

  it('lists tenant actions deterministically and reads one action', () => {
    const gateway = new ActionGateway();
    unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal(), actionId: 'action:aaa' })));
    unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal({ proposalId: 'prop-2' }), actionId: 'action:bbb' })));
    const listed = unwrap(gateway.listActions({ tenantId: TENANT_A }));
    expect(listed.map((entry) => entry.actionId)).toEqual(['action:aaa', 'action:bbb']);
    const one = unwrap(gateway.getAction({ tenantId: TENANT_A, actionId: 'action:aaa' }));
    expect(one.status).toBe('authorized');
  });
});

describe('submitAction — re-decision under a changed policy set', () => {
  it('records a NEW chained decision and the action runs under it', async () => {
    const { changedPolicySet } = await import('./helpers');
    const gateway = new ActionGateway();
    const first = unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
    const second = unwrap(
      gateway.submitAction(
        submitOptions({ proposal: plainProposal(), policies: changedPolicySet(), decidedAt: '2025-01-16T09:00:00.000Z' }),
      ),
    );
    expect(second.decision.contentDigest).not.toBe(first.decision.contentDigest);
    expect(second.decision.previousDecisionDigest).toBe(first.decision.contentDigest);
    expect(second.action.decisionDigest).toBe(second.decision.contentDigest);
    // The stream carries the full lifecycle (4 events: proposed, authorized, proposed, authorized).
    const stream = unwrap(gateway.actionStream({ tenantId: TENANT_A, actionId: second.action.actionId }));
    expect(stream.map(phaseOf)).toEqual(['proposed', 'authorized', 'proposed', 'authorized']);
  });
});
