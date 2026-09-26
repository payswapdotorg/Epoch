/**
 * The typed procurement error taxonomy (W037 Tech Lead pin; mirrors the
 * issue-code style of W036/W006/W007/W009/W010/W023 — errors are values,
 * never exceptions; every entry point is total).
 *
 * Named codes (the dispatch pins):
 * - `dangling-quote-rejected` — a selection not backed by a live quote
 *   digest (missing quote, withdrawn quote, or expired validity);
 * - `unevaluated-substitution-rejected` — accepting a substitution whose
 *   acceptance carries no constraint-evaluation reference;
 * - `distinction-collapse-rejected` — collapsing a prediction/estimate/
 *   baseline/commitment/actual value into the wrong typed reference (a
 *   lead-time observation pointing at the wrong distinction kind, a
 *   commitment reference that is not a W036 commitment record, an
 *   observation reference that is not an observation record) — the W036
 *   typed-rejection convention, reused;
 * - `tenant-isolation-rejected` — cross-tenant supplier/PO/package/
 *   commitment references (R12 tenant isolation);
 * - `validation` / `vendor-fields-rejected` — malformed records and
 *   strict-object rejection of unknown (provider/vendor) fields;
 * - `dangling-reference-rejected` — a requirement / acquisition request /
 *   package / quote / selection / purchase-order / commitment /
 *   observation / constraint-evaluation reference that does not resolve;
 * - `version-conflict` — immutable record re-admission with different
 *   content, or a broken PO/quote revision chain (mutation of a published
 *   revision);
 * - `digest-mismatch` — a claimed content digest that does not match the
 *   recomputed canonical SHA-256 (tamper detection), including broken
 *   version-chain links;
 * - `lifecycle-conflict` — an illegal supplier-delivery state transition
 *   (the append-only transition table);
 * - `authority-violation-rejected` — a record claiming a second
 *   lifecycle/baseline/schedule/delivery authority (the W036 forbidden
 *   field list, classified BEFORE schema validation).
 */
import type { LeadTimeSemantics } from './version';
import type { SemanticDistinctionKind } from '@epoch/solution-delivery';

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface ProcurementIssue {
  readonly path: string;
  readonly message: string;
}

/** The complete procurement error-code vocabulary. */
export type ProcurementErrorCode =
  | 'validation'
  | 'vendor-fields-rejected'
  | 'dangling-reference-rejected'
  | 'dangling-quote-rejected'
  | 'unevaluated-substitution-rejected'
  | 'distinction-collapse-rejected'
  | 'tenant-isolation-rejected'
  | 'version-conflict'
  | 'digest-mismatch'
  | 'lifecycle-conflict'
  | 'authority-violation-rejected';

/** The reference kinds a dangling reference may name. */
export type ProcurementReferenceKind =
  | 'requirement'
  | 'acquisition-request'
  | 'acquisition-package'
  | 'quote'
  | 'selection'
  | 'purchase-order'
  | 'commitment-record'
  | 'observation-record'
  | 'constraint-evaluation'
  | 'lead-time-record'
  | 'substitution-request';

/** Why a selected quote was not live at selection time. */
export type DanglingQuoteReason = 'missing' | 'withdrawn' | 'expired';

/** The typed procurement error taxonomy (values, never thrown). */
export type ProcurementError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly ProcurementIssue[];
    }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly issues: readonly ProcurementIssue[];
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'dangling-reference-rejected';
      readonly message: string;
      readonly referenceKind: ProcurementReferenceKind;
      readonly referenceId: string;
    }
  | {
      readonly code: 'dangling-quote-rejected';
      readonly message: string;
      readonly selectionId: string;
      readonly quoteId: string;
      readonly reason: DanglingQuoteReason;
    }
  | {
      readonly code: 'unevaluated-substitution-rejected';
      readonly message: string;
      readonly substitutionId: string;
    }
  | {
      readonly code: 'distinction-collapse-rejected';
      readonly message: string;
      readonly recordId: string;
      readonly expectedKind: SemanticDistinctionKind;
      readonly encounteredKind: SemanticDistinctionKind | LeadTimeSemantics;
    }
  | {
      readonly code: 'tenant-isolation-rejected';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
      readonly subject: string;
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
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
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

/** Result of a procurement operation: a value or a typed error. */
export type ProcurementResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ProcurementError };
