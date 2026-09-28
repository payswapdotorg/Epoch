/**
 * The typed supervision error taxonomy (values, never thrown — the W036
 * convention). Every admission surface returns
 * {@link SupervisionResult} with one of these codes.
 */
import type { FindingClass, FindingStatus } from './version';
import type { ProvenanceReferenceKind } from './version';
import type { ScheduleMutationField } from './version';

/** One flattened supervision issue (dotted path + message; "$" = root). */
export interface SupervisionIssue {
  readonly path: string;
  readonly message: string;
}

/** The closed supervision error-code vocabulary. */
export type SupervisionErrorCode =
  | 'validation'
  | 'vendor-fields-rejected'
  | 'digest-mismatch'
  | 're-schedule-rejected'
  | 'dangling-reference-rejected'
  | 'tenant-isolation-rejected'
  | 'replay-conflict'
  | 'version-conflict'
  | 'lifecycle-conflict';

/** The typed supervision error union. */
export type SupervisionError =
  | { readonly code: 'validation'; readonly message: string; readonly issues: readonly SupervisionIssue[] }
  | { readonly code: 'vendor-fields-rejected'; readonly message: string; readonly issues: readonly SupervisionIssue[] }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
      readonly subject: string;
    }
  | {
      readonly code: 're-schedule-rejected';
      readonly message: string;
      readonly field: ScheduleMutationField;
      readonly subject: string;
    }
  | {
      readonly code: 'dangling-reference-rejected';
      readonly message: string;
      readonly referenceKind: string;
      readonly referenceId: string;
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
      readonly code: 'version-conflict';
      readonly message: string;
      readonly subject: string;
      readonly subjectId: string;
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly subjectId: string;
    };

/** The total result wrapper of every supervision admission surface. */
export type SupervisionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SupervisionError };

/** Context carried by check-family helpers for typed error construction. */
export interface SupervisionErrorContext {
  readonly programId: string;
  readonly findingClass?: FindingClass | undefined;
  readonly findingStatus?: FindingStatus | undefined;
  readonly referenceKind?: ProvenanceReferenceKind | undefined;
}
