// Replay/idempotency coverage: duplicate decision admission (the kernel's
// typed duplicate-decision), duplicate approvals, and re-evaluation under
// a changed policy set.
import { describe, expect, it } from 'vitest';
import { ActionGateway } from '../src/index';
import {
  APPROVER_1,
  APPROVER_2,
  changedPolicySet,
  executeOptions,
  phaseOf,
  plainProposal,
  submitOptions,
  TENANT_A,
  T1,
  T2,
  unwrap,
} from './helpers';

describe('duplicate decision intake (idempotent replay)', () => {
  it('the same proposal under the same policy set is the typed duplicate-decision', () => {
    const gateway = new ActionGateway();
    const first = unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
    const replay = gateway.submitAction(
      submitOptions({ proposal: plainProposal(), decidedAt: T2 }),
    );
    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.error.code).toBe('duplicate-decision');
    if (replay.error.code === 'duplicate-decision') {
      expect(replay.error.existingDecisionDigest).toBe(first.decision.contentDigest);
    }
    // State unchanged: the stream still holds the first intake's events only.
    const stream = unwrap(
      gateway.actionStream({ tenantId: TENANT_A, actionId: first.action.actionId }),
    );
    expect(stream.map(phaseOf)).toEqual(['proposed', 'authorized']);
  });

  it('a second action id grounding the same proposal + policy adopts the SAME decision', () => {
    const gateway = new ActionGateway();
    const first = unwrap(
      gateway.submitAction(
        submitOptions({ proposal: plainProposal(), actionId: 'action:first-tracker' }),
      ),
    );
    const second = unwrap(
      gateway.submitAction(
        submitOptions({ proposal: plainProposal(), actionId: 'action:second-tracker' }),
      ),
    );
    // The registry's idempotency key matches: the SAME decision identity.
    expect(second.decision.contentDigest).toBe(first.decision.contentDigest);
    expect(second.action.decisionDigest).toBe(first.decision.contentDigest);
    expect(second.action.status).toBe('authorized');
    // Each action id keeps its own stream.
    expect(second.action.streamId).toBe('stream:action-second-tracker');
  });

  it('a re-evaluation under a CHANGED policy set is a NEW decision (the action advances)', () => {
    const gateway = new ActionGateway();
    const first = unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
    const second = unwrap(
      gateway.submitAction(
        submitOptions({ proposal: plainProposal(), policies: changedPolicySet(), decidedAt: T2 }),
      ),
    );
    expect(second.decision.contentDigest).not.toBe(first.decision.contentDigest);
    expect(second.decision.previousDecisionDigest).toBe(first.decision.contentDigest);
    expect(second.action.decisionDigest).toBe(second.decision.contentDigest);
    // Executing runs under the NEW decision.
    const execution = unwrap(gateway.executeAction(executeOptions()));
    expect(execution.outcome.decisionDigest).toBe(second.decision.contentDigest);
  });
});

describe('duplicate approval (idempotent replay)', () => {
  it('an approval replayed by the same approver echoes the sealed record', () => {
    const gateway = new ActionGateway();
    const intake = unwrap(gateway.submitAction(submitOptions()));
    const first = unwrap(
      gateway.approveAction({
        tenantId: TENANT_A,
        actionId: intake.action.actionId,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        note: 'LGTM',
        at: T1,
      }),
    );
    const replay = gateway.approveAction({
      tenantId: TENANT_A,
      actionId: intake.action.actionId,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      note: 'different note on replay',
      at: T2,
    });
    expect(replay.ok).toBe(false);
    if (replay.ok) return;
    expect(replay.error.code).toBe('duplicate-approval');
    if (replay.error.code === 'duplicate-approval') {
      expect(replay.error.approverId).toBe(APPROVER_1.id);
      expect(replay.error.existingApproval.contentDigest).toBe(first.approval.contentDigest);
      expect(replay.error.existingApproval.note).toBe('LGTM');
    }
  });

  it('a DISTINCT approver after the quorum is settled (approval-request-settled)', () => {
    const gateway = new ActionGateway();
    const intake = unwrap(gateway.submitAction(submitOptions()));
    unwrap(
      gateway.approveAction({
        tenantId: TENANT_A,
        actionId: intake.action.actionId,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        at: T1,
      }),
    );
    const late = gateway.approveAction({
      tenantId: TENANT_A,
      actionId: intake.action.actionId,
      decidedBy: APPROVER_2,
      asRole: 'lead-reviewer',
      at: T1,
    });
    expect(late.ok).toBe(false);
    if (late.ok) return;
    expect(late.error.code).toBe('approval-request-settled');
  });
});
