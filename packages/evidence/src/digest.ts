/**
 * Digest discipline for evidence records.
 *
 * Evidence identity is content addressing over the canonical JSON
 * serialization (sorted keys, no insignificant whitespace — the
 * runtime-neutral machinery shipped by @epoch/agent-protocol): the SHA-256
 * of a record's canonical form IS the record's address, so two structurally
 * equal records always produce the same digest and any tampering with a
 * record breaks the address. This is proof-grade SHA-256 content addressing,
 * distinct from the FNV-1a change detectors the constraint language uses for
 * compiled-constraint tamper detection.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { EvidenceError } from './errors';
import { EvidenceRecordSchema } from './schema';
import type { EvidenceRecord } from './types';

/**
 * Content-addressed identity of an evidence record: the SHA-256 of its
 * canonical JSON serialization. Validates defensively first — a record that
 * fails its schema has no canonical evidence form.
 */
export function computeEvidenceDigest(record: EvidenceRecord): Sha256Hex {
  const parsed = EvidenceRecordSchema.safeParse(record);
  if (!parsed.success) {
    throw new EvidenceError(
      `cannot digest an invalid evidence record (${parsed.error.issues[0]?.path.join('.') ?? '?'}: ${
        parsed.error.issues[0]?.message ?? 'invalid'
      })`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Verify a record against its claimed digest: recompute the canonical
 * digest and compare. Returns false when the content does not match the
 * address (tampered or mismatched records), true otherwise.
 */
export function verifyEvidenceRecord(
  record: EvidenceRecord,
  expectedDigest?: Sha256Hex,
): boolean {
  try {
    const actual = computeEvidenceDigest(record);
    return expectedDigest === undefined ? true : actual === expectedDigest;
  } catch {
    return false;
  }
}

/**
 * Verify the exact-revision discipline against artifact content: the
 * canonical digest of `artifact` must equal the subject digest the record
 * claims (`record.subject.digest`). This is the check that proves an
 * evidence record really refers to the exact artifact revision it names.
 */
export function verifyArtifactRevision(record: EvidenceRecord, artifact: JsonValue): boolean {
  const parsed = EvidenceRecordSchema.safeParse(record);
  if (!parsed.success) return false;
  return canonicalDigest(artifact) === parsed.data.subject.digest;
}
