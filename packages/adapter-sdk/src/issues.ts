/**
 * Flattened-issue helpers shared by the SDK's total entry points — zod
 * issues become typed {@link AdapterSdkIssue} values with precise dotted
 * paths (the W006 chain-validator issue style).
 */
import type { ZodError } from 'zod';
import type { AdapterSdkError, AdapterSdkIssue } from './types';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): AdapterSdkIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Build the typed `validation` error for a zod failure. */
export function validationError(error: ZodError): AdapterSdkError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `adapter document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}
