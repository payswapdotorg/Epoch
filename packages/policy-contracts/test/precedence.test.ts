// Precedence + composition-of-bindings resolution tests (positive and
// negative), including determinism under shuffled input order.
import { describe, expect, it } from 'vitest';
import { resolveApplicablePolicies } from '../src';
import type { PolicyDocument } from '../src';
import { policy, target } from './helpers';

function resolveOk(policies: unknown, targetValue: unknown = target) {
  const outcome = resolveApplicablePolicies(policies, targetValue);
  expect(outcome.ok, JSON.stringify(outcome)).toBe(true);
  if (outcome.ok) return outcome.resolution;
  throw new Error('unreachable');
}

const bind = (id: string) => ({ constraintId: `${id}-c` });

describe('resolveApplicablePolicies (positive)', () => {
  it('returns an empty resolution when no policy is applicable', () => {
    const resolution = resolveOk([
      policy({ id: 'a', applicability: { tenantId: 'other' }, bindings: [bind('a')] }),
    ]);
    expect(resolution.applicable).toEqual([]);
    expect(resolution.bindings).toEqual([]);
    expect(resolution.trace).toEqual([]);
  });

  it('collects bindings from a single applicable policy', () => {
    const resolution = resolveOk([
      policy({ id: 'a', bindings: [{ constraintId: 'x-1' }, { constraintId: 'x-2' }] }),
    ]);
    expect(resolution.applicable.map((p) => p.policyId)).toEqual(['a']);
    expect(resolution.bindings.map((b) => b.constraintId)).toEqual(['x-1', 'x-2']);
  });

  it('orders applicable policies by precedence, highest first', () => {
    const resolution = resolveOk([
      policy({ id: 'project-a', precedence: { tier: 'project', rank: 9 } }),
      policy({ id: 'platform-a', precedence: { tier: 'platform', rank: 0 } }),
      policy({ id: 'tenant-a', precedence: { tier: 'tenant', rank: 0 } }),
      policy({ id: 'workspace-a', precedence: { tier: 'workspace', rank: 0 } }),
    ]);
    expect(resolution.applicable.map((p) => p.policyId)).toEqual([
      'platform-a',
      'tenant-a',
      'workspace-a',
      'project-a',
    ]);
  });

  it('breaks tier ties by rank, then by id (deterministic total order)', () => {
    const resolution = resolveOk([
      policy({ id: 'zz', precedence: { tier: 'tenant', rank: 5 } }),
      policy({ id: 'aa', precedence: { tier: 'tenant', rank: 5 } }),
      policy({ id: 'mm', precedence: { tier: 'tenant', rank: 7 } }),
    ]);
    // Highest rank first; within equal (tier, rank) the total order is by id
    // ascending, so the reversed display list puts the lexicographically
    // greater id first.
    expect(resolution.applicable.map((p) => p.policyId)).toEqual(['mm', 'zz', 'aa']);
  });

  it('unions bindings across additive policies', () => {
    const resolution = resolveOk([
      policy({ id: 'low', precedence: { tier: 'project', rank: 0 }, bindings: [bind('low')] }),
      policy({ id: 'high', precedence: { tier: 'workspace', rank: 0 }, bindings: [bind('high')] }),
    ]);
    expect(resolution.bindings.map((b) => b.constraintId)).toEqual(['high-c', 'low-c']);
  });

  it('override policies replace lower-precedence bindings', () => {
    const resolution = resolveOk([
      policy({
        id: 'p1',
        precedence: { tier: 'project', rank: 0 },
        bindings: [bind('p1'), { constraintId: 'shared-c' }],
      }),
      policy({
        id: 'p2',
        precedence: { tier: 'workspace', rank: 0 },
        bindings: [bind('p2'), { constraintId: 'shared-c' }],
      }),
      policy({
        id: 'p3',
        precedence: { tier: 'tenant', rank: 0 },
        composition: 'override',
        bindings: [bind('p3')],
      }),
      policy({
        id: 'p4',
        precedence: { tier: 'platform', rank: 0 },
        bindings: [bind('p4')],
      }),
    ]);
    // p3 (override) resets everything accumulated from p1/p2; p4 (platform,
    // additive) adds on top. The effective set is exactly p4 + p3.
    expect(resolution.bindings.map((b) => b.constraintId)).toEqual(['p4-c', 'p3-c']);
    expect(resolution.trace).toEqual([
      { policyId: 'p1', action: 'add', bindingsAdded: 2, effectiveBindingCount: 2 },
      { policyId: 'p2', action: 'add', bindingsAdded: 2, effectiveBindingCount: 3 },
      { policyId: 'p3', action: 'reset', bindingsAdded: 1, effectiveBindingCount: 1 },
      { policyId: 'p4', action: 'add', bindingsAdded: 1, effectiveBindingCount: 2 },
    ]);
  });

  it('a higher-precedence re-binding of the same constraint wins', () => {
    const resolution = resolveOk([
      policy({
        id: 'low',
        precedence: { tier: 'project', rank: 0 },
        bindings: [{ constraintId: 'shared-c', constraintVersion: '1.0.0' }],
      }),
      policy({
        id: 'high',
        precedence: { tier: 'workspace', rank: 0 },
        bindings: [{ constraintId: 'shared-c', constraintVersion: '2.0.0' }],
      }),
    ]);
    expect(resolution.bindings).toEqual([{ constraintId: 'shared-c', constraintVersion: '2.0.0' }]);
  });

  it('ignores disabled policies', () => {
    const resolution = resolveOk([
      policy({ id: 'off', enabled: false, bindings: [bind('off')] }),
      policy({ id: 'on', bindings: [bind('on')] }),
    ]);
    expect(resolution.applicable.map((p) => p.policyId)).toEqual(['on']);
    expect(resolution.bindings.map((b) => b.constraintId)).toEqual(['on-c']);
  });

  it('ignores policies whose scope does not match the target', () => {
    const resolution = resolveOk([
      policy({ id: 'other-tenant', applicability: { tenantId: 'tenant-2' } }),
      policy({ id: 'matching', applicability: { tenantId: 'tenant-1' } }),
    ]);
    expect(resolution.applicable.map((p) => p.policyId)).toEqual(['matching']);
  });

  it('is deterministic under shuffled policy input order', () => {
    const documents: PolicyDocument[] = [
      policy({ id: 'a', precedence: { tier: 'tenant', rank: 1 } }),
      policy({ id: 'b', precedence: { tier: 'platform', rank: 0 }, composition: 'override' }),
      policy({ id: 'c', precedence: { tier: 'workspace', rank: 2 } }),
      policy({ id: 'd', precedence: { tier: 'project', rank: 3 } }),
    ];
    const first = resolveOk(documents);
    const shuffled = resolveOk([...documents].reverse());
    expect(shuffled).toStrictEqual(first);
  });
});

