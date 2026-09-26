// Negative intake coverage: the typed rejection battery — the W009
// authorization gate FIRST (before policy evaluation), tenant isolation,
// action-id conflicts, and validation.
import { describe, expect, it } from 'vitest';
import { ActionGateway } from '../src/index';
import {
  plainProposal,
  PRINCIPAL,
  submitOptions,
  TENANT_A,
  TENANT_B,
  unknownPrincipalContext,
  unauthenticatedContext,
  unwrap,
} from './helpers';

describe('the W009 authorization gate (BEFORE policy evaluation)', () => {
  it('rejects an unauthenticated principal (typed authorization-rejected)', () => {
    const gateway = new ActionGateway();
    const outcome = gateway.submitAction(
      submitOptions({
        proposal: plainProposal(),
        authorization: { context: unauthenticatedContext() },
      }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('authorization-rejected');
    if (outcome.error.code === 'authorization-rejected') {
      expect(outcome.error.denialCode).toBe('unauthenticated-principal');
      expect(outcome.error.principalId).toBe(PRINCIPAL);
    }
  });

  it('rejects an unknown principal (fail-closed)', () => {
    const gateway = new ActionGateway();
    const outcome = gateway.submitAction(
      submitOptions({
        proposal: plainProposal(),
        authorization: { context: unknownPrincipalContext() },
      }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('authorization-rejected');
    if (outcome.error.code === 'authorization-rejected') {
      expect(outcome.error.denialCode).toBe('unknown-principal');
    }
  });

  it('rejects a cross-tenant principal (the W009 tenant boundary)', () => {
    const gateway = new ActionGateway();
    const outcome = gateway.submitAction(
      submitOptions({
        proposal: plainProposal(),
        authorization: {
          context: {
            schemaVersion: 1,
            principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
            memberships: [], // no membership in tenant:acme
            knownTenants: [TENANT_A],
          },
        },
      }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('authorization-rejected');
    if (outcome.error.code === 'authorization-rejected') {
      expect(outcome.error.denialCode).toBe('cross-tenant-denied');
    }
  });

  it('fires BEFORE policy evaluation (an invalid policy set never reaches the gate)', () => {
    const gateway = new ActionGateway();
    const outcome = gateway.submitAction(
      submitOptions({
        proposal: plainProposal(),
        policies: [{ 'not-a-policy': true }],
        authorization: { context: unauthenticatedContext() },
      }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    // The authorization rejection wins even though the policy set is garbage.
    expect(outcome.error.code).toBe('authorization-rejected');
  });

  it('rejects a malformed principal id (validation, before the gate)', () => {
    const gateway = new ActionGateway();
    const outcome = gateway.submitAction(
      submitOptions({ authorization: { principalId: 'not-a-principal' } }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
  });

  it('rejects a malformed authorization context (W009 issues surfaced)', () => {
    const gateway = new ActionGateway();
    const outcome = gateway.submitAction(
      submitOptions({ authorization: { context: { nonsense: true } } }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
    expect(JSON.stringify(outcome.error)).toContain('$.authorization.context');
  });
});

describe('tenant isolation (R12)', () => {
  it('rejects foreign-tenant operations on a tenant-pinned host', () => {
    const gateway = new ActionGateway({ expectedTenantId: TENANT_A });
    const outcome = gateway.submitAction(
      submitOptions({ tenantId: TENANT_B, proposal: plainProposal() }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('tenant-isolation-rejected');
  });

  it('rejects cross-tenant ACTION reads (the caller sees the id is taken, never its state)', () => {
    const gateway = new ActionGateway();
    unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
    const outcome = gateway.getAction({ tenantId: TENANT_B, actionId: 'action:reinforce-beam-b12' });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('tenant-isolation-rejected');
  });

  it('rejects cross-tenant execution', () => {
    const gateway = new ActionGateway();
    unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
    const outcome = gateway.executeAction({
      tenantId: TENANT_B,
      actionId: 'action:reinforce-beam-b12',
      authorization: {
        principalId: PRINCIPAL,
        context: {
          schemaVersion: 1,
          principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
          memberships: [{ principalId: PRINCIPAL, tenantId: TENANT_B }],
          knownTenants: [TENANT_B],
        },
      },
      at: '2025-01-16T09:00:00.000Z',
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('tenant-isolation-rejected');
  });
});

describe('action identity conflicts', () => {
  it('rejects a DIFFERENT proposal revision under the same action id (action-conflict)', () => {
    const gateway = new ActionGateway();
    unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
    const outcome = gateway.submitAction(
      submitOptions({
        proposal: plainProposal({ proposalId: 'prop-revised-2' }),
      }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('action-conflict');
    if (outcome.error.code === 'action-conflict') {
      expect(outcome.error.encounteredProposalDigest).not.toBe(
        outcome.error.expectedProposalDigest,
      );
    }
  });

  it('rejects re-deciding a dispatched action (action-settled)', async () => {
    const { changedPolicySet, executeOptions } = await import('./helpers');
    const gateway = new ActionGateway();
    unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
    unwrap(gateway.executeAction(executeOptions()));
    const outcome = gateway.submitAction(
      submitOptions({ proposal: plainProposal(), policies: changedPolicySet() }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('action-settled');
  });

  it('rejects an unknown action on reads (unknown-action)', () => {
    const gateway = new ActionGateway();
    const outcome = gateway.getAction({ tenantId: TENANT_A, actionId: 'action:nope' });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('unknown-action');
  });
});

describe('intake validation', () => {
  it('rejects a malformed action id (grammar)', () => {
    const gateway = new ActionGateway();
    const outcome = gateway.submitAction(
      submitOptions({ actionId: 'not-an-action', proposal: plainProposal() }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
    expect(JSON.stringify(outcome.error)).toContain('$.actionId');
  });

  it('rejects a malformed proposal (W003 pipeline, precise paths)', () => {
    const gateway = new ActionGateway();
    const proposal = plainProposal() as Record<string, unknown>;
    delete proposal.authorityRequirements;
    const outcome = gateway.submitAction(submitOptions({ proposal }));
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
    expect(JSON.stringify(outcome.error)).toContain('$.proposal');
  });

  it('rejects a malformed tenant id (W009 grammar)', () => {
    const gateway = new ActionGateway();
    const outcome = gateway.submitAction(
      submitOptions({ tenantId: 'acme', proposal: plainProposal() }),
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
  });

  it('surfaces the kernel approval-directive validation (missing deadline)', () => {
    const gateway = new ActionGateway();
    const outcome = gateway.submitAction(
      submitOptions({ actionId: 'action:plain-no-directive', proposal: plainProposal(), approval: null }),
    );
    // plainProposal does not require approval: the directive is not needed.
    expect(outcome.ok).toBe(true);
    const requiresApproval = gateway.submitAction(
      submitOptions({ actionId: 'action:approval-no-directive', approval: null }),
    );
    expect(requiresApproval.ok).toBe(false);
    if (requiresApproval.ok) return;
    expect(requiresApproval.error.code).toBe('validation');
    expect(JSON.stringify(requiresApproval.error)).toContain('$.approval');
  });
});
