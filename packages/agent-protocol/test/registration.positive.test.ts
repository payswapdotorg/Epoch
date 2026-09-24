// Agent registration — positive cases: valid registrations from every
// executor kind (human, program, model, hybrid) round-trip through schema
// validation and canonical serialization with stable digests. This is the
// provider-neutrality positive evidence: a human, a deterministic solver,
// and an LLM-backed agent are all representable without protocol changes.
import { describe, expect, it } from 'vitest';
import { parseAgentRegistration, validateAgentRegistration } from '../src/registration';
import type { ExecutorKind } from '../src/registration';
import { canonicalJsonStringify } from '../src/canonical';
import { canonicalDigest, sha256Hex } from '../src/digest';
import { validRegistration } from './fixtures';

describe('parseAgentRegistration (positive)', () => {
  it('admits a fully valid registration and returns canonical evidence form', () => {
    const registration = validRegistration();
    const outcome = parseAgentRegistration(registration);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.agentId).toBe('agent:stress-checker');
    expect(outcome.canonicalJson).toBe(canonicalJsonStringify(registration));
    expect(outcome.digest).toBe(sha256Hex(outcome.canonicalJson));
    expect(outcome.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each(['human', 'program', 'model', 'hybrid'] as const satisfies readonly ExecutorKind[])(
    'admits a %s executor (provider neutrality)',
    (kind) => {
      const outcome = parseAgentRegistration(validRegistration({ executorKind: kind }));
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.value.executor.kind).toBe(kind);
    },
  );

  it('admits deterministic and non-deterministic executors', () => {
    for (const deterministic of [true, false]) {
      const outcome = parseAgentRegistration(validRegistration({ deterministic }));
      expect(outcome.ok).toBe(true);
      if (outcome.ok) expect(outcome.value.executor.deterministic).toBe(deterministic);
    }
  });

  it('produces identical digests regardless of member insertion order', () => {
    const first = validRegistration();
    // Same value, top-level members inserted in reverse order (nested values
    // are shared, so only the outer member order differs).
    const shuffled = Object.fromEntries(Object.entries(first).reverse()) as typeof first;
    const a = parseAgentRegistration(first);
    const b = parseAgentRegistration(shuffled);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.digest).toBe(b.digest);
    expect(a.canonicalJson).toBe(b.canonicalJson);
  });

  it('round-trips: canonical form parses back to the same value and digest', () => {
    const first = parseAgentRegistration(validRegistration());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = parseAgentRegistration(JSON.parse(first.canonicalJson));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value).toEqual(first.value);
    expect(second.canonicalJson).toBe(first.canonicalJson);
    expect(second.digest).toBe(first.digest);
  });

  it('admits every cost basis variant', () => {
    const variants = [
      { basis: 'none' },
      { basis: 'per-proposal', currency: 'EUR', amount: '1.50' },
      { basis: 'per-session', currency: 'USD', amount: '12' },
      { basis: 'per-hour', currency: 'NOK', amount: '900' },
    ] as const;
    for (const costProfile of variants) {
      const registration = { ...validRegistration(), costProfile };
      const outcome = parseAgentRegistration(registration);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) expect(outcome.value.costProfile).toEqual(costProfile);
    }
  });

  it('admits registrations without tools, description, or assumptions', () => {
    const registration = validRegistration();
    const minimal = {
      ...registration,
      description: undefined,
      tools: [],
      capabilities: [{ ...registration.capabilities[0]!, assumptions: [] }],
    };
    const outcome = parseAgentRegistration(minimal);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.tools).toEqual([]);
      expect(outcome.value.capabilities[0]!.assumptions).toEqual([]);
    }
  });

  it('validateAgentRegistration returns the parsed value (throwing API)', () => {
    const value = validateAgentRegistration(validRegistration());
    expect(value.authority.executionAuthority).toBe('none');
    expect(value.authority.proposableActionTypes).toHaveLength(2);
  });

  it('admits a human governance agent whose capability is approval', () => {
    const registration = validRegistration({ executorKind: 'human' });
    registration.agentId = 'agent:lead-reviewer';
    registration.capabilities = [
      {
        protocolVersion: '1.0.0',
        capabilityId: 'governance.design-review',
        summary: 'Reviews engineering proposals against acceptance criteria.',
        domain: 'governance',
        inputs: [
          {
            name: 'proposal-ref',
            kind: 'entity-reference',
            required: true,
            description: 'Proposal under review.',
          },
        ],
        outputs: [
          {
            name: 'verdict',
            kind: 'enum',
            required: true,
            description: 'Review verdict.',
            enumValues: ['approve', 'reject'],
          },
        ],
        assumptions: [],
      },
    ];
    const outcome = parseAgentRegistration(registration);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.value.executor.kind).toBe('human');
      expect(canonicalDigest(outcome.value)).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
