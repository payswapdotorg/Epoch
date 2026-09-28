/**
 * The typed observability error taxonomy (the W030 pin; mirrors the
 * issue-code style of W006/W007/W009/W010/W023/W024). Every entry
 * point is total — errors are values, never thrown.
 *
 * Named codes:
 * - `validation` — malformed records (strict objects reject unknown
 *   vendor/provider fields; malformed ids rejected);
 * - `vendor-fields-rejected` — strict-object rejection of unknown
 *   (provider/vendor) structural fields;
 * - `digest-mismatch` — a claimed content digest that does not match
 *   the recomputed canonical SHA-256 (tamper detection);
 * - `version-skew` — a record whose `schemaVersion` disagrees with
 *   the published record version (distinguishable from malformed
 *   payloads — the W011 parse precedent);
 * - `cross-tenant-denied` — tenant-isolation violation (R12; the
 *   shared W004/W009/W023 denial grammar);
 * - `unknown-policy` — a policy id with no admitted revision;
 * - `policy-inactive` — the named policy exists but is retired
 *   (enforcement requires an ACTIVE policy);
 * - `policy-conflict` — same policy id re-admitted with different
 *   content (replay-conflict; idempotent re-admission of the SAME
 *   digest is not an error);
 * - `unknown-subject-kind` — a subject kind outside the closed
 *   vocabulary;
 * - `duplicate-observation` — same observation id re-admitted with
 *   different content (idempotent re-admission of the SAME digest is
 *   not an error);
 * - `sequence-gap` — per-stream event sequences must be strictly
 *   contiguous from 1 (the W010 discipline);
 * - `causal-cycle` — a same-stream causal parent that is not
 *   strictly earlier (the W010 discipline);
 * - `unknown-causal-parent` — a causal parent outside known history
 *   (the W010 discipline);
 * - `isolation-violation` — a sandbox subject failed the isolation
 *   check (carries the typed violation list);
 * - `quarantine-conflict` — imposing quarantine on an already
 *   quarantined subject;
 * - `quarantine-release-rejected` — releasing a subject that is not
 *   quarantined (no silent no-op);
 * - `quarantined-subject-rejected` — operating on a quarantined
 *   subject (deny-by-default).
 */
import type { IsolationViolationCode, QuarantineFactKind } from './version';

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface ObservabilityIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * One typed sandbox-isolation violation (carried by the
 * `isolation-violation` error and the check verdict): a closed code
 * plus a human-readable detail plus the optional dotted path of the
 * offending field.
 */
export interface IsolationViolation {
  readonly code: IsolationViolationCode;
  readonly detail: string;
  readonly path?: string | undefined;
}

/** The complete observability error-code vocabulary. */
export type ObservabilityErrorCode =
  | 'validation'
  | 'vendor-fields-rejected'
  | 'digest-mismatch'
  | 'version-skew'
  | 'cross-tenant-denied'
  | 'unknown-policy'
  | 'policy-inactive'
  | 'policy-conflict'
  | 'unknown-subject-kind'
  | 'duplicate-observation'
  | 'sequence-gap'
  | 'causal-cycle'
  | 'unknown-causal-parent'
  | 'isolation-violation'
  | 'quarantine-conflict'
  | 'quarantine-release-rejected'
  | 'quarantined-subject-rejected';

/** The typed observability error taxonomy (values, never thrown). */
export type ObservabilityError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly ObservabilityIssue[];
    }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly issues: readonly ObservabilityIssue[];
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
      readonly subject: string;
    }
  | {
      readonly code: 'version-skew';
      readonly message: string;
      readonly encountered: number;
      readonly expected: number;
    }
  | {
      readonly code: 'cross-tenant-denied';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
      readonly subject: string;
    }
  | {
      readonly code: 'unknown-policy';
      readonly message: string;
      readonly policyId: string;
    }
  | {
      readonly code: 'policy-inactive';
      readonly message: string;
      readonly policyId: string;
    }
  | {
      readonly code: 'policy-conflict';
      readonly message: string;
      readonly policyId: string;
      readonly encounteredDigest: string;
    }
  | {
      readonly code: 'unknown-subject-kind';
      readonly message: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'duplicate-observation';
      readonly message: string;
      readonly observationId: string;
      readonly encounteredDigest: string;
    }
  | {
      readonly code: 'sequence-gap';
      readonly message: string;
      readonly streamId: string;
      readonly expectedSequence: number;
      readonly encounteredSequence: number;
    }
  | {
      readonly code: 'causal-cycle';
      readonly message: string;
      readonly streamId: string;
      readonly sequence: number;
      readonly parentSequence: number;
    }
  | {
      readonly code: 'unknown-causal-parent';
      readonly message: string;
      readonly streamId: string;
      readonly parentStreamId: string;
      readonly parentSequence: number;
    }
  | {
      readonly code: 'isolation-violation';
      readonly message: string;
      readonly violations: readonly IsolationViolation[];
    }
  | {
      readonly code: 'quarantine-conflict';
      readonly message: string;
      readonly subjectId: string;
    }
  | {
      readonly code: 'quarantine-release-rejected';
      readonly message: string;
      readonly subjectId: string;
    }
  | {
      readonly code: 'quarantined-subject-rejected';
      readonly message: string;
      readonly subjectId: string;
      readonly factKind: QuarantineFactKind;
    };

/** Total-result wrapper of every kernel entry point. */
export type ObservabilityResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ObservabilityError };
