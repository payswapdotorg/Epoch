// SHA-256 cross-verification: the runtime-neutral implementation in
// src/digest.ts must agree with the platform implementation (node:crypto)
// for a deterministic battery of ASCII, unicode, and long inputs. The
// node:crypto use here is test-only reference material — the runtime
// implementation stays runtime-neutral.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalDigest, sha256Hex } from '../src/digest';

function reference(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** Deterministic pseudo-random string generator (xorshift32). */
function deterministicStrings(count: number): string[] {
  let state = 0x2f6e2b1 ^ 0x9e3779b9;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  const alphabet =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;-_@#€‱😀中Ω𝕫';
  const strings: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const length = next() % 512;
    let s = '';
    for (let j = 0; j < length; j += 1) {
      s += alphabet[next() % alphabet.length];
    }
    strings.push(s);
  }
  return strings;
}

describe('sha256Hex cross-verification against node:crypto', () => {
  it('agrees on a deterministic battery of pseudo-random strings', () => {
    for (const input of deterministicStrings(64)) {
      expect(sha256Hex(input)).toBe(reference(input));
    }
  });

  it('agrees on unicode and emoji inputs', () => {
    const inputs = ['Ω≠≈ç√∫', '😀🚀🧬', '中文测试', ' naïve café ', '𝕫𝕫𝕫'];
    for (const input of inputs) {
      expect(sha256Hex(input)).toBe(reference(input));
    }
  });

  it('agrees on boundary lengths around 55/56/64 byte padding edges', () => {
    for (let length = 0; length <= 200; length += 1) {
      const input = 'x'.repeat(length);
      expect(sha256Hex(input)).toBe(reference(input));
    }
  });

  it('agrees on a long multi-block input', () => {
    const input = 'w'.repeat(100_000);
    expect(sha256Hex(input)).toBe(reference(input));
  });
});

describe('canonicalDigest', () => {
  it('digests the canonical form: key order does not matter', () => {
    const a = canonicalDigest({ x: 1, y: { b: 2, a: 3 } });
    const b = canonicalDigest({ y: { a: 3, b: 2 }, x: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('distinct values produce distinct digests', () => {
    expect(canonicalDigest({ a: 1 })).not.toBe(canonicalDigest({ a: 2 }));
    expect(canonicalDigest([1, 2])).not.toBe(canonicalDigest([2, 1]));
  });
});
