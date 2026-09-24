// Host-function contract surface tests: the closed vocabulary, the
// required-scope table, the trust-class ceilings (lattice properties),
// and the request/response payload schemas.
import { describe, expect, it } from 'vitest';
import {
  HOST_FUNCTION_DECLARATIONS,
  HOST_FUNCTION_IDS,
  LEGAL_RESOURCE_SCOPES,
  TRUST_CLASS_GRANT_CEILINGS,
  CapabilityInvokeRequestSchema,
  ClockReadRequestSchema,
  ClockReadResponseSchema,
  EvidenceAppendRequestSchema,
  LogWriteRequestSchema,
  StorageReadRequestSchema,
  StorageWriteRequestSchema,
  WorldReadRequestSchema,
} from '../src/index';

describe('host-function contract surface', () => {
  it('the host-function vocabulary is closed, sorted, and narrow (7 functions)', () => {
    expect([...HOST_FUNCTION_IDS]).toEqual([
      'capability.invoke',
      'clock.read',
      'evidence.append',
      'log.write',
      'storage.read',
      'storage.write',
      'world.read',
    ]);
    expect(HOST_FUNCTION_IDS).toHaveLength(HOST_FUNCTION_DECLARATIONS.length);
  });

  it('every declared host function has a contract entry and a required scope in the legal set', () => {
    const declared = new Set(HOST_FUNCTION_DECLARATIONS.map((entry) => entry.hostFunction));
    expect(declared.size).toBe(HOST_FUNCTION_IDS.length);
    for (const entry of HOST_FUNCTION_DECLARATIONS) {
      expect(entry.description.length).toBeGreaterThan(0);
      if (entry.requiredScope !== null) {
        expect(LEGAL_RESOURCE_SCOPES).toContainEqual(entry.requiredScope);
      }
    }
  });

  it('ambient functions (clock.read, log.write) require no resource scope', () => {
    for (const fn of ['clock.read', 'log.write'] as const) {
      const entry = HOST_FUNCTION_DECLARATIONS.find((d) => d.hostFunction === fn)!;
      expect(entry.requiredScope).toBeNull();
    }
  });

  it('scoped functions map to their domain scope', () => {
    const expected: Record<string, string> = {
      'capability.invoke': 'capability.invoke',
      'evidence.append': 'evidence.append',
      'storage.read': 'storage.read',
      'storage.write': 'storage.write',
      'world.read': 'world.read',
    };
    for (const [fn, scopeKey] of Object.entries(expected)) {
      const entry = HOST_FUNCTION_DECLARATIONS.find((d) => d.hostFunction === fn)!;
      expect(`${entry.requiredScope!.resource}.${entry.requiredScope!.access}`).toBe(scopeKey);
    }
  });

  it('the host surface has NO world-mutation function (lock rule 3 — actions execute only through the Action Gateway)', () => {
    for (const entry of HOST_FUNCTION_DECLARATIONS) {
      if (entry.requiredScope?.resource === 'world') {
        expect(entry.requiredScope.access).toBe('read');
      }
    }
  });
});

describe('trust-class grant ceilings', () => {
  it('the ceiling table covers t0..t4 in order', () => {
    expect(TRUST_CLASS_GRANT_CEILINGS.map((c) => c.trustClass)).toEqual(['t0', 't1', 't2', 't3', 't4']);
  });

  it('ceilings are MONOTONE (each class includes everything below it)', () => {
    for (let index = 1; index < TRUST_CLASS_GRANT_CEILINGS.length; index += 1) {
      const lower = TRUST_CLASS_GRANT_CEILINGS[index - 1]!;
      const upper = TRUST_CLASS_GRANT_CEILINGS[index]!;
      for (const fn of lower.hostFunctions) {
        expect(upper.hostFunctions, `${upper.trustClass} must include ${fn}`).toContain(fn);
      }
      for (const scope of lower.resourceScopes) {
        expect(upper.resourceScopes).toContainEqual(scope);
      }
    }
  });

  it('t4 equals the full host surface', () => {
    const t4 = TRUST_CLASS_GRANT_CEILINGS[4]!;
    expect([...t4.hostFunctions].sort()).toEqual([...HOST_FUNCTION_IDS].sort());
  });

  it('t0 excludes every side-effecting function', () => {
    const t0 = TRUST_CLASS_GRANT_CEILINGS[0]!;
    for (const fn of ['evidence.append', 'storage.write', 'capability.invoke'] as const) {
      expect(t0.hostFunctions).not.toContain(fn);
    }
  });
});

