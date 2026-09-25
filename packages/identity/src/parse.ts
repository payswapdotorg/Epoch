/**
 * Total parse surface for serialized identity documents.
 *
 * `parsePrincipal`, `parseCredentialAssertion`, and
 * `parseAuthenticationResult` never throw: schema violations surface as
 * typed `validation` issues with precise dotted paths (strict objects
 * reject unknown — vendor/provider — fields). The SEALED forms
 * additionally verify the claimed content digest, so a tampered record
 * fails with `digest-mismatch` instead of resolving.
 */
import {
  AuthenticationResultSchema,
  CredentialAssertionSchema,
  PrincipalSchema,
  SealedAuthenticationResultSchema,
  SealedCredentialAssertionSchema,
} from './schema';
import {
  verifyAuthenticationResultDigest,
  verifyCredentialAssertionDigest,
} from './digest';
import { validationError } from './issues';
import type {
  AuthenticationResult,
  CredentialAssertion,
  IdentityResult,
  Principal,
  SealedAuthenticationResult,
  SealedCredentialAssertion,
} from './types';

/** Parse and validate a serialized principal (total, never throws). */
export function parsePrincipal(input: unknown): IdentityResult<Principal> {
  const parsed = PrincipalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Parse and validate a serialized credential assertion (total). */
export function parseCredentialAssertion(
  input: unknown,
): IdentityResult<CredentialAssertion> {
  const parsed = CredentialAssertionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Parse and validate a serialized authentication result (total). */
export function parseAuthenticationResult(
  input: unknown,
): IdentityResult<AuthenticationResult> {
  const parsed = AuthenticationResultSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse and validate a sealed credential assertion (total), verifying
 * the claimed content digest (tamper detection).
 */
export function parseSealedCredentialAssertion(
  input: unknown,
): IdentityResult<SealedCredentialAssertion> {
  const sealed = SealedCredentialAssertionSchema.safeParse(input);
  if (!sealed.success) {
    return { ok: false, error: validationError(sealed.error) };
  }
  const verified = verifyCredentialAssertionDigest(sealed.data);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }
  return { ok: true, value: sealed.data };
}

/**
 * Parse and validate a sealed authentication result (total), verifying
 * the claimed content digest (tamper detection).
 */
export function parseSealedAuthenticationResult(
  input: unknown,
): IdentityResult<SealedAuthenticationResult> {
  const sealed = SealedAuthenticationResultSchema.safeParse(input);
  if (!sealed.success) {
    return { ok: false, error: validationError(sealed.error) };
  }
  const verified = verifyAuthenticationResultDigest(sealed.data);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }
  return { ok: true, value: sealed.data };
}
