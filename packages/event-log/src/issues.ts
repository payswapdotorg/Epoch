/**
 * Flattened-issue helpers shared by the event-log total entry points —
 * zod issues become typed {@link EventLogIssue} values with precise dotted
 * paths (the W006/W007 issue style).
 */
import type { ZodError } from 'zod';
import type { EventLogError, EventLogIssue } from './types';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): EventLogIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Build the typed `validation` error for a zod failure. */
export function validationError(error: ZodError): EventLogError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `event-log document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}
