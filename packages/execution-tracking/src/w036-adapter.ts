/**
 * W036 error-taxonomy adapter: every W036 `DeliveryError` surfaced through
 * an execution-tracking entry point is mapped onto the execution-tracking
 * taxonomy (errors are values; the mapping is total and deterministic).
 * Execution-tracking consumes the solution-delivery kernel — its typed
 * rejections are surfaced as the execution-typed equivalents, never
 * swallowed and never re-implemented.
 *
 * The one semantic addition: W036 `unaccepted-actualization-rejected`
 * maps onto the execution `actualization-bypass-rejected` — the W036
 * authority refused to actualize an observation that was not ACCEPTED,
 * which is precisely the authority boundary execution-tracking must
 * never bypass.
 */
import type { DeliveryError } from '@epoch/solution-delivery';
import type { ExecutionError, ExecutionIssue } from './errors';

/** Map one W036 flattened issue onto the execution issue shape. */
function mapIssue(issue: { path: unknown[] | string; message: string }): ExecutionIssue {
  const path = Array.isArray(issue.path) ? issue.path.map(String).join('.') : String(issue.path);
  return { path: path === '' ? '$' : path, message: issue.message };
}

/**
 * Total, deterministic mapping of W036 solution-delivery errors onto the
 * execution-tracking taxonomy:
 * - `validation` / `vendor-fields-rejected` map by kind;
 * - `digest-mismatch` maps identically (expected/encountered);
 * - `unaccepted-actualization-rejected` maps onto
 *   `actualization-bypass-rejected` (the authority boundary);
 * - `cross-tenant-denied` maps onto `tenant-isolation-rejected`;
 * - `lifecycle-conflict` maps onto the execution lifecycle conflict;
 * - every other W036 code (schedule/baseline/authority/forecast/...)
 *   surfaces as an execution `validation` error carrying the original
 *   message and code (never swallowed, never re-implemented).
 */
export function mapDeliveryError(error: DeliveryError, subject: string): ExecutionError {
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
    case 'unaccepted-actualization-rejected':
      return {
        code: 'actualization-bypass-rejected',
        message:
          `the W036 DeliveryRecord authority rejected the actualization (${error.message}) — ` +
          'execution-tracking produces observations and reconciles them; it NEVER writes Actual records directly',
        recordId: error.observationId,
        recordKind: 'observation',
      };
    case 'distinction-collapse-rejected':
      return {
        code: 'validation',
        message: `solution-delivery kernel rejected the record (${error.code}): ${error.message}`,
        issues: [
          {
            path: 'kind',
            message: `W036 code "${error.code}": ${error.message}`,
          },
        ],
      };
    case 'cross-tenant-denied':
      return {
        code: 'tenant-isolation-rejected',
        message: error.message,
        expectedTenantId: error.expectedTenantId,
        encounteredTenantId: error.encounteredTenantId,
        subject,
      };
    case 'lifecycle-conflict':
      return {
        code: 'lifecycle-conflict',
        message: error.message,
        subjectId: error.subjectId,
        from: 'w036-state',
        to: 'w036-state',
      };
    default:
      return {
        code: 'validation',
        message: `solution-delivery kernel rejected the record (${error.code}): ${error.message}`,
        issues: [{ path: '$', message: `W036 code "${error.code}": ${error.message}` }],
      };
  }
}

/** Adapt a W036 result onto the execution result type (total). */
export function adaptDeliveryResult<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: DeliveryError },
  subject: string,
): { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ExecutionError } {
  if (result.ok) {
    return { ok: true, value: result.value };
  }
  return { ok: false, error: mapDeliveryError(result.error, subject) };
}
