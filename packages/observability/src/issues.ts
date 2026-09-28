/**
 * Flattened-issue pre-classifiers (the W036/W038/W043 convention):
 *
 * - `vendorFieldsError` — zod unrecognized-key failures classify as
 *   `vendor-fields-rejected` (provider vocabulary can never smuggle
 *   into a strict observability record);
 * - `validationError` — everything else is a typed `validation`
 *   issue set with dotted paths.
 */
import { z } from 'zod';
import type { ObservabilityError, ObservabilityIssue, ObservabilityResult } from './errors';

/** Rebuild a dotted path from a zod issue path (the W036 helper shape). */
function dottedPath(path: Array<string | number>): string {
  if (path.length === 0) {
    return '$';
  }
  let out = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      out += `[${segment}]`;
    } else if (out === '') {
      out = segment;
    } else {
      out += `.${segment}`;
    }
  }
  return out;
}

/** Flatten a zod error into typed observability issues. */
export function flattenIssues(error: z.ZodError): ObservabilityIssue[] {
  return error.issues.map((issue) => ({
    path: dottedPath(issue.path as Array<string | number>),
    message: issue.message,
  }));
}

/** Whether a zod failure includes unrecognized keys (vendor fields). */
export function hasUnrecognizedKeys(error: z.ZodError): boolean {
  return error.issues.some((issue) => issue.code === 'unrecognized_keys');
}

/** The typed vendor-field rejection. */
export function vendorFieldsError(error: z.ZodError): ObservabilityError {
  return {
    code: 'vendor-fields-rejected',
    message:
      'the record carries unrecognized keys — observability records are strict; vendor/provider fields are rejected (lock rule 13)',
    issues: flattenIssues(error),
  };
}

/** The typed validation failure. */
export function validationError(error: z.ZodError): ObservabilityError {
  return {
    code: 'validation',
    message: 'the record does not satisfy the observability contract',
    issues: flattenIssues(error),
  };
}

/** Build a failure result from a typed error (the total-result helper). */
export function fail<T>(error: ObservabilityError): ObservabilityResult<T> {
  return { ok: false, error };
}
