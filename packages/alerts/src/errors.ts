/**
 * The typed alerts error taxonomy (values, never thrown — the W036
 * convention). Every admission surface returns {@link AlertsResult}
 * with one of these codes.
 */
import type { AlertResolutionKind, EscalationOutcomeKind, NotificationChannelKind, NotificationTargetKind } from './version';

/** One flattened alerts issue (dotted path + message; "$" = root). */
export interface AlertsIssue {
  readonly path: string;
  readonly message: string;
}

/** The closed alerts error-code vocabulary. */
export type AlertsErrorCode =
  | 'validation'
  | 'vendor-fields-rejected'
  | 'digest-mismatch'
  | 'gateway-bypass-rejected'
  | 'provider-vocabulary-rejected'
  | 'tenant-isolation-rejected'
  | 'replay-conflict'
  | 'lifecycle-conflict'
  | 'dangling-reference-rejected'
  | 'version-conflict';

/** The typed alerts error union. */
export type AlertsError =
  | { readonly code: 'validation'; readonly message: string; readonly issues: readonly AlertsIssue[] }
  | { readonly code: 'vendor-fields-rejected'; readonly message: string; readonly issues: readonly AlertsIssue[] }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
      readonly subject: string;
    }
  | {
      readonly code: 'gateway-bypass-rejected';
      readonly message: string;
      readonly reason: 'decision-missing' | 'decision-unverifiable' | 'proposal-unbound';
      readonly subject: string;
    }
  | {
      readonly code: 'provider-vocabulary-rejected';
      readonly message: string;
      readonly channelKind?: NotificationChannelKind | string | undefined;
      readonly targetKind?: NotificationTargetKind | string | undefined;
      readonly subject: string;
    }
  | {
      readonly code: 'tenant-isolation-rejected';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
      readonly subject: string;
    }
  | {
      readonly code: 'replay-conflict';
      readonly message: string;
      readonly subject: string;
      readonly publishedDigest: string;
      readonly encounteredDigest: string;
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly subjectId: string;
      readonly resolutionKind?: AlertResolutionKind | undefined;
    }
  | {
      readonly code: 'dangling-reference-rejected';
      readonly message: string;
      readonly referenceKind: string;
      readonly referenceId: string;
    }
  | {
      readonly code: 'version-conflict';
      readonly message: string;
      readonly subject: string;
      readonly subjectId: string;
    };

/** The total result wrapper of every alerts admission surface. */
export type AlertsResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AlertsError };

/** Context carried by escalation helpers for typed error construction. */
export interface AlertsErrorContext {
  readonly outcomeKind?: EscalationOutcomeKind | undefined;
}
