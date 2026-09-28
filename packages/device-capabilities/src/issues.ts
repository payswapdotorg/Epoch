/**
 * Typed-error construction helpers (the W011/W013/W016 issues precedent):
 * deterministic message strings and flattened zod issue paths so every
 * admission failure is a typed record with precise diagnostics.
 */
import type { z } from 'zod';
import type { DeviceCapabilitiesError, DeviceCapabilitiesIssue } from './errors';

/** Flatten a zod failure into the typed issue list (dotted paths). */
export function flattenZodIssues(error: z.ZodError): DeviceCapabilitiesIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/** The malformed-record error of a zod failure. */
export function malformedRecordError(
  error: z.ZodError,
): Extract<DeviceCapabilitiesError, { readonly code: 'malformed-record' }> {
  const issues = flattenZodIssues(error);
  const first = issues[0];
  const detail = first ? ` (${first.path}: ${first.message})` : '';
  return {
    code: 'malformed-record',
    message: `the device-capabilities document failed schema admission${detail}`,
    issues,
  };
}

/** The malformed-record error of an ad-hoc issue list. */
export function malformedRecord(
  issues: readonly DeviceCapabilitiesIssue[],
): DeviceCapabilitiesError {
  const first = issues[0];
  const detail = first ? ` (${first.path}: ${first.message})` : '';
  return {
    code: 'malformed-record',
    message: `the device-capabilities document failed schema admission${detail}`,
    issues: [...issues],
  };
}

/** The root-shape malformed-record error. */
export function rootShapeError(): DeviceCapabilitiesError {
  return {
    code: 'malformed-record',
    message: 'device-capabilities document root must be a JSON object',
    issues: [{ path: '$', message: 'expected a JSON object at the document root' }],
  };
}

/** The version-unsupported error. */
export function versionUnsupportedError(
  expected: string,
  encountered: string,
): DeviceCapabilitiesError {
  return {
    code: 'version-unsupported',
    message: `protocol version mismatch: expected ${expected}, encountered ${encountered}`,
    expected,
    encountered,
  };
}

/** The unknown-device-class error. */
export function unknownDeviceClassError(encountered: string): DeviceCapabilitiesError {
  return {
    code: 'unknown-device-class',
    message: `"${encountered}" is not a W011 device class — the profile table is closed`,
    encountered,
  };
}

/** The digest-mismatch error. */
export function digestMismatchError(
  path: readonly (string | number)[],
  expected: string,
  encountered: string,
): DeviceCapabilitiesError {
  return {
    code: 'digest-mismatch',
    message:
      'the claimed digest does not match the recomputed content digest (tampered or mismatched record) — the document is rejected',
    path: [...path],
    expected,
    encountered,
  };
}