describe('resolveApplicablePolicies (negative: invalid input rejected)', () => {
  it('rejects malformed policy documents with typed issues', () => {
    const outcome = resolveApplicablePolicies(
      [{ ...policy({ id: 'bad' }), precedence: { tier: 'universe', rank: 0 } }],
      target,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.issues[0].path.startsWith('$.policies[0]')).toBe(true);
  });

  it('rejects duplicate policy ids', () => {
    const outcome = resolveApplicablePolicies([policy({ id: 'dup' }), policy({ id: 'dup' })], target);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.issues.some((issue) => issue.code === 'duplicate-policy-id')).toBe(true);
  });

  it('rejects duplicate bindings inside one policy', () => {
    const outcome = resolveApplicablePolicies(
      [policy({ id: 'dup-bind', bindings: [bind('x'), bind('x')] })],
      target,
    );
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.issues.some((issue) => issue.code === 'duplicate-binding')).toBe(true);
  });

  it('rejects malformed targets', () => {
    const outcome = resolveApplicablePolicies([policy({ id: 'a' })], { tenantId: '' });
    expect(outcome.ok).toBe(false);
  });

  it('never throws on arbitrary garbage', () => {
    const garbage: unknown[] = [null, 42, 'policies', {}, [[]], [{ nope: true }]];
    for (const value of garbage) {
      expect(() => resolveApplicablePolicies(value, target)).not.toThrow();
    }
    expect(() => resolveApplicablePolicies([policy({ id: 'a' })], null)).not.toThrow();
    const deep: unknown = { a: { b: { c: { d: 1 } } } };
    let current = deep;
    for (let i = 0; i < 300; i += 1) {
      current = { nested: current };
    }
    expect(() => resolveApplicablePolicies([current], target)).not.toThrow();
  });
});
