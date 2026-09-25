// Session lifecycle negatives (named, typed): lifecycle conflicts on
// illegal operations; unknown sessions; duplicate session creation
// (idempotent vs conflicting); unknown-session lookups.
import { describe, expect, it } from 'vitest';
import { AgentRuntime } from '../src/index';
import {
  SESSION_ID,
  TENANT,
  T1,
  T2,
  fixtureRuntime,
  lifecycleEventFixture,
  planFixture,
  standardAgents,
  standardProposalSet,
  startedSession,
  withRealDigests,
} from './helpers';

describe('agent-runtime session lifecycle (negative)', () => {
  it('rejects starting a session that is already running', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const again = runtime.startSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T2 });
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.code).toBe('lifecycle-conflict');
    }
  });

  it('rejects resuming a session that is not suspended', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const resumed = runtime.resumeSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T2 });
    expect(resumed.ok).toBe(false);
    if (!resumed.ok) {
      expect(resumed.error.code).toBe('lifecycle-conflict');
    }
  });

  it('rejects cancelling a completed session (terminal)', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
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
    const cancelled = runtime.cancelSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T2 });
    expect(cancelled.ok).toBe(false);
    if (!cancelled.ok) {
      expect(cancelled.error.code).toBe('lifecycle-conflict');
    }
  });

  it('rejects event intake into a suspended session', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    runtime.suspendSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T2 });
    const ingested = runtime.ingestEvent({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      event: lifecycleEventFixture({ phase: 'executed', sequence: 1 }),
      at: T2,
    });
    expect(ingested.ok).toBe(false);
    if (!ingested.ok) {
      expect(ingested.error.code).toBe('lifecycle-conflict');
    }
  });

  it('rejects duplicate session creation with the SAME plan as duplicate-suppressed (idempotent)', () => {
    const { runtime, plan } = fixtureRuntime();
    const first = runtime.createSession({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      plan,
      createdAt: T1,
    });
    if (!first.ok) throw new Error(first.error.message);
    const second = runtime.createSession({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      plan,
      createdAt: T1,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe('duplicate-suppressed');
      if (second.error.code === 'duplicate-suppressed') {
        expect(second.error.sessionId).toBe(SESSION_ID);
      }
    }
  });

  it('rejects duplicate session creation with a DIFFERENT plan as lifecycle-conflict', () => {
    const { runtime, plan } = fixtureRuntime();
    const first = runtime.createSession({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      plan,
      createdAt: T1,
    });
    if (!first.ok) throw new Error(first.error.message);
    const other = runtime.compilePlan({
      tenantId: TENANT,
      plan: withRealDigests(planFixture({ displayName: 'A different plan' }), standardProposalSet()),
      proposals: standardProposalSet(),
    });
    if (!other.ok) throw new Error(other.error.message);
    const second = runtime.createSession({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      plan: other.value,
      createdAt: T1,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe('lifecycle-conflict');
    }
  });

  it('rejects unknown-session operations with unknown-session', () => {
    const { runtime } = fixtureRuntime();
    for (const result of [
      runtime.getSession({ tenantId: TENANT, sessionId: 'session:missing' }),
      runtime.startSession({ tenantId: TENANT, sessionId: 'session:missing', at: T1 }),
      runtime.handoffLog({ tenantId: TENANT, sessionId: 'session:missing' }),
    ]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('unknown-session');
      }
    }
  });

  it('rejects sessions grounded in another tenant\'s plan (cross-tenant-denied)', () => {
    const { runtime, plan, registry } = fixtureRuntime();
    // Compile a GENUINE plan of another tenant (valid digest, foreign scope).
    const foreignTenant = 'tenant:bridge';
    for (const binding of standardAgents(registry)) {
      const bound = runtime.bindAgent({
        tenantId: foreignTenant,
        agent: binding.agent,
        registry,
      });
      if (!bound.ok) throw new Error(bound.error.message);
    }
    const foreign = runtime.compilePlan({
      tenantId: foreignTenant,
      plan: {
        schemaVersion: 1,
        tenantId: foreignTenant,
        planId: 'plan:bridge-plan',
        steps: plan.steps.map((step) => ({
          stepId: step.stepId,
          agentId: step.agentId,
          proposal: step.proposal,
          dependsOn: [...step.dependsOn],
        })),
      },
      proposals: standardProposalSet(),
    });
    if (!foreign.ok) throw new Error(foreign.error.message);
    const created = runtime.createSession({
      tenantId: TENANT,
      sessionId: SESSION_ID,
      plan: foreign.value,
      createdAt: T1,
    });
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error.code).toBe('cross-tenant-denied');
    }
  });

  it('rejects operations for foreign tenants on a tenant-scoped host', () => {
    const scoped = new AgentRuntime({ expectedTenantId: TENANT });
    const denied = scoped.listSessions({ tenantId: 'tenant:bridge' });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.code).toBe('cross-tenant-denied');
    }
  });
});
