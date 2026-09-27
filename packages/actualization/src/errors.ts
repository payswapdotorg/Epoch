/**
 * The typed actualization error taxonomy (W039 Tech Lead pin; mirrors the
 * issue-code style of W006/W007/W009/W010/W023/W036/W037/W038). Every
 * entry point is total — errors are values, never exceptions.
 *
 * Named codes (the dispatch pin):
 * - `actualization-bypass-rejected` — an attempt to convert observations
 *   into actuals WITHOUT the W036 DeliveryRecord authority path (feeding
 *   an Actual record into the observation intake, or any non-observation
 *   kind where the authority path demands an observation); the W038
 *   precedent, mapped from W036 `unaccepted-actualization-rejected` and
 *   enforced at every intake/application boundary of this package;
 * - `conflict-unresolved-rejected` — actualizing a CONFLICTING
 *   observation group without a sealed conflict resolution;
 * - `insufficient-observations-rejected` — actualizing an INSUFFICIENT
 *   observation group (below the reconciliation policy's quorum);
 * - `lineage-order-rejected` — a lineage edge flowing backward in the
 *   prediction -> baseline -> commitment -> actual -> forecast order
 *   (only forecast -> forecast refinement may stay level);
 * - `lineage-cycle-rejected` — a lineage edge that would close a cycle in
 *   the content-addressed lineage graph;
 * - `history-immutable` — replacing or re-comparing an immutable
 *   historical comparison fact (changed content under a sealed
 *   comparison-fact identity, or a different fact for the same
 *   forecast/actual pair);
 * - `tenant-isolation-rejected` — tenant-isolation violation (R12);
 * - `forecast-overwrite-rejected` — surfaced from the W036 ledger when a
 *   forecast refinement targets anything but an earlier forecast
 *   (forecasts never overwrite historical predictions, baselines or
 *   actuals);
 * - `digest-mismatch` — a claimed content digest that does not match the
 *   recomputed canonical SHA-256 (tamper detection);
 * - `dangling-reference-rejected` — a reference that does not resolve
 *   (a stale assessment revision, an unknown observation, ...);
 * - `vendor-fields-rejected` — strict-object rejection of unknown
 *   (provider/vendor) structural fields.
 *
 * Additional codes completing the taxonomy:
 * - `validation` — generic malformed-record carrier (flattened
 *   dotted-path issues; schemaVersion skew reports here at path
 *   ["schemaVersion"]);
 * - `version-conflict` — same identity, different content (sealed
 *   records are immutable; changed content ships as a NEW identity);
 * - `lifecycle-conflict` — an illegal state transition (e.g. actualizing
 *   into a closed delivery, surfacing from the W036 authority).
 */
import type { LineageNodeKind, ValidationState } from './version';

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface ActualizationIssue {
  readonly path: string;
  readonly message: string;
}

/** The complete actualization error-code vocabulary. */
export type ActualizationErrorCode =
  | 'validation'
  | 'vendor-fields-rejected'
  | 'tenant-isolation-rejected'
  | 'digest-mismatch'
  | 'version-conflict'
  | 'lifecycle-conflict'
  | 'actualization-bypass-rejected'
  | 'conflict-unresolved-rejected'
  | 'insufficient-observations-rejected'
  | 'lineage-order-rejected'
  | 'lineage-cycle-rejected'
  | 'history-immutable'
  | 'forecast-overwrite-rejected'
  | 'dangling-reference-rejected';

/** The typed actualization error taxonomy (values, never thrown). */
export type ActualizationError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly ActualizationIssue[];
    }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly issues: readonly ActualizationIssue[];
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
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly subjectId: string;
    }
  | {
      readonly code: 'actualization-bypass-rejected';
      readonly message: string;
      readonly recordId: string;
      readonly recordKind: string;
    }
  | {
      readonly code: 'conflict-unresolved-rejected';
      readonly message: string;
      readonly assessmentId: string;
      readonly observationCount: number;
    }
  | {
      readonly code: 'insufficient-observations-rejected';
      readonly message: string;
      readonly assessmentId: string;
      readonly observationCount: number;
      readonly quorum: number;
    }
  | {
      readonly code: 'lineage-order-rejected';
      readonly message: string;
      readonly fromKind: LineageNodeKind;
      readonly toKind: LineageNodeKind;
    }
  | {
      readonly code: 'lineage-cycle-rejected';
      readonly message: string;
      readonly cycle: readonly string[];
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
      readonly code: 'forecast-overwrite-rejected';
      readonly message: string;
      readonly forecastRecordId: string;
      readonly refinesRecordId: string;
      readonly refinesKind: string;
    }
  | {
      readonly code: 'dangling-reference-rejected';
      readonly message: string;
      readonly referenceKind:
        | 'observation'
        | 'validation-assessment'
        | 'conflict-resolution'
        | 'lineage-node'
        | 'forecast-revision'
        | 'comparison-fact'
        | 'delivery-record';
      readonly referenceId: string;
    };

/** Result of an actualization operation: a value or a typed error. */
export type ActualizationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ActualizationError };

/** The validation-state carrier used by typed rejection details. */
export type { ValidationState };
