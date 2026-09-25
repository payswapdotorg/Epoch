// Plan compilation negatives (named, typed): malformed plans rejected
// with PRECISE dotted paths; version skew distinguished; semantic plan
// defects (duplicate ids, unknown/self/cyclic dependencies, unassigned
// agents, duplicate proposal references) are invalid-plan; unknown action
// references and tampered proposal revision pins are typed rejections.
import { describe, expect, it } from 'vitest';
import { compilePlan } from '../src/index';
import {
  planFixture,
  proposalFixture,
  standardAgents,
  standardProposalSet,
  fixtureRegistry,
  withRealDigests,
} from './helpers';

describe('plan compilation (negative)', () => {
  const registry = fixtureRegistry();

  it('rejects a malformed plan with a precise dotted path', () => {
    const result = compilePlan({
      plan: withRealDigests(planFixture({ tenantId: 'acme' }), standardProposalSet()),
      proposals: standardProposalSet(),
      agents: standardAgents(registry),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
      if (result.error.code === 'validation') {
        expect(result.error.issues.some((issue) => issue.path === 'tenantId')).toBe(true);
      }
    }
  });

  it('rejects version skew with version-unsupported before schema validation', () => {
    const result = compilePlan({
      plan: planFixture({ schemaVersion: 2 }),
      proposals: standardProposalSet(),
      agents: standardAgents(registry),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('version-unsupported');
      if (result.error.code === 'version-unsupported') {
        expect(result.error.expected).toBe('1');
        expect(result.error.encountered).toBe('2');
      }
    }
  });

  it('rejects an unknown (vendor) plan field via strict objects', () => {
    const result = compilePlan({
      plan: withRealDigests(planFixture({ modelVendor: 'acme-llm' }), standardProposalSet()),
      proposals: standardProposalSet(),
      agents: standardAgents(registry),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
    }
  });

  it('rejects an empty plan (at least one step)', () => {
    const result = compilePlan({
      plan: planFixture({ steps: [] }),
      proposals: standardProposalSet(),
      agents: standardAgents(registry),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
      if (result.error.code === 'validation') {
        expect(result.error.issues.some((issue) => issue.path === 'steps')).toBe(true);
      }
    }
  });

  it('rejects duplicate step ids with the offending path', () => {
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
            stepId: 'survey',
            agentId: 'agent:field-surveyor',
            proposal: { proposalId: 'prop-analyze-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: [],
          },
        ],
      }),
      proposals,
    );
    const result = compilePlan({ plan, proposals, agents: standardAgents(registry) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-plan');
      if (result.error.code === 'invalid-plan') {
        expect(result.error.issues.some((issue) => issue.path === 'steps[1].stepId')).toBe(true);
      }
    }
  });

  it('rejects a self-dependency', () => {
    const proposals = standardProposalSet();
    const plan = withRealDigests(
      planFixture({
        steps: [
          {
            stepId: 'survey',
            agentId: 'agent:field-surveyor',
            proposal: { proposalId: 'prop-survey-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: ['survey'],
          },
        ],
      }),
      proposals,
    );
    const result = compilePlan({ plan, proposals, agents: standardAgents(registry) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-plan');
      if (result.error.code === 'invalid-plan') {
        expect(result.error.issues.some((issue) => issue.path === 'steps[0].dependsOn')).toBe(true);
      }
    }
  });

  it('rejects an unknown dependency with the offending path', () => {
    const proposals = standardProposalSet();
    const plan = withRealDigests(
      planFixture({
        steps: [
          {
            stepId: 'survey',
            agentId: 'agent:field-surveyor',
            proposal: { proposalId: 'prop-survey-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: ['nonexistent-step'],
          },
        ],
      }),
      proposals,
    );
    const result = compilePlan({ plan, proposals, agents: standardAgents(registry) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-plan');
      if (result.error.code === 'invalid-plan') {
        expect(
          result.error.issues.some((issue) => issue.path === 'steps[0].dependsOn[0]'),
        ).toBe(true);
      }
    }
  });

  it('rejects a dependency cycle, naming the trapped steps', () => {
    const proposals = standardProposalSet();
    const plan = withRealDigests(
      planFixture({
        steps: [
          {
            stepId: 'survey',
            agentId: 'agent:field-surveyor',
            proposal: { proposalId: 'prop-survey-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: ['reinforce'],
          },
          {
            stepId: 'reinforce',
            agentId: 'agent:stress-analyst',
            proposal: { proposalId: 'prop-reinforce-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: ['survey'],
          },
        ],
      }),
      proposals,
    );
    const result = compilePlan({ plan, proposals, agents: standardAgents(registry) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-plan');
      expect(result.error.message).toContain('cycle');
    }
  });

  it('rejects a step assigned to an unbound agent', () => {
    const proposals = standardProposalSet();
    const plan = withRealDigests(planFixture(), proposals);
    (plan.steps as Array<Record<string, unknown>>)[0]!.agentId = 'agent:unbound-agent';
    const result = compilePlan({ plan, proposals, agents: standardAgents(registry) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-plan');
      if (result.error.code === 'invalid-plan') {
        expect(result.error.issues.some((issue) => issue.path === 'steps[0].agentId')).toBe(true);
      }
    }
  });

  it('rejects duplicate proposal references across steps', () => {
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
            stepId: 'again',
            agentId: 'agent:field-surveyor',
            proposal: { proposalId: 'prop-survey-001', canonicalDigest: '0'.repeat(64) },
            dependsOn: ['survey'],
          },
        ],
      }),
      proposals,
    );
    const result = compilePlan({ plan, proposals, agents: standardAgents(registry) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-plan');
      if (result.error.code === 'invalid-plan') {
        expect(
          result.error.issues.some((issue) => issue.path === 'steps[1].proposal.proposalId'),
        ).toBe(true);
      }
    }
  });

  it('rejects an unknown action reference (proposal not in the admitted set)', () => {
    const proposals = standardProposalSet();
    const plan = withRealDigests(planFixture(), proposals);
    // Corrupt the survey step to reference a proposal that was never admitted.
    const steps = plan.steps as Array<Record<string, unknown>>;
    steps[0] = {
      ...steps[0]!,
      proposal: { proposalId: 'prop-never-admitted', canonicalDigest: 'a'.repeat(64) },
    };
    const result = compilePlan({ plan, proposals, agents: standardAgents(registry) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unknown-action-reference');
      if (result.error.code === 'unknown-action-reference') {
        expect(result.error.proposalId).toBe('prop-never-admitted');
        expect(result.error.stepId).toBe('survey');
      }
    }
  });

  it('rejects a tampered proposal revision pin (digest mismatch)', () => {
    const proposals = standardProposalSet();
    const plan = withRealDigests(planFixture(), proposals);
    // The proposal IS admitted, but the step pins a stale/foreign revision.
    const steps = plan.steps as Array<Record<string, unknown>>;
    steps[0] = {
      ...steps[0]!,
      proposal: { proposalId: 'prop-survey-001', canonicalDigest: 'b'.repeat(64) },
    };
    const result = compilePlan({ plan, proposals, agents: standardAgents(registry) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('digest-mismatch');
      if (result.error.code === 'digest-mismatch') {
        expect(result.error.encountered).toBe('b'.repeat(64));
      }
    }
  });

  it('rejects a malformed proposal in the admitted set with a proposals[i] path', () => {
    const proposals = [
      proposalFixture({ proposedBy: 'not-an-agent-id' }),
      ...standardProposalSet(),
    ];
    const result = compilePlan({
      plan: withRealDigests(planFixture(), standardProposalSet()),
      proposals,
      agents: standardAgents(registry),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
      if (result.error.code === 'validation') {
        expect(result.error.issues.some((issue) => issue.path.startsWith('proposals[0]'))).toBe(
          true,
        );
      }
    }
  });
});
