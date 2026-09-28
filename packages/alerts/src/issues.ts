/**
 * Flattened-issue pre-classifiers (the W036/W038 convention) plus the
 * two W043-specific seam classifiers:
 *
 * - `providerVocabularyError` — out-of-vocabulary channel kinds / target
 *   kinds at the NotificationPort seam are provider vocabulary: typed
 *   `provider-vocabulary-rejected` BEFORE generic validation (the
 *   kernel never names providers; the closed neutral vocabularies are
 *   the seam's grammar);
 * - `gatewayBypassError` — an escalation outcome claimed without a
 *   verifiable gateway decision: typed `gateway-bypass-rejected` (the
 *   alerts kernel NEVER executes anything; policy decision FIRST).
 */
import { z } from 'zod';
import type { AlertsError, AlertsIssue, AlertsResult } from './errors';

/** Rebuild a dotted path from a zod issue path. */
function dottedPath(path: Array<string | number>): string {
  if (path.length === 0) {
    return '$';
  }
  let out = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      out += `[${segment}]`;
    } else if (out === '') {
      out = segment;
    } else {
      out += `.${segment}`;
    }
  }
  return out;
}

/** Flatten a zod error into typed alerts issues. */
export function flattenIssues(error: z.ZodError): AlertsIssue[] {
  return error.issues.map((issue) => ({
    path: dottedPath(issue.path as Array<string | number>),
    message: issue.message,
  }));
}

/** Whether a zod failure includes unrecognized keys (vendor fields). */
export function hasUnrecognizedKeys(error: z.ZodError): boolean {
  return error.issues.some((issue) => issue.code === 'unrecognized_keys');
}

/** The typed vendor-field rejection. */
export function vendorFieldsError(error: z.ZodError): AlertsError {
  return {
    code: 'vendor-fields-rejected',
    message:
      'the record carries unrecognized keys — alerts records are strict; vendor/provider fields are rejected (lock rule 13)',
    issues: flattenIssues(error),
  };
}

/** The typed validation failure. */
export function validationError(error: z.ZodError): AlertsError {
  return {
    code: 'validation',
    message: 'the record does not satisfy the alerts record schema',
    issues: flattenIssues(error),
  };
}

/** The typed PROVIDER-VOCABULARY rejection (the NotificationPort seam). */
export function providerVocabularyError(
  subject: string,
  detail: { channelKind?: string; targetKind?: string },
): AlertsError {
  return {
    code: 'provider-vocabulary-rejected',
    message:
      `provider vocabulary is rejected at the notification seam ("${subject}"): ` +
      `channel kinds and target kinds are closed neutral vocabularies — concrete providers are adapters behind the NotificationPort (encountered: ${JSON.stringify(detail)})`,
    channelKind: detail.channelKind,
    targetKind: detail.targetKind,
    subject,
  };
}

/** The typed GATEWAY-BYPASS rejection (the W022 authority seam). */
export function gatewayBypassError(
  subject: string,
  reason: 'decision-missing' | 'decision-unverifiable' | 'proposal-unbound',
): AlertsError {
  return {
    code: 'gateway-bypass-rejected',
    message:
      `the escalation outcome for "${subject}" cannot be recorded without a verifiable gateway decision (${reason}) — ` +
      'escalation actions are typed proposals through the W022 authority seam; the alerts kernel NEVER executes anything',
    reason,
    subject,
  };
}

/** Wrap a typed error into the total result (helper). */
export function fail<T>(error: AlertsError): AlertsResult<T> {
  return { ok: false, error };
}
