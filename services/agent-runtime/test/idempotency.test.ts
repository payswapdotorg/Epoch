// Replay/idempotency evidence (the W020 pin): re-running a plan with the
// same event history is idempotent — two runtimes fed the same session +
// event sequence hold byte-identical state (snapshots and session state
// digests); duplicate intake never mutates state; independent-step event
// ORDER does not change the settled step states.
import { describe, expect, it } from 'vitest';
import { computeSessionStateDigest } from '@epoch/agent-orchestration';
import {
  SESSION_ID,
  TENANT,
  T1,
  T2,
  T3,
  T4,
  fixtureRuntime,
  lifecycleEventFixture,
  standardProposalSet,
  startedSession,
  withRealDigests,
} from './helpers';

describe('agent-runtime replay idempotency', () => {
  function runHistory() {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    for (const [event, at] of [
      [lifecycleEventFixture({ phase: 'authorized', sequence: 1 }), T2],
      [lifecycleEventFixture({ phase: 'executed', sequence: 2 }), T2],
      [lifecycleEventFixture({ proposalId: 'prop-analyze-001', phase: 'executed', sequence: 3 }), T3],
      [lifecycleEventFixture({ proposalId: 'prop-reinforce-001', phase: 'executed', sequence: 4 }), T4],
    ] as const) {
      const advanced = runtime.ingestEvent({
        tenantId: TENANT,
        sessionId: SESSION_ID,
        event,
        at,
      });
      if (!advanced.ok) throw new Error(advanced.error.message);
    }
    return runtime;
  }

  it('two runtimes fed the same event history hold byte-identical snapshots', () => {
    expect(runHistory().snapshot()).toEqual(runHistory().snapshot());
  });

  it('two runtimes fed the same event history hold identical session state digests', () => {
    const a = runHistory().getSession({ tenantId: TENANT, sessionId: SESSION_ID });
    const b = runHistory().getSession({ tenantId: TENANT, sessionId: SESSION_ID });
    if (!a.ok || !b.ok) throw new Error('fixture session must exist');
    expect(a.value.status).toBe('completed');
    expect(computeSessionStateDigest(a.value)).toBe(computeSessionStateDigest(b.value));
  });

  it('replaying the whole history AGAIN into the advanced runtime is fully suppressed', () => {
    const runtime = runHistory();
    const before = runtime.snapshot();
    for (const [event, at] of [
      [lifecycleEventFixture({ phase: 'authorized', sequence: 1 }), T2],
      [lifecycleEventFixture({ phase: 'executed', sequence: 2 }), T2],
    ] as const) {
      const replayed = runtime.ingestEvent({ tenantId: TENANT, sessionId: SESSION_ID, event, at });
      expect(replayed.ok).toBe(false);
      if (!replayed.ok) {
        expect(replayed.error.code).toBe('duplicate-suppressed');
      }
    }
    expect(runtime.snapshot()).toEqual(before);
  });

  it('event ORDER between independent steps does not change the settled step states', () => {
    // A plan with two INDEPENDENT root steps: feeding their executed
    // facts in either order settles both identically (transition logs
    // differ by arrival; the settled step states do not).
    const build = (reverse: boolean) => {
      const { runtime } = fixtureRuntime();
      const plan = runtime.compilePlan({
        tenantId: TENANT,
        plan: withRealDigests(
          {
            schemaVersion: 1,
            tenantId: TENANT,
            planId: 'plan:two-roots',
            steps: [
              {
                stepId: 'zeta',
                agentId: 'agent:stress-analyst',
                proposal: { proposalId: 'prop-reinforce-001', canonicalDigest: '0'.repeat(64) },
                dependsOn: [],
              },
              {
                stepId: 'alpha',
                agentId: 'agent:field-surveyor',
                proposal: { proposalId: 'prop-survey-001', canonicalDigest: '0'.repeat(64) },
                dependsOn: [],
              },
            ],
          },
          standardProposalSet(),
        ),
        proposals: standardProposalSet(),
      });
      if (!plan.ok) throw new Error(plan.error.message);
      runtime.createSession({ tenantId: TENANT, sessionId: SESSION_ID, plan: plan.value, createdAt: T1 });
      runtime.startSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T1 });
      const alpha = lifecycleEventFixture({ phase: 'executed', sequence: 1 });
      const zeta = lifecycleEventFixture({
        proposalId: 'prop-reinforce-001',
        phase: 'executed',
        sequence: 2,
      });
      const order = reverse ? [zeta, alpha] : [alpha, zeta];
      for (const [index, event] of order.entries()) {
        const advanced = runtime.ingestEvent({
          tenantId: TENANT,
          sessionId: SESSION_ID,
          event,
          at: index === 0 ? T2 : T3,
        });
        if (!advanced.ok) throw new Error(advanced.error.message);
      }
      const session = runtime.getSession({ tenantId: TENANT, sessionId: SESSION_ID });
      if (!session.ok) throw new Error(session.error.message);
      return session.value;
    };
    const a = build(false);
    const b = build(true);
    expect(a.status).toBe('completed');
    expect(b.status).toBe('completed');
    expect(a.steps.map((step) => [step.stepId, step.status])).toEqual(
      b.steps.map((step) => [step.stepId, step.status]),
    );
  });
});
