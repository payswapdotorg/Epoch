/**
 * Flattened-issue helpers shared by the marketplace total entry points —
 * zod issues become typed {@link MarketplaceIssue} values with precise
 * dotted paths (the W006/W007/W010 issue style), plus the vendor-field
 * classifier that turns strict-object `unrecognized_keys` rejections into
 * the typed `vendor-fields-rejected` error.
 */
import type { ZodError } from 'zod';
import type { MarketplaceError, MarketplaceIssue } from './errors';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): MarketplaceIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Build the typed `validation` error for a zod failure. */
export function validationError(error: ZodError): MarketplaceError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `marketplace document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/**
 * Whether a zod failure includes a strict-object `unrecognized_keys`
 * rejection — the structural signal that unknown (vendor/provider) fields
 * attempted to enter a marketplace record.
 */
export function hasUnrecognizedKeys(error: ZodError): boolean {
  return error.issues.some((issue) => issue.code === 'unrecognized_keys');
}

/** The path of the first `unrecognized_keys` issue (empty array if none). */
export function unrecognizedKeysPath(error: ZodError): (string | number)[] {
  const issue = error.issues.find((candidate) => candidate.code === 'unrecognized_keys');
  if (issue === undefined) return [];
  return issue.path.filter(
    (segment): segment is string | number => typeof segment === 'string' || typeof segment === 'number',
  );
}

/** Build the typed `vendor-fields-rejected` error for a zod failure. */
export function vendorFieldsError(error: ZodError): MarketplaceError {
  const issues = flattenZodIssues(error);
  return {
    code: 'vendor-fields-rejected',
    message:
      'record carries unknown structural fields — provider/vendor fields cannot enter marketplace records ' +
      '(strict objects; adapterize provider semantics behind the PaymentPort seam instead)',
    issues,
    path: unrecognizedKeysPath(error),
  };
}
