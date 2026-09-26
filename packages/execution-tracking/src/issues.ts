/**
 * Flattened-issue helpers shared by the execution-tracking total entry
 * points — zod issues become typed {@link ExecutionIssue} values with
 * precise dotted paths (the W036 issue style), plus:
 *
 * - the vendor-field classifier that turns strict-object
 *   `unrecognized_keys` rejections into the typed
 *   `vendor-fields-rejected` error;
 * - the authority-field pre-classifier (the W036 forbidden-field list,
 *   classified BEFORE schema validation — a tracking record claiming
 *   schedule authority re-schedules by stealth);
 * - the UNCERTAINTY pre-classifier: confidence/provenance/freshness on
 *   EVERY observation is a W038 pin — a record whose uncertainty state
 *   is absent (or missing one of its three members) is the typed
 *   `uncertainty-missing-rejected` BEFORE schema validation, so the
 *   rejection is precise instead of a generic shape failure.
 */
import type { ZodError } from 'zod';
import { FORBIDDEN_AUTHORITY_FIELDS } from '@epoch/solution-delivery';
import type { ExecutionError, ExecutionIssue } from './errors';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): ExecutionIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Build the typed `validation` error for a zod failure. */
export function validationError(error: ZodError): ExecutionError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `execution-tracking document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/**
 * Whether a zod failure includes a strict-object `unrecognized_keys`
 * rejection — the structural signal that unknown (vendor/provider) fields
 * attempted to enter an execution-tracking record.
 */
export function hasUnrecognizedKeys(error: ZodError): boolean {
  return error.issues.some((issue) => issue.code === 'unrecognized_keys');
}

/** The path of the first `unrecognized_keys` issue (empty array if none). */
export function unrecognizedKeysPath(error: ZodError): (string | number)[] {
  const issue = error.issues.find((candidate) => candidate.code === 'unrecognized_keys');
  if (issue === undefined) return [];
  return issue.path.filter(
    (segment): segment is string | number =>
      typeof segment === 'string' || typeof segment === 'number',
  );
}

/** Build the typed `vendor-fields-rejected` error for a zod failure. */
export function vendorFieldsError(error: ZodError): ExecutionError {
  const issues = flattenZodIssues(error);
  return {
    code: 'vendor-fields-rejected',
    message:
      'record carries unknown structural fields — provider/vendor fields cannot enter execution-tracking records ' +
      '(strict objects; external field systems stay behind the service-layer FieldCapturePort adapter seam)',
    issues,
    path: unrecognizedKeysPath(error),
  };
}

/**
 * The authority-field pre-classifier (the W036/marketplace pricing
 * pre-classification pattern): a record declaring one of the
 * DP1.0-forbidden authority-claim field names is claiming a second
 * lifecycle/baseline/schedule/delivery authority — a typed
 * `authority-violation-rejected` BEFORE any schema validation. A
 * tracking record that re-declares schedule fields (planned/actual
 * dates, progress fractions of the schedule) is claiming the
 * ProgramOfWork's authority — tracking records OBSERVE, never
 * re-schedule.
 */
export function authorityViolationError(record: unknown): ExecutionError | null {
  if (typeof record !== 'object' || record === null) {
    return null;
  }
  for (const field of FORBIDDEN_AUTHORITY_FIELDS) {
    if (field in (record as Record<string, unknown>)) {
      return {
        code: 'authority-violation-rejected',
        message:
          `record declares the forbidden authority-claim field "${field}" — an execution-tracking record may not claim ` +
          'a second lifecycle/baseline/schedule/delivery authority (the ProgramOfWork stays the schedule authority; tracking records observe, never re-schedule)',
        field,
      };
    }
  }
  return null;
}

/**
 * The SCHEDULE-FIELD pre-classifier (the execution-tracking-specific
 * authority guard): a tracking/observation-family record declaring
 * ProgramOfWork schedule fields (plannedStart, plannedFinish,
 * actualStart, actualFinish, actualProgress, forecastFinish,
 * predecessors, successors) is attempting to re-schedule from the
 * tracking layer — the typed `authority-violation-rejected` BEFORE
 * schema validation.
 */
export const SCHEDULE_AUTHORITY_FIELDS: readonly string[] = [
  'plannedStart',
  'plannedFinish',
  'actualStart',
  'actualFinish',
  'actualProgress',
  'forecastFinish',
  'predecessors',
  'successors',
];

/** Classify a schedule-authority claim on an execution-tracking record. */
export function scheduleAuthorityError(record: unknown): ExecutionError | null {
  if (typeof record !== 'object' || record === null) {
    return null;
  }
  for (const field of SCHEDULE_AUTHORITY_FIELDS) {
    if (field in (record as Record<string, unknown>)) {
      return {
        code: 'authority-violation-rejected',
        message:
          `record declares the schedule field "${field}" — the activity's schedule authority STAYS in the ProgramOfWork; ` +
          'execution-tracking records OBSERVE state, they never re-schedule',
        field,
      };
    }
  }
  return null;
}

/**
 * The UNCERTAINTY pre-classifier (the W038 pin: "confidence/provenance/
 * freshness on EVERY observation — a record without it is
 * `uncertainty-missing-rejected`"): a record whose `uncertainty` member
 * is absent, not an object, or missing any of provenance / freshness /
 * confidence is the typed `uncertainty-missing-rejected` BEFORE schema
 * validation (the decision-sufficiency rule preserves what is not known;
 * an observation without uncertainty is inexpressible).
 */
export function uncertaintyMissingError(
  record: unknown,
  pathPrefix = '',
): ExecutionError | null {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    return null;
  }
  const missing: ('provenance' | 'freshness' | 'confidence' | 'uncertainty')[] = [];
  const uncertainty = (record as Record<string, unknown>)['uncertainty'];
  if (uncertainty === undefined) {
    missing.push('uncertainty');
  } else if (typeof uncertainty !== 'object' || uncertainty === null || Array.isArray(uncertainty)) {
    missing.push('uncertainty');
  } else {
    const state = uncertainty as Record<string, unknown>;
    for (const member of ['provenance', 'freshness', 'confidence'] as const) {
      if (state[member] === undefined || state[member] === null) {
        missing.push(member);
      }
    }
  }
  if (missing.length === 0) {
    return null;
  }
  const recordId =
    typeof (record as Record<string, unknown>)['recordId'] === 'string'
      ? ((record as Record<string, unknown>)['recordId'] as string)
      : undefined;
  const where = pathPrefix === '' ? 'record' : `${pathPrefix} record`;
  return {
    code: 'uncertainty-missing-rejected',
    message:
      `${where} is missing the mandatory uncertainty state (${missing.join(', ')}) — confidence/provenance/freshness ` +
      'travel on EVERY execution observation (the W036 distinction conventions; the decision-sufficiency rule preserves what is not known)',
    recordId,
    missing,
  };
}
