/**
 * The typed variance error taxonomy (W039 Tech Lead pin; mirrors the
 * issue-code style of W006/W007/W009/W010/W023/W036/W037/W038/W039-
 * actualization). Every entry point is total — errors are values, never
 * exceptions.
 *
 * Named codes (the dispatch pin):
 * - `attribution-evidence-required` — a root-cause attribution without
 *   W006-convention evidence references is inexpressible;
 * - `history-immutable` — modifying or replacing a recorded historical
 *   prediction comparison (same comparison id with different content, or
 *   a different comparison for the same compared pair);
 * - `tenant-isolation-rejected` — tenant-isolation violation (R12);
 * - `measure-kind-mismatch` — comparing measures of different kinds (or
 *   units/currencies) in one variance/comparison fold;
 * - `digest-mismatch` — a claimed content digest that does not match the
 *   recomputed canonical SHA-256 (tamper detection);
 * - `vendor-fields-rejected` — strict-object rejection of unknown
 *   (provider/vendor) structural fields.
 *
 * Additional codes completing the taxonomy:
 * - `validation` — generic malformed-record carrier (flattened
 *   dotted-path issues; schemaVersion skew reports here at path
 *   ["schemaVersion"]);
 * - `version-conflict` — same identity, different content (sealed
 *   records are immutable; changed content ships as a NEW identity);
 * - `dangling-reference-rejected` — a reference that does not resolve
 *   against the caller-supplied known references.
 */
import type {
  AttributionCauseKind,
  ComparedLineKind,
  VarianceClass,
  VarianceDirection,
} from './version';

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface VarianceIssue {
  readonly path: string;
  readonly message: string;
}

/** The complete variance error-code vocabulary. */
export type VarianceErrorCode =
  | 'validation'
  | 'vendor-fields-rejected'
  | 'tenant-isolation-rejected'
  | 'digest-mismatch'
  | 'version-conflict'
  | 'measure-kind-mismatch'
  | 'attribution-evidence-required'
  | 'history-immutable'
  | 'dangling-reference-rejected';

/** The typed variance error taxonomy (values, never thrown). */
export type VarianceError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly VarianceIssue[];
    }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly issues: readonly VarianceIssue[];
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'tenant-isolation-rejected';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
      readonly subject: string;
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'version-conflict';
      readonly message: string;
      readonly subject: string;
      readonly subjectId: string;
      readonly publishedDigest?: string | undefined;
      readonly encounteredDigest?: string | undefined;
    }
  | {
      readonly code: 'measure-kind-mismatch';
      readonly message: string;
      readonly baselineKind: string;
      readonly actualKind: string;
      readonly subject: string;
    }
  | {
      readonly code: 'attribution-evidence-required';
      readonly message: string;
      readonly varianceRecordId: string;
      readonly evidenceCount: number;
    }
  | {
      readonly code: 'history-immutable';
      readonly message: string;
      readonly subject: string;
      readonly subjectId: string;
      readonly publishedDigest?: string | undefined;
      readonly encounteredDigest?: string | undefined;
    }
  | {
      readonly code: 'dangling-reference-rejected';
      readonly message: string;
      readonly referenceKind:
        | 'variance-record'
        | 'compared-line'
        | 'cause-record'
        | 'forecast-revision'
        | 'actual-record';
      readonly referenceId: string;
    };

/** Result of a variance operation: a value or a typed error. */
export type VarianceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: VarianceError };

/** Vocabulary carrier re-exports for typed rejection details. */
export type { AttributionCauseKind, ComparedLineKind, VarianceClass, VarianceDirection };
