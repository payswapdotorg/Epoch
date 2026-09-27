/**
 * The typed desktop-shell error taxonomy (W017).
 *
 * Every failure is a discriminated {@link DesktopShellError} value (never
 * a bare throw), so consumers branch deterministically on `code` — the
 * W009/W011/W013 house discipline. `invocation-rejected` failures carry
 * the verbatim typed W013 {@link RendererRuntimeError} as their `cause`,
 * so kernel/experience-boundary failures stay fully typed end-to-end
 * (R12, lock rules 3/8). `authority-violation` failures enumerate their
 * violations with the attempt kind, so a bypass can never masquerade as a
 * generic validation problem.
 */
import { z } from 'zod';
import type { RendererRuntimeError } from '@epoch/renderer-runtime';

/** One flattened validation issue (dotted path + message; "$" = root). */
export const DesktopIssueSchema = z
  .strictObject({
    path: z.string(),
    message: z.string().min(1),
  })
  .meta({
    id: 'DesktopIssue',
    title: 'DesktopIssue',
    description: 'One flattened validation issue: dotted path ("$" = root) plus message.',
  });

/** One flattened issue. */
export type DesktopIssue = z.infer<typeof DesktopIssueSchema>;

/** The typed authority-violation record (one bypass/claim attempt). */
export const AuthorityViolationRecordSchema = z
  .strictObject({
    /** Where the attempt surfaced (dotted path). */
    path: z.string(),
    /** What was attempted (admission bypass, authoring authority claim, ...). */
    attempt: z.string().min(1),
  })
  .meta({
    id: 'AuthorityViolationRecord',
    title: 'AuthorityViolationRecord',
    description: 'One typed authority-violation record: path plus the attempted bypass.',
  });

/** One authority-violation record. */
export type AuthorityViolationRecord = z.infer<typeof AuthorityViolationRecordSchema>;

/**
 * The typed desktop-shell error (discriminated on `code`; see
 * src/version.ts DESKTOP_ERROR_CODES for the full semantics of each code).
 */
export const DesktopShellErrorSchema = z.discriminatedUnion('code', [
  z.strictObject({
    code: z.literal('version-unsupported'),
    message: z.string().min(1),
    expected: z.string(),
    encountered: z.string(),
  }),
  z.strictObject({
    code: z.literal('malformed-record'),
    message: z.string().min(1),
    issues: z.array(DesktopIssueSchema).min(1),
  }),
  z.strictObject({
    code: z.literal('digest-mismatch'),
    message: z.string().min(1),
    /** Where the mismatch surfaced (dotted path). */
    path: z.string(),
    expected: z.string(),
    encountered: z.string(),
  }),
  z.strictObject({
    code: z.literal('cross-tenant-denied'),
    message: z.string().min(1),
    /** Where the isolation violation surfaced (dotted path). */
    path: z.string(),
    expectedTenantId: z.string(),
    encounteredTenantId: z.string(),
  }),
  z.strictObject({
    code: z.literal('authority-violation'),
    message: z.string().min(1),
    /** The enumerated violations (attempt kinds + paths). */
    violations: z.array(AuthorityViolationRecordSchema).min(1),
  }),
  z.strictObject({
    code: z.literal('unknown-window'),
    message: z.string().min(1),
    windowId: z.string(),
    sessionId: z.string(),
  }),
  z.strictObject({
    code: z.literal('unknown-session'),
    message: z.string().min(1),
    sessionId: z.string(),
  }),
  z.strictObject({
    code: z.literal('invalid-transition'),
    message: z.string().min(1),
    /** The subject of the rejected transition ("window" | "session"). */
    subject: z.enum(['window', 'session']),
    fromState: z.string(),
    event: z.string(),
  }),
  z.strictObject({
    code: z.literal('replay-violation'),
    message: z.string().min(1),
    /** What was violated (gap, fork, out-of-order, chain root). */
    reason: z.enum(['gap', 'fork', 'out-of-order', 'chain-root']),
    expectedSequence: z.number().int().nonnegative().optional(),
    encounteredSequence: z.number().int().nonnegative().optional(),
  }),
  z.strictObject({
    code: z.literal('device-mismatch'),
    message: z.string().min(1),
    expected: z.string(),
    encountered: z.string(),
  }),
  z.strictObject({
    code: z.literal('cache-violation'),
    message: z.string().min(1),
    address: z.string().optional(),
    reason: z.enum(['unknown-address', 'stale-read', 'kind-mismatch']),
  }),
  z.strictObject({
    code: z.literal('invocation-rejected'),
    message: z.string().min(1),
    /** The verbatim typed W013 renderer-runtime error. */
    cause: z.custom<RendererRuntimeError>(() => true),
  }),
]);

