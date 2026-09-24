// Action proposals — positive cases: valid proposals round-trip through
// schema validation and canonical serialization with stable digests; every
// executor kind of agent (human, program, model) can propose without
// protocol changes; every reversibility and confidence classification is
// representable.
import { describe, expect, it } from 'vitest';
import { parseActionProposal, validateActionProposal } from '../src/proposal';
import type { ReversibilityClassification, EffectConfidence } from '../src/targets';
import { canonicalJsonStringify, canonicalDigest } from '@epoch/agent-protocol';
import { validProposal } from './fixtures';

describe('parseActionProposal (positive)', () => {
  it('admits a fully valid proposal and returns canonical evidence form', () => {
    const proposal = validProposal();
    const outcome = parseActionProposal(proposal);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.proposalId).toBe('prop-2025-0001');
    expect(outcome.canonicalJson).toBe(canonicalJsonStringify(proposal));
    expect(outcome.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('proposals from human, program, and model agents are equally representable', () => {
    for (const proposedBy of ['agent:lead-reviewer', 'agent:solver-bot', 'agent:stress-checker']) {
      const outcome = parseActionProposal(validProposal({ proposedBy }));
      expect(outcome.ok, proposedBy).toBe(true);
    }
  });

  it('produces identical digests regardless of member insertion order', () => {
    const first = validProposal();
    const shuffled = Object.fromEntries(Object.entries(first).reverse()) as typeof first;
    const a = parseActionProposal(first);
    const b = parseActionProposal(shuffled);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.digest).toBe(b.digest);
  });

  it('canonicalizes nested parameter objects with sorted keys', () => {
    const proposal = validProposal();
    proposal.parameters = {
      'geometry': { z: 1, a: [3, { q: null, b: 2 }] },
      'reinforcement-class': 'B',
    };
    const outcome = parseActionProposal(proposal);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.canonicalJson).toContain('{"a":[3,{"b":2,"q":null}],"z":1}');
  });

  it('round-trips: canonical form parses back to the same value and digest', () => {
    const first = parseActionProposal(validProposal());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = parseActionProposal(JSON.parse(first.canonicalJson));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value).toEqual(first.value);
    expect(second.digest).toBe(first.digest);
  });

  it.each([
    { kind: 'reversible', via: 'automatic' },
    { kind: 'reversible', via: 'manual', notes: 'Requires site visit.' },
    { kind: 'irreversible' },
  ] as const satisfies readonly ReversibilityClassification[])(
    'admits reversibility classification %j',
    (reversibility) => {
      const proposal = validProposal();
      proposal.reversibility = reversibility;
      const outcome = parseActionProposal(proposal);
      expect(outcome.ok).toBe(true);
    },
  );

  it.each([
    { kind: 'deterministic' },
    { kind: 'quantified', value: 0 },
    { kind: 'quantified', value: 1 },
    { kind: 'qualitative', level: 'high' },
    { kind: 'qualitative', level: 'low' },
  ] as const satisfies readonly EffectConfidence[])(
    'admits effect confidence %j',
    (confidence) => {
      const proposal = validProposal();
      proposal.predictedEffects = [
        { description: 'Primary predicted effect.', confidence },
      ];
      const outcome = parseActionProposal(proposal);
      expect(outcome.ok).toBe(true);
    },
  );

  it('admits unconditional, side-effect-free proposals (empty arrays are explicit)', () => {
    const proposal = validProposal();
    proposal.preconditions = [];
    proposal.sideEffects = [];
    const outcome = parseActionProposal(proposal);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.preconditions).toEqual([]);
    expect(outcome.value.sideEffects).toEqual([]);
  });

  it('admits external-resource targets and external action types', () => {
    const proposal = validProposal();
    proposal.actionType = { id: 'external.git.create-pull-request', version: '2.1.0' };
    proposal.target = { kind: 'external-resource', ref: 'https://example.invalid/repo#12' };
    const outcome = parseActionProposal(proposal);
    expect(outcome.ok).toBe(true);
  });

  it('validateActionProposal returns the parsed value (throwing API)', () => {
    const value = validateActionProposal(validProposal());
    expect(value.authorityRequirements.requiredScopes).toEqual([
      'world:write',
      'external:scheduling:write',
    ]);
    expect(canonicalDigest(value)).toMatch(/^[0-9a-f]{64}$/);
  });
});
