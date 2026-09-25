// Session records (positives): creation from a compiled plan round-trips;
// status transitions follow the typed table; outcome evaluation is pure.
import { describe, expect, it } from 'vitest';
import {
  compilePlan,
  createSessionRecord,
  evaluateSessionOutcome,
  isTerminalSessionStatus,
  parseOrchestrationSession,
  transitionSessionStatus,
} from '../src/index';
import type { StepState } from '../src/index';
import {
  T0,
  T1,
  T2,
  T3,
  planFixture,
  standardAgents,
  standardProposalSet,
  fixtureRegistry,
  withRealDigests,
} from './helpers';

describe('session records (positive)', () => {
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

  it('creates a pending session with all steps pending and agents sorted', () => {
    const session = createSessionRecord({
      sessionId: 'session:run-001',
      plan: compiledPlan(),
      agents: standardAgents(registry),
      createdAt: T0,
    });
    if (!session.ok) throw new Error(session.error.message);
    expect(session.value.status).toBe('pending');
    expect(session.value.agents.map((binding) => binding.agent.agentId)).toEqual([
      'agent:field-surveyor',
      'agent:stress-analyst',
    ]);
    expect(session.value.steps.map((step) => step.status)).toEqual([
      'pending',
      'pending',
      'pending',
    ]);
    expect(session.value.createdAt).toBe(T0);
  });

  it('session documents round-trip through their validator', () => {
    const session = createSessionRecord({
      sessionId: 'session:run-001',
      plan: compiledPlan(),
      agents: standardAgents(registry),
      createdAt: T0,
    });
    if (!session.ok) throw new Error(session.error.message);
    const reparsed = parseOrchestrationSession(JSON.parse(JSON.stringify(session.value)));
    if (!reparsed.ok) throw new Error(reparsed.error.message);
    expect(reparsed.value).toEqual(session.value);
  });

  it('applies legal status transitions and records them replayably', () => {
    const created = createSessionRecord({
      sessionId: 'session:run-001',
      plan: compiledPlan(),
      agents: standardAgents(registry),
      createdAt: T0,
    });
    if (!created.ok) throw new Error(created.error.message);
    const started = transitionSessionStatus(created.value, 'running', 'start', T1);
    if (!started.ok) throw new Error(started.error.message);
    expect(started.value.status).toBe('running');
    expect(started.value.sessionTransitions).toEqual([
      { from: 'pending', to: 'running', cause: 'start', at: T1 },
    ]);
    const suspended = transitionSessionStatus(started.value, 'suspended', 'suspend', T2);
    if (!suspended.ok) throw new Error(suspended.error.message);
    const resumed = transitionSessionStatus(suspended.value, 'running', 'resume', T3);
    if (!resumed.ok) throw new Error(resumed.error.message);
    expect(resumed.value.sessionTransitions).toHaveLength(3);
    expect(resumed.value.updatedAt).toBe(T3);
  });

  it('evaluates settlement outcomes purely over step states', () => {
    const step = (status: StepState['status']): StepState => ({
      stepId: 'x',
      status,
      attempt: 1,
    });
    expect(evaluateSessionOutcome([step('executed'), step('executed')])).toBe('completed');
    expect(evaluateSessionOutcome([step('executed'), step('failed')])).toBe('failed');
    expect(evaluateSessionOutcome([step('executed'), step('skipped')])).toBe('failed');
    expect(evaluateSessionOutcome([step('executed'), step('dispatched')])).toBeUndefined();
    expect(evaluateSessionOutcome([step('pending')])).toBeUndefined();
  });

  it('terminal statuses are exactly completed, failed and cancelled', () => {
    expect(isTerminalSessionStatus('completed')).toBe(true);
    expect(isTerminalSessionStatus('failed')).toBe(true);
    expect(isTerminalSessionStatus('cancelled')).toBe(true);
    expect(isTerminalSessionStatus('pending')).toBe(false);
    expect(isTerminalSessionStatus('running')).toBe(false);
    expect(isTerminalSessionStatus('suspended')).toBe(false);
  });
});
