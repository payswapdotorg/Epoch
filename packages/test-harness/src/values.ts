/**
 * Shared value primitives of the scenario engine: the JSON value model and
 * the digest discipline (canonical SHA-256 content addressing over the
 * @epoch/agent-protocol machinery — the same canonicalization every Epoch
 * kernel uses, so harness digests are directly comparable with kernel
 * digests).
 *
 * Determinism discipline (the W031 E2E philosophy, generalized): zero
 * wall-clock reads, zero randomness, zero network. Every digest is derived
 * from content; every record is digest-stable across processes.
 */
import {
  canonicalDigest,
  canonicalJsonStringify,
  type JsonValue,
} from '@epoch/agent-protocol';

export type { JsonValue };

/** The shape every content digest carries (64 lowercase hex chars). */
export const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

/** Total type guard for digest-shaped strings. */
export function isDigest(value: string): boolean {
  return DIGEST_PATTERN.test(value);
}

/**
 * Digest-stable serialization of a harness record: the canonical JSON form
 * (sorted keys, no insignificant whitespace). Two structurally equal
 * records serialize byte-identically.
 */
export function canonicalJson(value: JsonValue): string {
  return canonicalJsonStringify(value);
}

/** Canonical SHA-256 content digest over a JSON value. */
export function digestOf(value: JsonValue): string {
  return canonicalDigest(value);
}

/** Digest over the canonical serialization of an arbitrary record. */
export function digestRecord(value: Record<string, unknown>): string {
  return canonicalDigest(value as JsonValue);
}

/**
 * JSON round-trip: serialize + re-parse. The round-tripped value's digest
 * must equal the original's (the W031 round-trip gate, reusable).
 */
export function jsonRoundTrip(value: JsonValue): { readonly value: JsonValue; readonly digestStable: boolean } {
  const text = canonicalJsonStringify(value);
  const roundTripped = JSON.parse(text) as JsonValue;
  return { value: roundTripped, digestStable: canonicalDigest(roundTripped) === canonicalDigest(value) };
}
