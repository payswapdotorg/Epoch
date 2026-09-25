// Published-surface integrity: the exported vocabularies and mirrored id
// patterns are exactly the W009-pinned sets.
import { describe, expect, it } from 'vitest';
import {
  ALLOW_REASONS,
  AUTHORIZATION_CONTRACT_VERSION,
  AUTHORIZATION_OUTCOMES,
  AUTHORIZATION_RECORD_VERSION,
  AUTHORIZATION_SCHEMA_SURFACE,
  DENIAL_CODES,
  EVIDENCE_PATH_PATTERN,
  NOT_APPLICABLE_REASONS,
  PRINCIPAL_ID_PATTERN,
  PRINCIPAL_STATUSES,
  TENANT_ID_PATTERN,
} from '../src/index';

describe('authorization published surface', () => {
  it('the outcome vocabulary is exactly allow/deny/not-applicable', () => {
    expect([...AUTHORIZATION_OUTCOMES]).toEqual(['allow', 'deny', 'not-applicable']);
  });

  it('the denial taxonomy is closed, typed, and fail-closed', () => {
    expect([...DENIAL_CODES]).toEqual([
      'unknown-principal',
      'unknown-tenant',
      'cross-tenant-denied',
      'cross-workspace-denied',
      'cross-project-denied',
      'inactive-principal',
      'unauthenticated-principal',
    ]);
  });

  it('the allow + not-applicable reason vocabularies are pinned', () => {
    expect([...ALLOW_REASONS]).toEqual([
      'covering-membership',
      'active-principal',
      'authenticated-principal',
    ]);
    expect([...NOT_APPLICABLE_REASONS]).toEqual(['resource-not-tenant-scoped']);
  });

  it('mirrored id patterns and the status vocabulary are pinned', () => {
    expect('principal:ada').toMatch(PRINCIPAL_ID_PATTERN);
    expect('tenant:acme').toMatch(TENANT_ID_PATTERN);
    expect('Tenant:ACME').not.toMatch(TENANT_ID_PATTERN);
    expect([...PRINCIPAL_STATUSES]).toEqual(['active', 'suspended', 'deactivated']);
  });

  it('evidence paths are rooted at the four decision inputs', () => {
    expect('request.resource.tenantId').toMatch(EVIDENCE_PATH_PATTERN);
    expect('principals[0].status').toMatch(EVIDENCE_PATH_PATTERN);
    expect('memberships[2]').toMatch(EVIDENCE_PATH_PATTERN);
    expect('knownTenants').toMatch(EVIDENCE_PATH_PATTERN);
    expect('workspace:acme-eng').not.toMatch(EVIDENCE_PATH_PATTERN);
    expect('request..bad').not.toMatch(EVIDENCE_PATH_PATTERN);
    expect('evidence[0]').not.toMatch(EVIDENCE_PATH_PATTERN);
    expect('').not.toMatch(EVIDENCE_PATH_PATTERN);
  });

  it('version constants are pinned', () => {
    expect(AUTHORIZATION_CONTRACT_VERSION).toBe('1.0.0');
    expect(AUTHORIZATION_RECORD_VERSION).toBe(1);
  });

  it('the schema surface is complete, unique, and sorted', () => {
    const types = AUTHORIZATION_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toEqual([...types].sort());
    for (const entry of AUTHORIZATION_SCHEMA_SURFACE) {
      expect(entry.schema, entry.type).toBeDefined();
    }
  });
});
