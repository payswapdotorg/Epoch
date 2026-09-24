// Digest-machinery parity evidence (mirror policy): NIST FIPS 180-4
// test vectors, a node:crypto cross-check over a deterministic
// pseudo-random byte corpus, and a canonical-JSON fixture corpus. Two
// implementations that agree with the standard and with node:crypto
// produce identical content addresses for identical content — the
// equivalence the mirror requires (deliberate-duplication policy, see
// src/version.ts).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CanonicalizationError,
  canonicalJsonStringify,
  sha256BytesHex,
  sha256Hex,
  type JsonValue,
} from '../src/index';
import { syntheticBytes } from './helpers';

// NIST FIPS 180-4 test vectors (SHA-256).
const NIST_VECTORS: ReadonlyArray<{ input: string; digest: string }> = [
  { input: 'abc', digest: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' },
  {
    input:
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    digest: '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  },
  { input: '', digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
  { input: 'a', digest: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb' },
];

describe('SHA-256 NIST vectors (mirror correctness)', () => {
  it.each(NIST_VECTORS)('matches the NIST vector for %s', ({ input, digest }: { input: string; digest: string }) => {
    expect(sha256Hex(input)).toBe(digest);
  });

  it('matches the 64-byte a-repetition vector', () => {
    expect(sha256Hex('a'.repeat(64))).toBe('ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb');
  });
});

describe('node:crypto cross-check (byte corpus)', () => {
  it('agrees with node:crypto over deterministic pseudo-random corpora of many lengths', () => {
    for (let length = 0; length <= 300; length += 7) {
      for (const seed of [1, 42, 987654]) {
        const bytes = syntheticBytes(seed, length);
        const expected = createHash('sha256').update(bytes).digest('hex');
        expect(sha256BytesHex(bytes), `seed ${seed} len ${length}`).toBe(expected);
      }
    }
  });

  it('agrees with node:crypto over multi-block and boundary lengths (55/56/57/63/64/65/127/128/129)', () => {
    for (const length of [55, 56, 57, 63, 64, 65, 127, 128, 129, 1000, 4096]) {
      const bytes = syntheticBytes(length, length);
      const expected = createHash('sha256').update(bytes).digest('hex');
      expect(sha256BytesHex(bytes), `len ${length}`).toBe(expected);
    }
  });
});

describe('canonical JSON fixture corpus (mirror correctness)', () => {
  it('object key order is absorbed (equivalent objects serialize identically)', () => {
    expect(canonicalJsonStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJsonStringify({ a: 2, b: 1 })).toBe('{"a":2,"b":1}');
    const nested = { z: { y: [3, { b: true, a: null }], x: 's' } };
    expect(canonicalJsonStringify(nested)).toBe('{"z":{"x":"s","y":[3,{"a":null,"b":true}]}}');
  });

  it('no insignificant whitespace; strings escape via well-formed JSON.stringify', () => {
    expect(canonicalJsonStringify({ k: 'v' })).toBe('{"k":"v"}');
    expect(canonicalJsonStringify(['a', 'b'])).toBe('["a","b"]');
    expect(canonicalJsonStringify('quote"back\\slash\n\u0001')).toBe(
      JSON.stringify('quote"back\\slash\n\u0001'),
    );
  });

  it('numbers use ECMAScript serialization (-0 becomes "0"; large magnitudes exponent form)', () => {
    expect(canonicalJsonStringify({ n: -0 })).toBe('{"n":0}');
    expect(canonicalJsonStringify({ n: 1e21 })).toBe('{"n":1e+21}');
    expect(canonicalJsonStringify({ n: 1.5 })).toBe('{"n":1.5}');
  });

  it('undefined object members are omitted; null/booleans serialize as themselves', () => {
    expect(canonicalJsonStringify({ a: 1, b: undefined } as unknown as JsonValue)).toBe('{"a":1}');
    expect(canonicalJsonStringify([null, true, false])).toBe('[null,true,false]');
  });

  it('rejects undefined array elements and non-finite numbers with the typed error', () => {
    expect(() => canonicalJsonStringify([undefined] as unknown as never)).toThrow(CanonicalizationError);
    expect(() => canonicalJsonStringify({ n: Number.NaN } as unknown as JsonValue)).toThrow(
      CanonicalizationError,
    );
    expect(() => canonicalJsonStringify({ n: Number.POSITIVE_INFINITY } as unknown as JsonValue)).toThrow(
      CanonicalizationError,
    );
  });
});
