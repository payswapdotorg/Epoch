/**
 * Total parse surface for serialized tenancy documents.
 *
 * `parseTenancyNode`, `parseTenancyNodeRecord`, and `parseTenancySnapshot`
 * never throw: schema violations surface as typed `validation` issues with
 * precise dotted paths (strict objects reject unknown — vendor/provider —
 * fields), and serialized RECORDS/SNAPSHOTS additionally have their
 * embedded digests verified against the recomputed content digests, so a
 * tampered record fails with `digest-mismatch` instead of resolving.
 * Snapshot SEMANTICS (single-rooted platform tree, dangling parents,
 * cycles, containment) are validated by `TenancyHierarchy.fromSnapshot`.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { TenancyNodeRecordSchema, TenancyNodeSchema, TenancySnapshotSchema } from './schema';
import { validationError } from './issues';
import type { TenancyNode, TenancyNodeRecord, TenancyResult, TenancySnapshot } from './types';

/** Parse and validate a serialized tenancy node (total, never throws). */
export function parseTenancyNode(input: unknown): TenancyResult<TenancyNode> {
  const parsed = TenancyNodeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse and validate a serialized tenancy node record (total, never
 * throws), verifying the embedded node digest (tamper detection).
 */
export function parseTenancyNodeRecord(input: unknown): TenancyResult<TenancyNodeRecord> {
  const parsed = TenancyNodeRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const record = parsed.data;
  const expected = canonicalDigest(record.node as unknown as JsonValue);
  if (expected !== record.nodeDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'record nodeDigest does not match the recomputed digest of its node content (tampered record)',
        expected,
        encountered: record.nodeDigest,
      },
    };
  }
  return { ok: true, value: record };
}

/**
 * Parse and validate a serialized hierarchy snapshot (total, never
 * throws), verifying every embedded record digest (tamper detection).
 * Structural only: single-rootedness, dangling parents, cycles, and the
 * containment table are checked by `TenancyHierarchy.fromSnapshot`.
 */
export function parseTenancySnapshot(input: unknown): TenancyResult<TenancySnapshot> {
  const parsed = TenancySnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const snapshot = parsed.data;
  for (const record of snapshot.records) {
    const expected = canonicalDigest(record.node as unknown as JsonValue);
    if (expected !== record.nodeDigest) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: `record for node "${record.node.nodeId}" carries a nodeDigest that does not match its content (tampered snapshot)`,
          expected,
          encountered: record.nodeDigest,
        },
      };
    }
  }
  return { ok: true, value: snapshot };
}
