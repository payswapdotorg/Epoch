// RUNTIME parity with the REAL W022 action gateway (the typed
// allow / deny / requires-approval decision paths, the approval flow,
// and the authority outcome records) — devDependencies only.
import { describe, expect, it } from 'vitest';
import { ActionGateway } from '@epoch/action-gateway';
import { parseActionProposal } from '@epoch/action-protocol';
import { McpActionAdapter, buildInvocationProposal, verifyInvocationRecord } from '../src/index';
import {
  APPROVER,
  DEADLINE,
  TENANT_A,
  T1,
  T2,
  adapterSetup,
  allowingContext,
  GatewayAuthorityPort,
  applicablePolicySet,
  resolver,
  referenceSurfaces,
  PRINCIPAL,
} from './helpers';

describe('W022 action-gateway parity (the REAL gateway behind the authority seam)', () => {
  it('the adapter-built proposal passes the REAL W003 admission pipeline', () => {
    const plan = buildInvocationProposal({
      tenantId: TENANT_A,
      toolRef: 'tool:terrain-elevation-lookup',
      actionId: 'action:parity-invocation',
      arguments: { latitude: 52.5, longitude: 13.4 },
      proposedAt: T1,
    });
    const admitted = parseActionProposal(plan.proposal);
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value.actionType.id).toBe('tool.invoke');
      expect(admitted.digest).toBe(plan.proposalRef.canonicalDigest);
    }
  });

  it('the requires-approval path: the REAL gateway records a typed decision', () => {
    const { gateway, action } = adapterSetup();
    const invocation = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:parity-approval',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T2,
    });
    if (!invocation.ok) throw new Error(invocation.error.message);
    expect(invocation.value.decision.outcome).toBe('requires-approval');
    expect(invocation.value.disposition).toBe('authority-pending-approval');
    // The decision digest IS the real gateway's sealed decision digest.
    const stored = gateway.getAction({ tenantId: TENANT_A, actionId: 'action:parity-approval' });
    expect(stored.ok).toBe(true);
    if (stored.ok) {
      expect(invocation.value.decision.decisionDigest).toBe(stored.value.decisionDigest);
      expect(stored.value.status).toBe('awaiting-approval');
    }
  });

  it('the allow path: approval authorizes, the dispatch executes, the outcome is the gateway record', () => {
    const { gateway, action } = adapterSetup();
    const first = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:parity-allow',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T2,
    });
    if (!first.ok) throw new Error(first.error.message);
    expect(first.value.disposition).toBe('authority-pending-approval');

    // The human approval flow on the REAL gateway.
    const approval = gateway.approveAction({
      tenantId: TENANT_A,
      actionId: 'action:parity-allow',
      decidedBy: APPROVER,
      asRole: 'tool-operator',
      at: T2,
      note: 'approved for parity evidence',
    });
    expect(approval.ok).toBe(true);

    // Re-route the SAME proposal revision (identical inputs -> identical
    // proposal -> the gateway's idempotent duplicate-decision intake).
    const executed = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:parity-allow',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T2,
    });
    if (!executed.ok) throw new Error(executed.error.message);
    // The ORIGINAL decision required approval; the authority's approval
    // flow completed, so the action is authorized and the dispatch runs.
    expect(executed.value.decision.outcome).toBe('requires-approval');
    expect(executed.value.decision.actionStatus).toBe('authorized');
    expect(executed.value.disposition).toBe('executed');
    expect(executed.value.outcome?.kind).toBe('succeeded');
    // The outcome digest IS the real gateway's sealed outcome-record digest.
    const stored = gateway.getAction({ tenantId: TENANT_A, actionId: 'action:parity-allow' });
    expect(stored.ok).toBe(true);
    if (stored.ok) {
      expect(stored.value.outcome).toBeDefined();
      expect(executed.value.outcome?.outcomeDigest).toBe(stored.value.outcome?.contentDigest);
      expect(stored.value.status).toBe('executed');
    }
    expect(verifyInvocationRecord(executed.value)).toBe(true);
  });

  it('the allow-decision path: a non-approval proposal through the seam records the allow decision', () => {
    // The adapter's own invocations ALWAYS require human approval (the
    // safe reference pin). The allow DECISION path is exercised through
    // the same seam with a W003 proposal that does not require approval.
    const { authority } = adapterSetup();
    const proposal = {
      protocolVersion: '1.0.0',
      messageKind: 'action.proposal',
      messageId: 'msg-parity-allow-path',
      createdAt: T1,
      proposalId: 'prop-parity-allow-path',
      proposedBy: 'agent:external-tool-adapter',
      actionType: { id: 'tool.invoke', version: '1.0.0' },
      target: { kind: 'external-resource', ref: 'tool:terrain-elevation-lookup' },
      parameters: { tool: 'tool:terrain-elevation-lookup', latitude: 52.5, longitude: 13.4 },
      preconditions: [],
      predictedEffects: [
        {
          description: 'The external tool computes its declared output after the authority-authorized invocation.',
          confidence: { kind: 'deterministic' },
        },
      ],
      sideEffects: [
        { description: 'The external tool may consume provider quota.', reversible: true },
      ],
      reversibility: { kind: 'reversible', via: 'automatic' },
      authorityRequirements: {
        requiredScopes: ['external:tool:read'],
        requiresHumanApproval: false,
      },
      rationale: 'allow-decision parity evidence',
    };
    const submission = authority.submitAction({
      tenantId: TENANT_A,
      actionId: 'action:parity-allow-decision',
      proposal,
      authorization: { principalId: PRINCIPAL, context: allowingContext() },
      decidedAt: T1,
    });
    expect(submission.ok).toBe(true);
    if (!submission.ok) throw new Error(submission.error.message);
    expect(submission.decision.outcome).toBe('allow');
    expect(submission.decision.actionStatus).toBe('authorized');
  });

  it('the deny path: no applicable policy is the typed authority-denied disposition', () => {
    const { action } = adapterSetup({ policies: [] });
    const invocation = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:parity-deny',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T2,
    });
    if (!invocation.ok) throw new Error(invocation.error.message);
    expect(invocation.value.decision.outcome).toBe('deny');
    expect(invocation.value.decision.denialCode).toBe('no-applicable-policy');
    expect(invocation.value.disposition).toBe('authority-denied');
    expect(invocation.value.outcome).toBeUndefined();
  });

  it('the constraint-blocked deny path: a blocking policy denies with the constraint provenance', () => {
    const gateway = new ActionGateway();
    const authority = new GatewayAuthorityPort(gateway, {
      policies: applicablePolicySet(),
      resolveConstraint: resolver,
      evaluationContext: { inputs: { invocationCount: 99 } },
    });
    const action = new McpActionAdapter({
      surfaces: referenceSurfaces(),
      authority,
      expectedTenantId: TENANT_A,
    });
    const blocked = action.route({
      tenant: TENANT_A,
      tool: 'tool:terrain-elevation-lookup',
      arguments: { latitude: 52.5, longitude: 13.4 },
      actionId: 'action:parity-blocked',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T2,
    });
    if (!blocked.ok) throw new Error(blocked.error.message);
    expect(blocked.value.decision.outcome).toBe('deny');
    expect(blocked.value.decision.denialCode).toBe('constraint-blocked');
  });
});
