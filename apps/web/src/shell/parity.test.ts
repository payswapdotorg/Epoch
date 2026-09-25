// RUNTIME PARITY with the merged upstream contract surfaces, through
// devDependencies ONLY (the W009 authorization W004-parity precedent): the
// shell-owned mirrors in src/shell/version.ts are identical, at runtime,
// to the upstream vocabularies and patterns. The web app has ZERO runtime
// coupling with these packages — shell source never imports them (pinned
// by isolation.test.ts); only this devDependency test does.
//
//   @epoch/tenancy              — tenant/workspace/project id patterns
//   @epoch/identity             — principal vocabulary + id pattern
//   @epoch/authorization        — denial-code vocabulary + principal status
//   @epoch/experience-protocol  — Experience Graph kinds
//   @epoch/experience-compiler  — the graph-kind -> plan-stage compile table
import { describe, expect, it } from 'vitest';
import {
  PROJECT_ID_PATTERN as TENANCY_PROJECT,
  TENANT_ID_PATTERN as TENANCY_TENANT,
  WORKSPACE_ID_PATTERN as TENANCY_WORKSPACE,
} from '@epoch/tenancy';
import {
  PRINCIPAL_ID_PATTERN as IDENTITY_PRINCIPAL,
  PRINCIPAL_KINDS as IDENTITY_KINDS,
  PRINCIPAL_LIFECYCLE_STATES as IDENTITY_LIFECYCLE,
} from '@epoch/identity';
import {
  DENIAL_CODES as AUTHORIZATION_DENIALS,
  PRINCIPAL_STATUSES as AUTHORIZATION_STATUSES,
} from '@epoch/authorization';
import { EXPERIENCE_GRAPH_KINDS as PROTOCOL_GRAPH_KINDS } from '@epoch/experience-protocol';
import { PLAN_KIND_STAGE_KINDS as COMPILER_KIND_TABLE } from '@epoch/experience-compiler';
import {
  EXPERIENCE_GRAPH_KINDS,
  EXPERIENCE_SLOT_GRAPH_KINDS,
  EXPERIENCE_SLOT_IDS,
  MIRRORED_AUTHORIZATION_DENIAL_CODES,
  NAVIGATION_DENIAL_CODES,
  PRINCIPAL_ID_PATTERN,
  PRINCIPAL_KINDS,
  PRINCIPAL_STATUSES,
  PROJECT_ID_PATTERN,
  TENANT_ID_PATTERN,
  WORKSPACE_ID_PATTERN,
} from './version';

// Compile-time pins live in ./parity.types.ts (verified by tsc --noEmit).

describe('shell parity with upstream contracts (devDependency pins)', () => {
  it('tenant/workspace/project id patterns mirror @epoch/tenancy exactly', () => {
    expect(TENANT_ID_PATTERN.source).toBe(TENANCY_TENANT.source);
    expect(TENANT_ID_PATTERN.flags).toBe(TENANCY_TENANT.flags);
    expect(WORKSPACE_ID_PATTERN.source).toBe(TENANCY_WORKSPACE.source);
    expect(PROJECT_ID_PATTERN.source).toBe(TENANCY_PROJECT.source);
    // Spot-check the shared grammar.
    expect(TENANT_ID_PATTERN.test('tenant:acme')).toBe(true);
    expect(TENANT_ID_PATTERN.test('Tenant:ACME')).toBe(false);
  });

  it('principal vocabulary mirrors @epoch/identity exactly', () => {
    expect([...PRINCIPAL_KINDS]).toEqual([...IDENTITY_KINDS]);
    expect([...PRINCIPAL_STATUSES]).toEqual([...IDENTITY_LIFECYCLE]);
    expect(PRINCIPAL_ID_PATTERN.source).toBe(IDENTITY_PRINCIPAL.source);
  });

  it('principal status mirrors @epoch/authorization exactly', () => {
    expect([...PRINCIPAL_STATUSES]).toEqual([...AUTHORIZATION_STATUSES]);
  });

  it('mirrored navigation denial codes are a subset of @epoch/authorization DENIAL_CODES', () => {
    for (const code of MIRRORED_AUTHORIZATION_DENIAL_CODES) {
      expect([...AUTHORIZATION_DENIALS]).toContain(code);
    }
    // The full navigation vocabulary is shell-owned + mirrored codes.
    expect([...NAVIGATION_DENIAL_CODES].sort()).toEqual(
      [
        ...MIRRORED_AUTHORIZATION_DENIAL_CODES,
        'insufficient-permissions',
        'malformed-route',
        'unknown-route',
      ].sort(),
    );
  });

  it('Experience Graph kinds mirror @epoch/experience-protocol exactly', () => {
    expect([...EXPERIENCE_GRAPH_KINDS]).toEqual([...PROTOCOL_GRAPH_KINDS]);
  });

  it('the Experience slots partition the graph kinds exactly (total + disjoint)', () => {
    const covered: string[] = [];
    for (const slot of EXPERIENCE_SLOT_IDS) {
      for (const kind of EXPERIENCE_SLOT_GRAPH_KINDS[slot]) {
        expect(covered, `graph kind '${kind}' claimed by more than one slot`).not.toContain(kind);
        covered.push(kind);
      }
    }
    expect([...covered].sort()).toEqual([...EXPERIENCE_GRAPH_KINDS].sort());
  });

  it('the compiler admits a plan for every graph kind the shell can host (compile-table seam)', () => {
    const compilerKinds = Object.keys(COMPILER_KIND_TABLE).sort();
    expect(compilerKinds).toEqual([...EXPERIENCE_GRAPH_KINDS].sort());
    for (const slot of EXPERIENCE_SLOT_IDS) {
      for (const kind of EXPERIENCE_SLOT_GRAPH_KINDS[slot]) {
        expect(COMPILER_KIND_TABLE).toHaveProperty(kind);
      }
    }
  });
});
