/**
 * Digest discipline for authorization records: a decision's identity is
 * the SHA-256 of its canonical JSON serialization (content addressing
 * over the runtime-neutral canonical machinery from
 * @epoch/agent-protocol); the decision additionally carries the digest
 * of the exact request revision it answers. Serialization REJECTS a
 * decision whose claimed digest does not match its content (tamper
 * detection) — see `parseSealedAuthorizationDecision`.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { AuthorizationDecisionSchema, AuthorizationRequestSchema } from './schema';
import { flattenZodIssues, validationError } from './issues';
import type {
  AuthorizationDecision,
  AuthorizationRequest,
  AuthorizationResult,
} from './types';

/** A sealed decision envelope: the decision + its claimed content digest. */
export interface AuthorizationDecisionRegistration {
  readonly decision: AuthorizationDecision;
  readonly digest: Sha256Hex;
}

/**
 * Content-addressed identity of a request: the SHA-256 of its canonical
 * JSON serialization (the exact-revision address the decision carries).
 * Throws on an invalid request — producers validate first.
 */
export function computeAuthorizationRequestDigest(request: AuthorizationRequest): Sha256Hex {
  const parsed = AuthorizationRequestSchema.safeParse(request);
  if (!parsed.success) {
    const first = flattenZodIssues(parsed.error)[0];
    throw new Error(
      `cannot digest an invalid authorization request (${first?.path ?? '?'}: ${first?.message ?? 'invalid'})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Content-addressed identity of a decision: the SHA-256 of its canonical
 * JSON serialization. Equivalent decisions (any key order) always
 * produce the same digest. Throws on an invalid decision — producers
 * validate first (use {@link sealAuthorizationDecision} for the total
 * form).
 */
export function computeAuthorizationDecisionDigest(decision: AuthorizationDecision): Sha256Hex {
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
 * Seal a valid decision into its envelope (decision + recomputed
 * digest). Total: an invalid decision yields a typed `validation` error.
 */
export function sealAuthorizationDecision(
  input: unknown,
): AuthorizationResult<AuthorizationDecisionRegistration> {
  const parsed = AuthorizationDecisionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      decision: parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/**
 * Verify a claimed decision digest against the recomputed content
 * digest (tamper detection). Total.
 */
export function verifyAuthorizationDecisionDigest(
  registration: AuthorizationDecisionRegistration,
): AuthorizationResult<AuthorizationDecision> {
  const parsed = AuthorizationDecisionSchema.safeParse(registration.decision);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const expected = canonicalDigest(parsed.data as unknown as JsonValue);
  if (expected !== registration.digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'authorization decision digest does not match its content (tampered or mismatched envelope) — the decision is rejected',
        expected,
        encountered: registration.digest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
