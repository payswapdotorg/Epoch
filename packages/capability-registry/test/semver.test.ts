// Semver machinery: parse, total order, and constraint satisfaction
// (exact + caret incl. the npm 0.x carve-outs).
import { describe, expect, it } from 'vitest';
import {
  compareSemver,
  parseSemverCore,
  satisfiesVersionConstraint,
  VersionConstraintSchema,
} from '../src/index';

describe('parseSemverCore', () => {
  it.each([
    ['1.2.3', { major: 1, minor: 2, patch: 3 }],
    ['0.0.0', { major: 0, minor: 0, patch: 0 }],
    ['10.20.30', { major: 10, minor: 20, patch: 30 }],
  ])('parses %s', (input, parts) => {
    const parsed = parseSemverCore(input);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.parts).toEqual(parts);
  });

  it.each(['1.2', '1.2.3.4', 'v1.2.3', '1.2.3-beta', '', '1..3', 'a.b.c', '1.2.x'])(
    'rejects malformed %s',
    (input) => {
      const parsed = parseSemverCore(input);
      expect(parsed.ok, input).toBe(false);
    },
  );
});

describe('compareSemver (total order)', () => {
  it.each([
    ['1.0.0', '1.0.0', 0],
    ['1.0.0', '1.0.1', -1],
    ['1.0.1', '1.0.0', 1],
    ['1.0.0', '1.1.0', -1],
    ['1.9.0', '1.10.0', -1],
    ['1.255.0', '2.0.0', -1],
    ['0.2.0', '1.0.0', -1],
  ])('compare(%s, %s) === %d', (a, b, expected) => {
    expect(Math.sign(compareSemver(a, b))).toBe(expected);
  });

  it('is antisymmetric and transitive over a sorted corpus', () => {
    const versions = ['0.1.0', '1.0.0', '1.0.1', '1.2.0', '1.10.0', '2.0.0', '10.0.0'];
    const sorted = [...versions].sort(compareSemver);
    expect(sorted).toEqual(versions);
    for (let i = 0; i < sorted.length - 1; i += 1) {
      expect(compareSemver(sorted[i]!, sorted[i + 1]!)).toBeLessThan(0);
      expect(compareSemver(sorted[i + 1]!, sorted[i]!)).toBeGreaterThan(0);
    }
  });
});

describe('satisfiesVersionConstraint', () => {
  const exact = (version: string) => ({ kind: 'exact' as const, version });
  const caret = (version: string) => ({ kind: 'caret' as const, version });

  it.each([
    ['1.2.3', exact('1.2.3'), true],
    ['1.2.4', exact('1.2.3'), false],
    ['1.2.3', caret('1.2.3'), true],
    ['1.9.9', caret('1.2.3'), true],
    ['2.0.0', caret('1.2.3'), false],
    ['1.2.2', caret('1.2.3'), false],
    ['1.2.3', caret('1.0.0'), true],
    ['0.2.9', caret('0.2.3'), true],
    ['0.3.0', caret('0.2.3'), false],
    ['0.2.2', caret('0.2.3'), false],
    ['0.0.3', caret('0.0.3'), true],
    ['0.0.4', caret('0.0.3'), false],
  ])('%s satisfies %j: %s', (candidate, constraint, expected) => {
    expect(satisfiesVersionConstraint(candidate, constraint)).toBe(expected);
  });

  it('a malformed candidate satisfies nothing (total function)', () => {
    expect(satisfiesVersionConstraint('nope', exact('1.0.0'))).toBe(false);
    expect(satisfiesVersionConstraint('nope', caret('1.0.0'))).toBe(false);
  });
});

describe('VersionConstraintSchema', () => {
  it('accepts well-formed constraints and rejects malformed anchor versions', () => {
    expect(VersionConstraintSchema.safeParse({ kind: 'exact', version: '1.2.3' }).success).toBe(
      true,
    );
    expect(VersionConstraintSchema.safeParse({ kind: 'caret', version: '0.2.0' }).success).toBe(
      true,
    );
    expect(VersionConstraintSchema.safeParse({ kind: 'exact', version: '1.2' }).success).toBe(
      false,
    );
    expect(VersionConstraintSchema.safeParse({ kind: 'wildcard', version: '*' }).success).toBe(
      false,
    );
    expect(VersionConstraintSchema.safeParse({ kind: 'caret' }).success).toBe(false);
  });

  it('rejects unknown fields inside a constraint (strict objects)', () => {
    expect(
      VersionConstraintSchema.safeParse({ kind: 'exact', version: '1.0.0', channel: 'beta' })
        .success,
    ).toBe(false);
  });
});
