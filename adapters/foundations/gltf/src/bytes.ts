/**
 * The bridge's deterministic byte primitives (W060) — pure code, zero
 * dependencies, runtime-neutral (web/desktop/Node alike; lock rule 14):
 *
 * - SHA-256 over raw BYTES (FIPS 180-4). The kernel's
 *   @epoch/agent-protocol exports `sha256Hex(string)` (UTF-8); binary
 *   content-addressing needs the byte form, so this module implements the
 *   same algorithm over Uint8Array. Correctness evidence: `test/bytes.test.ts`
 *   verifies the NIST test vectors and cross-checks byte/string digests over
 *   pure-ASCII inputs (where both must agree).
 *
 * - RFC 4648 base64 decoding (strict: canonical alphabet + mandatory
 *   padding) for glTF data-URI buffers. Invalid padding/alphabet is a typed
 *   refusal, never a silent decode.
 *
 * - ASCII/JSON sniffing helpers for container detection.
 */

// SHA-256 round constants (first 32 bits of the fractional parts of the cube
// roots of the first 64 primes) — identical to the kernel implementation.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

/** Lowercase hexadecimal SHA-256 digest of raw bytes (exactly 64 chars). */
export function sha256HexOfBytes(bytes: Uint8Array): string {
  const data = bytes;
  const bitLength = data.length * 8;
  const blockCount = Math.ceil((data.length + 1 + 8) / 64);
  const total = blockCount * 64;
  const buffer = new Uint8Array(total);
  buffer.set(data);
  buffer[data.length] = 0x80;
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  view.setUint32(total - 8, Math.floor(bitLength / 4294967296));
  view.setUint32(total - 4, bitLength >>> 0);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < total; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4);
    }
    for (let i = 16; i < 64; i += 1) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
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
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('');
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = (() => {
  const table = new Int8Array(128).fill(-1);
  for (let i = 0; i < BASE64_ALPHABET.length; i += 1) {
    table[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

/** The outcome of one strict base64 decode. */
export type Base64DecodeResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; error: string };

/**
 * Strict RFC 4648 base64 decode (canonical alphabet, length % 4 === 0,
 * mandatory padding, no whitespace). Refuses non-canonical input instead of
 * silently decoding permissively.
 */
export function decodeBase64(input: string): Base64DecodeResult {
  if (input.length === 0 || input.length % 4 !== 0) {
    return { ok: false, error: `base64 length ${input.length} is empty or not a multiple of 4` };
  }
  const padding = input.endsWith('==') ? 2 : input.endsWith('=') ? 1 : 0;
  const contentLength = input.length - padding;
  if (padding === 2 && contentLength % 4 !== 2) {
    return { ok: false, error: 'base64 "==" padding is inconsistent with its length' };
  }
  if (padding === 1 && contentLength % 4 !== 3) {
    return { ok: false, error: 'base64 "=" padding is inconsistent with its length' };
  }
  for (let i = 0; i < contentLength; i += 1) {
    const code = input.charCodeAt(i);
    if (code < 32 || code > 127 || BASE64_LOOKUP[code] < 0) {
      return { ok: false, error: `base64 contains a non-canonical character at index ${i}` };
    }
  }
  // Every full 4-character group carries 3 bytes; the padding group
  // carries (3 - padding) of them.
  const byteCount = (input.length / 4) * 3 - padding;
  const out = new Uint8Array(byteCount);
  let outIndex = 0;
  for (let i = 0; i + 4 <= input.length; i += 4) {
    const v0 = BASE64_LOOKUP[input.charCodeAt(i)];
    const v1 = BASE64_LOOKUP[input.charCodeAt(i + 1)];
    const v2 = i + 2 < contentLength ? BASE64_LOOKUP[input.charCodeAt(i + 2)] : 0;
    const v3 = i + 3 < contentLength ? BASE64_LOOKUP[input.charCodeAt(i + 3)] : 0;
    const triple = (v0 << 18) | (v1 << 12) | (v2 << 6) | v3;
    const remaining = byteCount - outIndex;
    const emit = Math.min(3, remaining);
    if (emit >= 1) out[outIndex] = (triple >>> 16) & 0xff;
    if (emit >= 2) out[outIndex + 1] = (triple >>> 8) & 0xff;
    if (emit >= 3) out[outIndex + 2] = triple & 0xff;
    outIndex += emit;
    if (emit < 3) break;
  }
  return { ok: true, bytes: out };
}

/** True when the bytes start with the exact ASCII sequence. */
export function startsWithAscii(bytes: Uint8Array, prefix: string): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i += 1) {
    if (bytes[i] !== prefix.charCodeAt(i)) return false;
  }
  return true;
}

/** Decode bytes as UTF-8 text (glTF JSON is UTF-8; TextDecoder is universal). */
export function utf8Text(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

/** Encode text as UTF-8 bytes. */
export function utf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * A plain-object check for decoded JSON: JSON.parse output always carries
 * Object.prototype (or null for exotic reviver output) — never an Array,
 * never a class instance, never null/undefined.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
