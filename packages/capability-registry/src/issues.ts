/**
 * Flattened-issue helpers shared by the registry's total entry points —
 * zod issues become typed {@link RegistryIssue} values with precise
 * dotted paths (the W006 chain-validator issue style).
 */
import type { ZodError } from 'zod';
import type { RegistryError, RegistryIssue } from './types';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): RegistryIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Build the typed `validation` error for a zod failure. */
export function validationError(error: ZodError): RegistryError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `capability document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}
