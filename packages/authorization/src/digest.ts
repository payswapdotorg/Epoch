/**
 * Digest discipline for authorization decisions: a decision record is
 * content-addressed by the SHA-256 of its canonical JSON (content
 * addressing over the runtime-neutral canonical machinery from
 * @epoch/agent-protocol). Parse REJECTS a record whose claimed digest
 * does not match its content (`digest-mismatch` — tamper detection) —
 * see `parseAuthorizationRecord` in src/parse.ts. Decisions are
 * evidence: exact-revision addressable, audit-grade (R17).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { AuthorizationDecisionSchema } from './schema';
import { flattenZodIssues, validationError } from './issues';
import type {
  AuthorizationDecision,
  AuthorizationRecord,
  AuthorizationResult,
} from './types';

/**
 * Content-addressed identity of an authorization decision: the SHA-256
 * of its canonical JSON serialization. Equivalent decisions (any key
 * order) always produce the same digest. Throws on an invalid decision
 * — producers validate first (use {@link sealAuthorizationDecision} for
 * the total form).
 */
export function computeAuthorizationDecisionDigest(
  decision: AuthorizationDecision,
): Sha256Hex {
  const parsed = AuthorizationDecisionSchema.safeParse(decision);
  if (!parsed.success) {
    const first = flattenZodIssues(parsed.error)[0];
    throw new Error(
      `cannot digest an invalid authorization decision (${first?.path ?? '?'}: ${first?.message ?? 'invalid'})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Seal a valid decision into a published record (decision + its
 * recomputed digest). Total: an invalid decision yields a typed
 * `validation` error with flattened issue paths.
 */
export function sealAuthorizationDecision(
  decision: unknown,
): AuthorizationResult<AuthorizationRecord> {
  const parsed = AuthorizationDecisionSchema.safeParse(decision);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      decision: parsed.data,
      decisionDigest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/**
 * Verify a claimed digest against the recomputed content digest of a
 * decision (tamper detection). Total.
 */
export function verifyAuthorizationDecisionDigest(
  record: AuthorizationRecord,
): AuthorizationResult<AuthorizationDecision> {
  const parsed = AuthorizationDecisionSchema.safeParse(record.decision);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const expected = canonicalDigest(parsed.data as unknown as JsonValue);
  if (expected !== record.decisionDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'authorization decision digest does not match its content (tampered or mismatched record) — the record is rejected',
        path: ['decisionDigest'],
        expected,
        encountered: record.decisionDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
