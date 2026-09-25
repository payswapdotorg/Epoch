// Deterministic plan compilation (positives): authored plans compile into
// content-addressed, deterministically ordered compiled plans; identical
// semantic content produces identical plans regardless of authoring order;
// compiled plans round-trip through their validator and digest.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETRY_POLICY,
  compilePlan,
  computePlanDigest,
  parseCompiledPlan,
  verifyCompiledPlanDigest,
} from '../src/index';
import {
  admittedProposal,
  planFixture,
  proposalFixture,
  standardAgents,
  standardProposalSet,
  fixtureRegistry,
  withRealDigests,
} from './helpers';

describe('plan compilation (positive)', () => {
  const registry = fixtureRegistry();

  it('compiles a valid plan into a content-addressed compiled plan', () => {
    const compiled = compilePlan({
      plan: withRealDigests(planFixture(), standardProposalSet()),
      proposals: standardProposalSet(),
      agents: standardAgents(registry),
    });
    if (!compiled.ok) throw new Error(compiled.error.message);
    expect(compiled.value.planDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(compiled.value.stepCount).toBe(3);
    expect(compiled.value.tenantId).toBe('tenant:acme');
  });

  it('orders steps topologically with ties broken by step id', () => {
    const proposals = [
      ...standardProposalSet(),
      proposalFixture({ messageId: 'msg-proposal-004', proposalId: 'prop-inspect-001' }),
    ];
    // Authored in scrambled order; 'alpha' and 'zebra' become ready
    // together after 'survey' — the ready queue admits ascending stepId.
    const plan = withRealDigests(
      planFixture({
        steps: [
          {
            stepId: 'zebra',
            agentId: 'agent:stress-analyst',
            proposal: { proposalId: 'prop-analyze-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: ['survey'],
          },
          {
            stepId: 'reinforce',
            agentId: 'agent:stress-analyst',
            proposal: { proposalId: 'prop-reinforce-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: ['alpha'],
          },
          {
            stepId: 'survey',
            agentId: 'agent:field-surveyor',
            proposal: { proposalId: 'prop-survey-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: [],
          },
          {
            stepId: 'alpha',
            agentId: 'agent:field-surveyor',
            proposal: { proposalId: 'prop-inspect-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: ['survey'],
          },
        ],
      }),
      proposals,
    );
    const compiled = compilePlan({
      plan,
      proposals,
      agents: standardAgents(registry),
    });
    if (!compiled.ok) throw new Error(compiled.error.message);
    expect(compiled.value.steps.map((step) => step.stepId)).toEqual([
      'survey',
      'alpha',
      'reinforce',
      'zebra',
    ]);
  });

  it('identical semantic content produces identical compiled plans (authoring-order independence)', () => {
    const proposals = standardProposalSet();
    const agents = standardAgents(registry);
    const a = compilePlan({
      plan: withRealDigests(planFixture(), proposals),
      proposals,
      agents,
    });
    const reversed = withRealDigests(
      planFixture({
        steps: [
          {
            stepId: 'reinforce',
            agentId: 'agent:stress-analyst',
            proposal: { proposalId: 'prop-reinforce-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: ['analyze'],
          },
          {
            stepId: 'analyze',
            agentId: 'agent:stress-analyst',
            proposal: { proposalId: 'prop-analyze-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: ['survey'],
          },
          {
            stepId: 'survey',
            agentId: 'agent:field-surveyor',
            proposal: { proposalId: 'prop-survey-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: [],
          },
        ],
      }),
      proposals,
    );
    const b = compilePlan({ plan: reversed, proposals, agents });
    if (!a.ok) throw new Error(a.error.message);
    if (!b.ok) throw new Error(b.error.message);
    expect(a.value).toEqual(b.value);
    expect(a.value.planDigest).toBe(b.value.planDigest);
  });

  it('different semantic content produces different plan digests', () => {
    const proposals = standardProposalSet();
    const agents = standardAgents(registry);
    const first = compilePlan({
      plan: withRealDigests(planFixture(), proposals),
      proposals,
      agents,
    });
    const second = compilePlan({
      plan: withRealDigests(planFixture({ displayName: 'Different plan' }), proposals),
      proposals,
      agents,
    });
    if (!first.ok) throw new Error(first.error.message);
    if (!second.ok) throw new Error(second.error.message);
    expect(first.value.planDigest).not.toBe(second.value.planDigest);
  });

  it('normalizes dependsOn (sorted, de-duplicated) and defaults retry policies', () => {
    const proposals = standardProposalSet();
    const plan = withRealDigests(
      planFixture({
        steps: [
          {
            stepId: 'survey',
            agentId: 'agent:field-surveyor',
            proposal: { proposalId: 'prop-survey-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: [],
          },
          {
            stepId: 'analyze',
            agentId: 'agent:stress-analyst',
            proposal: { proposalId: 'prop-analyze-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: ['survey', 'survey'],
            retryPolicy: { maxAttempts: 3, retryOn: ['failed', 'rejected'] },
          },
          {
            stepId: 'reinforce',
            agentId: 'agent:stress-analyst',
            proposal: { proposalId: 'prop-reinforce-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: ['analyze'],
          },
        ],
      }),
      proposals,
    );
    const compiled = compilePlan({ plan, proposals, agents: standardAgents(registry) });
    if (!compiled.ok) throw new Error(compiled.error.message);
    const analyze = compiled.value.steps.find((step) => step.stepId === 'analyze')!;
    expect(analyze.dependsOn).toEqual(['survey']);
    expect(analyze.retryPolicy).toEqual({ maxAttempts: 3, retryOn: ['failed', 'rejected'] });
    const survey = compiled.value.steps.find((step) => step.stepId === 'survey')!;
    expect(survey.retryPolicy).toEqual(DEFAULT_RETRY_POLICY);
  });

  it('compiled plans round-trip through parseCompiledPlan with their digest verified', () => {
    const proposals = standardProposalSet();
    const compiled = compilePlan({
      plan: withRealDigests(planFixture(), proposals),
      proposals,
      agents: standardAgents(registry),
    });
    if (!compiled.ok) throw new Error(compiled.error.message);
    const serialized = JSON.parse(JSON.stringify(compiled.value));
    const reparsed = parseCompiledPlan(serialized);
    if (!reparsed.ok) throw new Error(reparsed.error.message);
    expect(reparsed.value).toEqual(compiled.value);
    expect(verifyCompiledPlanDigest(compiled.value)).toEqual({ ok: true, value: compiled.value });
    expect(computePlanDigest(reparsed.value)).toBe(compiled.value.planDigest);
  });

  it('resolves proposals through the REAL W003 admission pipeline', () => {
    // The fixture proposals parse through parseActionProposal; their
    // admitted digests are the canonical revision pins in the compiled plan.
    const proposals = standardProposalSet();
    const compiled = compilePlan({
      plan: withRealDigests(planFixture(), proposals),
      proposals,
      agents: standardAgents(registry),
    });
    if (!compiled.ok) throw new Error(compiled.error.message);
    const admitted = admittedProposal(proposals[0]!);
    const survey = compiled.value.steps.find((step) => step.stepId === 'survey')!;
    expect(survey.proposal.canonicalDigest).toBe(admitted.digest);
    expect(survey.proposal.proposalId).toBe(admitted.proposal.proposalId);
  });
});
