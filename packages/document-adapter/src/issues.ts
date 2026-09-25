/**
 * Flattened-issue helpers shared by the total entry points — zod issues
 * become typed {@link DocumentAdapterIssue} values with precise dotted
 * paths (the W006/W007 issue style).
 */
import type { ZodError } from 'zod';
import type { DocumentAdapterError, DocumentAdapterIssue } from './types';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): DocumentAdapterIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.') || '$',
    message: issue.message,
  }));
}

/** Build the typed `malformed-document` error for a zod failure. */
export function malformedDocument(error: ZodError): DocumentAdapterError {
  const issues = flattenZodIssues(error);
  return {
    code: 'malformed-document',
    message: `document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/** Build a one-issue `malformed-document` error at an exact path. */
export function malformedAt(
  path: string,
  message: string,
): DocumentAdapterError {
  return {
    code: 'malformed-document',
    message,
    issues: [{ path, message }],
  };
}
