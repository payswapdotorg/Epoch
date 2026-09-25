// Session lifecycle (positives): bind -> compile -> create -> start ->
// advance -> settle; suspend/resume; cancel; snapshot round-trips.
import { describe, expect, it } from 'vitest';
import { AgentRuntime } from '../src/index';
import {
  SESSION_ID,
  TENANT,
  T1,
  T2,
  T3,
  T4,
  T5,
  fixtureRuntime,
  lifecycleEventFixture,
  planFixture,
  standardProposalSet,
  startedSession,
  withRealDigests,
} from './helpers';

describe('agent-runtime session lifecycle (positive)', () => {
  it('runs the full happy path: create -> start -> advance -> complete', () => {
    const { runtime, plan } = fixtureRuntime();
    const started = startedSession(runtime, plan);
    // Starting dispatches the root step (survey) toward the gateway.
    expect(started.session.status).toBe('running');
    expect(started.handoffs.map((handoff) => handoff.stepId)).toEqual(['survey']);
    expect(started.handoffs[0]!.attempt).toBe(1);
    expect(started.handoffs[0]!.agentId).toBe('agent:field-surveyor');

    // survey authorized -> executed; analyze dispatches on the event.
    const authorized = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'authorized', sequence: 1 }),
      at: T2,
    });
    if (!authorized.ok) throw new Error(authorized.error.message);
    expect(authorized.value.session.steps[0]!.status).toBe('authorized');

    const executed = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'executed', sequence: 2 }),
      at: T3,
    });
    if (!executed.ok) throw new Error(executed.error.message);
    expect(executed.value.session.steps[0]!.status).toBe('executed');
    expect(executed.value.handoffs.map((handoff) => handoff.stepId)).toEqual(['analyze']);

    // analyze + reinforce execute; the session completes.
    runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ proposalId: 'prop-analyze-001', phase: 'executed', sequence: 3 }),
      at: T4,
    });
    const final = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ proposalId: 'prop-reinforce-001', phase: 'executed', sequence: 4 }),
      at: T5,
    });
    if (!final.ok) throw new Error(final.error.message);
    expect(final.value.session.status).toBe('completed');
    expect(final.value.session.steps.map((step) => step.status)).toEqual([
      'executed',
      'executed',
      'executed',
    ]);
    // The handoff log carries the full ordered dispatch history.
    const log = runtime.handoffLog({ tenantId: TENANT, sessionId: SESSION_ID });
    if (!log.ok) throw new Error(log.error.message);
    expect(log.value.map((handoff) => handoff.stepId)).toEqual([
      'survey',
      'analyze',
      'reinforce',
    ]);
  });

  it('suspends and resumes a running session, dispatching on resume', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const suspended = runtime.suspendSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T2 });
    if (!suspended.ok) throw new Error(suspended.error.message);
    expect(suspended.value.session.status).toBe('suspended');
    const resumed = runtime.resumeSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T3 });
    if (!resumed.ok) throw new Error(resumed.error.message);
    expect(resumed.value.session.status).toBe('running');
  });

  it('cancels a running session', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const cancelled = runtime.cancelSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T2 });
    if (!cancelled.ok) throw new Error(cancelled.error.message);
    expect(cancelled.value.session.status).toBe('cancelled');
  });

  it('snapshots round-trip through AgentRuntime.fromSnapshot', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'executed', sequence: 1 }),
      at: T2,
    });
    const snapshot = runtime.snapshot();
    const serialized = JSON.parse(JSON.stringify(snapshot));
    const restored = AgentRuntime.fromSnapshot(serialized);
    if (!restored.ok) throw new Error(restored.error.message);
    expect(restored.value.snapshot()).toEqual(snapshot);
    const session = restored.value.getSession({ tenantId: TENANT, sessionId: SESSION_ID });
    if (!session.ok) throw new Error(session.error.message);
    expect(session.value.status).toBe('running');
    // And the restored host still suppresses the already-processed event.
    const duplicate = restored.value.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'executed', sequence: 1 }),
      at: T3,
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe('duplicate-suppressed');
    }
  });

  it('createSession defaults the agent set to the tenant bindings', () => {
    const { runtime, plan } = fixtureRuntime();
    const created = runtime.createSession({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      plan,
      createdAt: T1,
    });
    if (!created.ok) throw new Error(created.error.message);
    expect(created.value.agents.map((binding) => binding.agent.agentId)).toEqual([
      'agent:field-surveyor',
      'agent:stress-analyst',
    ]);
  });

  it('compilePlan resolves steps against the tenant bindings', () => {
    const { runtime } = fixtureRuntime();
    const compiled = runtime.compilePlan({
      tenantId: TENANT,
      plan: withRealDigests(planFixture(), standardProposalSet()),
      proposals: standardProposalSet(),
    });
    if (!compiled.ok) throw new Error(compiled.error.message);
    expect(compiled.value.steps).toHaveLength(3);
  });
});
