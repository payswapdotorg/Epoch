/**
 * The typed access-projection error taxonomy (the W041 dispatch pins;
 * errors are values, never exceptions; every entry point is total).
 *
 * Named codes (the dispatch pins):
 * - `authorization-bypass-rejected` — the kernel refuses to evaluate a
 *   projection without a prior W009 decision record that VERIFIABLY
 *   covers the exact request (missing decision, failed digest
 *   verification, request-digest mismatch, subject mismatch, resource
 *   mismatch). The decision point is NEVER re-implemented here;
 * - `authorization-denied` — a well-formed prior decision whose outcome
 *   is deny (or not-applicable, fail-closed): the projection stage never
 *   runs;
 * - `policy-binding-missing` — no policy row binds this subject
 *   (role/task class) x object class (fail-closed);
 * - `view-without-grant-rejected` / `export-without-grant-rejected` /
 *   `share-without-grant-rejected` — the action is not in the selected
 *   binding's allowed actions (export and share are DISTINCT actions
 *   with their own policy rows);
 * - `task-escalation-rejected` — an agent task projection wider than the
 *   role baseline (task rows are narrower, never wider);
 * - `field-leak-rejected` — a projection whose released entries fall
 *   outside the selected policy row (defense-in-depth at admission;
 *   the evaluator cannot produce such a projection);
 * - `identity-fork-rejected` — a projection claiming an object identity
 *   that is not the canonical record's (same object id, non-canonical
 *   digest — projections never mint identities);
 * - `tenant-isolation-rejected` — cross-tenant policy/record/projection
 *   references (R12 tenant isolation);
 * - `validation` / `vendor-fields-rejected` — malformed records and
 *   strict-object rejection of unknown (provider/vendor) fields;
 * - `authority-violation-rejected` — a record claiming a second
 *   lifecycle/baseline/schedule/delivery authority (the W036 forbidden
 *   field list, classified BEFORE schema validation);
 * - `dangling-reference-rejected` — a policy/object/revision reference
 *   that does not resolve;
 * - `version-conflict` — immutable record re-admission with different
 *   content, or a policy revision re-registration with different content;
 * - `lifecycle-conflict` — a retired policy revision used for a new
 *   projection (the append-only policy lifecycle);
 * - `digest-mismatch` — a claimed content digest that does not match the
 *   recomputed canonical SHA-256 (tamper detection);
 * - `replay-conflict` — an audit append whose evaluation key is already
 *   sealed with DIFFERENT content (the trail refuses to fork).
 */
import type { ObjectClass, ProjectionAction } from './version';

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface AccessProjectionIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * The projection DENIAL codes — stage-2 policy outcomes that are AUDITED
 * (every projection decision emits a sealed audit record) rather than
 * raised as errors: the denial is a legitimate decision, not a failure.
 */
export type ProjectionDenialCode =
  | 'policy-binding-missing'
  | 'view-without-grant-rejected'
  | 'export-without-grant-rejected'
  | 'share-without-grant-rejected'
  | 'task-escalation-rejected';

/** One audited projection denial (stage 2). */
export interface ProjectionDenial {
  readonly code: ProjectionDenialCode;
  readonly message: string;
}

/** The complete access-projection error-code vocabulary. */
export type AccessProjectionErrorCode =
  | 'validation'
  | 'vendor-fields-rejected'
  | 'authority-violation-rejected'
  | 'authorization-bypass-rejected'
  | 'authorization-denied'
  | 'policy-binding-missing'
  | 'view-without-grant-rejected'
  | 'export-without-grant-rejected'
  | 'share-without-grant-rejected'
  | 'task-escalation-rejected'
  | 'field-leak-rejected'
  | 'identity-fork-rejected'
  | 'tenant-isolation-rejected'
  | 'dangling-reference-rejected'
  | 'version-conflict'
  | 'digest-mismatch'
  | 'replay-conflict';

/** The reference kinds a dangling reference may name. */
export type AccessReferenceKind =
  | 'projection-policy'
  | 'policy-revision'
  | 'canonical-record'
  | 'projection'
  | 'audit-record';

/** The typed access-projection error taxonomy (values, never thrown). */
export type AccessProjectionError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly AccessProjectionIssue[];
    }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly issues: readonly AccessProjectionIssue[];
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'authority-violation-rejected';
      readonly message: string;
      readonly field: string;
    }
  | {
      readonly code: 'authorization-bypass-rejected';
      readonly message: string;
      readonly reason:
        | 'decision-missing'
        | 'decision-unverifiable'
        | 'request-digest-mismatch'
        | 'principal-mismatch'
        | 'resource-mismatch'
        | 'action-kind-unknown';
    }
  | {
      readonly code: 'authorization-denied';
      readonly message: string;
      readonly outcome: 'deny' | 'not-applicable';
      readonly denialCode: string;
    }
  | {
      readonly code: 'policy-binding-missing';
      readonly message: string;
      readonly principalKind: string;
      readonly role?: string | undefined;
      readonly agentTaskClass?: string | undefined;
      readonly objectClass: ObjectClass;
    }
  | {
      readonly code: 'view-without-grant-rejected';
      readonly message: string;
      readonly action: ProjectionAction;
      readonly policyId: string;
      readonly revision: number;
    }
  | {
      readonly code: 'export-without-grant-rejected';
      readonly message: string;
      readonly action: ProjectionAction;
      readonly policyId: string;
      readonly revision: number;
    }
  | {
      readonly code: 'share-without-grant-rejected';
      readonly message: string;
      readonly action: ProjectionAction;
      readonly policyId: string;
      readonly revision: number;
    }
  | {
      readonly code: 'task-escalation-rejected';
      readonly message: string;
      readonly taskClass: string;
      readonly role?: string | undefined;
      readonly breaches: readonly string[];
    }
  | {
      readonly code: 'field-leak-rejected';
      readonly message: string;
      readonly leakedPaths: readonly string[];
      readonly policyId: string;
      readonly revision: number;
    }
  | {
      readonly code: 'identity-fork-rejected';
      readonly message: string;
      readonly objectClass: ObjectClass;
      readonly objectId: string;
      readonly expectedObjectDigest: string;
      readonly encounteredObjectDigest: string;
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
      readonly referenceKind: AccessReferenceKind;
      readonly referenceId: string;
    }
  | {
      readonly code: 'version-conflict';
      readonly message: string;
      readonly subject: string;
      readonly expectedDigest?: string | undefined;
      readonly encounteredDigest?: string | undefined;
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly subject: string;
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'replay-conflict';
      readonly message: string;
      readonly evaluationKey: string;
      readonly sealedDigest: string;
      readonly encounteredDigest: string;
    };

/** The total-result wrapper of every kernel entry point. */
export type AccessProjectionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AccessProjectionError };
