/**
 * The byte-primitive battery (W060): SHA-256 correctness against the NIST
 * FIPS 180-4 test vectors, strict RFC 4648 base64, and the UTF-8 helpers.
 * The byte-form SHA-256 is the bridge's content-addressing primitive — its
 * correctness is proven here FIRST, then cross-checked against the kernel's
 * @epoch/agent-protocol string-form implementation.
 */
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@epoch/agent-protocol';
import {
  decodeBase64,
  isPlainObject,
  sha256HexOfBytes,
  startsWithAscii,
  utf8Bytes,
  utf8Text,
} from '../src/bytes';

const bytesOf = (text: string): Uint8Array => utf8Bytes(text);

describe('sha256HexOfBytes (FIPS 180-4 correctness)', () => {
  it('matches the NIST test vectors', () => {
    // The three canonical FIPS 180-4 vectors plus a multi-block input.
    expect(sha256HexOfBytes(bytesOf(''))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256HexOfBytes(bytesOf('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(
      sha256HexOfBytes(bytesOf('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')),
    ).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    expect(sha256HexOfBytes(bytesOf('a'.repeat(1_000)))).toBe(
      '41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3',
    );
  });

  it('agrees with the kernel string-form digest over pure-ASCII input', () => {
    const ascii = 'epoch gltf bridge cross-check 0123456789';
    expect(sha256HexOfBytes(bytesOf(ascii))).toBe(sha256Hex(ascii));
  });

  it('digests raw binary bytes (not UTF-8 text) exactly', () => {
    // Every byte value 0..255 exactly once — a deterministic binary input.
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) all[i] = i;
    expect(sha256HexOfBytes(all)).toMatch(/^[0-9a-f]{64}$/);
    // Stable across runs (determinism evidence).
    expect(sha256HexOfBytes(all)).toBe(sha256HexOfBytes(all));
    // And NOT the digest of the same bytes decoded as (lossy) text.
    expect(sha256HexOfBytes(all)).not.toBe(sha256Hex(utf8Text(all)));
  });

  it('handles subarray views without offset contamination', () => {
    const carrier = new Uint8Array(64);
    carrier.set(bytesOf('abc'), 16);
    const view = carrier.subarray(16, 19);
    expect(sha256HexOfBytes(view)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('decodeBase64 (strict RFC 4648)', () => {
  it('decodes canonical padded input', () => {
    expect(decodeBase64('')).toEqual({ ok: false, error: expect.any(String) });
    const one = decodeBase64('TQ==');
    expect(one.ok && one.bytes).toEqual(new Uint8Array([0x4d]));
    const two = decodeBase64('TWE=');
    expect(two.ok && two.bytes).toEqual(new Uint8Array([0x4d, 0x61]));
    const three = decodeBase64('TWFu');
    expect(three.ok && three.bytes).toEqual(new Uint8Array([0x4d, 0x61, 0x6e]));
  });

  it('refuses non-canonical input (typed errors, never permissive decodes)', () => {
    expect(!decodeBase64('TQ').ok).toBe(true); // length not a multiple of 4
    expect(!decodeBase64('T===').ok).toBe(true); // impossible padding
    expect(!decodeBase64('T Q==').ok).toBe(true); // whitespace
    expect(!decodeBase64('TQ=*').ok).toBe(true); // non-alphabet character
    expect(!decodeBase64('TWE=\n').ok).toBe(true); // trailing newline
    expect(!decodeBase64('====').ok).toBe(true); // padding-only garbage
  });

  it('round-trips the fixture triangle buffer', () => {
    const raw = new Uint8Array(36);
    const view = new DataView(raw.buffer);
    for (let i = 0; i < 9; i += 1) view.setFloat32(i * 4, i * 0.5, true);
    let binary = '';
    for (const byte of raw) binary += String.fromCharCode(byte);
    const decoded = decodeBase64(btoa(binary));
    expect(decoded.ok && Array.from(decoded.bytes)).toEqual(Array.from(raw));
  });
});

describe('text and sniffing helpers', () => {
  it('starts-with ASCII sniffing detects the GLB magic exactly', () => {
    expect(startsWithAscii(new Uint8Array([0x67, 0x6c, 0x54, 0x46]), 'glTF')).toBe(true);
    expect(startsWithAscii(new Uint8Array([0x67, 0x6c, 0x54, 0x46]), 'glTx')).toBe(false);
    expect(startsWithAscii(new Uint8Array([0x67, 0x6c]), 'glTF')).toBe(false);
  });

  it('UTF-8 round-trips text', () => {
    expect(utf8Text(utf8Bytes('glTF 2.0 — bridge'))).toBe('glTF 2.0 — bridge');
  });

  it('plain-object detection matches JSON.parse output shape', () => {
    expect(isPlainObject(JSON.parse('{"a":1}'))).toBe(true);
    expect(isPlainObject(JSON.parse('[1]'))).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject({})).toBe(true);
  });
});