describe('host-function request payload contracts', () => {
  it('clock.read accepts the marker request and rejects extras', () => {
    expect(ClockReadRequestSchema.safeParse({ instant: true }).success).toBe(true);
    expect(ClockReadRequestSchema.safeParse({}).success).toBe(false);
    expect(ClockReadRequestSchema.safeParse({ instant: true, extra: 1 }).success).toBe(false);
  });

  it('clock.read response requires a canonical timestamp', () => {
    expect(ClockReadResponseSchema.safeParse({ instant: '2026-01-02T03:04:05.678Z' }).success).toBe(true);
    expect(ClockReadResponseSchema.safeParse({ instant: '2026-01-02' }).success).toBe(false);
  });

  it('log.write validates level and message bounds', () => {
    expect(LogWriteRequestSchema.safeParse({ level: 'info', message: 'hello' }).success).toBe(true);
    expect(LogWriteRequestSchema.safeParse({ level: 'verbose', message: 'x' }).success).toBe(false);
    expect(LogWriteRequestSchema.safeParse({ level: 'info', message: '' }).success).toBe(false);
  });

  it('world.read validates bounded entity refs', () => {
    expect(WorldReadRequestSchema.safeParse({ entityRefs: ['world:beam-1'] }).success).toBe(true);
    expect(WorldReadRequestSchema.safeParse({ entityRefs: [] }).success).toBe(false);
    expect(
      WorldReadRequestSchema.safeParse({ entityRefs: Array.from({ length: 65 }, (_, i) => `e${i}`) }).success,
    ).toBe(false);
  });

  it('evidence.append validates statement bounds and optional digest', () => {
    expect(EvidenceAppendRequestSchema.safeParse({ statement: 'load was measured' }).success).toBe(true);
    expect(
      EvidenceAppendRequestSchema.safeParse({
        statement: 'x',
        subjectDigest: 'a'.repeat(64),
      }).success,
    ).toBe(true);
    expect(EvidenceAppendRequestSchema.safeParse({ statement: '' }).success).toBe(false);
    expect(EvidenceAppendRequestSchema.safeParse({ statement: 'x', subjectDigest: 'nope' }).success).toBe(false);
  });

  it('capability.invoke validates the capability id and named inputs', () => {
    expect(
      CapabilityInvokeRequestSchema.safeParse({
        capabilityId: 'engineering.stress-analysis',
        inputs: { 'load-kn': 42 },
      }).success,
    ).toBe(true);
    expect(CapabilityInvokeRequestSchema.safeParse({ capabilityId: 'bad id', inputs: {} }).success).toBe(false);
    expect(
      CapabilityInvokeRequestSchema.safeParse({ capabilityId: 'engineering.stress-analysis', inputs: { 'BAD KEY': 1 } })
        .success,
    ).toBe(false);
  });

  it('storage.read/write validate the storage key charset', () => {
    expect(StorageReadRequestSchema.safeParse({ key: 'cache.last-run' }).success).toBe(true);
    expect(StorageReadRequestSchema.safeParse({ key: 'Bad Key!' }).success).toBe(false);
    expect(StorageWriteRequestSchema.safeParse({ key: 'cache.last-run', value: { a: [1, null] } }).success).toBe(true);
    expect(StorageWriteRequestSchema.safeParse({ key: 'cache', value: undefined }).success).toBe(false);
  });
});
