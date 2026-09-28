/**
 * @epoch/release-kit — shared primitives (Work Order W035).
 *
 * Opaque ids over the closed grammars of version.ts, the canonical-JSON
 * SHA-256 digest discipline of @epoch/agent-protocol (the SAME content
 * addressing every Epoch kernel uses), the total-result shape, and the
 * typed error value. Zero wall-clock, zero randomness, zero I/O.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  CHECKLIST_ID_PATTERN,
  CHECKLIST_ITEM_ID_PATTERN,
  MANIFEST_ID_PATTERN,
  NOTES_ID_PATTERN,
  RELEASE_ACTOR_PATTERN,
  RELEASE_ID_PATTERN,
  REVISION_PATTERN,
} from './version';

// --------------------------------------------------------------------------------
// Opaque ids.
// --------------------------------------------------------------------------------

/** One release-candidate id (`release:<slug>`). */
export const ReleaseIdSchema = z
  .string()
  .regex(RELEASE_ID_PATTERN, 'must be a release id of the form "release:<slug>"');

/** One release-notes id (`notes:<slug>`). */
export const NotesIdSchema = z
  .string()
  .regex(NOTES_ID_PATTERN, 'must be a notes id of the form "notes:<slug>"');

/** One readiness-checklist id (`rc:<slug>`). */
export const ChecklistIdSchema = z
  .string()
  .regex(CHECKLIST_ID_PATTERN, 'must be a checklist id of the form "rc:<slug>"');

/** One checklist-item id (`item:<index>:<slug>` — the W033 ops grammar). */
export const ChecklistItemIdSchema = z
  .string()
  .regex(CHECKLIST_ITEM_ID_PATTERN, 'must be an item id of the form "item:<index>:<slug>"');

/** One manifest id (`manifest:<16 hex>` — derived from the content digest). */
export const ManifestIdSchema = z
  .string()
  .regex(MANIFEST_ID_PATTERN, 'must be a manifest id of the form "manifest:<16 hex>"');

/** One acting actor (`actor:<slug>` — the W033 provenance grammar). */
export const ReleaseActorSchema = z
  .string()
  .regex(RELEASE_ACTOR_PATTERN, 'must be an actor id of the form "actor:<slug>"');

/** One exact source revision (40-hex git SHA, caller-supplied). */
export const RevisionSchema = z.string().regex(REVISION_PATTERN, 'must be a 40-hex git revision');

/** One non-negative safe integer. */
export const NonNegativeIntSchema = z
  .number()
  .int('must be an integer')
  .min(0, 'must be non-negative')
  .max(Number.MAX_SAFE_INTEGER, 'must be a safe integer');

/** One positive safe integer. */
export const PositiveIntSchema = z
  .number()
  .int('must be an integer')
  .min(1, 'must be positive')
  .max(Number.MAX_SAFE_INTEGER, 'must be a safe integer');

/** A canonical non-negative decimal string (exact arithmetic, never floats). */
export const NonNegativeDecimalSchema = z.string().regex(
  /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/,
  'must be a canonical non-negative decimal string',
);

/** A semver-core string (the shared SDK contract-version grammar). */
export const SemverCoreSchema = z.string().regex(
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/,
  'must be a semver core string (X.Y.Z)',
);

// --------------------------------------------------------------------------------
// Digest discipline.
// --------------------------------------------------------------------------------

/** The canonical SHA-256 digest of any JSON-serializable record content. */
export function digestOfJson(content: JsonValue): Sha256Hex {
  return canonicalDigest(content);
}

// --------------------------------------------------------------------------------
// Typed errors + the total-result shape.
// --------------------------------------------------------------------------------

/** One typed release-kit error (a value, never a thrown exception). */
export interface ReleaseError {
  readonly code: import('./version').ReleaseErrorCode;
  readonly message: string;
  /** The precise item/subject/record the error concerns (context). */
  readonly subject?: string;
  /** Open items, when the error is `release-not-ready`. */
  readonly openItems?: readonly string[];
}

/** The total result shape: a value or a typed error — never a throw. */
export type ReleaseResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ReleaseError };

/** Construct a failed result (the single construction path for errors). */
export function releaseFail(
  code: import('./version').ReleaseErrorCode,
  message: string,
  extra?: { readonly subject?: string; readonly openItems?: readonly string[] },
): ReleaseResult<never> {
  return { ok: false, error: { code, message, ...extra } };
}

/** The first zod issue as a human-readable validation string. */
export function firstIssueText(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue === undefined) return 'unknown validation issue';
  const path = issue.path.length > 0 ? ` at "${issue.path.join('.')}"` : '';
  return `${issue.message}${path}`;
}
