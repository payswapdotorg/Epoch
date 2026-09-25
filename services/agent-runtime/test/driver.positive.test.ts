// The advance-on-event driver (positives): dependency-ordered dispatch,
// retries under the typed policy, cascade skips on terminal failure,
// recorded echoes, settlement semantics, and deterministic ordering.
import { describe, expect, it } from 'vitest';
import { fixtureRuntime, lifecycleEventFixture, planFixture, standardProposalSet, withRealDigests, SESSION_ID, TENANT, T1, T2, T3, T4 } from './helpers';

describe('agent-runtime driver (positive)', () => {
  it('dispatches ready steps in compiled order, never by arrival order', () => {
    // A plan with two INDEPENDENT root steps: whichever order they were
    // authored in, dispatch follows the compiled (stepId-tie-broken) order.
    const { runtime, registry } = fixtureRuntime();
    const proposals = standardProposalSet();
    const plan = runtime.compilePlan({
      tenantId: TENANT,
      plan: withRealDigests(
        planFixture({
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
        }),
        proposals,
      ),
      proposals,
    });
    if (!plan.ok) throw new Error(plan.error.message);
    void registry;
    const created = runtime.createSession({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      plan: plan.value,
      createdAt: T1,
    });
    if (!created.ok) throw new Error(created.error.message);
    const started = runtime.startSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T1 });
    if (!started.ok) throw new Error(started.error.message);
    expect(started.value.handoffs.map((handoff) => handoff.stepId)).toEqual(['alpha', 'zeta']);
  });

  it('applies authorized/executed facts and auto-dispatches dependents', () => {
    const { runtime, plan } = fixtureRuntime();
    runtime.createSession({ tenantId: TENANT, sessionId: SESSION_ID, plan, createdAt: T1 });
    runtime.startSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T1 });
    const executed = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'executed', sequence: 1 }),
      at: T2,
    });
    if (!executed.ok) throw new Error(executed.error.message);
    expect(executed.value.session.steps.map((step) => step.status)).toEqual([
      'executed',
      'dispatched',
      'pending',
    ]);
  });

  it('re-queues a covered failure and re-dispatches with an incremented attempt', () => {
    const { runtime } = fixtureRuntime();
    // Grant the survey step a retry policy covering 'failed'.
    const proposals = standardProposalSet();
    const retried = runtime.compilePlan({
      tenantId: TENANT,
      plan: withRealDigests(
        planFixture({
          steps: [
            {
              stepId: 'survey',
              agentId: 'agent:field-surveyor',
              proposal: { proposalId: 'prop-survey-001', canonicalDigest: '0'.repeat(64) },
              dependsOn: [],
              retryPolicy: { maxAttempts: 2, retryOn: ['failed'] },
            },
            {
              stepId: 'analyze',
              agentId: 'agent:stress-analyst',
              proposal: { proposalId: 'prop-analyze-001', canonicalDigest: '0'.repeat(64) },
              dependsOn: ['survey'],
            },
          ],
        }),
        proposals,
      ),
      proposals,
    });
    if (!retried.ok) throw new Error(retried.error.message);
    runtime.createSession({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      plan: retried.value,
      createdAt: T1,
    });
    runtime.startSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T1 });
    const failed = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'failed', sequence: 1 }),
      at: T2,
    });
    if (!failed.ok) throw new Error(failed.error.message);
    // The retry re-queued AND re-dispatched the step in the same advance.
    expect(failed.value.session.steps[0]!.status).toBe('dispatched');
    expect(failed.value.session.steps[0]!.attempt).toBe(2);
    expect(failed.value.handoffs.map((handoff) => handoff.stepId)).toEqual(['survey']);
    expect(failed.value.handoffs[0]!.attempt).toBe(2);
    // The retry is replayable typed data.
    const retryTransition = failed.value.session.stepTransitions.find(
      (transition) => transition.cause === 'retry',
    );
    expect(retryTransition).toMatchObject({
      stepId: 'survey',
      from: 'dispatched',
      to: 'pending',
      phase: 'failed',
    });
  });

  it('settles an uncovered failure, cascades skips, and fails the session', () => {
    const { runtime, plan } = fixtureRuntime();
    runtime.createSession({ tenantId: TENANT, sessionId: SESSION_ID, plan, createdAt: T1 });
    runtime.startSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T1 });
    const failed = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'failed', sequence: 1 }),
      at: T2,
    });
    if (!failed.ok) throw new Error(failed.error.message);
    expect(failed.value.session.steps.map((step) => step.status)).toEqual([
      'failed',
      'skipped',
      'skipped',
    ]);
    expect(failed.value.session.status).toBe('failed');
    const cascadeTransitions = failed.value.session.stepTransitions.filter(
      (transition) => transition.cause === 'cascade',
    );
    expect(cascadeTransitions.map((transition) => transition.stepId).sort()).toEqual([
      'analyze',
      'reinforce',
    ]);
  });

  it('records proposed and effects-recorded echoes without status changes', () => {
    const { runtime, plan } = fixtureRuntime();
    runtime.createSession({ tenantId: TENANT, sessionId: SESSION_ID, plan, createdAt: T1 });
    runtime.startSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T1 });
    const proposed = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'proposed', sequence: 1 }),
      at: T2,
    });
    if (!proposed.ok) throw new Error(proposed.error.message);
    expect(proposed.value.session.steps[0]!.status).toBe('dispatched');
    expect(proposed.value.session.steps[0]!.lastPhase).toBe('proposed');

    runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'executed', sequence: 2 }),
      at: T3,
    });
    const effects = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'effects-recorded', sequence: 3 }),
      at: T4,
    });
    if (!effects.ok) throw new Error(effects.error.message);
    expect(effects.value.session.steps[0]!.status).toBe('executed');
    expect(effects.value.session.steps[0]!.lastPhase).toBe('effects-recorded');
  });

  it('completes the session exactly when every step executed', () => {
    const { runtime, plan } = fixtureRuntime();
    runtime.createSession({ tenantId: TENANT, sessionId: SESSION_ID, plan, createdAt: T1 });
    runtime.startSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T1 });
    runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'executed', sequence: 1 }),
      at: T2,
    });
    const session = runtime.getSession({ tenantId: TENANT, sessionId: SESSION_ID });
    if (!session.ok) throw new Error(session.error.message);
    expect(session.value.status).toBe('running');
    runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ proposalId: 'prop-analyze-001', phase: 'executed', sequence: 2 }),
      at: T3,
    });
    runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ proposalId: 'prop-reinforce-001', phase: 'executed', sequence: 3 }),
      at: T4,
    });
    const completed = runtime.getSession({ tenantId: TENANT, sessionId: SESSION_ID });
    if (!completed.ok) throw new Error(completed.error.message);
    expect(completed.value.status).toBe('completed');
  });
});
