// Simulator registration — negative cases: a simulator that cannot
// declare its validity domain, assumptions, or fidelity is NOT
// registrable; malformed declarations and smuggled engine vocabulary are
// rejected as typed protocol errors, never uncontrolled exceptions.
import { describe, expect, it } from 'vitest';
import { parseSimulatorRegistration } from '../src/registration';
import type { SimulatorRegistration } from '../src/registration';
import { validRegistration } from './fixtures';

type Mutation = (registration: SimulatorRegistration) => void;

function rejectMutation(name: string, mutate: Mutation, match?: RegExp): void {
  it(`rejects ${name}`, () => {
    const registration = validRegistration();
    mutate(registration);
    const outcome = parseSimulatorRegistration(registration);
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

describe('parseSimulatorRegistration (negative: undeclarable contracts)', () => {
  rejectMutation(
    'a registration missing its validity domain',
    (r) => delete (r as Partial<SimulatorRegistration>).validityDomain,
    /validityDomain/i,
  );

  rejectMutation(
    'a validity domain with an empty includes list',
    (r) => {
      r.validityDomain.includes = [];
    },
    /includes|too_small/i,
  );

  rejectMutation(
    'a validity domain with an empty summary',
    (r) => {
      r.validityDomain.summary = '';
    },
    /summary|too_small/i,
  );

  rejectMutation(
    'a registration missing its assumptions',
    (r) => delete (r as Partial<SimulatorRegistration>).assumptions,
    /assumptions/i,
  );

  rejectMutation(
    'a registration with an empty assumptions list',
    (r) => {
      r.assumptions = [];
    },
    /assumptions|too_small/i,
  );

  rejectMutation(
    'a registration missing its fidelity declaration',
    (r) => delete (r as Partial<SimulatorRegistration>).fidelity,
    /fidelity/i,
  );

  rejectMutation(
    'a fidelity profile with an empty summary',
    (r) => {
      r.fidelity.summary = '';
    },
    /summary|too_small/i,
  );

  rejectMutation(
    'a registration with zero declared inputs',
    (r) => {
      r.inputs = [];
    },
    /inputs|too_small/i,
  );

  rejectMutation(
    'a registration with zero declared outputs',
    (r) => {
      r.outputs = [];
    },
    /outputs|too_small/i,
  );

  rejectMutation(
    'a registration missing its reproducibility declaration',
    (r) => delete (r as Partial<SimulatorRegistration>).reproducibility,
    /reproducibility/i,
  );
});

describe('parseSimulatorRegistration (negative: contradictory reproducibility)', () => {
  rejectMutation(
    'a non-deterministic simulator claiming internal-seed',
    (r) => {
      r.reproducibility = { deterministic: false, seedPolicy: 'internal-seed' };
    },
    /internal-seed|deterministic/i,
  );

  it('admits non-deterministic with not-applicable and external-seed policies', () => {
    for (const seedPolicy of ['not-applicable', 'external-seed'] as const) {
      const registration = validRegistration();
      registration.reproducibility = { deterministic: false, seedPolicy };
      const outcome = parseSimulatorRegistration(registration);
      expect(outcome.ok, `seedPolicy=${seedPolicy}`).toBe(true);
    }
  });
});

describe('parseSimulatorRegistration (negative: malformed declarations)', () => {
  rejectMutation(
    'registrations with duplicate input names',
    (r) => {
      r.inputs = [r.inputs[0]!, { ...r.inputs[0]! }];
    },
    /unique/i,
  );

  rejectMutation(
    'registrations with duplicate output names',
    (r) => {
      r.outputs = [r.outputs[0]!, { ...r.outputs[0]! }];
    },
    /unique/i,
  );

  rejectMutation(
    'registrations where an input and an output share a name',
    (r) => {
      r.outputs[0]!.name = r.inputs[0]!.name;
    },
    /disjoint/i,
  );

  rejectMutation(
    'latency profiles with p95 < p50',
    (r) => {
      r.latencyProfile = { p50Milliseconds: 5_000, p95Milliseconds: 4_000 };
    },
    /p95/i,
  );

  rejectMutation(
    'billed cost profiles without currency/amount',
    (r) => {
      r.costProfile = { basis: 'per-hour' } as SimulatorRegistration['costProfile'];
    },
    /currency|amount/i,
  );

  it('rejects malformed simulator ids', () => {
    for (const simulatorId of ['thermal-steady-state', 'Simulator:Foo', 'simulator:', 'sim']) {
      const registration = validRegistration({ simulatorId });
      const outcome = parseSimulatorRegistration(registration);
      expect(outcome.ok, `simulatorId=${simulatorId}`).toBe(false);
    }
  });

  it('rejects non-canonical or impossible timestamps', () => {
    for (const createdAt of [
      '2025-02-10T08:00:00Z',
      '2025-02-10T08:00:00.000+02:00',
      '2025-02-30T08:00:00.000Z',
      'not-a-timestamp',
    ]) {
      const registration = validRegistration();
      registration.createdAt = createdAt;
      const outcome = parseSimulatorRegistration(registration);
      expect(outcome.ok, `createdAt=${createdAt}`).toBe(false);
    }
  });

  it('rejects non-object inputs with a typed error', () => {
    for (const input of [null, 42, 'x', [], true]) {
      const outcome = parseSimulatorRegistration(input);
      expect(outcome.ok).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});

describe('parseSimulatorRegistration (negative: engine-vocabulary smuggling)', () => {
  it('rejects solver/engine/provider-specific fields via unknown-field discipline', () => {
    for (const smuggled of [
      { solver: 'openfoam' },
      { engine: 'chrono' },
      { backend: 'drake' },
      { toolchain: 'fmi' },
      { vendor: 'ansys' },
      { licenseKey: 'secret' },
    ]) {
      const registration = { ...validRegistration(), ...smuggled };
      const outcome = parseSimulatorRegistration(registration);
      expect(outcome.ok, `smuggled=${JSON.stringify(smuggled)}`).toBe(false);
      if (outcome.ok) continue;
      expect(outcome.error.kind).toBe('schema-violation');
    }
  });
});

describe('parseSimulatorRegistration (negative: version and kind gates)', () => {
  it('reports version-mismatch with expected and encountered versions', () => {
    for (const encountered of ['0.9.0', '2.0.0', '1.0', '1.0.0-rc1', '']) {
      const registration = { ...validRegistration(), protocolVersion: encountered };
      const outcome = parseSimulatorRegistration(registration);
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
    const registration = validRegistration() as Partial<SimulatorRegistration>;
    delete registration.protocolVersion;
    const outcome = parseSimulatorRegistration(registration);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('schema-violation');
  });

  it('reports kind-mismatch with expected and encountered kinds', () => {
    const registration = { ...validRegistration(), messageKind: 'agent.registration' };
    const outcome = parseSimulatorRegistration(registration);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe('kind-mismatch');
      if (outcome.error.kind === 'kind-mismatch') {
        expect(outcome.error.expected).toBe('simulation.registration');
        expect(outcome.error.encountered).toBe('agent.registration');
      }
    }
  });

  it('gives version-mismatch precedence over kind-mismatch', () => {
    const registration = {
      ...validRegistration(),
      protocolVersion: '0.9.0',
      messageKind: 'agent.registration',
    };
    const outcome = parseSimulatorRegistration(registration);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.kind).toBe('version-mismatch');
  });
});
