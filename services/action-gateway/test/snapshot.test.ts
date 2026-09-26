// Snapshot coverage: deterministic emission, restore round-trip, continued
// operation after restore, and tamper detection at every layer (kernel
// records, action entries, event streams).
import { describe, expect, it } from 'vitest';
import { ActionGateway } from '../src/index';
import {
  APPROVER_1,
  executeOptions,
  plainProposal,
  submitOptions,
  TENANT_A,
  T1,
  unwrap,
} from './helpers';

function populatedGateway(): ActionGateway {
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
  unwrap(gateway.executeAction(executeOptions()));
  unwrap(
    gateway.submitAction(
      // A DISTINCT proposal id: the second action is an independent
      // proposal, not a revision chaining onto the first.
      submitOptions({
        proposal: plainProposal({ proposalId: 'prop-plain-second' }),
        actionId: 'action:second-action',
      }),
    ),
  );
  return gateway;
}

describe('snapshot round-trip', () => {
  it('restores a gateway from a snapshot (byte-identical snapshot)', () => {
    const original = populatedGateway();
    const restored = unwrap(ActionGateway.fromSnapshot(original.snapshot()));
    expect(JSON.stringify(restored.snapshot())).toBe(JSON.stringify(original.snapshot()));
  });

  it('the restored gateway keeps operating consistently', () => {
    const restored = unwrap(ActionGateway.fromSnapshot(populatedGateway().snapshot()));
    const execution = restored.executeAction(executeOptions({ actionId: 'action:second-action' }));
    expect(execution.ok).toBe(true);
    if (execution.ok) {
      expect(execution.value.action.status).toBe('executed');
    }
    const stream = unwrap(
      restored.actionStream({ tenantId: TENANT_A, actionId: 'action:second-action' }),
    );
    expect(stream.map((event) => event.payload.data.phase)).toEqual([
      'proposed',
      'authorized',
      'executed',
      'effects-recorded',
    ]);
  });

  it('restores the host tenant pin', () => {
    const gateway = new ActionGateway({ expectedTenantId: TENANT_A });
    unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
    const restored = unwrap(
      ActionGateway.fromSnapshot(gateway.snapshot(), { expectedTenantId: TENANT_A }),
    );
    const foreign = restored.getAction({ tenantId: 'tenant:other', actionId: 'action:reinforce-beam-b12' });
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) {
      expect(foreign.error.code).toBe('tenant-isolation-rejected');
    }
  });
});

describe('snapshot tamper detection', () => {
  it('rejects a tampered KERNEL decision (digest-mismatch through the kernel path)', () => {
    const snapshot = populatedGateway().snapshot();
    const tampered = {
      ...snapshot,
      registry: {
        ...snapshot.registry,
        decisions: snapshot.registry.decisions.map((decision) =>
          decision.outcome === 'allow'
            ? { ...decision, decidedAt: '2026-06-06T06:06:06.006Z' }
            : decision,
        ),
      },
    };
    const outcome = ActionGateway.fromSnapshot(tampered);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('digest-mismatch');
  });

  it('rejects a tampered action entry (host schema validation)', () => {
    const snapshot = populatedGateway().snapshot();
    const tampered = {
      ...snapshot,
      actions: snapshot.actions.map((entry) =>
        entry.status === 'executed'
          ? { ...entry, status: 'awaiting-approval' as const, outcome: undefined }
          : entry,
      ),
    };
    const outcome = ActionGateway.fromSnapshot(tampered);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
    // The entry-status consistency check fires: the tampered status
    // disagrees with the restored registry state.
    expect(JSON.stringify(outcome.error)).toContain('inconsistent');
  });

  it('rejects a tampered event stream (digest-mismatch)', () => {
    const snapshot = populatedGateway().snapshot();
    const tampered = {
      ...snapshot,
      events: snapshot.events.map((event, index) =>
        index === 0 ? { ...event, occurredAt: '2026-01-01T00:00:00.000Z' } : event,
      ),
    };
    const outcome = ActionGateway.fromSnapshot(tampered);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('digest-mismatch');
  });

  it('rejects a non-contiguous event stream', () => {
    const snapshot = populatedGateway().snapshot();
    const tampered = {
      ...snapshot,
      events: snapshot.events.filter((event, index) => index !== 1),
    };
    const outcome = ActionGateway.fromSnapshot(tampered);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
    expect(JSON.stringify(outcome.error)).toContain('contiguous');
  });

  it('rejects an entry referencing a decision that concerns another proposal revision', () => {
    const snapshot = populatedGateway().snapshot();
    // The snapshot holds two decisions (requires-approval + allow) over
    // DIFFERENT proposal revisions; point the first entry at the other one.
    const first = snapshot.registry.decisions[0]!;
    const other = snapshot.registry.decisions.find(
      (decision) => decision.contentDigest !== first.contentDigest,
    );
    expect(other).toBeDefined();
    const tampered = {
      ...snapshot,
      actions: snapshot.actions.map((entry, index) =>
        index === 0 && other !== undefined ? { ...entry, decisionDigest: other.contentDigest } : entry,
      ),
    };
    const outcome = ActionGateway.fromSnapshot(tampered);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
  });

  it('rejects a version-skewed snapshot (schemaVersion gate)', () => {
    const snapshot = { ...populatedGateway().snapshot(), schemaVersion: 2 };
    const outcome = ActionGateway.fromSnapshot(snapshot);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('validation');
  });
});

describe('deterministic emission', () => {
  it('two gateways fed the same history emit byte-identical snapshots', () => {
    expect(JSON.stringify(populatedGateway().snapshot())).toBe(
      JSON.stringify(populatedGateway().snapshot()),
    );
  });
});
