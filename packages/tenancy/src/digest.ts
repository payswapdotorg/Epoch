/**
 * Digest discipline for tenancy records: a node record is content-addressed
 * by the SHA-256 of its canonical JSON serialization (content addressing
 * over the runtime-neutral canonical machinery from
 * @epoch/agent-protocol). Admission REJECTS a sealed record whose claimed
 * digest does not match its content (`digest-mismatch` — tamper detection)
 * — see `restoreSealed` in src/directory.ts and `parseSealedTenancyNode`
 * in src/parse.ts.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenancyNodeSchema } from './schema';
import { flattenZodIssues, validationError } from './issues';
import type { SealedTenancyNode, TenancyNode, TenancyResult } from './types';

/**
 * Content-addressed identity of a tenancy node: the SHA-256 of its
 * canonical JSON serialization. Equivalent nodes (any key order) always
 * produce the same digest. Throws on an invalid node — producers validate
 * first (use {@link sealTenancyNode} for the total form).
 */
export function computeTenancyNodeDigest(node: TenancyNode): Sha256Hex {
  const parsed = TenancyNodeSchema.safeParse(node);
  if (!parsed.success) {
    const first = flattenZodIssues(parsed.error)[0];
    throw new Error(
      `cannot digest an invalid tenancy node (${first?.path ?? '?'}: ${first?.message ?? 'invalid'})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Seal a valid node into a sealed record (node + its recomputed digest).
 * Total: an invalid node yields a typed `validation` error with flattened
 * issue paths.
 */
export function sealTenancyNode(node: unknown): TenancyResult<SealedTenancyNode> {
  const parsed = TenancyNodeSchema.safeParse(node);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      node: parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/**
 * Verify a claimed digest against the recomputed content digest of a node
 * (tamper detection). Total.
 */
export function verifyTenancyNodeDigest(
  sealed: SealedTenancyNode,
): TenancyResult<TenancyNode> {
  const parsed = TenancyNodeSchema.safeParse(sealed.node);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const expected = canonicalDigest(parsed.data as unknown as JsonValue);
  if (expected !== sealed.digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'tenancy node digest does not match its content (tampered or mismatched envelope) — the record is rejected',
        path: ['digest'],
        expected,
        encountered: sealed.digest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
