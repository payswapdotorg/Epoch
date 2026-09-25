// Published-surface integrity: the exported vocabularies, the lifecycle
// transition table, and the id pattern are exactly the W009-pinned sets.
import { describe, expect, it } from 'vitest';
import {
  AUTHENTICATION_FAILURE_REASONS,
  CREDENTIAL_MECHANISMS,
  IDENTITY_CONTRACT_VERSION,
  IDENTITY_RECORD_VERSION,
  IDENTITY_SCHEMA_SURFACE,
  PRINCIPAL_ID_PATTERN,
  PRINCIPAL_KINDS,
  PRINCIPAL_LIFECYCLE_STATES,
  PRINCIPAL_LIFECYCLE_TRANSITIONS,
} from '../src/index';

describe('identity published surface', () => {
  it('the principal-kind vocabulary names participant classes, never vendors', () => {
    expect([...PRINCIPAL_KINDS]).toEqual(['human', 'agent', 'service']);
  });

  it('the lifecycle vocabulary is active -> suspended -> deactivated, forward-only', () => {
    expect([...PRINCIPAL_LIFECYCLE_STATES]).toEqual(['active', 'suspended', 'deactivated']);
    expect(PRINCIPAL_LIFECYCLE_TRANSITIONS).toEqual({
      active: ['suspended', 'deactivated'],
      suspended: ['deactivated'],
      deactivated: [],
    });
  });

  it('the credential vocabulary names neutral mechanism classes', () => {
    expect([...CREDENTIAL_MECHANISMS]).toEqual([
      'shared-secret',
      'asymmetric-key',
      'signed-assertion',
      'one-time-token',
      'biometric',
    ]);
  });

  it('the failure-reason vocabulary is closed and typed', () => {
    expect([...AUTHENTICATION_FAILURE_REASONS]).toEqual([
      'invalid-credential',
      'expired-credential',
      'revoked-credential',
      'malformed-assertion',
      'challenge-mismatch',
      'unknown-principal',
      'inactive-principal',
    ]);
  });

  it('principal ids are opaque prefixed slugs (no tenant, no provider encoding)', () => {
    expect('principal:ada').toMatch(PRINCIPAL_ID_PATTERN);
    expect('principal:stress-agent').toMatch(PRINCIPAL_ID_PATTERN);
    expect('Principal:Ada').not.toMatch(PRINCIPAL_ID_PATTERN);
    expect('ada').not.toMatch(PRINCIPAL_ID_PATTERN);
    expect('tenant:acme').not.toMatch(PRINCIPAL_ID_PATTERN);
    expect('principal:').not.toMatch(PRINCIPAL_ID_PATTERN);
  });

  it('version constants are pinned', () => {
    expect(IDENTITY_CONTRACT_VERSION).toBe('1.0.0');
    expect(IDENTITY_RECORD_VERSION).toBe(1);
  });

  it('the schema surface is complete, unique, and sorted', () => {
    const types = IDENTITY_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toEqual([...types].sort());
    for (const entry of IDENTITY_SCHEMA_SURFACE) {
      expect(entry.schema, entry.type).toBeDefined();
    }
  });
});
