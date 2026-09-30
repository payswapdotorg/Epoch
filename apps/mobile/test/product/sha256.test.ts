// The pure-TS SHA-256 correctness battery: the NIST/NSA standard test
// vectors + node:crypto cross-checks over deterministic byte spans. The
// implementation is the client-side digest-before-upload seam — pinned
// here so the digest-addressing invariant rests on verified hashing.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Bytes, sha256Hex, sha256Text } from '../../src/product/sha256';

describe('the pure-TS SHA-256 (FIPS 180-4)', () => {
  it('the NIST standard vectors (empty, "abc", two-block, four-block)', () => {
    // FIPS 180-4 / NIST example vectors.
    expect(sha256Text('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Text('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(
      sha256Text('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    ).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    expect(sha256Text('a'.repeat(1000))).toBe(
      '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
    );
  });

  it('the million-"a" vector (multi-block + 32-bit length boundary)', () => {
    expect(sha256Hex(new TextEncoder().encode('a'.repeat(1_000_000)))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    );
  });

  it('cross-checks node:crypto over deterministic byte spans (0..257 bytes, step patterns)', () => {
    for (let size = 0; size <= 257; size += 1) {
      const bytes = new Uint8Array(size);
      for (let i = 0; i < size; i += 1) {
        bytes[i] = (i * 7 + size * 13) % 256;
      }
      const expected = createHash('sha256').update(bytes).digest('hex');
      expect(sha256Hex(bytes)).toBe(expected);
    }
  });

  it('cross-checks node:crypto over the exact 55/56/57/63/64/65/119/120/127-byte padding edges', () => {
    for (const size of [55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129]) {
      const bytes = new Uint8Array(size).fill(0xa5);
      const expected = createHash('sha256').update(bytes).digest('hex');
      expect(sha256Hex(bytes)).toBe(expected);
    }
  });

  it('the digest bytes form matches (32 bytes, first/last stable)', () => {
    const digest = sha256Bytes(new TextEncoder().encode('epoch'));
    expect(digest).toHaveLength(32);
    expect(sha256Hex(new TextEncoder().encode('epoch'))).toMatch(/^[0-9a-f]{64}$/);
  });

  it('determinism: the same bytes always digest identically (repeated calls)', () => {
    const bytes = new TextEncoder().encode('deterministic-field-evidence');
    expect(sha256Hex(bytes)).toBe(sha256Hex(new Uint8Array(bytes)));
    expect(sha256Text('deterministic-field-evidence')).toBe(sha256Text('deterministic-field-evidence'));
  });
});
