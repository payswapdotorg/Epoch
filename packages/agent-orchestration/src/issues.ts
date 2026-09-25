/**
 * Flattened-issue helpers shared by the orchestration admission surfaces —
 * zod issues become typed {@link OrchestrationIssue} values with precise
 * dotted paths (the W006 chain-validator issue style).
 */
import type { ZodError } from 'zod';
import type { OrchestrationError, OrchestrationIssue } from './types';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): OrchestrationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Build the typed `validation` error for a zod failure. */
export function validationError(error: ZodError): OrchestrationError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `orchestration document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/** Build the typed `invalid-plan` error for semantically invalid plans. */
export function invalidPlanError(message: string, issues: readonly OrchestrationIssue[]): OrchestrationError {
  return {
    code: 'invalid-plan',
    message,
    issues,
  };
}
