/**
 * Digest discipline for identity records: credential assertions and
 * authentication results are audit-grade EVIDENCE, so they are
 * content-addressed by the SHA-256 of their canonical JSON (content
 * addressing over the runtime-neutral canonical machinery from
 * @epoch/agent-protocol). Admission REJECTS a sealed record whose
 * claimed digest does not match its content (`digest-mismatch` — tamper
 * detection). Principals are registry state, not evidence, and carry no
 * digest by design.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  AuthenticationResultSchema,
  CredentialAssertionSchema,
} from './schema';
import { flattenZodIssues, validationError } from './issues';
import type {
  AuthenticationResult,
  CredentialAssertion,
  IdentityResult,
  SealedAuthenticationResult,
  SealedCredentialAssertion,
} from './types';

/**
 * Content-addressed identity of a credential assertion. Throws on an
 * invalid assertion — producers validate first (use
 * {@link sealCredentialAssertion} for the total form).
 */
export function computeCredentialAssertionDigest(assertion: CredentialAssertion): Sha256Hex {
  const parsed = CredentialAssertionSchema.safeParse(assertion);
  if (!parsed.success) {
    const first = flattenZodIssues(parsed.error)[0];
    throw new Error(
      `cannot digest an invalid credential assertion (${first?.path ?? '?'}: ${first?.message ?? 'invalid'})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
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

/** Seal a valid credential assertion (total). */
export function sealCredentialAssertion(
  assertion: unknown,
): IdentityResult<SealedCredentialAssertion> {
  const parsed = CredentialAssertionSchema.safeParse(assertion);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      assertion: parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/** Seal a valid authentication result (total). */
export function sealAuthenticationResult(
  result: unknown,
): IdentityResult<SealedAuthenticationResult> {
  const parsed = AuthenticationResultSchema.safeParse(result);
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

/**
 * Verify a claimed digest against the recomputed content digest of an
 * authentication result (tamper detection). Total.
 */
export function verifyAuthenticationResultDigest(
  sealed: SealedAuthenticationResult,
): IdentityResult<AuthenticationResult> {
  const parsed = AuthenticationResultSchema.safeParse(sealed.result);
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
          'authentication result digest does not match its content (tampered or mismatched envelope) — the record is rejected',
        path: ['digest'],
        expected,
        encountered: sealed.digest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Verify a claimed digest against the recomputed content digest of a
 * credential assertion (tamper detection). Total.
 */
export function verifyCredentialAssertionDigest(
  sealed: SealedCredentialAssertion,
): IdentityResult<CredentialAssertion> {
  const parsed = CredentialAssertionSchema.safeParse(sealed.assertion);
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
          'credential assertion digest does not match its content (tampered or mismatched envelope) — the record is rejected',
        path: ['digest'],
        expected,
        encountered: sealed.digest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
