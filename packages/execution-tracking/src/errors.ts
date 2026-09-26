/**
 * The typed execution-tracking error taxonomy (W038 Tech Lead pin; mirrors
 * the issue-code style of W036/W037/W006/W007/W009/W010/W023 — errors are
 * values, never exceptions; every entry point is total).
 *
 * Named codes (the dispatch pins):
 * - `actualization-bypass-rejected` — an attempt to write Actual records
 *   through execution-tracking (the package PRODUCES observations and
 *   reconciles them; actualization flows ONLY through the W036
 *   DeliveryRecord acceptance/actualization path — a distinction record
 *   of kind `actual` at the observation intake, or a reconciliation the
 *   W036 authority rejects, is this typed rejection);
 * - `uncertainty-missing-rejected` — a record without the mandatory
 *   uncertainty state (W036 distinction conventions: provenance +
 *   freshness + confidence on EVERY observation);
 * - `ambiguous-linkage-rejected` — low-friction field ingestion that
 *   cannot infer ONE work package for the capture (multiple candidates:
 *   ambiguity is a typed rejection, never a guess — ingestion is
 *   low-friction but never lossy);
 * - `tenant-isolation-rejected` — cross-tenant work-package/observation/
 *   issue/proposal references (R12 tenant isolation);
 * - `validation` / `vendor-fields-rejected` — malformed records and
 *   strict-object rejection of unknown (provider/vendor) fields;
 * - `dangling-reference-rejected` — a work-package / activity /
 *   milestone / observation / issue / proposal / delivery reference that
 *   does not resolve;
 * - `digest-mismatch` — a claimed content digest that does not match the
 *   recomputed canonical SHA-256 (tamper detection);
 * - `version-conflict` — immutable record re-admission with different
 *   content (mutation of a published record);
 * - `lifecycle-conflict` — an illegal tracking-state transition, an
 *   issue-resolution conflict, or an illegal W036 delivery transition
 *   surfaced through the adapter;
 * - `authority-violation-rejected` — a record claiming a second
 *   lifecycle/baseline/schedule/delivery authority (the W036 forbidden
 *   field list, classified BEFORE schema validation; tracking records
 *   OBSERVE, never re-schedule).
 */
import type { IssueKind, ResourceKind, FieldEvidenceKind, TrackingState } from './version';

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface ExecutionIssue {
  readonly path: string;
  readonly message: string;
}

/** The complete execution-tracking error-code vocabulary. */
export type ExecutionErrorCode =
  | 'validation'
  | 'vendor-fields-rejected'
  | 'actualization-bypass-rejected'
  | 'uncertainty-missing-rejected'
  | 'ambiguous-linkage-rejected'
  | 'tenant-isolation-rejected'
  | 'dangling-reference-rejected'
  | 'digest-mismatch'
  | 'version-conflict'
  | 'lifecycle-conflict'
  | 'authority-violation-rejected';

/** The reference kinds a dangling reference may name. */
export type ExecutionReferenceKind =
  | 'work-package'
  | 'activity'
  | 'milestone'
  | 'tracking-state-record'
  | 'resource-observation-record'
  | 'evidence-link-record'
  | 'issue-record'
  | 'observation-record'
  | 'reconciliation-proposal'
  | 'delivery-record'
  | 'solution-version';

/** The record families that may carry a tenant-isolation violation. */
export type TenantIsolationSubject =
  | 'record'
  | 'store'
  | 'work-package-reference'
  | 'observation-record'
  | 'delivery-record'
  | 'issue-record'
  | 'reconciliation-proposal';

/** The typed execution-tracking error taxonomy (values, never thrown). */
export type ExecutionError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly ExecutionIssue[];
    }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly issues: readonly ExecutionIssue[];
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'actualization-bypass-rejected';
      readonly message: string;
      readonly recordId: string;
      readonly recordKind: string;
    }
  | {
      readonly code: 'uncertainty-missing-rejected';
      readonly message: string;
      readonly recordId?: string | undefined;
      readonly missing: readonly ('provenance' | 'freshness' | 'confidence' | 'uncertainty')[];
    }
  | {
      readonly code: 'ambiguous-linkage-rejected';
      readonly message: string;
      readonly subject: string;
      readonly candidateWorkPackageIds: readonly string[];
    }
  | {
      readonly code: 'tenant-isolation-rejected';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
      readonly subject: string;
    }
  | {
      readonly code: 'dangling-reference-rejected';
      readonly message: string;
      readonly referenceKind: ExecutionReferenceKind;
      readonly referenceId: string;
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
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly subjectId: string;
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly code: 'authority-violation-rejected';
      readonly message: string;
      readonly field: string;
    };

/** Result of an execution-tracking operation: a value or a typed error. */
export type ExecutionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ExecutionError };

/** Convenience aliases carrying the vocabulary kinds on typed errors. */
export type { IssueKind, ResourceKind, FieldEvidenceKind, TrackingState };
