/**
 * The typed simulation-fabric error taxonomy (W021 Tech Lead pin; mirrors
 * the issue-code style of W006/W007/W009/W010/W020/W023/W036). Every entry
 * point is total — errors are values, never exceptions.
 *
 * Named codes (the W021 dispatch pins):
 * - `tenant-isolation-rejected` — a tenant-scope violation (R12): a run is
 *   tenant-scoped and may never be read or referenced across the tenant
 *   boundary;
 * - `duplicate-run` — a replayed submission carrying the SAME content
 *   under an already-consumed idempotency key: the typed admission echoes
 *   the EXISTING run identity (same runId + runDigest + key) and the
 *   state is unchanged — never a silent dedup;
 * - `idempotency-conflict` — a submission carrying DIFFERENT content
 *   under an already-consumed idempotency key (typed rejection);
 * - `unknown-capability-binding` — a capability binding reference that
 *   does not resolve against the admitted registration set;
 * - `nonconforming-invocation` / `nonconforming-result` — the W005
 *   cross-document conformance checks returned violations;
 * - `result-rejected` — a port-produced result failed W005 admission
 *   (the run settles `failed` with cause `result-rejected`).
 *
 * Additional codes completing the taxonomy (the house set):
 * - `version-unsupported` — schemaVersion skew (expected/encountered);
 * - `validation` — malformed documents (strict objects reject unknown
 *   vendor/provider fields) with precise dotted paths;
 * - `vendor-fields-rejected` — strict-object rejection of unknown
 *   structural fields, including structural copies of foreign records
 *   (capability registrations bind by opaque typed reference only);
 * - `digest-mismatch` — a claimed digest (run state chain, sealed result,
 *   sealed event) does not match the recomputed canonical SHA-256;
 * - `lifecycle-conflict` — an illegal run-status transition (including
 *   any transition out of a terminal status);
 * - `unknown-run` — a run lookup that does not exist.
 */
import type { ConformanceViolation } from '@epoch/simulation-protocol';

/** One flattened validation issue (dotted path + message; "" = root). */
export interface FabricIssue {
  readonly path: string;
  readonly message: string;
}

/** The complete simulation-fabric error-code vocabulary. */
export type FabricErrorCode =
  | 'version-unsupported'
  | 'validation'
  | 'vendor-fields-rejected'
  | 'nonconforming-invocation'
  | 'nonconforming-result'
  | 'tenant-isolation-rejected'
  | 'duplicate-run'
  | 'idempotency-conflict'
  | 'digest-mismatch'
  | 'lifecycle-conflict'
  | 'unknown-run'
  | 'unknown-capability-binding'
  | 'result-rejected';

/** The typed simulation-fabric error taxonomy (values, never thrown). */
export type FabricError =
  | {
      readonly code: 'version-unsupported';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly FabricIssue[];
    }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly issues: readonly FabricIssue[];
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'nonconforming-invocation';
      readonly message: string;
      readonly violations: readonly ConformanceViolation[];
    }
  | {
      readonly code: 'nonconforming-result';
      readonly message: string;
      readonly violations: readonly ConformanceViolation[];
    }
  | {
      readonly code: 'tenant-isolation-rejected';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
      readonly runId?: string | undefined;
    }
  | {
      readonly code: 'duplicate-run';
      readonly message: string;
      /** The EXISTING run identity — a replayed submission returns the SAME identity. */
      readonly runId: string;
      readonly runDigest: string;
      readonly idempotencyKey: string;
    }
  | {
      readonly code: 'idempotency-conflict';
      readonly message: string;
      readonly idempotencyKey: string;
      readonly existingRunId: string;
      readonly existingRunDigest: string;
      readonly encounteredRunDigest: string;
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
      /** The source status (a run status, or a capability lifecycle state at the W007 seam). */
      readonly from: string;
      /** The target status (a run status, or a capability lifecycle state at the W007 seam). */
      readonly to: string;
    }
  | {
      readonly code: 'unknown-run';
      readonly message: string;
      readonly runId: string;
    }
  | {
      readonly code: 'unknown-capability-binding';
      readonly message: string;
      readonly capabilityId: string;
      readonly version?: string | undefined;
    }
  | {
      readonly code: 'result-rejected';
      readonly message: string;
      readonly issues: readonly FabricIssue[];
    };

/** Result of a fabric operation: a value or a typed error. */
export type FabricResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: FabricError };
