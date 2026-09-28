/**
 * Typed-error construction helpers (the W011/W013/W016 issues precedent):
 * deterministic message strings and flattened zod issue paths so every
 * admission failure is a typed record with precise diagnostics.
 */
import type { z } from 'zod';
import type { ProgressiveSceneError, ProgressiveSceneIssue } from './errors';

/** Flatten a zod failure into the typed issue list (dotted paths). */
export function flattenZodIssues(error: z.ZodError): ProgressiveSceneIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/** The malformed-record error of a zod failure. */
export function malformedRecordError(
  error: z.ZodError,
): Extract<ProgressiveSceneError, { readonly code: 'malformed-record' }> {
  const issues = flattenZodIssues(error);
  const first = issues[0];
  const detail = first ? ` (${first.path}: ${first.message})` : '';
  return {
    code: 'malformed-record',
    message: `the progressive-scene document failed schema admission${detail}`,
    issues,
  };
}

/** The malformed-record error of an ad-hoc issue list. */
export function malformedRecord(issues: readonly ProgressiveSceneIssue[]): ProgressiveSceneError {
  const first = issues[0];
  const detail = first ? ` (${first.path}: ${first.message})` : '';
  return {
    code: 'malformed-record',
    message: `the progressive-scene document failed schema admission${detail}`,
    issues: [...issues],
  };
}

/** The root-shape malformed-record error. */
export function rootShapeError(): ProgressiveSceneError {
  return {
    code: 'malformed-record',
    message: 'progressive-scene document root must be a JSON object',
    issues: [{ path: '$', message: 'expected a JSON object at the document root' }],
  };
}

/** The version-unsupported error. */
export function versionUnsupportedError(
  expected: string,
  encountered: string,
): ProgressiveSceneError {
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
): ProgressiveSceneError {
  return {
    code: 'cross-tenant-denied',
    message: `cross-tenant progressive-scene operation denied: expected tenant "${expectedTenantId}", encountered "${encounteredTenantId}"`,
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
): ProgressiveSceneError {
  return {
    code: 'digest-mismatch',
    message:
      'the claimed digest does not match the recomputed content digest (tampered or mismatched record) — the document is rejected',
    path: [...path],
    expected,
    encountered,
  };
}

/** The unfittable-scene error (the typed honest answer). */
export function unfittableSceneError(
  minimalUsage: { readonly nodes: number; readonly edges: number; readonly estimatedTriangles: number; readonly assetBytes: number },
  limits: { readonly maxGraphNodes: number; readonly maxGraphEdges: number; readonly maxTriangles?: number; readonly maxTextureBytes?: number },
): ProgressiveSceneError {
  return {
    code: 'unfittable-scene',
    message:
      `even the minimal-core rung (nodes=${minimalUsage.nodes}, triangles=${minimalUsage.estimatedTriangles}, assetBytes=${minimalUsage.assetBytes}) ` +
      `cannot fit the target budgets — progressive adaptation is honest: no silent clamp`,
    minimalUsage: { ...minimalUsage },
    limits: { ...limits },
  };
}

/** The invalid-rung-index error. */
export function invalidRungIndexError(encountered: number, rungCount: number): ProgressiveSceneError {
  return {
    code: 'invalid-rung-index',
    message: `rung index ${encountered} is outside the ladder (valid indices: 0..${rungCount - 1})`,
    encountered,
    rungCount,
  };
}
