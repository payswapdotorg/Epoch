/**
 * Flattened-issue helpers shared by the runtime's total entry points —
 * zod issues become typed {@link ExtensionRuntimeIssue} values with
 * precise dotted paths (the W006/W007 issue style).
 */
import type { ZodError } from 'zod';
import type { ExtensionRuntimeError, ExtensionRuntimeIssue } from './types';

/**
 * Flatten a zod failure into dotted-path issues. `unrecognized_keys`
 * failures (strict objects rejecting unknown/vendor fields) are
 * expanded into one issue per key at the precise key path, so vendor
 * fields report exactly where they were rejected.
 */
export function flattenZodIssues(error: ZodError): ExtensionRuntimeIssue[] {
  const issues: ExtensionRuntimeIssue[] = [];
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
      path: issue.path.map((segment) => String(segment)).join('.'),
      message: issue.message,
    });
  }
  return issues;
}


/** Build the typed `validation` error for a zod failure (narrowed variant). */
export function validationError(
  error: ZodError,
): Extract<ExtensionRuntimeError, { readonly code: 'validation' }> {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `extension-runtime document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}
