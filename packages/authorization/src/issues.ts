/**
 * Flattened-issue helpers shared by the authorization package's total
 * entry points — zod issues become typed {@link AuthorizationIssue}
 * values with precise dotted paths (the W006/W007 issue style).
 *
 * zod 4 reports strict-object rejections (unknown — vendor/provider —
 * keys) as ONE `unrecognized_keys` issue carrying the key list; the
 * flattener expands those into one issue per unrecognized key, so the
 * offending field name is always addressable at `issue.path`.
 */
import type { ZodError } from 'zod';
import type { AuthorizationError, AuthorizationIssue } from './types';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): AuthorizationIssue[] {
  const issues: AuthorizationIssue[] = [];
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        issues.push({
          path: key,
          message: `unrecognized key "${key}" — strict objects reject unknown (vendor/provider) fields`,
        });
      }
      continue;
    }
    issues.push({
      path: issue.path.map((segment) => String(segment)).join('.'),
      message: issue.message,
    });
  }
  return issues;
}

/** Build the typed `validation` error for a zod failure. */
export function validationError(error: ZodError): AuthorizationError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `authorization document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}
