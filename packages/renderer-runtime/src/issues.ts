/**
 * Flattened-issue helpers for the hosting surface's total entry points —
 * zod issues become typed {@link RendererIssue} values with precise
 * dotted paths (the W006/W007/W008/W011 issue style).
 */
import type { ZodError } from 'zod';
import type { RendererIssue, RendererRuntimeError } from './errors';

/**
 * Flatten a zod failure into dotted-path issues. `unrecognized_keys`
 * failures (strict objects rejecting unknown/vendor/engine fields) are
 * expanded into one issue per key at the precise key path, so vendor
 * fields report exactly where they were rejected.
 */
export function flattenZodIssues(error: ZodError): RendererIssue[] {
  const issues: RendererIssue[] = [];
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      const base = issue.path.map((segment) => String(segment)).join('.');
      for (const key of issue.keys) {
        issues.push({
          path: base === '' ? String(key) : `${base}.${String(key)}`,
          message: issue.message,
        });
      }
      continue;
    }
    issues.push({
      path: issue.path.length === 0 ? '$' : issue.path.map((segment) => String(segment)).join('.'),
      message: issue.message,
    });
  }
  return issues;
}

/** Build the typed `malformed-record` error for a zod failure. */
export function malformedRecordError(
  error: ZodError,
): Extract<RendererRuntimeError, { readonly code: 'malformed-record' }> {
  const issues = flattenZodIssues(error);
  return {
    code: 'malformed-record',
    message: `renderer document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/** Build the typed `malformed-invocation` error for a zod failure. */
export function malformedInvocationError(
  error: ZodError,
): Extract<RendererRuntimeError, { readonly code: 'malformed-invocation' }> {
  const issues = flattenZodIssues(error);
  return {
    code: 'malformed-invocation',
    message: `invocation envelope failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}
