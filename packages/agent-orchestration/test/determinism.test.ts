// Determinism evidence (the W020 pin): identical inputs produce identical
// digests; compilation is a pure function; ZERO wall-clock reads and ZERO
// randomness in src (source scan).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compilePlan,
  computePlanDigest,
  computeSessionStateDigest,
  createSessionRecord,
} from '../src/index';
import {
  T0,
  planFixture,
  standardAgents,
  standardProposalSet,
  fixtureRegistry,
  withRealDigests,
} from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

describe('agent-orchestration determinism', () => {
  const registry = fixtureRegistry();

  it('compilePlan is a pure function of its inputs', () => {
    const options = {
      plan: withRealDigests(planFixture(), standardProposalSet()),
      proposals: standardProposalSet(),
      agents: standardAgents(registry),
    };
    const a = compilePlan(options);
    const b = compilePlan(options);
    expect(a).toEqual(b);
  });

  it('session state digests are stable across identical constructions', () => {
    const build = () => {
      const compiled = compilePlan({
        plan: withRealDigests(planFixture(), standardProposalSet()),
        proposals: standardProposalSet(),
        agents: standardAgents(registry),
      });
      if (!compiled.ok) throw new Error(compiled.error.message);
      const session = createSessionRecord({
        sessionId: 'session:run-001',
        plan: compiled.value,
        agents: standardAgents(registry),
        createdAt: T0,
      });
      if (!session.ok) throw new Error(session.error.message);
      return session.value;
    };
    expect(build()).toEqual(build());
    expect(computeSessionStateDigest(build())).toBe(computeSessionStateDigest(build()));
  });

  it('serialization round-trips do not drift (JSON.parse(JSON.stringify))', () => {
    const compiled = compilePlan({
      plan: withRealDigests(planFixture(), standardProposalSet()),
      proposals: standardProposalSet(),
      agents: standardAgents(registry),
    });
    if (!compiled.ok) throw new Error(compiled.error.message);
    const roundTripped = JSON.parse(JSON.stringify(compiled.value));
    expect(computePlanDigest(roundTripped)).toBe(compiled.value.planDigest);
  });

  it('src contains ZERO wall-clock reads and ZERO randomness', () => {
    const forbidden = [
      /Date\.now/,
      /new Date\(/,
      /Math\.random/,
      /performance\.now/,
      /process\.hrtime/,
      /crypto\.randomUUID/,
    ];
    const violations: string[] = [];
    for (const file of readdirSync(SRC_DIR)) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(path.join(SRC_DIR, file), 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(source)) {
          violations.push(`${file}: /${pattern.source}/`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
