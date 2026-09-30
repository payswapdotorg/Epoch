/**
 * @epoch/mobile — pure TypeScript SHA-256 (W049 product runtime).
 *
 * The field product computes evidence digests BEFORE upload (the W049
 * digest-addressing invariant: the capture references the digest, never a
 * local path/bytes), so the mobile host needs a SHA-256 implementation that
 * runs identically on Node (test/harness), on the device JavaScript runtime
 * (device) and in CI — with NO platform-native dependency (the catalog pins
 * no crypto package for apps/mobile; the device JS runtime exposes no synchronous
 * digest; the authority ALWAYS recomputes server-side, so this is the
 * client-side pre-computation seam, not a verification authority).
 *
 * FIPS 180-4 implementation over Uint8Array. Correctness is pinned by
 * test/product/sha256.test.ts against:
 *  - the NIST/NSA standard test vectors (empty, "abc", two-block "abc...",
 *    the million-'a' vector);
 *  - node:crypto createHash cross-checks over deterministic byte spans
 *    (the Node-only comparison lives in the test file, never in src).
 */
import type { Sha256Hex } from '@epoch/agent-protocol';

/** The SHA-256 round constants K (FIPS 180-4, 4.2.2). */
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

/** The initial hash state H0 (FIPS 180-4, 5.3.3). */
const H0 = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
] as const;

/** rotr(x, n) — the rotate-right primitive (32-bit). */
function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

/** The message schedule + compression over one 64-byte block. */
function compress(
  state: readonly number[],
  block: Uint8Array,
  blockOffset: number,
): number[] {
  const w = new Array<number>(64);
  for (let t = 0; t < 16; t += 1) {
    const i = blockOffset + t * 4;
    w[t] =
      ((block[i]! << 24) | (block[i + 1]! << 16) | (block[i + 2]! << 8) | block[i + 3]!) >>> 0;
  }
  for (let t = 16; t < 64; t += 1) {
    const s0 = rotr(w[t - 15]!, 7) ^ rotr(w[t - 15]!, 18) ^ (w[t - 15]! >>> 3);
    const s1 = rotr(w[t - 2]!, 17) ^ rotr(w[t - 2]!, 19) ^ (w[t - 2]! >>> 10);
    w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) >>> 0;
  }
  let [a, b, c, d, e, f, g, h] = state;
  for (let t = 0; t < 64; t += 1) {
    const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
    const ch = (e & f) ^ (~e & g);
    const temp1 = (h + S1 + ch + K[t]! + w[t]!) >>> 0;
    const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const temp2 = (S0 + maj) >>> 0;
    h = g;
    g = f;
    f = e;
    e = (d + temp1) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (temp1 + temp2) >>> 0;
  }
  return [
    (state[0]! + a) >>> 0,
    (state[1]! + b) >>> 0,
    (state[2]! + c) >>> 0,
    (state[3]! + d) >>> 0,
    (state[4]! + e) >>> 0,
    (state[5]! + f) >>> 0,
    (state[6]! + g) >>> 0,
    (state[7]! + h) >>> 0,
  ];
}

const HEX = '0123456789abcdef' as const;

/**
 * SHA-256 over raw bytes (FIPS 180-4): padding, the 64-bit big-endian bit
 * length, one block at a time. Deterministic, allocation-bounded (two
 * buffers), zero platform APIs.
 */
export function sha256Bytes(bytes: Uint8Array): Uint8Array {
  const bitLength = bytes.length * 8;
  // Padding: 0x80, zeros, then the 64-bit big-endian bit length (total a
  // multiple of 64 bytes; the length field never overflows for field-sized
  // payloads — checked defensively).
  if (!Number.isSafeInteger(bitLength) || bitLength >= 2 ** 53) {
    throw new RangeError('sha256Bytes: payload too large for the 64-bit length field');
  }
  const paddedLength = ((bytes.length + 8) >> 6) + 1;
  const totalLength = paddedLength * 64;
  const padded = new Uint8Array(totalLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  // The high 32 bits of the bit length (zero for every realistic payload).
  const high = Math.floor(bitLength / 2 ** 32);
  const low = bitLength >>> 0;
  padded[totalLength - 8] = (high >>> 24) & 0xff;
  padded[totalLength - 7] = (high >>> 16) & 0xff;
  padded[totalLength - 6] = (high >>> 8) & 0xff;
  padded[totalLength - 5] = high & 0xff;
  padded[totalLength - 4] = (low >>> 24) & 0xff;
  padded[totalLength - 3] = (low >>> 16) & 0xff;
  padded[totalLength - 2] = (low >>> 8) & 0xff;
  padded[totalLength - 1] = low & 0xff;

  let state: number[] = [...H0];
  for (let offset = 0; offset < totalLength; offset += 64) {
    state = compress(state, padded, offset);
  }
  const digest = new Uint8Array(32);
  for (let i = 0; i < 8; i += 1) {
    digest[i * 4] = (state[i]! >>> 24) & 0xff;
    digest[i * 4 + 1] = (state[i]! >>> 16) & 0xff;
    digest[i * 4 + 2] = (state[i]! >>> 8) & 0xff;
    digest[i * 4 + 3] = state[i]! & 0xff;
  }
  return digest;
}

/** SHA-256 over raw bytes as the lowercase 64-char hex digest (the W006/W046 grammar). */
export function sha256Hex(bytes: Uint8Array): Sha256Hex {
  const digest = sha256Bytes(bytes);
  let out = '';
  for (const byte of digest) {
    out += HEX[byte >> 4];
    out += HEX[byte & 0xf];
  }
  return out as Sha256Hex;
}

/** SHA-256 over a UTF-8 string (text notes) as the hex digest. */
export function sha256Text(text: string): Sha256Hex {
  const bytes = new TextEncoder().encode(text);
  return sha256Hex(bytes);
}
