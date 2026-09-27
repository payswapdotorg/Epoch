/**
 * The W036 adapter: maps @epoch/solution-delivery errors onto the
 * access-projection taxonomy, so canonical-record verification failures
 * surface as THIS kernel's typed errors (the W038 w036-adapter
 * precedent).
 */
import type { DeliveryError } from '@epoch/solution-delivery';
import type { AccessProjectionError } from './errors';

/** Map one W036 delivery error onto the access-projection taxonomy. */
export function mapDeliveryError(error: DeliveryError, subject: string): AccessProjectionError {
  switch (error.code) {
    case 'digest-mismatch':
      return {
        code: 'digest-mismatch',
        message: `canonical record "${subject}" failed digest verification: ${error.message}`,
        expected: error.expected,
        encountered: error.encountered,
      };
    case 'cross-tenant-denied':
      return {
        code: 'tenant-isolation-rejected',
        message: `canonical record "${subject}" failed the W036 tenant gate: ${error.message}`,
        expectedTenantId: error.expectedTenantId,
        encounteredTenantId: error.encounteredTenantId,
        subject,
      };
    default:
      return {
        code: 'validation',
        message: `canonical record "${subject}" failed W036 validation: ${error.message}`,
        issues: [{ path: '$', message: error.message }],
      };
  }
}

/** Adapt one W036 total result onto the access-projection result type. */
export function adaptDeliveryResult<T>(
  result: { ok: true; value: T } | { ok: false; error: DeliveryError },
  subject: string,
): { ok: true; value: T } | { ok: false; error: AccessProjectionError } {
  if (result.ok) return result;
  return { ok: false, error: mapDeliveryError(result.error, subject) };
}
