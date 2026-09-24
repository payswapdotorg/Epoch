/**
 * Verification contract versions and closed vocabularies.
 *
 * Versioning policy (v1): a serialized verification chain is admitted only
 * when its `schemaVersion` equals {@link VERIFICATION_RECORD_VERSION}
 * exactly; the parser reports a distinct `version-mismatch` issue before
 * schema validation. {@link VERIFICATION_CONTRACT_VERSION} versions the
 * published contract surface (`schemas/` + the typed index export).
 */

/** Version of the published verification contract surface (schemas/ + types). */
export const VERIFICATION_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized verification chain. */
export const VERIFICATION_RECORD_VERSION = 1 as const;

/**
 * The two DISTINCT stages of the verification chain (architecture lock
 * rule 7 corollary): verification asks "was the work done to spec";
 * validation asks "is the spec right". They are separate typed stages and
 * never fuse — a validation record cannot satisfy a verification slot and
 * vice versa (enforced by the chain validator's stage-consistency checks).
 */
export const VERIFICATION_STAGES = ['verification', 'validation'] as const;

/** Outcome of a Result: the judgment a run produced about its claim. */
export const RESULT_OUTCOMES = ['pass', 'fail', 'inconclusive'] as const;

/** Decision of an Approval: the authority act on a result. */
export const APPROVAL_DECISIONS = ['approved', 'rejected'] as const;

/** Execution status of a Run. */
export const RUN_STATUSES = ['completed', 'failed', 'aborted'] as const;
