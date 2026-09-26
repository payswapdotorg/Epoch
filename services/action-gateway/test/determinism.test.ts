// Determinism coverage: same inputs -> same decision identity + same event
// digests; input order never leaks; snapshots are byte-identical.
import { describe, expect, it } from 'vitest';
import { ActionGateway, computeActionEventDigest } from '../src/index';
import {
  APPROVER_1,
  executeOptions,
  plainProposal,
  policySet,
  submitOptions,
  TENANT_A,
  T1,
  T2,
  unwrap,
} from './helpers';

/** The full reference history: intake -> approve -> execute. */
function history(gateway: ActionGateway): ActionGateway {
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
  unwrap(gateway.executeAction(executeOptions({ at: T2 })));
  return gateway;
}

describe('determinism', () => {
  it('the same proposal + the same policy digest produce the SAME decision identity and event digests', () => {
    const gatewayA = new ActionGateway();
    const gatewayB = new ActionGateway();
    const intakeA = unwrap(gatewayA.submitAction(submitOptions({ proposal: plainProposal() })));
    const intakeB = unwrap(gatewayB.submitAction(submitOptions({ proposal: plainProposal() })));
    expect(intakeB.decision.contentDigest).toBe(intakeA.decision.contentDigest);
    expect(intakeB.events.map((event) => event.contentDigest)).toEqual(
      intakeA.events.map((event) => event.contentDigest),
    );
  });

  it('policy-set INPUT ORDER never leaks into the decision identity or the events', () => {
    const single = policySet();
    const gatewayA = new ActionGateway();
    const gatewayB = new ActionGateway();
    const intakeA = unwrap(
      gatewayA.submitAction(submitOptions({ proposal: plainProposal(), policies: single })),
    );
    // A second gateway fed the same set (reversed) digests identically.
    const intakeB = unwrap(
      gatewayB.submitAction(submitOptions({ proposal: plainProposal(), policies: [...single].reverse() })),
    );
    expect(intakeB.decision.policySetDigest).toBe(intakeA.decision.policySetDigest);
    expect(intakeB.decision.contentDigest).toBe(intakeA.decision.contentDigest);
    expect(intakeB.events.map((event) => event.contentDigest)).toEqual(
      intakeA.events.map((event) => event.contentDigest),
    );
  });

  it('two gateways fed the same history hold byte-identical snapshots', () => {
    const snapshotA = history(new ActionGateway()).snapshot();
    const snapshotB = history(new ActionGateway()).snapshot();
    expect(JSON.stringify(snapshotA)).toBe(JSON.stringify(snapshotB));
  });

  it('the mirrored event digest matches a recomputation from content', () => {
    const gateway = history(new ActionGateway());
    const stream = unwrap(
      gateway.actionStream({ tenantId: TENANT_A, actionId: 'action:reinforce-beam-b12' }),
    );
    for (const event of stream) {
      const { contentDigest, ...content } = event;
      expect(computeActionEventDigest(content)).toBe(contentDigest);
    }
  });

  it('health is deterministic over the same history', () => {
    expect(JSON.stringify(history(new ActionGateway()).health())).toBe(
      JSON.stringify(history(new ActionGateway()).health()),
    );
  });
});