/** One typed desktop-shell error. */
export type DesktopShellError = z.infer<typeof DesktopShellErrorSchema>;

/** The total-result shape of every desktop-shell entry point. */
export type DesktopResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DesktopShellError };

/** Construct an ok result. */
export function desktopOk<T>(value: T): DesktopResult<T> {
  return { ok: true, value };
}

/** Construct a typed failure. */
export function desktopFail<T>(error: DesktopShellError): DesktopResult<T> {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Error constructors (internal + exported for tests).
// ---------------------------------------------------------------------------

/** A version-skew failure (`expected`/`encountered` as strings). */
export function versionUnsupportedError(
  expected: string | number,
  encountered: string | number,
): DesktopShellError {
  return {
    code: 'version-unsupported',
    message: `version mismatch: expected ${String(expected)}, encountered ${String(encountered)}`,
    expected: String(expected),
    encountered: String(encountered),
  };
}

/** A malformed-record failure from a path/message issue list. */
export function malformedRecordError(
  message: string,
  issues: readonly DesktopIssue[],
): DesktopShellError {
  return { code: 'malformed-record', message, issues: [...issues] };
}

/** A digest-mismatch (tamper-detection) failure. */
export function digestMismatchError(
  path: string,
  expected: string,
  encountered: string,
): DesktopShellError {
  return {
    code: 'digest-mismatch',
    message: `claimed digest at "${path}" does not match the recomputed content — the record is rejected (tamper detection)`,
    path,
    expected,
    encountered,
  };
}

/** A tenant-isolation failure (R12). */
export function crossTenantDeniedError(
  path: string,
  expectedTenantId: string,
  encounteredTenantId: string,
): DesktopShellError {
  return {
    code: 'cross-tenant-denied',
    message: `cross-tenant operation denied at "${path}": expected tenant "${expectedTenantId}", encountered "${encounteredTenantId}"`,
    path,
    expectedTenantId,
    encounteredTenantId,
  };
}

/** An authority-violation failure (admission bypass / authority claim). */
export function authorityViolationError(
  message: string,
  violations: readonly AuthorityViolationRecord[],
): DesktopShellError {
  return { code: 'authority-violation', message, violations: [...violations] };
}

/** An unknown-window failure. */
export function unknownWindowError(sessionId: string, windowId: string): DesktopShellError {
  return {
    code: 'unknown-window',
    message: `window "${windowId}" does not exist in session "${sessionId}"`,
    windowId,
    sessionId,
  };
}

/** An unknown-session failure. */
export function unknownSessionError(sessionId: string): DesktopShellError {
  return {
    code: 'unknown-session',
    message: `session "${sessionId}" does not exist on this shell`,
    sessionId,
  };
}

/** A lifecycle-transition failure. */
export function invalidTransitionError(
  subject: 'window' | 'session',
  fromState: string,
  event: string,
): DesktopShellError {
  return {
    code: 'invalid-transition',
    message: `illegal ${subject} transition: event "${event}" is not admitted from state "${fromState}"`,
    subject,
    fromState,
    event,
  };
}

/** A replay-safety failure (chain gap/fork/order). */
export function replayViolationError(
  reason: 'gap' | 'fork' | 'out-of-order' | 'chain-root',
  message: string,
  expectedSequence?: number,
  encounteredSequence?: number,
): DesktopShellError {
  return {
    code: 'replay-violation',
    message,
    reason,
    expectedSequence,
    encounteredSequence,
  };
}

/** A device-mismatch failure (non-desktop target). */
export function deviceMismatchError(expected: string, encountered: string): DesktopShellError {
  return {
    code: 'device-mismatch',
    message: `experience artifact targets a ${encountered} device; this shell hosts ${expected} surfaces`,
    expected,
    encountered,
  };
}

/** An offline-cache contract failure. */
export function cacheViolationError(
  reason: 'unknown-address' | 'stale-read' | 'kind-mismatch',
  message: string,
  address?: string,
): DesktopShellError {
  return { code: 'cache-violation', message, reason, address };
}

/** A W013-invocation rejection (typed cause attached verbatim). */
export function invocationRejectedError(cause: RendererRuntimeError): DesktopShellError {
  return {
    code: 'invocation-rejected',
    message: `the renderer runtime denied the invocation (${cause.code}): ${cause.message}`,
    cause,
  };
}
