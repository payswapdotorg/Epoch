import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/sha256';

// Deterministic pseudo-random bytes (xorshift32) for the node:crypto
// cross-check — no flakiness, full coverage of message lengths.
function* seededBytes(seed: number, length: number): Generator<number> {
  let state = seed >>> 0 || 0x9e3779b9;
  for (let i = 0; i < length; i += 1) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    yield state & 0xff;
  }
}

function randomBytes(seed: number, length: number): Uint8Array {
  return Uint8Array.from(seededBytes(seed, length));
}

describe('sha256Hex', () => {
  // NIST/FIPS 180-4 test vectors.
  it('matches the empty-string vector', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('matches the abc vector', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('matches the 448-bit vector', () => {
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('matches the million-a vector', () => {
    expect(sha256Hex('a'.repeat(1_000_000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });

  it('agrees with node:crypto across many lengths (block boundaries included)', () => {
    for (let length = 0; length <= 600; length += 7) {
      const bytes = randomBytes(length * 2654435761 + 1, length);
      const utf8 = new TextDecoder().decode(bytes);
      const expected = createHash('sha256').update(bytes).digest('hex');
      expect(sha256Hex(bytes), `length ${length} (bytes)`).toBe(expected);
      if (utf8 !== undefined) {
        const expectedString = createHash('sha256').update(utf8, 'utf8').digest('hex');
        expect(sha256Hex(utf8), `length ${length} (string)`).toBe(expectedString);
      }
    }
  });

  it('handles multi-byte UTF-8 and surrogate pairs', () => {
    const sample = 'héllo wörld — 🚀🛰️ 你好，世界';
    expect(sha256Hex(sample)).toBe(createHash('sha256').update(sample, 'utf8').digest('hex'));
  });
});
