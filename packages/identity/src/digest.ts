/**
 * Digest discipline for identity records: a principal's (and an
 * authentication result's) identity is the SHA-256 of its content's
 * canonical JSON serialization (content addressing over the
 * runtime-neutral canonical machinery from @epoch/agent-protocol). The
 * registry REJECTS a registration whose claimed digest does not match
 * the recomputed one (tamper detection) — see `registerPrincipal` and
 * `recordAuthentication` in src/registry.ts and the parse functions in
 * src/parse.ts.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { AuthenticationResultSchema, PrincipalSchema } from './schema';
import { flattenZodIssues, validationError } from './issues';
import type {
  AuthenticationResult,
  AuthenticationResultRegistration,
  AuthenticationResultRecord,
  IdentityResult,
  Principal,
  PrincipalRegistration,
} from './types';

/**
 * Content-addressed identity of a principal: the SHA-256 of the
 * principal content's canonical JSON serialization. Equivalent
 * principals (any key order) always produce the same digest. Throws on
 * an invalid principal — producers validate first (use
 * {@link sealPrincipal} for the total form).
 */
export function computePrincipalDigest(principal: Principal): Sha256Hex {
  const parsed = PrincipalSchema.safeParse(principal);
  if (!parsed.success) {
    const first = flattenZodIssues(parsed.error)[0];
    throw new Error(
      `cannot digest an invalid principal (${first?.path ?? '?'}: ${first?.message ?? 'invalid'})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Seal a valid principal into a registration envelope (principal + its
 * recomputed digest). Total: an invalid principal yields a typed
 * `validation` error with flattened issue paths.
 */
export function sealPrincipal(input: unknown): IdentityResult<PrincipalRegistration> {
  const parsed = PrincipalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      principal: parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/** Verify a claimed principal digest against the recomputed one. Total. */
export function verifyPrincipalDigest(
  registration: PrincipalRegistration,
): IdentityResult<Principal> {
  const parsed = PrincipalSchema.safeParse(registration.principal);
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
          'principal digest does not match its content (tampered or mismatched envelope) — the registration is rejected',
        expected,
        encountered: registration.digest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Content-addressed identity of an authentication result. Throws on an
 * invalid result — producers validate first (use
 * {@link sealAuthenticationResult} for the total form).
 */
export function computeAuthenticationResultDigest(result: AuthenticationResult): Sha256Hex {
  const parsed = AuthenticationResultSchema.safeParse(result);
  if (!parsed.success) {
    const first = flattenZodIssues(parsed.error)[0];
    throw new Error(
      `cannot digest an invalid authentication result (${first?.path ?? '?'}: ${first?.message ?? 'invalid'})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Seal a valid authentication result into its envelope. Total: an
 * invalid result (including a verified result that carries a reason, or
 * a failed result without one) yields a typed `validation` error.
 */
export function sealAuthenticationResult(
  input: unknown,
): IdentityResult<AuthenticationResultRegistration> {
  const parsed = AuthenticationResultSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      result: parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/** Verify a claimed authentication-result digest against the recomputed one. Total. */
export function verifyAuthenticationResultDigest(
  registration: AuthenticationResultRegistration,
): IdentityResult<AuthenticationResult> {
  const parsed = AuthenticationResultSchema.safeParse(registration.result);
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
          'authentication result digest does not match its content (tampered or mismatched envelope) — the registration is rejected',
        expected,
        encountered: registration.digest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** The published record for a verified authentication result. */
export function authenticationResultRecordFor(
  result: AuthenticationResult,
): AuthenticationResultRecord {
  return {
    schemaVersion: 1,
    result,
    resultDigest: computeAuthenticationResultDigest(result),
  };
}
