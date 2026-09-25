/**
 * Total parse surface for serialized authorization documents.
 *
 * `parseAuthorizationRequest` and `parseAuthorizationDecision` never
 * throw: schema violations surface as typed `validation` issues with
 * precise dotted paths (strict objects reject unknown — vendor/provider
 * — fields). A decision RECORD additionally has its embedded
 * `decisionDigest` verified against the recomputed content digest, so a
 * tampered record fails with `digest-mismatch` instead of resolving.
 */
import {
  AuthorizationDecisionSchema,
  AuthorizationRecordSchema,
  AuthorizationRequestSchema,
} from './schema';
import { verifyAuthorizationDecisionDigest } from './digest';
import { validationError } from './issues';
import type {
  AuthorizationDecision,
  AuthorizationRecord,
  AuthorizationRequest,
  AuthorizationResult,
} from './types';

/** Parse and validate a serialized authorization request (total, never throws). */
export function parseAuthorizationRequest(
  input: unknown,
): AuthorizationResult<AuthorizationRequest> {
  const parsed = AuthorizationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Parse and validate a serialized authorization decision (total, never throws). */
export function parseAuthorizationDecision(
  input: unknown,
): AuthorizationResult<AuthorizationDecision> {
  const parsed = AuthorizationDecisionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse and validate a serialized authorization record (total, never
 * throws), verifying the embedded decision digest (tamper detection).
 */
export function parseAuthorizationRecord(
  input: unknown,
): AuthorizationResult<AuthorizationRecord> {
  const parsed = AuthorizationRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const verified = verifyAuthorizationDecisionDigest(parsed.data);
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }
  return { ok: true, value: parsed.data };
}
