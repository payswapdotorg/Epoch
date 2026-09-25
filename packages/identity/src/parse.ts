/**
 * Total parse surface for serialized identity documents.
 *
 * `parsePrincipal`, `parsePrincipalRecord`, `parseCredentialAssertion`,
 * `parseAuthenticationResult`, and `parseAuthenticationResultRecord`
 * never throw: schema violations surface as typed `validation` issues
 * with precise dotted paths (strict objects reject unknown — vendor AND
 * secret — fields), and serialized RECORDS additionally have their
 * embedded digests verified against the recomputed content digests, so a
 * tampered record fails with `digest-mismatch` instead of resolving.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  AuthenticationResultRecordSchema,
  AuthenticationResultSchema,
  CredentialAssertionSchema,
  PrincipalRecordSchema,
  PrincipalSchema,
} from './schema';
import { validationError } from './issues';
import type {
  AuthenticationResult,
  AuthenticationResultRecord,
  CredentialAssertion,
  IdentityResult,
  Principal,
  PrincipalRecord,
} from './types';

/** Parse and validate a serialized principal (total, never throws). */
export function parsePrincipal(input: unknown): IdentityResult<Principal> {
  const parsed = PrincipalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse and validate a serialized principal record (total, never
 * throws), verifying the embedded principal digest (tamper detection).
 */
export function parsePrincipalRecord(input: unknown): IdentityResult<PrincipalRecord> {
  const parsed = PrincipalRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const record = parsed.data;
  const expected = canonicalDigest(record.principal as unknown as JsonValue);
  if (expected !== record.principalDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'record principalDigest does not match the recomputed digest of its principal content (tampered record)',
        expected,
        encountered: record.principalDigest,
      },
    };
  }
  return { ok: true, value: record };
}

/** Parse and validate a serialized credential assertion (total, never throws). */
export function parseCredentialAssertion(input: unknown): IdentityResult<CredentialAssertion> {
  const parsed = CredentialAssertionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Parse and validate a serialized authentication result (total, never throws). */
export function parseAuthenticationResult(input: unknown): IdentityResult<AuthenticationResult> {
  const parsed = AuthenticationResultSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse and validate a serialized authentication-result record (total,
 * never throws), verifying the embedded result digest (tamper
 * detection).
 */
export function parseAuthenticationResultRecord(
  input: unknown,
): IdentityResult<AuthenticationResultRecord> {
  const parsed = AuthenticationResultRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const record = parsed.data;
  const expected = canonicalDigest(record.result as unknown as JsonValue);
  if (expected !== record.resultDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'record resultDigest does not match the recomputed digest of its result content (tampered record)',
        expected,
        encountered: record.resultDigest,
      },
    };
  }
  return { ok: true, value: record };
}
