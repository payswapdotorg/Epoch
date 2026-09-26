/**
 * Flattened-issue helpers shared by the simulation-fabric total entry
 * points — zod issues become typed {@link FabricIssue} values with
 * precise dotted paths (the W006/W007/W010/W023/W036 issue style), plus
 * the vendor-field classifier that turns strict-object
 * `unrecognized_keys` rejections into the typed `vendor-fields-rejected`
 * error (a structural copy of a foreign record is rejected before it can
 * enter a fabric document).
 */
import type { ZodError } from 'zod';
import type { FabricError, FabricIssue } from './errors';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): FabricIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Build the typed `validation` error for a zod failure. */
export function validationError(error: ZodError): FabricError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `simulation-fabric document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/**
 * Whether a zod failure includes a strict-object `unrecognized_keys`
 * rejection — the structural signal that unknown (vendor/provider) fields
 * or a structural copy of a foreign record attempted to enter a fabric
 * document.
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
export function vendorFieldsError(error: ZodError): FabricError {
  const issues = flattenZodIssues(error);
  return {
    code: 'vendor-fields-rejected',
    message:
      'document carries unknown structural fields — provider/vendor fields and structural copies of foreign records cannot enter simulation-fabric documents ' +
      '(bind capability registrations by typed opaque reference; adapterize provider semantics behind the SimulationExecutionPort seam instead)',
    issues,
    path: unrecognizedKeysPath(error),
  };
}

/** Re-path a fabric validation error under a dotted prefix. */
export function rePathError(error: FabricError, prefix: string): FabricError {
  if (error.code !== 'validation' && error.code !== 'vendor-fields-rejected') {
    return { ...error, message: `${prefix}: ${error.message}` };
  }
  return {
    ...error,
    message: `${prefix}: ${error.message}`,
    issues: error.issues.map((issue) => ({
      path: issue.path === '' ? prefix : `${prefix}.${issue.path}`,
      message: issue.message,
    })),
  };
}
