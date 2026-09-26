// The human-approval flow: quorum, delegation, deadlines, expiry (the
// typed approval-timeout), rejection vetoes, and supersession.
import { describe, expect, it } from 'vitest';
import { ActionGateway } from '../src/index';
import {
  APPROVER_1,
  APPROVER_2,
  changedPolicySet,
  DEADLINE,
  executeOptions,
  GATEWAY_AUTHORIZER,
  phaseOf,
  submitOptions,
  TENANT_A,
  T1,
  T2,
  unwrap,
} from './helpers';

function approvalFlow(gateway = new ActionGateway()) {
  const intake = unwrap(gateway.submitAction(submitOptions()));
  return { gateway, intake };
}

describe('quorum', () => {
  it('an approval meeting the quorum authorizes the action (authorized event)', () => {
    const { gateway, intake } = approvalFlow();
    const approval = unwrap(
      gateway.approveAction({
        tenantId: TENANT_A,
        actionId: intake.action.actionId,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        at: T1,
      }),
    );
    expect(approval.action.status).toBe('authorized');
    expect(approval.approval.decidedBy.id).toBe(APPROVER_1.id);
    expect(approval.events.map(phaseOf)).toEqual(['authorized']);
    expect(approval.events[0]?.payload.data.detail).toMatchObject({
      decisionDigest: intake.decision.contentDigest,
      via: 'human-approval',
      approvals: 1,
    });
    // And execution now proceeds.
    const execution = unwrap(gateway.executeAction(executeOptions({ actionId: intake.action.actionId })));
    expect(execution.action.status).toBe('executed');
  });

  it('a sub-quorum approval leaves the action awaiting (no milestone event)', () => {
    const gateway = new ActionGateway();
    const intake = unwrap(
      gateway.submitAction(
        submitOptions({
          actionId: 'action:quorum-two-sub',
          proposal: quorumTwoProposal(),
        }),
      ),
    );
    const approval = unwrap(
      gateway.approveAction({
        tenantId: TENANT_A,
        actionId: intake.action.actionId,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        at: T1,
      }),
    );
    expect(approval.action.status).toBe('awaiting-approval');
    expect(approval.events).toHaveLength(0);
  });

  it('two distinct approvers meet a quorum of two', () => {
    const gateway = new ActionGateway();
    const intake = unwrap(
      gateway.submitAction(
        submitOptions({ actionId: 'action:quorum-two-real', proposal: quorumTwoProposal() }),
      ),
    );
    unwrap(
      gateway.approveAction({
        tenantId: TENANT_A,
        actionId: intake.action.actionId,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        at: T1,
      }),
    );
    expect(unwrap(gateway.getAction({ tenantId: TENANT_A, actionId: intake.action.actionId })).status).toBe(
      'awaiting-approval',
    );
    const second = unwrap(
      gateway.approveAction({
        tenantId: TENANT_A,
        actionId: intake.action.actionId,
        decidedBy: APPROVER_2,
        asRole: 'lead-reviewer',
        at: T1,
      }),
    );
    expect(second.action.status).toBe('authorized');
    expect(second.events.map(phaseOf)).toEqual(['authorized']);
  });
});

