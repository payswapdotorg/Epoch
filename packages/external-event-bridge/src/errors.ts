/**
 * The typed external-event-bridge error taxonomy (the W042 dispatch pin,
 * following the W036/W041 precedent). Every entry point is total —
 * errors are VALUES, never exceptions:
 *
 * - `version-unsupported` — schemaVersion skew (expected/encountered);
 * - `validation` — malformed records (strict objects reject unknown
 *   vendor/provider fields);
 * - `digest-mismatch` — a claimed digest that does not match recomputed
 *   canonical SHA-256 (tamper detection);
 * - `replay-conflict` — the same idempotency key replayed with
 *   DIFFERENT content (identical replay is the sealed prior receipt,
 *   never an error);
 * - `tenant-isolation-rejected` — a tenant scope violation (R12; the
 *   W009 gate or the pinned tenant disagreed with the record's tenant);
 * - `authorization-bypass-rejected` — an operation attempted without a
 *   verifiable prior W009 decision that covers the exact request
 *   (the two-stage discipline: the decision point always precedes the
 *   bridge stage);
 * - `observation-bypass-rejected` — an attempt to make the bridge write
 *   or accept observations directly (inbound events PROPOSE observation
 *   intake through the authority path; they never present themselves as
 *   observations);
 * - `least-privilege-violation-rejected` — an outbound dispatch whose
 *   payload is not filtered to the projection-policy reference (an
 *   unfiltered send, or a payload field outside the allowlist);
 * - `authority-violation` — a structurally invalid authority claim on
 *   the intake path (a payload embedding a sealed authority record).
 */
/** One flattened validation issue (dotted path + message; "$" = root). */
export interface BridgeIssue {
  readonly path: string;
  readonly message: string;
}

/** The closed error-code vocabulary. */
export type BridgeErrorCode =
  | 'version-unsupported'
  | 'validation'
  | 'digest-mismatch'
  | 'replay-conflict'
  | 'tenant-isolation-rejected'
  | 'authorization-bypass-rejected'
  | 'observation-bypass-rejected'
  | 'least-privilege-violation-rejected'
  | 'authority-violation';

/** The typed error union (values, never thrown). */
export type BridgeError =
  | { readonly code: 'version-unsupported'; readonly message: string; readonly expected: number; readonly encountered: string; readonly issues: readonly BridgeIssue[] }
  | { readonly code: 'validation'; readonly message: string; readonly issues: readonly BridgeIssue[] }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
      readonly subject: string;
    }
  | {
      readonly code: 'replay-conflict';
      readonly message: string;
      readonly idempotencyKey: string;
      readonly subject: string;
    }
  | {
      readonly code: 'tenant-isolation-rejected';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
    }
  | {
      readonly code: 'authorization-bypass-rejected';
      readonly message: string;
      readonly reason:
        | 'decision-missing'
        | 'decision-unverifiable'
        | 'request-digest-mismatch'
        | 'decision-not-allow'
        | 'resource-untenanted';
    }
  | {
      readonly code: 'observation-bypass-rejected';
      readonly message: string;
      readonly reason: 'sealed-observation-payload' | 'authority-record-payload';
    }
  | {
      readonly code: 'least-privilege-violation-rejected';
      readonly message: string;
      readonly reason:
        | 'projection-missing'
        | 'field-outside-allowlist'
        | 'empty-allowlist'
        | 'policy-digest-mismatch';
      readonly violatingPaths?: readonly string[];
    }
  | { readonly code: 'authority-violation'; readonly message: string; readonly reason: string };

/** The total result type (the W003/W036 convention). */
export type BridgeResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: BridgeError };
