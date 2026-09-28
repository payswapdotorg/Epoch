/**
 * The typed learning-calibration error taxonomy (W040 Tech Lead pin;
 * mirrors the issue-code style of W006/W007/W009/W010/W023/W036/
 * W037/W038/W039). Every entry point is total — errors are values,
 * never exceptions.
 *
 * Named codes (the dispatch pin):
 * - `model-revision-lineage-required` — a model revision (or its
 *   proposal) without dataset lineage: no dataset references, or no
 *   changing-observation references, or references that do not resolve
 *   within the referenced datasets' row provenance — a revision
 *   without lineage to the observations that changed it is a typed
 *   rejection;
 * - `history-immutable` — mutating historical learning history: a
 *   re-assembled dataset with the same identity but different content
 *   (replay conflict — the replay must seal the PRIOR record), a
 *   metric set or model revision re-admitted with different content;
 *   also the READ-ONLY guarantee on source comparison facts/outcomes —
 *   no write path exists by construction, and admission rejects any
 *   attempt to replace admitted history;
 * - `stale-reference-rejected` — a proposal referencing tampered or
 *   stale digests: a dataset reference whose id/digest does not match
 *   the supplied evidence, or a changing-observation reference that
 *   does not resolve inside the referenced datasets;
 * - `parallel-history-store-rejected` — an attempt to key learning
 *   history by domain pack (a pack-scoped duplicate store): pack
 *   learning surfaces are PURE PROJECTIONS over the universal dataset;
 * - `tenant-isolation-rejected` — tenant-isolation violation (R12).
 *
 * Additional codes completing the taxonomy:
 * - `validation` — generic malformed-record carrier (flattened
 *   dotted-path issues; schemaVersion skew reports here at path
 *   ["schemaVersion"]);
 * - `vendor-fields-rejected` — strict-object rejection of unknown
 *   (provider/vendor) structural fields;
 * - `digest-mismatch` — a claimed content digest that does not match
 *   the recomputed canonical SHA-256 (tamper detection);
 * - `version-conflict` — same identity, different content (sealed
 *   records are immutable; changed content ships as a NEW identity);
 * - `dangling-reference-rejected` — a reference that does not resolve
 *   (a candidate embedding a comparison fact or outcome record that is
 *   not registered with the store).
 */
/** One flattened validation issue (dotted path + message; "$" = root). */
export interface LearningIssue {
  readonly path: string;
  readonly message: string;
}

/** The complete learning-calibration error-code vocabulary. */
export type LearningErrorCode =
  | 'validation'
  | 'vendor-fields-rejected'
  | 'tenant-isolation-rejected'
  | 'digest-mismatch'
  | 'version-conflict'
  | 'history-immutable'
  | 'model-revision-lineage-required'
  | 'stale-reference-rejected'
  | 'parallel-history-store-rejected'
  | 'dangling-reference-rejected';

/** The typed learning-calibration error taxonomy (values, never thrown). */
export type LearningError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly LearningIssue[];
    }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly issues: readonly LearningIssue[];
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
      readonly publishedDigest: string;
      readonly encounteredDigest: string;
    }
  | {
      readonly code: 'history-immutable';
      readonly message: string;
      readonly subject: string;
      readonly subjectId: string;
      readonly publishedDigest: string;
      readonly encounteredDigest: string;
    }
  | {
      readonly code: 'model-revision-lineage-required';
      readonly message: string;
      readonly subjectId: string;
    }
  | {
      readonly code: 'stale-reference-rejected';
      readonly message: string;
      readonly referenceKind: string;
      readonly referenceId: string;
    }
  | {
      readonly code: 'parallel-history-store-rejected';
      readonly message: string;
      readonly subjectId: string;
    }
  | {
      readonly code: 'dangling-reference-rejected';
      readonly message: string;
      readonly referenceKind: string;
      readonly referenceId: string;
    };

/** The total-result wrapper of every kernel entry point. */
export type LearningResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: LearningError };
