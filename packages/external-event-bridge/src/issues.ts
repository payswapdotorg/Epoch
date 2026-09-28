/**
 * Flattened-issue helpers shared by the external-event-bridge total entry
 * points — zod issues become typed {@link BridgeIssue} values with
 * precise dotted paths (the W006/W007/W010/W036 issue style), plus the
 * version-skew classifier that surfaces `schemaVersion` drift as the
 * typed `version-unsupported` error BEFORE any other diagnostic.
 */
import type { ZodError } from 'zod';
import { EXTERNAL_EVENT_BRIDGE_RECORD_VERSION } from './version';
import type { BridgeError, BridgeIssue } from './errors';

/** Flatten a zod failure into dotted-path issues. */
export function flattenZodIssues(error: ZodError): BridgeIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
}

/** Whether a zod failure pins the schemaVersion literal (version skew). */
export function isVersionSkew(error: ZodError): boolean {
  return error.issues.some((issue) => issue.path.includes('schemaVersion'));
}

/** Build the typed `version-unsupported` error for a version-skew failure. */
export function versionSkewError(error: ZodError): BridgeError {
  return {
    code: 'version-unsupported',
    message: `bridge document carries a schemaVersion other than ${EXTERNAL_EVENT_BRIDGE_RECORD_VERSION} — version skew is rejected before any other diagnostic`,
    expected: EXTERNAL_EVENT_BRIDGE_RECORD_VERSION,
    encountered: 'unknown (see issues)',
    issues: flattenZodIssues(error),
  };
}

/** Build the typed `validation` error for a zod failure. */
export function validationError(error: ZodError): BridgeError {
  const issues = flattenZodIssues(error);
  return {
    code: 'validation',
    message: `external-event-bridge document failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues,
  };
}

/**
 * Classify one zod failure: version skew first (the admission
 * precedence), then plain validation.
 */
export function classifiedParseError(error: ZodError): BridgeError {
  return isVersionSkew(error) ? versionSkewError(error) : validationError(error);
}
