// Policy schema + scope matching tests (positive and negative).
import { describe, expect, it } from 'vitest';
import { matchesScope, policyDocumentSchema } from '../src';
import { policy, target } from './helpers';

describe('policy document schema (positive)', () => {
  it('accepts a valid policy', () => {
    const parsed = policyDocumentSchema.safeParse(
      policy({
        id: 'platform-defaults',
        precedence: { tier: 'platform', rank: 10 },
        bindings: [{ constraintId: 'pressure-below-max', constraintVersion: '1.0.0' }],
      }),
    );
    expect(parsed.success).toBe(true);
  });

  it('accepts an empty scope (universal applicability)', () => {
    const parsed = policyDocumentSchema.safeParse(policy({ id: 'global', applicability: {} }));
    expect(parsed.success).toBe(true);
  });
});

describe('policy document schema (negative: malformed policies rejected)', () => {
  it('rejects unknown keys (strict shape)', () => {
    const bad = { ...policy({ id: 'x' }), unknown: true };
    expect(policyDocumentSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects unknown precedence tiers and compositions', () => {
    expect(
      policyDocumentSchema.safeParse(
        policy({ id: 'x', precedence: { tier: 'galaxy' as never, rank: 0 } }),
      ).success,
    ).toBe(false);
    expect(
      policyDocumentSchema.safeParse(policy({ id: 'x', composition: 'replace' as never })).success,
    ).toBe(false);
  });

  it('rejects negative or non-integer ranks', () => {
    expect(
      policyDocumentSchema.safeParse(
        policy({ id: 'x', precedence: { tier: 'tenant', rank: -1 } }),
      ).success,
    ).toBe(false);
    expect(
      policyDocumentSchema.safeParse(
        policy({ id: 'x', precedence: { tier: 'tenant', rank: 1.5 } }),
      ).success,
    ).toBe(false);
  });

  it('rejects empty binding lists', () => {
    expect(policyDocumentSchema.safeParse(policy({ id: 'x', bindings: [] })).success).toBe(false);
  });

  it('rejects a wrong language version gate', () => {
    expect(
      policyDocumentSchema.safeParse({ ...policy({ id: 'x' }), languageVersion: '2.0.0' }).success,
    ).toBe(false);
  });

  it('rejects malformed binding constraint ids', () => {
    expect(
      policyDocumentSchema.safeParse(
        policy({ id: 'x', bindings: [{ constraintId: 'NOT_KEBAB' }] }),
      ).success,
    ).toBe(false);
  });
});

describe('matchesScope (positive)', () => {
  it('empty scope matches everything', () => {
    expect(matchesScope({}, {})).toBe(true);
    expect(matchesScope({}, target)).toBe(true);
  });

  it('matches exact tenant/workspace/project', () => {
    expect(matchesScope({ tenantId: 'tenant-1' }, target)).toBe(true);
    expect(matchesScope({ tenantId: 'tenant-2' }, target)).toBe(false);
    expect(matchesScope({ workspaceId: 'ws-1' }, target)).toBe(true);
    expect(matchesScope({ projectId: 'proj-1', tenantId: 'tenant-1' }, target)).toBe(true);
  });

  it('matches actionKinds and resourceTypes membership', () => {
    expect(matchesScope({ actionKinds: ['deploy', 'delete'] }, target)).toBe(true);
    expect(matchesScope({ actionKinds: ['read'] }, target)).toBe(false);
    expect(matchesScope({ resourceTypes: ['cluster'] }, target)).toBe(true);
    expect(matchesScope({ resourceTypes: ['cluster', 'bucket'] }, target)).toBe(true);
  });

  it('matches tag allOf/anyOf semantics', () => {
    expect(matchesScope({ tags: { allOf: ['production'] } }, target)).toBe(true);
    expect(matchesScope({ tags: { allOf: ['production', 'staging'] } }, target)).toBe(false);
    expect(matchesScope({ tags: { anyOf: ['staging', 'critical'] } }, target)).toBe(true);
    expect(matchesScope({ tags: { anyOf: ['staging'] } }, target)).toBe(false);
    expect(matchesScope({ tags: { allOf: ['production'], anyOf: ['critical'] } }, target)).toBe(
      true,
    );
  });

  it('all present matchers must match (AND semantics)', () => {
    expect(
      matchesScope({ tenantId: 'tenant-1', actionKinds: ['read'] }, target),
    ).toBe(false);
  });
});

describe('matchesScope (negative: fail-closed totality)', () => {
  it('a matcher for an absent target field never matches', () => {
    expect(matchesScope({ projectId: 'proj-1' }, { tenantId: 'tenant-1' })).toBe(false);
    expect(matchesScope({ actionKinds: ['deploy'] }, {})).toBe(false);
    expect(matchesScope({ tags: { allOf: ['production'] } }, {})).toBe(false);
  });

  it('malformed scopes never match and never throw', () => {
    const malformed: unknown[] = [null, undefined, 42, 'scope', [], { tenantId: '' }, { actionKinds: [] }];
    for (const scope of malformed) {
      expect(() => matchesScope(scope, target)).not.toThrow();
      expect(matchesScope(scope, target)).toBe(false);
    }
    // Note: `{ tags: {} }` is a VALID empty tag matcher (matches everything).
    expect(matchesScope({ tags: {} }, target)).toBe(true);
  });

  it('malformed targets never match and never throw', () => {
    const malformed: unknown[] = [null, undefined, 42, 'target', [], { tenantId: '' }, { tags: 'x' }];
    for (const badTarget of malformed) {
      expect(() => matchesScope({}, badTarget)).not.toThrow();
      expect(matchesScope({}, badTarget)).toBe(false);
    }
  });
});
