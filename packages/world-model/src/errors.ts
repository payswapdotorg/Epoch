/**
 * Typed error taxonomy for the Canonical World Model.
 *
 * Every failure mode of the world model authority surfaces as a
 * `WorldModelError` with a stable machine-readable `code`. Callers never
 * receive raw parser errors.
 */

export type WorldModelErrorCode =
  /** Input failed schema validation (malformed statement, provenance, confidence, validity, ...). */
  | 'WM_VALIDATION'
  /** A referenced object (entity, assertion, type, mapping) does not exist. */
  | 'WM_NOT_FOUND'
  /** A referenced object exists but its type does not satisfy the required relation endpoint types. */
  | 'WM_TYPE_MISMATCH'
  /** The request conflicts with existing state (duplicate key, superseding a non-live assertion, ...). */
  | 'WM_CONFLICT'
  /** Snapshot or record integrity failed (digest mismatch, derived-key mismatch, broken links, core vocabulary tampering). */
  | 'WM_INTEGRITY'
  /** Serialized form carries an unknown schema or contract version. */
  | 'WM_VERSION_MISMATCH'
  /** Temporal query or write is inconsistent (invalid instant, non-monotonic history). */
  | 'WM_TEMPORAL'
  /** An authority/security boundary was violated (reserved namespaces, kernel vocabulary injection, unattributed writes). */
  | 'WM_AUTHORITY'
  /** A serialized payload is not a well-formed world model document. */
  | 'WM_SCHEMA';

export class WorldModelError extends Error {
  readonly code: WorldModelErrorCode;
  readonly details: readonly string[];

  constructor(code: WorldModelErrorCode, message: string, details: readonly string[] = []) {
    super(details.length > 0 ? `${message} (${details.join('; ')})` : message);
    this.name = 'WorldModelError';
    this.code = code;
    this.details = details;
  }
}

/** Format zod issues into stable, readable detail strings. */
export function issuesToDetails(issues: readonly { path: (string | number | symbol)[]; message: string }[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.map((p) => String(p)).join('.');
    return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
  });
}
