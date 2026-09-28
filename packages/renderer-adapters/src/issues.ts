/**
 * Typed-error construction helpers (the W011/W013/W016 issues precedent):
 * deterministic message strings and flattened zod issue paths so every
 * admission failure is a typed record with precise diagnostics.
 */
import type { z } from 'zod';
import type { RendererAdaptersError, RendererAdaptersIssue } from './errors';

/** Flatten a zod failure into the typed issue list (dotted paths). */
export function flattenZodIssues(error: z.ZodError): RendererAdaptersIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/** The malformed-record error of a zod failure. */
export function malformedRecordError(
  error: z.ZodError,
): Extract<RendererAdaptersError, { readonly code: 'malformed-record' }> {
  const issues = flattenZodIssues(error);
  const first = issues[0];
  const detail = first ? ` (${first.path}: ${first.message})` : '';
  return {
    code: 'malformed-record',
    message: `the renderer-adapters document failed schema admission${detail}`,
    issues,
  };
}

/** The malformed-record error of an ad-hoc issue list. */
export function malformedRecord(issues: readonly RendererAdaptersIssue[]): RendererAdaptersError {
  const first = issues[0];
  const detail = first ? ` (${first.path}: ${first.message})` : '';
  return {
    code: 'malformed-record',
    message: `the renderer-adapters document failed schema admission${detail}`,
    issues: [...issues],
  };
}

/** The root-shape malformed-record error. */
export function rootShapeError(): RendererAdaptersError {
  return {
    code: 'malformed-record',
    message: 'renderer-adapters document root must be a JSON object',
    issues: [{ path: '$', message: 'expected a JSON object at the document root' }],
  };
}

/** The version-unsupported error. */
export function versionUnsupportedError(
  expected: string,
  encountered: string,
): RendererAdaptersError {
  return {
    code: 'version-unsupported',
    message: `protocol version mismatch: expected ${expected}, encountered ${encountered}`,
    expected,
    encountered,
  };
}

/** The cross-tenant-denied error (R12). */
export function crossTenantDeniedError(
  path: readonly (string | number)[],
  expectedTenantId: string,
  encounteredTenantId: string,
): RendererAdaptersError {
  return {
    code: 'cross-tenant-denied',
    message: `cross-tenant renderer-adapter operation denied: expected tenant "${expectedTenantId}", encountered "${encounteredTenantId}"`,
    path: [...path],
    expectedTenantId,
    encounteredTenantId,
  };
}

/** The digest-mismatch error. */
export function digestMismatchError(
  path: readonly (string | number)[],
  expected: string,
  encountered: string,
): RendererAdaptersError {
  return {
    code: 'digest-mismatch',
    message:
      'the claimed digest does not match the recomputed content digest (tampered or mismatched record) — the document is rejected',
    path: [...path],
    expected,
    encountered,
  };
}

/** The assessment-device-mismatch error (decision-input integrity). */
export function assessmentDeviceMismatchError(): Extract<
  RendererAdaptersError,
  { readonly code: 'assessment-device-mismatch' }
> {
  return {
    code: 'assessment-device-mismatch',
    message:
      'the supplied assessment does not assess the binding\u2019s device descriptor — the selection inputs must be about the same device',
  };
}
