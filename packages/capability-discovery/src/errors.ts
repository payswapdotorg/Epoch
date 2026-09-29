/**
 * @epoch/capability-discovery — typed error taxonomy + result helpers
 * (errors are values, never exceptions; total entry points with a fixed
 * precedence, the W007/W036 convention).
 */
import type { DiscoveryError, DiscoveryIssue, DiscoveryResult } from './types';

/** Build a success result. */
export function ok<T>(value: T): DiscoveryResult<T> {
  return { ok: true, value };
}

/** Build a typed failure result. */
export function fail<T>(error: DiscoveryError): DiscoveryResult<T> {
  return { ok: false, error };
}

/** Flatten zod issues into discovery issues. */
export function zodIssuesToDiscoveryIssues(error: {
  readonly issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[];
}): DiscoveryIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.') || '$',
    message: issue.message,
  }));
}

/** Build a typed validation failure from zod issues. */
export function validationError(message: string, issues: readonly DiscoveryIssue[]): DiscoveryError {
  return { code: 'validation', message, issues: [...issues] };
}

/** Build a plain typed failure. */
export function typedError(
  code: Exclude<
    DiscoveryError['code'],
    'validation' | 'lineage-mismatch'
  >,
  message: string,
): DiscoveryError {
  return { code, message };
}
