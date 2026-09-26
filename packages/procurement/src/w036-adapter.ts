/**
 * W036 error-taxonomy adapter: every W036 `DeliveryError` surfaced
 * through a procurement entry point is mapped onto the procurement
 * taxonomy (errors are values; the mapping is total and deterministic).
 * Procurement consumes the solution-delivery kernel — its typed
 * rejections are surfaced as the procurement-typed equivalents, never
 * swallowed and never re-implemented.
 */
import type { DeliveryError } from '@epoch/solution-delivery';
import type { ProcurementError, ProcurementIssue } from './errors';

/** Map one W036 flattened issue onto the procurement issue shape. */
function mapIssue(issue: { path: unknown[] | string; message: string }): ProcurementIssue {
  const path = Array.isArray(issue.path) ? issue.path.map(String).join('.') : String(issue.path);
  return { path: path === '' ? '$' : path, message: issue.message };
}

/**
 * Total, deterministic mapping of W036 solution-delivery errors onto
 * the procurement taxonomy:
 * - `validation` / `vendor-fields-rejected` map by kind;
 * - `digest-mismatch` maps identically (expected/encountered);
 * - `distinction-collapse-rejected` maps onto the procurement
 *   distinction-collapse rejection (publishedKind -> expectedKind);
 * - `cross-tenant-denied` maps onto `tenant-isolation-rejected`;
 * - every other W036 code (schedule/lifecycle/baseline/authority/...)
 *   surfaces as a procurement `validation` error carrying the original
 *   message and code (never swallowed, never re-implemented).
 */
export function mapDeliveryError(error: DeliveryError, subject: string): ProcurementError {
  switch (error.code) {
    case 'validation':
      return {
        code: 'validation',
        message: `solution-delivery kernel rejected the record: ${error.message}`,
        issues: error.issues.map(mapIssue),
      };
    case 'vendor-fields-rejected':
      return {
        code: 'vendor-fields-rejected',
        message: `solution-delivery kernel rejected the record: ${error.message}`,
        issues: error.issues.map(mapIssue),
        path: [],
      };
    case 'digest-mismatch':
      return {
        code: 'digest-mismatch',
        message: error.message,
        expected: error.expected,
        encountered: error.encountered,
      };
    case 'distinction-collapse-rejected':
      return {
        code: 'distinction-collapse-rejected',
        message: error.message,
        recordId: error.recordId,
        expectedKind: error.publishedKind,
        encounteredKind: error.encounteredKind,
      };
    case 'cross-tenant-denied':
      return {
        code: 'tenant-isolation-rejected',
        message: error.message,
        expectedTenantId: error.expectedTenantId,
        encounteredTenantId: error.encounteredTenantId,
        subject,
      };
    default:
      return {
        code: 'validation',
        message: `solution-delivery kernel rejected the record (${error.code}): ${error.message}`,
        issues: [{ path: '$', message: `W036 code "${error.code}": ${error.message}` }],
      };
  }
}

/** Adapt a W036 result onto the procurement result type (total). */
export function adaptDeliveryResult<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: DeliveryError },
  subject: string,
): { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ProcurementError } {
  if (result.ok) {
    return { ok: true, value: result.value };
  }
  return { ok: false, error: mapDeliveryError(result.error, subject) };
}
