/**
 * Flattened-issue helpers shared by the action-policy total entry points —
 * zod issues become typed {@link ActionPolicyIssue} values with precise
 * dotted paths (the W006/W009/W010/W023 issue style).
 */
import type { ZodError } from 'zod';
import type { ActionPolicyError, ActionPolicyIssue } from './types';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): ActionPolicyIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Build the typed `validation` error for a zod failure. */
export function validationError(error: ZodError): ActionPolicyError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `action-policy document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/** Build the typed `validation` error for free-form issues. */
export function validationIssues(message: string, issues: readonly ActionPolicyIssue[]): ActionPolicyError {
  return { code: 'validation', message, issues };
}

/** Flatten a zod failure and re-path every issue under a base path. */
export function rePathedIssues(error: ZodError, base: string): ActionPolicyIssue[] {
  return flattenZodIssues(error).map((issue) => ({
    path: issue.path === '' ? base : `${base}.${issue.path}`,
    message: issue.message,
  }));
}
