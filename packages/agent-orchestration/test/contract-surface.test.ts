// Published-surface integrity: the exported vocabularies, the id patterns,
// the lifecycle transition tables, and the retry policy bounds are exactly
// the architecture-pinned sets; every schema-surface type is exported from
// the package index and round-trips through its validator.
import { describe, expect, it } from 'vitest';
import {
  AGENT_ORCHESTRATION_CONTRACT_VERSION,
  AGENT_ORCHESTRATION_SCHEMA_SURFACE,
  MAX_RETRY_ATTEMPTS,
  ORCHESTRATION_PLAN_ID_PATTERN,
  ORCHESTRATION_PRINCIPAL_ID_PATTERN,
  ORCHESTRATION_RECORD_VERSION,
  ORCHESTRATION_SESSION_ID_PATTERN,
  ORCHESTRATION_STEP_ID_PATTERN,
  ORCHESTRATION_TENANT_ID_PATTERN,
  RETRYABLE_ACTION_PHASES,
  SESSION_LIFECYCLE_TRANSITIONS,
  SESSION_STATUSES,
  STEP_LIFECYCLE_TRANSITIONS,
  STEP_STATUSES,
  CompiledPlanSchema,
  OrchestrationSessionSchema,
  RetryPolicySchema,
  StepStateSchema,
} from '../src/index';
import { compilePlan, createSessionRecord } from '../src/index';
import {
  T0,
  planFixture,
  standardAgents,
  standardProposalSet,
  fixtureRegistry,
  withRealDigests,
} from './helpers';

describe('agent-orchestration published surface', () => {
  it('version constants are pinned', () => {
    expect(AGENT_ORCHESTRATION_CONTRACT_VERSION).toBe('1.0.0');
    expect(ORCHESTRATION_RECORD_VERSION).toBe(1);
  });

  it('plan, session and step ids are kind-prefixed or local slugs (no embedded objects)', () => {
    expect('plan:column-reinforcement').toMatch(ORCHESTRATION_PLAN_ID_PATTERN);
    expect('session:run-001').toMatch(ORCHESTRATION_SESSION_ID_PATTERN);
    expect('survey').toMatch(ORCHESTRATION_STEP_ID_PATTERN);
    expect(ORCHESTRATION_PLAN_ID_PATTERN.test('Plan:Upper')).toBe(false);
    expect(ORCHESTRATION_SESSION_ID_PATTERN.test('session:')).toBe(false);
    expect(ORCHESTRATION_STEP_ID_PATTERN.test('1-leading-digit')).toBe(false);
    expect(ORCHESTRATION_STEP_ID_PATTERN.test('UPPER')).toBe(false);
  });

  it('tenant and principal ids mirror the W009 grammars', () => {
    expect('tenant:acme').toMatch(ORCHESTRATION_TENANT_ID_PATTERN);
    expect('principal:lead-eng').toMatch(ORCHESTRATION_PRINCIPAL_ID_PATTERN);
    expect('tenant:ACME').not.toMatch(ORCHESTRATION_TENANT_ID_PATTERN);
    expect('openai:gpt').not.toMatch(ORCHESTRATION_PRINCIPAL_ID_PATTERN);
  });

  it('the session lifecycle vocabulary and transition table are closed', () => {
    expect([...SESSION_STATUSES]).toEqual([
      'pending',
      'running',
      'suspended',
      'completed',
      'failed',
      'cancelled',
    ]);
    expect(SESSION_LIFECYCLE_TRANSITIONS.pending).toEqual(['running', 'cancelled']);
    expect(SESSION_LIFECYCLE_TRANSITIONS.running).toEqual([
      'suspended',
      'completed',
      'failed',
      'cancelled',
    ]);
    expect(SESSION_LIFECYCLE_TRANSITIONS.suspended).toEqual(['running', 'cancelled']);
    expect(SESSION_LIFECYCLE_TRANSITIONS.completed).toEqual([]);
    expect(SESSION_LIFECYCLE_TRANSITIONS.failed).toEqual([]);
    expect(SESSION_LIFECYCLE_TRANSITIONS.cancelled).toEqual([]);
  });

  it('the step lifecycle vocabulary and transition table are closed', () => {
    expect([...STEP_STATUSES]).toEqual([
      'pending',
      'dispatched',
      'authorized',
      'executed',
      'failed',
      'rejected',
      'skipped',
    ]);
    expect(STEP_LIFECYCLE_TRANSITIONS.pending).toEqual(['dispatched', 'skipped']);
    expect(STEP_LIFECYCLE_TRANSITIONS.dispatched).toEqual([
      'authorized',
      'executed',
      'failed',
      'rejected',
      'pending',
    ]);
    expect(STEP_LIFECYCLE_TRANSITIONS.authorized).toEqual(['executed', 'failed', 'pending']);
    expect(STEP_LIFECYCLE_TRANSITIONS.executed).toEqual([]);
    expect(STEP_LIFECYCLE_TRANSITIONS.skipped).toEqual([]);
  });

  it('retry policies are bounded typed data over the retryable phases', () => {
    expect([...RETRYABLE_ACTION_PHASES]).toEqual(['rejected', 'failed']);
    expect(MAX_RETRY_ATTEMPTS).toBe(16);
    expect(RetryPolicySchema.safeParse({ maxAttempts: 1, retryOn: [] }).success).toBe(true);
    expect(RetryPolicySchema.safeParse({ maxAttempts: 0, retryOn: [] }).success).toBe(false);
    expect(RetryPolicySchema.safeParse({ maxAttempts: 17, retryOn: [] }).success).toBe(false);
    expect(
      RetryPolicySchema.safeParse({ maxAttempts: 2, retryOn: ['executed'] }).success,
    ).toBe(false);
  });

  it('the schema surface is complete, unique, and sorted', () => {
    const types = AGENT_ORCHESTRATION_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    expect([...types].sort()).toEqual(types);
  });

  it('serialized projections validate against the published validators', () => {
    const compiled = compilePlan({
      plan: withRealDigests(planFixture(), standardProposalSet()),
      proposals: standardProposalSet(),
      agents: standardAgents(fixtureRegistry()),
    });
    if (!compiled.ok) throw new Error(compiled.error.message);
    expect(CompiledPlanSchema.safeParse(compiled.value).success).toBe(true);
    const session = createSessionRecord({
      sessionId: 'session:run-001',
      plan: compiled.value,
      agents: standardAgents(fixtureRegistry()),
      createdAt: T0,
    });
    if (!session.ok) throw new Error(session.error.message);
    expect(OrchestrationSessionSchema.safeParse(session.value).success).toBe(true);
    expect(
      StepStateSchema.safeParse(JSON.parse(JSON.stringify(session.value.steps[0]))).success,
    ).toBe(true);
  });
});
