/**
 * The typed solution-delivery error taxonomy (W036 Tech Lead pin; mirrors
 * the issue-code style of W006/W007/W009/W010/W023). Every entry point is
 * total — errors are values, never exceptions.
 *
 * Named codes (the dispatch pin):
 * - `unknown-solution-reference` — a solution id / version that does not
 *   resolve;
 * - `version-conflict` — publishing a version that already exists (with
 *   different content: mutation of a published version) or a version that
 *   is not semver-greater than the published head;
 * - `cross-tenant-denied` — tenant-isolation violation (R12);
 * - `schedule-cycle-rejected` — a dependency CYCLE in the ProgramOfWork
 *   realization graph;
 * - `baseline-mutation-rejected` — an attempted mutation of an approved /
 *   published baseline (immutability; changes ship as NEW versions);
 * - `distinction-collapse-rejected` — collapsing the nine semantic
 *   distinctions into one mutable value (a record identity changing kind);
 * - `unaccepted-actualization-rejected` — actualizing an observation that
 *   is not ACCEPTED (actualization converts ACCEPTED observations only);
 * - `forecast-overwrite-rejected` — a forecast overwriting a historical
 *   prediction, baseline, or actual;
 * - `dangling-reference-rejected` — a world / constraint / evidence /
 *   in-program reference that does not resolve;
 * - `vendor-fields-rejected` — strict-object rejection of unknown
 *   (provider/vendor) structural fields;
 * - `authority-violation-rejected` — a pack-style record claiming a second
 *   lifecycle/baseline/schedule/delivery authority or redefining stage
 *   semantics.
 *
 * Additional codes completing the taxonomy:
 * - `validation` — generic malformed-record carrier (flattened dotted-path
 *   issues; schemaVersion skew reports here at path ["schemaVersion"]);
 * - `digest-mismatch` — a claimed content digest that does not match the
 *   recomputed canonical SHA-256 (tamper detection), including broken
 *   version-chain links;
 * - `lifecycle-conflict` — an illegal lifecycle transition or observation
 *   review-state conflict (mirrors the W023 completion code);
 * - `schedule-integrity-rejected` — a dependency-integrity violation that
 *   is not a cycle (e.g. an inconsistent predecessor/successor mirror).
 */
import type {
  LifecycleTransitionRelation,
  SemanticDistinctionKind,
  UniversalLifecycleStage,
} from './version';

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface DeliveryIssue {
  readonly path: string;
  readonly message: string;
}

/** The complete solution-delivery error-code vocabulary. */
export type DeliveryErrorCode =
  | 'validation'
  | 'vendor-fields-rejected'
  | 'unknown-solution-reference'
  | 'version-conflict'
  | 'baseline-mutation-rejected'
  | 'cross-tenant-denied'
  | 'schedule-cycle-rejected'
  | 'schedule-integrity-rejected'
  | 'distinction-collapse-rejected'
  | 'unaccepted-actualization-rejected'
  | 'forecast-overwrite-rejected'
  | 'lifecycle-conflict'
  | 'authority-violation-rejected'
  | 'dangling-reference-rejected'
  | 'digest-mismatch';

/** The typed solution-delivery error taxonomy (values, never thrown). */
export type DeliveryError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly DeliveryIssue[];
    }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly issues: readonly DeliveryIssue[];
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'unknown-solution-reference';
      readonly message: string;
      readonly solutionId: string;
      readonly encounteredVersion?: string | undefined;
      readonly encounteredDigest?: string | undefined;
    }
  | {
      readonly code: 'version-conflict';
      readonly message: string;
      readonly solutionId: string;
      readonly version: string;
      readonly publishedDigest?: string | undefined;
      readonly encounteredDigest?: string | undefined;
    }
  | {
      readonly code: 'baseline-mutation-rejected';
      readonly message: string;
      readonly solutionId: string;
      readonly version: string;
      readonly baselineDigest: string;
    }
  | {
      readonly code: 'cross-tenant-denied';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
    }
  | {
      readonly code: 'schedule-cycle-rejected';
      readonly message: string;
      readonly cycle: readonly string[];
    }
  | {
      readonly code: 'schedule-integrity-rejected';
      readonly message: string;
      readonly issues: readonly DeliveryIssue[];
    }
  | {
      readonly code: 'distinction-collapse-rejected';
      readonly message: string;
      readonly recordId: string;
      readonly publishedKind: SemanticDistinctionKind;
      readonly encounteredKind: SemanticDistinctionKind;
    }
  | {
      readonly code: 'unaccepted-actualization-rejected';
      readonly message: string;
      readonly observationId: string;
      readonly observationState: 'proposed' | 'accepted' | 'rejected' | 'missing';
    }
  | {
      readonly code: 'forecast-overwrite-rejected';
      readonly message: string;
      readonly forecastRecordId: string;
      readonly refinesRecordId: string;
      readonly refinesKind: SemanticDistinctionKind | 'missing';
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly subjectId: string;
      readonly relation?: LifecycleTransitionRelation | undefined;
    }
  | {
      readonly code: 'authority-violation-rejected';
      readonly message: string;
      readonly encounteredStage?: UniversalLifecycleStage | string | undefined;
      readonly field?: string | undefined;
    }
  | {
      readonly code: 'dangling-reference-rejected';
      readonly message: string;
      readonly referenceKind:
        | 'world-entity'
        | 'world-relation'
        | 'constraint'
        | 'evidence'
        | 'solution-version'
        | 'work-package'
        | 'activity'
        | 'milestone'
        | 'solution-line'
        | 'observation'
        | 'acquisition-request'
        | 'info-request'
        | 'stage-record';
      readonly referenceId: string;
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    };

/** Result of a solution-delivery operation: a value or a typed error. */
export type DeliveryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DeliveryError };
