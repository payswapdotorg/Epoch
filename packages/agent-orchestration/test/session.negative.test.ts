// Session record negatives (named, typed): illegal lifecycle transitions
// are lifecycle-conflict; tampered compiled plans are digest-mismatch;
// coverage violations (steps assigned to unbound agents) are invalid-plan;
// malformed session documents are validation errors with precise paths.
import { describe, expect, it } from 'vitest';
import {
  compilePlan,
  createSessionRecord,
  parseOrchestrationSession,
  transitionSessionStatus,
} from '../src/index';
import {
  T0,
  planFixture,
  standardAgents,
  standardProposalSet,
  fixtureRegistry,
  withRealDigests,
} from './helpers';

describe('session records (negative)', () => {
  const registry = fixtureRegistry();

  function compiledPlan() {
    const compiled = compilePlan({
      plan: withRealDigests(planFixture(), standardProposalSet()),
      proposals: standardProposalSet(),
      agents: standardAgents(registry),
    });
    if (!compiled.ok) throw new Error(compiled.error.message);
    return compiled.value;
  }

  it('rejects starting a session that is already running (lifecycle-conflict)', () => {
    const created = createSessionRecord({
      sessionId: 'session:run-001',
      plan: compiledPlan(),
      agents: standardAgents(registry),
      createdAt: T0,
    });
    if (!created.ok) throw new Error(created.error.message);
    const started = transitionSessionStatus(created.value, 'running', 'start', T0);
    if (!started.ok) throw new Error(started.error.message);
    const again = transitionSessionStatus(started.value, 'running', 'start', T0);
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.code).toBe('lifecycle-conflict');
      if (again.error.code === 'lifecycle-conflict') {
        expect(again.error.from).toBe('running');
        expect(again.error.to).toBe('running');
      }
    }
  });

  it('rejects transitions out of terminal statuses', () => {
    const created = createSessionRecord({
      sessionId: 'session:run-001',
      plan: compiledPlan(),
      agents: standardAgents(registry),
      createdAt: T0,
    });
    if (!created.ok) throw new Error(created.error.message);
    const started = transitionSessionStatus(created.value, 'running', 'start', T0);
    if (!started.ok) throw new Error(started.error.message);
    const completed = transitionSessionStatus(started.value, 'completed', 'all-steps-executed', T0);
    if (!completed.ok) throw new Error(completed.error.message);
    for (const to of ['pending', 'running', 'suspended', 'failed', 'cancelled'] as const) {
      const result = transitionSessionStatus(completed.value, to, 'cancel', T0);
      expect(result.ok, `completed -> ${to}`).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('lifecycle-conflict');
      }
    }
  });

  it('rejects suspending a pending session (only running suspends)', () => {
    const created = createSessionRecord({
      sessionId: 'session:run-001',
      plan: compiledPlan(),
      agents: standardAgents(registry),
      createdAt: T0,
    });
    if (!created.ok) throw new Error(created.error.message);
    const result = transitionSessionStatus(created.value, 'suspended', 'suspend', T0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('lifecycle-conflict');
    }
  });

  it('rejects a session whose steps reference unbound agents (invalid-plan)', () => {
    const [onlySurveyor] = standardAgents(registry);
    const result = createSessionRecord({
      sessionId: 'session:run-001',
      plan: compiledPlan(),
      agents: [onlySurveyor!],
      createdAt: T0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-plan');
      expect(result.error.message).toContain('agent:stress-analyst');
    }
  });

  it('rejects a tampered compiled plan (digest-mismatch) at session creation', () => {
    const plan = compiledPlan();
    const tampered = {
      ...plan,
      displayName: 'Tampered after compilation',
    };
    const result = createSessionRecord({
      sessionId: 'session:run-001',
      plan: tampered,
      agents: standardAgents(registry),
      createdAt: T0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('digest-mismatch');
    }
  });

  it('rejects a malformed session document with precise paths', () => {
    const created = createSessionRecord({
      sessionId: 'session:run-001',
      plan: compiledPlan(),
      agents: standardAgents(registry),
      createdAt: T0,
    });
    if (!created.ok) throw new Error(created.error.message);
    const corrupted = {
      ...(created.value as unknown as Record<string, unknown>),
      status: 'paused',
    };
    const result = parseOrchestrationSession(corrupted);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
      if (result.error.code === 'validation') {
        expect(result.error.issues.some((issue) => issue.path === 'status')).toBe(true);
      }
    }
  });
});
