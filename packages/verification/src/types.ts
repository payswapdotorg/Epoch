/**
 * @epoch/verification — published contract types (v1).
 *
 * The verification chain (architecture.md, binding):
 *   Requirement -> Claim -> Method -> Run -> Evidence -> Result -> Approval.
 *
 * - Verification and validation are DISTINCT stages (lock rule 7
 *   corollary): every Claim, Method, Run, and Result carries a `stage`, and
 *   the chain validator rejects stage confusion — a validation record can
 *   never satisfy a verification slot and vice versa.
 * - Evidence is exact-revision addressable (@epoch/evidence records;
 *   results and runs reference evidence by canonical SHA-256 digest).
 * - Approval is a distinct authority act: results never self-approve; an
 *   approval references the result, the approver identity, and the
 *   decision, and the approver must differ from the executor of the run
 *   that produced the result.
 * - Uncertainty travels with the chain: results carry the W002-aligned
 *   Confidence model.
 *
 * Neutrality: requirement/claim/method/run/actor identifiers are opaque
 * strings owned by their producing domains; no provider semantics live in
 * these types (lock rule 13).
 */
import type { Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type { Confidence, EvidenceRecord } from '@epoch/evidence';
import type { ProvenanceAgentKind, ProvenanceGraph, ProvenanceIssue } from '@epoch/provenance';
import type {
  APPROVAL_DECISIONS,
  RESULT_OUTCOMES,
  RUN_STATUSES,
  VERIFICATION_STAGES,
} from './version';

/** The two distinct chain stages: verification ("was the work done to spec") vs validation ("is the spec right"). */
export type VerificationStage = (typeof VERIFICATION_STAGES)[number];

/** Outcome of a Result. */
export type ResultOutcome = (typeof RESULT_OUTCOMES)[number];

/** Decision of an Approval. */
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

/** Execution status of a Run. */
export type RunStatus = (typeof RUN_STATUSES)[number];

/** The requirement: what must hold (authored outside this kernel). */
export interface Requirement {
  readonly schemaVersion: 1;
  readonly requirementId: string;
  readonly statement: string;
}

/** The claim: a testable assertion that a requirement can be verified/validated against. */
export interface Claim {
  readonly schemaVersion: 1;
  readonly claimId: string;
  /** The requirement this claim operationalizes. */
  readonly requirementId: string;
  readonly statement: string;
  /** Verification ("was the work done to spec") or validation ("is the spec right"). */
  readonly stage: VerificationStage;
}

/** The method: how a claim will be verified/validated. */
export interface Method {
  readonly schemaVersion: 1;
  readonly methodId: string;
  /** The claim this method operationalizes. */
  readonly claimId: string;
  /** Must match the claim's stage — stage confusion is rejected. */
  readonly stage: VerificationStage;
  readonly description: string;
  /** Whether the method is deterministic (reproducible evidence). */
  readonly deterministic: boolean;
}

/** The run: one execution of a method, producing evidence. */
export interface Run {
  readonly schemaVersion: 1;
  readonly runId: string;
  /** The method this run executes. */
  readonly methodId: string;
  /** Must match the method's stage. */
  readonly stage: VerificationStage;
  /** Opaque actor identity that executed the run. */
  readonly executedBy: string;
  /** PROV agent kind of the executor (first-class provenance, R5/R17). */
  readonly executedByKind: ProvenanceAgentKind;
  readonly startedAt: Timestamp;
  readonly endedAt: Timestamp;
  readonly status: RunStatus;
  /** Canonical digests of the evidence records this run produced. */
  readonly producedEvidence: readonly Sha256Hex[];
}

/** The result: the judgment a run produced about its claim, grounded in evidence. */
export interface Result {
  readonly schemaVersion: 1;
  readonly resultId: string;
  /** The claim being judged. */
  readonly claimId: string;
  /** The run whose evidence grounds the judgment. */
  readonly runId: string;
  /** Must match the claim's and run's stage. */
  readonly stage: VerificationStage;
  readonly outcome: ResultOutcome;
  /** Evidence consumed by the judgment (subset of the run's products). */
  readonly evidenceDigests: readonly Sha256Hex[];
  /** Uncertainty of the judgment (W002-aligned confidence model). */
  readonly confidence: Confidence;
  readonly decidedAt: Timestamp;
  readonly rationale?: string | undefined;
}

/** The approval: a distinct authority act over a result. */
export interface Approval {
  readonly schemaVersion: 1;
  readonly approvalId: string;
  /** The result being approved. */
  readonly resultId: string;
  /** Approver identity — must differ from the executor of the result's run. */
  readonly approverId: string;
  /** PROV agent kind of the approver. */
  readonly approverKind: ProvenanceAgentKind;
  readonly decision: ApprovalDecision;
  readonly decidedAt: Timestamp;
  readonly rationale?: string | undefined;
}

/**
 * A verification chain: the closed set of chain records plus the evidence
 * records they reference. Partial-but-consistent chains are valid (a run
 * may not have a result yet; a result may not be approved yet); broken
 * chains are rejected (see `validateChain`). Attached provenance graphs are
 * validated when present.
 */
export interface VerificationChain {
  readonly schemaVersion: 1;
  readonly requirements: readonly Requirement[];
  readonly claims: readonly Claim[];
  readonly methods: readonly Method[];
  readonly runs: readonly Run[];
  readonly evidence: readonly EvidenceRecord[];
  readonly results: readonly Result[];
  readonly approvals: readonly Approval[];
  readonly provenance?: readonly ProvenanceGraph[] | undefined;
}

/** Issue codes reported by the verification parse/validation surface. */
export type ChainIssueCode =
  | 'version-mismatch'
  | 'schema'
  | 'duplicate-id'
  | 'unknown-requirement'
  | 'unknown-claim'
  | 'unknown-method'
  | 'unknown-run'
  | 'unknown-result'
  | 'claim-without-method'
  | 'stage-mismatch'
  | 'evidence-digest-mismatch'
  | 'evidence-not-produced-by-run'
  | 'evidence-run-mismatch'
  | 'evidence-method-mismatch'
  | 'evidence-subject-conflict'
  | 'self-approval'
  | 'duplicate-approval'
  | 'actor-kind-conflict'
  | 'run-time-order'
  | 'result-before-run-end'
  | 'approval-before-result'
  | 'provenance-invalid';

/** One typed, human-readable chain issue (entry points never throw). */
export interface ChainIssue {
  readonly code: ChainIssueCode;
  readonly message: string;
  readonly path?: readonly (string | number)[];
  /** Present on `provenance-invalid`: the underlying graph issues. */
  readonly details?: readonly ProvenanceIssue[];
}
