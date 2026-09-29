/** Issue helpers (zod -> seam issues) + result constructors. */
import type { z } from 'zod';
import type { SessionError, SessionIssue, SessionResult } from './version';

/** Project zod issues into typed seam issues. */
export function zodIssues(error: z.ZodError): readonly SessionIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '/',
    message: issue.message,
  }));
}

/** The ok constructor. */
export function ok<T>(value: T): SessionResult<T> {
  return { ok: true, value };
}

/** The fail constructor. */
export function fail<T>(error: SessionError): SessionResult<T> {
  return { ok: false, error };
}
