/**
 * Flattened-issue helpers shared by the procurement total entry points —
 * zod issues become typed {@link ProcurementIssue} values with precise
 * dotted paths (the W036 issue style), plus the vendor-field classifier
 * that turns strict-object `unrecognized_keys` rejections into the typed
 * `vendor-fields-rejected` error, and the authority-field pre-classifier
 * (the W036 forbidden-field list classified BEFORE schema validation).
 */
import type { ZodError } from 'zod';
import { FORBIDDEN_AUTHORITY_FIELDS } from '@epoch/solution-delivery';
import type { ProcurementError, ProcurementIssue } from './errors';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): ProcurementIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Build the typed `validation` error for a zod failure. */
export function validationError(error: ZodError): ProcurementError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `procurement document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/**
 * Whether a zod failure includes a strict-object `unrecognized_keys`
 * rejection — the structural signal that unknown (vendor/provider) fields
 * attempted to enter a procurement record.
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
export function vendorFieldsError(error: ZodError): ProcurementError {
  const issues = flattenZodIssues(error);
  return {
    code: 'vendor-fields-rejected',
    message:
      'record carries unknown structural fields — provider/vendor fields cannot enter procurement records ' +
      '(strict objects; supplier systems stay behind the service-layer SupplierPort adapter seam)',
    issues,
    path: unrecognizedKeysPath(error),
  };
}

/**
 * The authority-field pre-classifier (the W036/marketplace pricing
 * pre-classification pattern): a record declaring one of the
 * DP1.0-forbidden authority-claim field names is claiming a second
 * lifecycle/baseline/schedule/delivery authority — a typed
 * `authority-violation-rejected` BEFORE any schema validation.
 */
export function authorityViolationError(record: unknown): ProcurementError | null {
  if (typeof record !== 'object' || record === null) {
    return null;
  }
  for (const field of FORBIDDEN_AUTHORITY_FIELDS) {
    if (field in (record as Record<string, unknown>)) {
      return {
        code: 'authority-violation-rejected',
        message:
          `record declares the forbidden authority-claim field "${field}" — a procurement projection may not claim ` +
          'a second lifecycle/baseline/schedule/delivery authority (USL1.0/DP1.0; architecture questions, not fields)',
        field,
      };
    }
  }
  return null;
}
