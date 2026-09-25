// Health/liveness as typed data: deterministic derivation from hosted
// state — healthy by default, degraded exactly when a session has
// settled failed; counts and degraded session ids are sorted typed data.
import { describe, expect, it } from 'vitest';
import {
  SESSION_ID,
  TENANT,
  T1,
  T2,
  fixtureRuntime,
  lifecycleEventFixture,
  startedSession,
} from './helpers';

describe('agent-runtime health', () => {
  it('an empty host is healthy with zeroed counts', () => {
    const { runtime } = fixtureRuntime();
    expect(runtime.health()).toEqual({
      schemaVersion: 1,
      status: 'healthy',
      sessionCount: 0,
      sessionsByStatus: {
        pending: 0,
        running: 0,
        suspended: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      },
      unsettledStepCount: 0,
      degradedSessions: [],
    });
  });

  it('a running session counts its unsettled steps without degrading health', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const health = runtime.health();
    expect(health.status).toBe('healthy');
    expect(health.sessionCount).toBe(1);
    expect(health.sessionsByStatus.running).toBe(1);
    expect(health.unsettledStepCount).toBe(3);
  });

  it('a failed session degrades health and is listed', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'failed', sequence: 1 }),
      at: T2,
    });
    const health = runtime.health();
    expect(health.status).toBe('degraded');
    expect(health.sessionsByStatus.failed).toBe(1);
    expect(health.unsettledStepCount).toBe(0);
    expect(health.degradedSessions).toEqual([`${TENANT}#${SESSION_ID}`]);
  });

  it('a completed session does not degrade health', () => {
    const { runtime, plan } = fixtureRuntime();
    runtime.createSession({ tenantId: TENANT, sessionId: SESSION_ID, plan, createdAt: T1 });
    runtime.startSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T1 });
    runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'executed', sequence: 1 }),
      at: T2,
    });
    runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ proposalId: 'prop-analyze-001', phase: 'executed', sequence: 2 }),
      at: T2,
    });
    runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ proposalId: 'prop-reinforce-001', phase: 'executed', sequence: 3 }),
      at: T2,
    });
    const health = runtime.health();
    expect(health.status).toBe('healthy');
    expect(health.sessionsByStatus.completed).toBe(1);
  });
});
