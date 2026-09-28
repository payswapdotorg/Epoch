/**
 * Flattened-issue pre-classifiers (the W036/W038 convention):
 *
 * - `vendorFieldsError` — zod unrecognized-key failures classify as
 *   `vendor-fields-rejected` (provider vocabulary can never smuggle into
 *   a strict supervision record);
 * - `validationError` — everything else is a typed `validation` issue
 *   set with dotted paths;
 * - `scheduleAuthorityError` — schedule-MUTATION vocabulary on a
 *   supervision-side record (issue summaries, lead-time inputs, the
 *   evaluation input) is a typed `re-schedule-rejected` BEFORE
 *   validation: supervision OBSERVES the ProgramOfWork, it never
 *   re-schedules it (the graph authority stays in W036).
 */
import { z } from 'zod';
import { SCHEDULE_MUTATION_FIELDS, type ScheduleMutationField } from './version';
import type { SupervisionError, SupervisionIssue, SupervisionResult } from './errors';

/** Rebuild a dotted path from a zod issue path (the W036 helper shape). */
function dottedPath(path: Array<string | number>): string {
  if (path.length === 0) {
    return '$';
  }
  let out = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      out += `[${segment}]`;
    } else if (out === '') {
      out = segment;
    } else {
      out += `.${segment}`;
    }
  }
  return out;
}

/** Flatten a zod error into typed supervision issues. */
export function flattenIssues(error: z.ZodError): SupervisionIssue[] {
  return error.issues.map((issue) => ({
    path: dottedPath(issue.path as Array<string | number>),
    message: issue.message,
  }));
}

/** Whether a zod failure includes unrecognized keys (vendor fields). */
export function hasUnrecognizedKeys(error: z.ZodError): boolean {
  return error.issues.some((issue) => issue.code === 'unrecognized_keys');
}

/** The typed vendor-field rejection. */
export function vendorFieldsError(error: z.ZodError): SupervisionError {
  return {
    code: 'vendor-fields-rejected',
    message:
      'the record carries unrecognized keys — supervision records are strict; vendor/provider fields are rejected (lock rule 13)',
    issues: flattenIssues(error),
  };
}

/** The typed validation failure. */
export function validationError(error: z.ZodError): SupervisionError {
  return {
    code: 'validation',
    message: 'the record does not satisfy the supervision record schema',
    issues: flattenIssues(error),
  };
}

/**
 * The typed RE-SCHEDULE rejection: a supervision-side record that tries
 * to mutate ProgramOfWork schedule state (any
 * {@link SCHEDULE_MUTATION_FIELDS} key on the raw object).
 */
export function scheduleAuthorityError(field: ScheduleMutationField, subject: string): SupervisionError {
  return {
    code: 're-schedule-rejected',
    message:
      `supervision OBSERVES the ProgramOfWork, it never re-schedules it — field "${field}" on "${subject}" ` +
      'carries schedule-mutation vocabulary; the schedule authority stays in W036 (changes ship as new baseline versions through the W036 path)',
    field,
    subject,
  };
}

/**
 * Pre-validation scan of a raw record for schedule-mutation vocabulary.
 * Returns the typed rejection when any mutation field is present, `null`
 * otherwise. Deliberately runs BEFORE schema validation so a reschedule
 * attempt classifies as an authority violation, never as a vendor field.
 */
export function scanScheduleMutation(
  raw: unknown,
  subject: string,
): SupervisionError | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  for (const field of SCHEDULE_MUTATION_FIELDS) {
    if (field in raw) {
      return scheduleAuthorityError(field, subject);
    }
  }
  return null;
}

/** Wrap a typed error into the total result (helper). */
export function fail<T>(error: SupervisionError): SupervisionResult<T> {
  return { ok: false, error };
}
