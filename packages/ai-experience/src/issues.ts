/**
 * Flattened-issue helpers shared by the AI-experience total entry points —
 * zod issues become typed `AiExperienceIssue` values with precise dotted
 * paths (the W006/W007/W010 issue style).
 */
import type { ZodError } from 'zod';
import type { AiExperienceError, AiExperienceIssue } from './types';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): AiExperienceIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Build the typed `validation` error for a zod failure. */
export function validationError(error: ZodError): AiExperienceError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `AI-collaboration document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/** Build the typed `invalid-intent` error for a zod failure of an intent. */
export function invalidIntentError(error: ZodError): AiExperienceError {
  const issues = flattenZodIssues(error);
  return {
    code: 'invalid-intent',
    message: `interaction intent failed validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/** Build a `validation` error from a single message (no zod failure). */
export function validationMessage(message: string, path = '$'): AiExperienceError {
  return {
    code: 'validation',
    message,
    issues: [{ path, message }],
  };
}
