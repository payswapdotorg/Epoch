// Determinism evidence (the W020 pin): identical operation sequences
// produce byte-identical snapshots; serialization round-trips do not
// drift; ZERO wall-clock reads and ZERO randomness in src (source scan).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRuntime } from '../src/index';
import {
  SESSION_ID,
  TENANT,
  T1,
  T2,
  fixtureRuntime,
  lifecycleEventFixture,
  startedSession,
} from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

describe('agent-runtime determinism', () => {
  it('two runtimes driven identically emit byte-identical snapshots', () => {
    const build = () => {
      const { runtime, plan } = fixtureRuntime();
      startedSession(runtime, plan);
      runtime.ingestEvent({
        tenantId: TENANT,
        sessionId: SESSION_ID,
        event: lifecycleEventFixture({ phase: 'executed', sequence: 1 }),
        at: T2,
      });
      return runtime;
    };
    expect(build().snapshot()).toEqual(build().snapshot());
  });

  it('serialization round-trips do not drift (JSON.parse(JSON.stringify))', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const snapshot = runtime.snapshot();
    const roundTripped = JSON.parse(JSON.stringify(snapshot));
    expect(roundTripped).toEqual(snapshot);
    const restored = AgentRuntime.fromSnapshot(roundTripped);
    if (!restored.ok) throw new Error(restored.error.message);
    expect(restored.value.snapshot()).toEqual(snapshot);
  });

  it('a tampered snapshot is a typed rejection (never silent corruption)', () => {
    const { runtime, plan } = fixtureRuntime();
    startedSession(runtime, plan);
    const snapshot = runtime.snapshot() as unknown as Record<string, unknown>;
    const tampered = {
      ...snapshot,
      sessions: (snapshot.sessions as Array<Record<string, unknown>>).map((entry) => ({
        ...(entry as { session: Record<string, unknown> }).session,
        status: 'paused',
      })),
    };
    const restored = AgentRuntime.fromSnapshot(tampered);
    expect(restored.ok).toBe(false);
    if (!restored.ok) {
      expect(restored.error.code).toBe('validation');
    }
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

  it('T1 is a fixed caller-supplied instant (no hidden clock dependency)', () => {
    // The same operations stamped with different caller instants produce
    // different transition records — proving instants are inputs, not
    // clock reads (the inverse of the determinism guarantee).
    const build = (at: string) => {
      const { runtime, plan } = fixtureRuntime();
      runtime.createSession({ tenantId: TENANT, sessionId: SESSION_ID, plan, createdAt: at });
      runtime.startSession({ tenantId: TENANT, sessionId: SESSION_ID, at });
      return runtime.snapshot();
    };
    expect(build(T1)).not.toEqual(build(T2));
  });
});
