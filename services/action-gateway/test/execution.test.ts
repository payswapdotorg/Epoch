// Execution dispatch coverage: the adapter seam, record-shaped outcomes,
// the failure path, and every execution-gate typed rejection.
import { describe, expect, it } from 'vitest';
import { ActionGateway, InMemoryExecutionPort } from '../src/index';
import {
  executeOptions,
  gatewayWithAuthorizedAction,
  phaseOf,
  plainProposal,
  PRINCIPAL,
  submitOptions,
  TENANT_A,
  T2,
  unauthenticatedContext,
  unwrap,
} from './helpers';

describe('successful dispatch', () => {
  it('executes through the port seam and records a sealed outcome record', () => {
    const port = new InMemoryExecutionPort();
    const gateway = new ActionGateway({ executionPort: port });
    unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
    const execution = unwrap(
      gateway.executeAction(executeOptions({ evidenceRefs: ['evidence:extra'] })),
    );
    expect(execution.action.status).toBe('executed');
    expect(execution.outcome.kind).toBe('succeeded');
    expect(execution.outcome.evidenceRefs).toEqual(['evidence:extra', 'execution:reinforce-beam-b12']);
    expect(execution.outcome.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(execution.outcome.decisionDigest).toBe(execution.action.decisionDigest);
    expect(execution.outcome.executedAt).toBe(T2);
    // The dispatch went through the seam exactly once.
    expect(port.dispatched()).toHaveLength(1);
    expect(port.dispatched()[0]?.proposal.proposalId).toBe('prop-2025-0100');
    // The stream records executed + effects-recorded.
    expect(execution.events.map(phaseOf)).toEqual(['executed', 'effects-recorded']);
    expect(execution.events[0]?.payload.data.detail).toMatchObject({
      outcomeDigest: execution.outcome.contentDigest,
      outcomeKind: 'succeeded',
    });
  });
});

describe('failed dispatch (typed failure records + degraded health)', () => {
  it('records a failed outcome and degrades host health', () => {
    const gateway = new ActionGateway({
      executionPort: new InMemoryExecutionPort({
        failWith: { code: 'tool-unavailable', reason: 'The reference tool is offline.' },
      }),
    });
    unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
    const execution = unwrap(gateway.executeAction(executeOptions()));
    expect(execution.action.status).toBe('failed');
    expect(execution.outcome.kind).toBe('failed');
    expect(execution.outcome.failure).toEqual({
      code: 'tool-unavailable',
      reason: 'The reference tool is offline.',
    });
    expect(execution.events.map(phaseOf)).toEqual(['failed']);
    const health = gateway.health();
    expect(health.status).toBe('degraded');
    expect(health.degradedActions).toEqual([`${TENANT_A}#action:reinforce-beam-b12`]);
    expect(health.actionsByStatus.failed).toBe(1);
  });
});

describe('the execution gates', () => {
  it('rejects execution while approval is pending (approval-required)', () => {
    const gateway = new ActionGateway();
    unwrap(gateway.submitAction(submitOptions()));
    const outcome = gateway.executeAction(executeOptions());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('approval-required');
  });

  it('rejects execution of a denied action (action-denied)', () => {
    const gateway = new ActionGateway();
    unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal(), spend: 150 })));
    const outcome = gateway.executeAction(executeOptions());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('action-denied');
    if (outcome.error.code === 'action-denied') {
      expect(outcome.error.denialCode).toBe('constraint-blocked');
    }
  });

  it('rejects re-execution of a dispatched action (action-settled)', () => {
    const { gateway } = gatewayWithAuthorizedAction();
    unwrap(gateway.executeAction(executeOptions()));
    const outcome = gateway.executeAction(executeOptions());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('action-settled');
  });

  it('rejects a drifted execution reference (proposal-drift-rejected)', () => {
    const { gateway, proposalDigest } = gatewayWithAuthorizedAction();
    const outcome = gateway.executeAction(
      executeOptions({ expectedProposalDigest: 'e'.repeat(64) }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('proposal-drift-rejected');
    if (outcome.error.code === 'proposal-drift-rejected') {
      expect(outcome.error.expectedProposalDigest).toBe(proposalDigest);
      expect(outcome.error.encounteredProposalDigest).toBe('e'.repeat(64));
    }
  });

  it('rejects an unauthorized EXECUTION (the W009 context rides every execution)', () => {
    const { gateway } = gatewayWithAuthorizedAction();
    const outcome = gateway.executeAction({
      ...executeOptions(),
      authorization: { principalId: PRINCIPAL, context: unauthenticatedContext() },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('authorization-rejected');
    if (outcome.error.code === 'authorization-rejected') {
      expect(outcome.error.actionId).toBe('action:reinforce-beam-b12');
    }
  });

  it('rejects an unsupported action type at the adapter seam (execution-unsupported)', () => {
    const gateway = new ActionGateway({
      executionPort: new InMemoryExecutionPort({ supportedActionTypes: ['hvac.filter.replace'] }),
    });
    unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
    const outcome = gateway.executeAction(executeOptions());
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('execution-unsupported');
    if (outcome.error.code === 'execution-unsupported') {
      expect(outcome.error.actionTypeId).toBe('structural.element.reinforce');
    }
  });
});

describe('health as typed data', () => {
  it('derives health deterministically (healthy when nothing failed)', () => {
    const { gateway } = gatewayWithAuthorizedAction();
    const health = gateway.health();
    expect(health.status).toBe('healthy');
    expect(health.actionCount).toBe(1);
    expect(health.actionsByStatus).toMatchObject({ authorized: 1 });
    expect(health.undispatchedActionCount).toBe(1);
  });
});
