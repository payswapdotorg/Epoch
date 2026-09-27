/**
 * W036 error-taxonomy adapter: every W036 `DeliveryError` surfaced
 * through an actualization entry point is mapped onto the actualization
 * taxonomy (errors are values; the mapping is total and deterministic).
 * Actualization consumes the solution-delivery kernel — its typed
 * rejections are surfaced as the actualization-typed equivalents, never
 * swallowed and never re-implemented.
 *
 * The two semantic mappings of the authority boundary:
 * - W036 `unaccepted-actualization-rejected` maps onto
 *   `actualization-bypass-rejected` — the W036 authority refused to
 *   actualize an observation that was not ACCEPTED, which is precisely
 *   the bypass this package must never perform (the W038 precedent);
 * - W036 `cross-tenant-denied` maps onto `tenant-isolation-rejected`
 *   (R12).
 */
import type { DeliveryError } from '@epoch/solution-delivery';
import type { ActualizationError, ActualizationIssue } from './errors';

/** Map one W036 flattened issue onto the actualization issue shape. */
function mapIssue(issue: { path: unknown[] | string; message: string }): ActualizationIssue {
  const path = Array.isArray(issue.path) ? issue.path.map(String).join('.') : String(issue.path);
  return { path: path === '' ? '$' : path, message: issue.message };
}

/**
 * Total, deterministic mapping of W036 solution-delivery errors onto the
 * actualization taxonomy (see the module doc).
 */
export function mapDeliveryError(error: DeliveryError, subject: string): ActualizationError {
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
          'actualization converts ACCEPTED observations through the W036 authority path only; ' +
          'this package NEVER writes Actual records directly',
        recordId: error.observationId,
        recordKind: 'observation',
      };
    case 'cross-tenant-denied':
      return {
        code: 'tenant-isolation-rejected',
        message: error.message,
        expectedTenantId: error.expectedTenantId,
        encounteredTenantId: error.encounteredTenantId,
        subject,
      };
    case 'version-conflict':
      return {
        code: 'version-conflict',
        message: `solution-delivery kernel rejected the record: ${error.message}`,
        subject,
        subjectId: error.version,
        ...(error.publishedDigest !== undefined ? { publishedDigest: error.publishedDigest } : {}),
        ...(error.encounteredDigest !== undefined
          ? { encounteredDigest: error.encounteredDigest }
          : {}),
      };
    case 'lifecycle-conflict':
      return {
        code: 'lifecycle-conflict',
        message: error.message,
        subjectId: error.subjectId,
      };
    case 'forecast-overwrite-rejected':
      return {
        code: 'forecast-overwrite-rejected',
        message: error.message,
        forecastRecordId: error.forecastRecordId,
        refinesRecordId: error.refinesRecordId,
        refinesKind: error.refinesKind,
      };
    case 'distinction-collapse-rejected':
      return {
        code: 'validation',
        message: `solution-delivery kernel rejected the record (${error.code}): ${error.message}`,
        issues: [{ path: 'kind', message: `W036 code "${error.code}": ${error.message}` }],
      };
    default:
      return {
        code: 'validation',
        message: `solution-delivery kernel rejected the record (${error.code}): ${error.message}`,
        issues: [{ path: '$', message: `W036 code "${error.code}": ${error.message}` }],
      };
  }
}

/** Adapt a W036 result onto the actualization result type (total). */
export function adaptDeliveryResult<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: DeliveryError },
  subject: string,
):
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ActualizationError } {
  if (result.ok) {
    return { ok: true, value: result.value };
  }
  return { ok: false, error: mapDeliveryError(result.error, subject) };
}
