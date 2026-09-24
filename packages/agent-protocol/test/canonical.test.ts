// Canonical JSON serialization: determinism, stability, and rejection of
// non-representable values (positive and negative evidence for the
// exact-revision evidence addressing used across the protocols).
import { describe, expect, it } from 'vitest';
import {
  CanonicalizationError,
  canonicalJsonStringify,
  type JsonValue,
} from '../src/canonical';
import { canonicalDigest, sha256Hex } from '../src/digest';

describe('canonicalJsonStringify (positive)', () => {
  it('sorts object members by key regardless of insertion order', () => {
    const a = canonicalJsonStringify({ b: 1, a: 2 });
    const b = canonicalJsonStringify({ a: 2, b: 1 });
    expect(a).toBe('{"a":2,"b":1}');
    expect(b).toBe(a);
  });

  it('sorts nested members recursively', () => {
    const value = { z: { y: 1, x: 2 }, a: [{ q: false, p: null }] };
    expect(canonicalJsonStringify(value)).toBe(
      '{"a":[{"p":null,"q":false}],"z":{"x":2,"y":1}}',
    );
  });

  it('emits no insignificant whitespace', () => {
    expect(canonicalJsonStringify({ a: [1, 2], b: 'x' })).toBe('{"a":[1,2],"b":"x"}');
  });

  it('serializes scalars, empty containers, and arrays', () => {
    expect(canonicalJsonStringify(null)).toBe('null');
    expect(canonicalJsonStringify(true)).toBe('true');
    expect(canonicalJsonStringify(false)).toBe('false');
    expect(canonicalJsonStringify(0)).toBe('0');
    expect(canonicalJsonStringify(-0)).toBe('0');
    expect(canonicalJsonStringify(1.5)).toBe('1.5');
    expect(canonicalJsonStringify(1e21)).toBe('1e+21');
    expect(canonicalJsonStringify('hi')).toBe('"hi"');
    expect(canonicalJsonStringify([])).toBe('[]');
    expect(canonicalJsonStringify({})).toBe('{}');
    expect(canonicalJsonStringify([1, [2, [3]]])).toBe('[1,[2,[3]]]');
  });

  it('escapes strings with JSON escaping; non-ASCII passes through literally', () => {
    expect(canonicalJsonStringify('a"b\\c')).toBe('"a\\"b\\\\c"');
    expect(canonicalJsonStringify('line\nbreak\ttab')).toBe('"line\\nbreak\\ttab"');
    expect(canonicalJsonStringify('\u00e9\u4e2d\ud83d\ude00')).toBe('"é中😀"');
  });

  it('sorts keys in UTF-16 code-unit order', () => {
    // 'Z' (0x5A) sorts before 'a' (0x61) in code-unit order.
    expect(canonicalJsonStringify({ a: 1, Z: 2 })).toBe('{"Z":2,"a":1}');
  });

  it('is idempotent: parsing canonical output and re-serializing is stable', () => {
    const value: JsonValue = { b: [{ y: 1, x: [true, null] }], a: 's' };
    const once = canonicalJsonStringify(value);
    const twice = canonicalJsonStringify(JSON.parse(once) as JsonValue);
    expect(twice).toBe(once);
  });

  it('makes equivalent messages produce identical evidence digests', () => {
    const a = canonicalDigest({ proposal: 1, meta: { b: 2, a: [3] } });
    const b = canonicalDigest({ meta: { a: [3], b: 2 }, proposal: 1 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('canonicalJsonStringify (negative)', () => {
  it('rejects NaN and Infinity', () => {
    expect(() => canonicalJsonStringify(Number.NaN)).toThrow(CanonicalizationError);
    expect(() => canonicalJsonStringify(Number.POSITIVE_INFINITY)).toThrow(
      CanonicalizationError,
    );
    expect(() => canonicalJsonStringify(Number.NEGATIVE_INFINITY)).toThrow(
      CanonicalizationError,
    );
  });

  it('omits undefined-valued object members (same JSON value as absent keys)', () => {
    expect(canonicalJsonStringify({ a: undefined } as unknown as JsonValue)).toBe('{}');
    expect(canonicalJsonStringify({ a: 1, b: undefined } as unknown as JsonValue)).toBe(
      '{"a":1}',
    );
  });

  it('rejects undefined array elements', () => {
    expect(() => canonicalJsonStringify([undefined] as unknown as JsonValue)).toThrow(
      CanonicalizationError,
    );
  });

  it('rejects functions, symbols, and bigints', () => {
    expect(() =>
      canonicalJsonStringify({ a: () => 1 } as unknown as JsonValue),
    ).toThrow(CanonicalizationError);
    expect(() =>
      canonicalJsonStringify(Symbol('x') as unknown as JsonValue),
    ).toThrow(CanonicalizationError);
    expect(() => canonicalJsonStringify(1n as unknown as JsonValue)).toThrow(
      CanonicalizationError,
    );
  });
});

describe('sha256Hex (positive, NIST vectors)', () => {
  it('empty string', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('"abc"', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('two-block message (448-bit boundary)', () => {
    expect(
      sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    ).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('million "a" characters (multi-block stress)', () => {
    expect(sha256Hex('a'.repeat(1_000_000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });
});
