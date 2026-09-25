/**
 * Flattened-issue helpers shared by the authorization total entry
 * points — zod issues become typed {@link AuthorizationIssue} values
 * with precise dotted paths (the W006/W007 issue style).
 */
import type { ZodError } from 'zod';
import type { AuthorizationError, AuthorizationIssue } from './types';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): AuthorizationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
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
