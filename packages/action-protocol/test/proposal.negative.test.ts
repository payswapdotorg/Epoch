// Action proposals — negative cases: the acceptance battery. A proposal
// missing authority requirements must be rejected; safety-relevant metadata
// is required, not optional; the proposal cannot self-authorize; envelope
// discipline (version/kind gates) applies unchanged.
import { describe, expect, it } from 'vitest';
import { parseActionProposal } from '../src/proposal';
import type { ActionProposal } from '../src/proposal';
import { validProposal } from './fixtures';

type Mutation = (proposal: ActionProposal) => void;

function rejectMutation(name: string, mutate: Mutation, match?: RegExp): void {
  it(`rejects ${name}`, () => {
    const proposal = validProposal();
    mutate(proposal);
    const outcome = parseActionProposal(proposal);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.kind).toBe('schema-violation');
    if (match && outcome.error.kind === 'schema-violation') {
      const text = outcome.error.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(' | ');
      expect(text).toMatch(match);
    }
  });
}

describe('parseActionProposal (negative: required safety metadata)', () => {
  rejectMutation(
    'a proposal missing its authority requirements',
    (p) => delete (p as Partial<ActionProposal>).authorityRequirements,
    /authorityRequirements/i,
  );

  rejectMutation(
    'a proposal with an empty requiredScopes list',
    (p) => {
      p.authorityRequirements.requiredScopes = [];
    },
    /requiredScopes|too_small/i,
  );

  rejectMutation(
    'a proposal missing its reversibility classification',
    (p) => delete (p as Partial<ActionProposal>).reversibility,
    /reversibility/i,
  );

  rejectMutation(
    'a proposal with no predicted effects',
    (p) => {
      p.predictedEffects = [];
    },
    /predictedEffects|too_small/i,
  );

  rejectMutation(
    'a proposal missing its preconditions declaration',
    (p) => delete (p as Partial<ActionProposal>).preconditions,
    /preconditions/i,
  );

  rejectMutation(
    'a proposal missing its side effects declaration',
    (p) => delete (p as Partial<ActionProposal>).sideEffects,
    /sideEffects/i,
  );

  rejectMutation(
    'a proposal missing its target',
    (p) => delete (p as Partial<ActionProposal>).target,
    /target/i,
  );

  rejectMutation(
    'a partially-reversible proposal without notes on the irreversible residue',
    (p) => {
      p.reversibility = { kind: 'partially-reversible' } as ActionProposal['reversibility'];
    },
    /notes|too_small/i,
  );
});

describe('parseActionProposal (negative: authority requirements semantics)', () => {
  rejectMutation(
    'a proposal requiring human approval without a quorum',
    (p) => {
      p.authorityRequirements.requiresHumanApproval = true;
      p.authorityRequirements.approvalQuorum = undefined;
    },
    /approvalQuorum/i,
  );

  rejectMutation(
    'a proposal with a quorum but no human-approval requirement',
    (p) => {
      p.authorityRequirements.requiresHumanApproval = false;
    },
    /approvalQuorum/i,
  );

  rejectMutation(
    'a proposal with a zero-approval quorum',
    (p) => {
      p.authorityRequirements.approvalQuorum = { approvals: 0, roles: ['engineer'] };
    },
    /approvals|too_small/i,
  );

  rejectMutation(
    'a proposal with a roleless quorum',
    (p) => {
      p.authorityRequirements.approvalQuorum = { approvals: 1, roles: [] };
    },
    /roles|too_small/i,
  );

  it('rejects malformed authority scopes', () => {
    for (const scope of ['world', 'world:', 'World:Write', 'world write', ':write']) {
      const proposal = validProposal();
      proposal.authorityRequirements.requiredScopes = [scope];
      const outcome = parseActionProposal(proposal);
      expect(outcome.ok, `scope=${scope}`).toBe(false);
    }
  });
});

