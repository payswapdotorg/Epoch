// @epoch/constraint-language — deterministic canonical JSON + FNV-1a digest.
//
// Evaluation and compilation artifacts are digested over a canonical JSON
// serialization (recursively key-sorted, no whitespace) so that identical
// semantic content always yields an identical digest regardless of key order.
// The digest is a non-cryptographic change detector (FNV-1a-32): proof-grade
// hashing belongs to the Verification/Evidence domain (W006), not to the
// constraint kernel.
//
// Portability: UTF-8 encoding and the hash are implemented in pure
// TypeScript (no TextEncoder / node:crypto dependency) so the kernel can run
// in any ES2022 environment (web/desktop/mobile share semantic contracts,
// architecture lock rule 14). Lone-surrogate handling is defined by this
// implementation (CESU-style 3-byte encoding) and is stable across platforms.

/** Serialize a JSON-compatible value to its canonical (key-sorted) form. */
export function canonicalJson(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'number':
      // Non-finite numbers never occur in validated data; map them to null so
      // canonicalization stays a total, JSON-compatible function.
      return Number.isFinite(value) ? JSON.stringify(value) : 'null';
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map((item) => serialize(item)).join(',')}]`;
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort();
      const parts = keys.map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`);
      return `{${parts.join(',')}}`;
    }
    default:
      throw new Error(`canonicalJson: unsupported value of type ${typeof value}`);
  }
}

/** UTF-8 byte sequence of `input` (pure TypeScript, deterministic). */
function utf8Bytes(input: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    let codePoint = input.charCodeAt(i);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && i + 1 < input.length) {
      const low = input.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = (codePoint - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
        i += 1;
      }
    }
    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
}

/** FNV-1a 32-bit hash of the UTF-8 encoding of `input`, as 8 lowercase hex chars. */
export function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (const byte of utf8Bytes(input)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** FNV-1a digest of the canonical JSON serialization of `value`. */
export function digestOf(value: unknown): string {
  return fnv1a32(canonicalJson(value));
}