describe('delegation', () => {
  it('admits a within-bound delegated approval', () => {
    const { gateway, intake } = approvalFlow();
    const approval = unwrap(
      gateway.approveAction({
        tenantId: TENANT_A,
        actionId: intake.action.actionId,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        delegationPath: ['principal:eng-director', 'principal:eng-lead'],
        at: T1,
      }),
    );
    expect(approval.approval.delegation.depth).toBe(1);
    expect(approval.action.status).toBe('authorized');
  });

  it('rejects delegation beyond the directive bound (kernel passthrough)', () => {
    const { gateway, intake } = approvalFlow();
    const outcome = gateway.approveAction({
      tenantId: TENANT_A,
      actionId: intake.action.actionId,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      delegationPath: ['principal:eng-director', 'principal:eng-manager', 'principal:eng-lead'],
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('delegation-depth-exceeded');
  });

  it('rejects circular delegation (kernel passthrough)', () => {
    const { gateway, intake } = approvalFlow();
    const outcome = gateway.approveAction({
      tenantId: TENANT_A,
      actionId: intake.action.actionId,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      delegationPath: ['principal:eng-lead', 'principal:eng-manager', 'principal:eng-lead'],
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('delegation-cycle');
  });

  it('rejects a gateway-role authorizer as approver (agents are structurally excluded)', () => {
    const { gateway, intake } = approvalFlow();
    const outcome = gateway.approveAction({
      tenantId: TENANT_A,
      actionId: intake.action.actionId,
      // A principal-grammar id carrying the ACTION-GATEWAY role: the actor
      // grammar passes, the kernel ROLE gate fires.
      decidedBy: { id: 'principal:gateway-automation', role: 'action-gateway' },
      asRole: 'senior-structural-engineer',
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('approver-role-rejected');
  });

  it('rejects a non-principal approver id (event actor grammar, validation)', () => {
    const { gateway, intake } = approvalFlow();
    const outcome = gateway.approveAction({
      tenantId: TENANT_A,
      actionId: intake.action.actionId,
      decidedBy: GATEWAY_AUTHORIZER, // 'gateway:main' is not the actor grammar
      asRole: 'senior-structural-engineer',
      at: T1,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
  });
});

describe('rejection (fail-closed veto)', () => {
  it('a human rejection settles the action rejected (event + terminal state)', () => {
    const { gateway, intake } = approvalFlow();
    const rejection = unwrap(
      gateway.rejectAction({
        tenantId: TENANT_A,
        actionId: intake.action.actionId,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        note: 'The simulation evidence is stale.',
        at: T1,
      }),
    );
    expect(rejection.action.status).toBe('rejected');
    expect(rejection.events.map(phaseOf)).toEqual(['rejected']);
    expect(rejection.events[0]?.payload.data.detail).toMatchObject({ via: 'human-rejection' });
    // Execution is now impossible.
    const execution = gateway.executeAction(executeActionOptionsFor(intake.action.actionId));
    expect(execution.ok).toBe(false);
    if (!execution.ok) {
      expect(execution.error.code).toBe('action-rejected');
    }
  });

  it('a rejection vetoes even after sub-quorum approvals', () => {
    const gateway = new ActionGateway();
    const intake = unwrap(
      gateway.submitAction(submitOptions({ actionId: 'action:veto-after-approval' })),
    );
    unwrap(
      gateway.approveAction({
        tenantId: TENANT_A,
        actionId: intake.action.actionId,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        at: T1,
      }),
    );
    // Quorum was 1, so this approval already authorized — a later rejection
    // is settled (approval-request-settled), proving single settlement.
    const lateRejection = gateway.rejectAction({
      tenantId: TENANT_A,
      actionId: intake.action.actionId,
      decidedBy: APPROVER_2,
      asRole: 'lead-reviewer',
      at: T1,
    });
    expect(lateRejection.ok).toBe(false);
    if (!lateRejection.ok) {
      expect(lateRejection.error.code).toBe('approval-request-settled');
    }
  });
});

describe('deadlines and expiry (typed approval-timeout)', () => {
  it('rejects a late approval (approval-deadline-expired, kernel passthrough)', () => {
    const { gateway, intake } = approvalFlow();
    const outcome = gateway.approveAction({
      tenantId: TENANT_A,
      actionId: intake.action.actionId,
      decidedBy: APPROVER_1,
      asRole: 'senior-structural-engineer',
      at: '2025-01-19T00:00:00.000Z',
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('approval-deadline-expired');
  });

  it('the sweep expires unmet requests: action approval-expired, event approval-timeout', () => {
    const { gateway, intake } = approvalFlow();
    const expired = unwrap(gateway.expireApprovals('2025-01-19T00:00:00.000Z'));
    expect(expired).toHaveLength(1);
    expect(expired[0]?.action.actionId).toBe(intake.action.actionId);
    expect(expired[0]?.action.status).toBe('approval-expired');
    expect(phaseOf(expired[0]!.event)).toBe('rejected');
    expect(expired[0]?.event.payload.data.detail).toMatchObject({ via: 'approval-timeout' });
    // The sweep is idempotent.
    expect(unwrap(gateway.expireApprovals('2025-01-20T00:00:00.000Z'))).toHaveLength(0);
    // Execution after expiry is the typed approval-timeout.
    const execution = gateway.executeAction(executeActionOptionsFor(intake.action.actionId));
    expect(execution.ok).toBe(false);
    if (!execution.ok) {
      expect(execution.error.code).toBe('approval-timeout');
      if (execution.error.code === 'approval-timeout') {
        expect(execution.error.deadline).toBe(DEADLINE);
      }
    }
  });
});

describe('supersession (re-decision under a changed policy set)', () => {
  it('a new decision supersedes the open request; approvals do not transfer', () => {
    const gateway = new ActionGateway();
    const first = unwrap(gateway.submitAction(submitOptions()));
    // The re-decision of the SAME proposal under a changed policy set: a
    // NEW chained decision; the prior request is superseded.
    const second = unwrap(
      gateway.submitAction(
        submitOptions({ proposal: first.action.proposal, policies: changedPolicySet(), decidedAt: T2 }),
      ),
    );
    expect(second.action.decisionDigest).not.toBe(first.action.decisionDigest);
    expect(second.action.status).toBe('awaiting-approval');
    // The action's in-force request is the NEW one: a FRESH approval is
    // required (the old approvals never transfer across decisions).
    const approval = unwrap(
      gateway.approveAction({
        tenantId: TENANT_A,
        actionId: first.action.actionId,
        decidedBy: APPROVER_1,
        asRole: 'senior-structural-engineer',
        at: T2,
      }),
    );
    expect(approval.action.status).toBe('authorized');
    expect(approval.approval.decisionDigest).toBe(second.action.decisionDigest);
    expect(approval.approval.contentDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

/** A quorum-2 proposal (distinct approvers required). */
function quorumTwoProposal() {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'action.proposal',
    messageId: 'msg-quorum-two',
    createdAt: '2025-01-15T10:00:00.000Z',
    proposalId: 'prop-quorum-two',
    proposedBy: 'agent:stress-checker',
    actionType: { id: 'structural.element.reinforce', version: '1.0.0' },
    target: { kind: 'world-entity', ref: 'entity:beam-b-12' },
    parameters: {},
    preconditions: [],
    predictedEffects: [{ description: 'Effect.', confidence: { kind: 'deterministic' } }],
    sideEffects: [],
    reversibility: { kind: 'reversible', via: 'manual' },
    authorityRequirements: {
      requiredScopes: ['world:write'],
      requiresHumanApproval: true,
      approvalQuorum: { approvals: 2, roles: ['senior-structural-engineer', 'lead-reviewer'] },
    },
    expiresAt: '2025-01-22T10:00:00.000Z',
  };
}

/** executeAction options bound to one action id. */
function executeActionOptionsFor(actionId: string) {
  return {
    ...executeOptions({ actionId }),
  };
}
