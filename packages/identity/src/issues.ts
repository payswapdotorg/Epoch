/**
 * Flattened-issue helpers shared by the identity package's total entry
 * points — zod issues become typed {@link IdentityIssue} values with
 * precise dotted paths (the W006/W007 issue style).
 *
 * zod 4 reports strict-object rejections (unknown — vendor/provider —
 * keys, or credential material attempting to enter the closed shapes)
 * as ONE `unrecognized_keys` issue carrying the key list; the flattener
 * expands those into one issue per unrecognized key, so the offending
 * field name is always addressable at `issue.path`.
 */
import type { ZodError } from 'zod';
import type { IdentityError, IdentityIssue } from './types';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): IdentityIssue[] {
  const issues: IdentityIssue[] = [];
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        issues.push({
          path: key,
          message: `unrecognized key "${key}" — strict objects reject unknown (vendor/provider/credential-material) fields`,
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
export function validationError(error: ZodError): IdentityError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `identity document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}
