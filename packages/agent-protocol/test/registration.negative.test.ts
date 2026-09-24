// Agent registration — negative cases: authority boundaries, malformed
// declarations, and envelope discipline. Every rejection must be a typed
// protocol error, never an uncontrolled exception.
import { describe, expect, it } from 'vitest';
import { parseAgentRegistration } from '../src/registration';
import type { AgentRegistration } from '../src/registration';
import { validRegistration } from './fixtures';

type Mutation = (registration: AgentRegistration) => void;

function rejectMutation(
  name: string,
  mutate: Mutation,
  match?: RegExp,
): void {
  it(`rejects ${name}`, () => {
    const registration = validRegistration();
    mutate(registration);
    const outcome = parseAgentRegistration(registration);
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

describe('parseAgentRegistration (negative: authority boundary)', () => {
  rejectMutation(
    'a registration missing its authority declaration',
    (r) => delete (r as Partial<AgentRegistration>).authority,
    /authority/i,
  );

  rejectMutation(
    'any attempt to claim execution authority other than "none"',
    (r) => {
      (r.authority as { executionAuthority: string }).executionAuthority = 'world:write';
    },
    /executionAuthority|invalid_literal/i,
  );

  rejectMutation(
    'a registration with an empty proposableActionTypes list',
    (r) => {
      r.authority.proposableActionTypes = [];
    },
    /proposableActionTypes|too_small/i,
  );

  it('rejects smuggled execution/decision vocabulary via unknown-field discipline', () => {
    for (const smuggled of [
      { canExecute: true },
      { executionAuthorityToken: 'world:write' },
      { authorized: true },
      { approved: true },
    ]) {
      const registration = {
        ...validRegistration(),
        ...smuggled,
      };
      const outcome = parseAgentRegistration(registration);
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});

describe('parseAgentRegistration (negative: malformed declarations)', () => {
  rejectMutation(
    'registrations with zero capabilities',
    (r) => {
      r.capabilities = [];
    },
    /capabilities|too_small/i,
  );

  rejectMutation(
    'registrations with duplicate capability ids',
    (r) => {
      r.capabilities = [r.capabilities[0]!, { ...r.capabilities[0]! }];
    },
    /unique/i,
  );

  rejectMutation(
    'registrations with duplicate tool ids',
    (r) => {
      r.tools = [r.tools[0]!, { ...r.tools[0]! }];
    },
    /unique/i,
  );

  rejectMutation(
    'latency profiles with p95 < p50',
    (r) => {
      r.latencyProfile = { p50Milliseconds: 10_000, p95Milliseconds: 9_000 };
    },
    /p95/i,
  );

  rejectMutation(
    'cost profiles with a billed basis but no amount/currency',
    (r) => {
      r.costProfile = { basis: 'per-hour' } as AgentRegistration['costProfile'];
    },
    /costProfile\.(currency|amount)/i,
  );

  it('rejects cost profiles with basis "none" that carry an amount', () => {
    const registration = validRegistration();
    registration.costProfile = { basis: 'none', amount: '1.00' } as unknown as AgentRegistration['costProfile'];
    const outcome = parseAgentRegistration(registration);
    expect(outcome.ok).toBe(false);
  });

  rejectMutation(
    'non-decimal cost amounts',
    (r) => {
      r.costProfile = { basis: 'per-proposal', currency: 'USD', amount: '1.5e2' };
    },
    /amount|pattern/i,
  );

  rejectMutation(
    'lowercase currency codes',
    (r) => {
      r.costProfile = { basis: 'per-proposal', currency: 'usd', amount: '1' };
    },
    /currency|pattern/i,
  );

  rejectMutation(
    'negative latency percentiles',
    (r) => {
      r.latencyProfile = { p50Milliseconds: -1, p95Milliseconds: 0 };
    },
    /p50|too_small/i,
  );

  rejectMutation(
    'missing evidence requirements',
    (r) => delete (r as Partial<AgentRegistration>).evidenceRequirements,
    /evidence/i,
  );

  rejectMutation(
    'missing cost profile',
    (r) => delete (r as Partial<AgentRegistration>).costProfile,
    /costProfile/i,
  );

  rejectMutation(
    'missing latency profile',
    (r) => delete (r as Partial<AgentRegistration>).latencyProfile,
    /latencyProfile/i,
  );
});

describe('parseAgentRegistration (negative: envelope discipline)', () => {
  it('rejects malformed agent ids', () => {
    for (const agentId of ['stress-checker', 'Agent:Foo', 'agent:', 'agent:X', 'a']) {
      const registration = validRegistration();
      registration.agentId = agentId;
      const outcome = parseAgentRegistration(registration);
      expect(outcome.ok, `agentId=${agentId}`).toBe(false);
    }
  });

  it('rejects non-canonical or impossible timestamps', () => {
    for (const createdAt of [
      '2025-01-15T09:30:00Z', // missing milliseconds
      '2025-01-15T09:30:00.000+02:00', // offset instead of Z
      '2025-01-15 09:30:00.000Z', // space separator
      '2025-02-30T09:30:00.000Z', // impossible calendar date
      '2025-13-01T09:30:00.000Z', // impossible month
      'not-a-timestamp',
    ]) {
      const registration = validRegistration();
      registration.createdAt = createdAt;
      const outcome = parseAgentRegistration(registration);
      expect(outcome.ok, `createdAt=${createdAt}`).toBe(false);
    }
  });

  it('rejects non-object inputs with a typed error', () => {
    for (const input of [null, 42, 'x', [], true]) {
      const outcome = parseAgentRegistration(input);
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});

describe('parseAgentRegistration (negative: version and kind gates)', () => {
  it('reports version-mismatch with expected and encountered versions', () => {
    for (const encountered of ['0.9.0', '2.0.0', '1.0', '1.0.0-rc1', '']) {
      const registration = { ...validRegistration(), protocolVersion: encountered };
      const outcome = parseAgentRegistration(registration);
      expect(outcome.ok, `protocolVersion=${encountered}`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('version-mismatch');
      if (outcome.error.kind === 'version-mismatch') {
        expect(outcome.error.expected).toBe('1.0.0');
        expect(outcome.error.encountered).toBe(encountered);
      }
    }
  });

  it('reports a missing protocolVersion as schema-violation (not version-mismatch)', () => {
    const registration = validRegistration() as Partial<AgentRegistration>;
    delete registration.protocolVersion;
    const outcome = parseAgentRegistration(registration);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('schema-violation');
  });

  it('reports a non-string protocolVersion as schema-violation', () => {
    const registration = { ...validRegistration(), protocolVersion: 1 };
    const outcome = parseAgentRegistration(registration);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('schema-violation');
  });

  it('reports kind-mismatch with expected and encountered kinds', () => {
    const registration = {
      ...validRegistration(),
      messageKind: 'action.proposal',
    };
    const outcome = parseAgentRegistration(registration);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('kind-mismatch');
      if (outcome.error.kind === 'kind-mismatch') {
        expect(outcome.error.expected).toBe('agent.registration');
        expect(outcome.error.encountered).toBe('action.proposal');
      }
    }
  });

  it('gives version-mismatch precedence over kind-mismatch', () => {
    const registration = {
      ...validRegistration(),
      protocolVersion: '0.9.0',
      messageKind: 'action.proposal',
    };
    const outcome = parseAgentRegistration(registration);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('version-mismatch');
  });
});
