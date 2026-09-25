/**
 * Total parse surface for serialized authorization documents.
 *
 * `parseAuthorizationRequest`, `parseAuthorizationContext`, and
 * `parseSealedAuthorizationDecision` never throw: schema violations
 * surface as typed `validation` issues with precise dotted paths
 * (strict objects reject unknown — vendor/provider — fields), and a
 * sealed decision additionally has its claimed digest verified against
 * the recomputed content digest, so a tampered decision fails with
 * `digest-mismatch` instead of resolving.
 */
import {
  AuthorizationContextSchema,
  AuthorizationRequestSchema,
} from './schema';
import { validationError } from './issues';
import { verifyAuthorizationDecisionDigest } from './digest';
import type { AuthorizationDecisionRegistration } from './digest';
import type {
  AuthorizationContext,
  AuthorizationRequest,
  AuthorizationResult,
} from './types';

/** Parse and validate a serialized authorization request (total, never throws). */
export function parseAuthorizationRequest(input: unknown): AuthorizationResult<AuthorizationRequest> {
  const parsed = AuthorizationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Parse and validate a serialized decision context (total, never throws). */
export function parseAuthorizationContext(input: unknown): AuthorizationResult<AuthorizationContext> {
  const parsed = AuthorizationContextSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse and validate a sealed decision (total, never throws), verifying
 * the claimed digest (tamper detection).
 */
export function parseSealedAuthorizationDecision(
  input: AuthorizationDecisionRegistration,
): AuthorizationResult<AuthorizationDecisionRegistration> {
  const verified = verifyAuthorizationDecisionDigest(input);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }
  return { ok: true, value: input };
}