describe('parseActionProposal (negative: no self-authorization)', () => {
  it('rejects smuggled authorization or execution vocabulary via unknown-field discipline', () => {
    for (const smuggled of [
      { authorized: true },
      { authorization: 'granted' },
      { approved: true },
      { decision: { kind: 'authorized' } },
      { executed: false },
      { executionAuthority: 'world:write' },
    ]) {
      const proposal = { ...validProposal(), ...smuggled };
      const outcome = parseActionProposal(proposal);
      expect(outcome.ok, JSON.stringify(smuggled)).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});

describe('parseActionProposal (negative: shape discipline)', () => {
  rejectMutation(
    'malformed action type ids (single segment, uppercase, empty)',
    (p) => {
      p.actionType = { id: 'reinforce', version: '1.0.0' };
    },
    /actionType/i,
  );

  rejectMutation(
    'non-semver action type versions',
    (p) => {
      p.actionType = { id: 'structural.element.reinforce', version: '1.0' };
    },
    /version|pattern/i,
  );

  rejectMutation(
    'quantified confidence values outside [0, 1]',
    (p) => {
      p.predictedEffects = [
        { description: 'd', confidence: { kind: 'quantified', value: 1.5 } },
      ];
    },
    /value|too_big/i,
  );

  rejectMutation(
    'unknown reversibility kinds',
    (p) => {
      p.reversibility = { kind: 'undoable' } as unknown as ActionProposal['reversibility'];
    },
    /reversibility/i,
  );

  rejectMutation(
    'unknown target kinds',
    (p) => {
      p.target = { kind: 'anything-goes', ref: 'x' } as unknown as ActionProposal['target'];
    },
    /target/i,
  );

  it('rejects parameter keys outside the parameter-name charset', () => {
    const proposal = validProposal();
    proposal.parameters = { 'Bad Key!': 1 };
    const outcome = parseActionProposal(proposal);
    expect(outcome.ok).toBe(false);
  });

  it('rejects non-finite parameter values', () => {
    const proposal = validProposal();
    proposal.parameters = { load: Number.NaN };
    const outcome = parseActionProposal(proposal);
    expect(outcome.ok).toBe(false);
  });

  it('rejects empty evidenceRefs arrays (absent or non-empty, never decorative)', () => {
    const proposal = validProposal();
    proposal.evidenceRefs = [];
    expect(parseActionProposal(proposal).ok).toBe(false);
  });

  it('rejects malformed proposer agent ids', () => {
    const outcome = parseActionProposal(validProposal({ proposedBy: 'stress-checker' }));
    expect(outcome.ok).toBe(false);
  });
});

describe('parseActionProposal (negative: envelope discipline)', () => {
  it('reports version-mismatch with expected and encountered versions', () => {
    for (const encountered of ['0.9.0', '2.0.0', '1.0', '']) {
      const proposal = { ...validProposal(), protocolVersion: encountered };
      const outcome = parseActionProposal(proposal);
      expect(outcome.ok, `protocolVersion=${encountered}`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('version-mismatch');
      if (outcome.error.kind === 'version-mismatch') {
        expect(outcome.error.expected).toBe('1.0.0');
        expect(outcome.error.encountered).toBe(encountered);
      }
    }
  });

  it('reports kind-mismatch when the message kind belongs to another protocol', () => {
    const proposal = { ...validProposal(), messageKind: 'agent.registration' };
    const outcome = parseActionProposal(proposal);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('kind-mismatch');
      if (outcome.error.kind === 'kind-mismatch') {
        expect(outcome.error.expected).toBe('action.proposal');
        expect(outcome.error.encountered).toBe('agent.registration');
      }
    }
  });

  it('gives version-mismatch precedence over kind-mismatch', () => {
    const proposal = {
      ...validProposal(),
      protocolVersion: '9.9.9',
      messageKind: 'action.authorization-decision',
    };
    const outcome = parseActionProposal(proposal);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('version-mismatch');
  });

  it('rejects non-object inputs with a typed error', () => {
    for (const input of [null, 7, 'x', [], true]) {
      const outcome = parseActionProposal(input);
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});
