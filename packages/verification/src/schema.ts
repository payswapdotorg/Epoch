/**
 * @epoch/verification — runtime zod validators for the published contract
 * types. Strict object shapes; evidence records and provenance graphs are
 * validated by their owning packages' schemas (@epoch/evidence,
 * @epoch/provenance), reused here by reference so the chain surface cannot
 * drift from the evidence/provenance contracts.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import {
  ConfidenceSchema,
  EvidenceRecordSchema,
  Sha256DigestSchema,
} from '@epoch/evidence';
import { ProvenanceAgentKindSchema, ProvenanceGraphSchema } from '@epoch/provenance';
import {
  APPROVAL_DECISIONS,
  RESULT_OUTCOMES,
  RUN_STATUSES,
  VERIFICATION_RECORD_VERSION,
  VERIFICATION_STAGES,
} from './version';

/** Opaque chain identifier (owned by the producing domain). */
const ChainId = z.string().min(1).max(256);

/** Free-text statement/rationale field. */
const Statement = z.string().min(1).max(4096);

/** Serialized-form version discriminator for the verification chain (v1). */
export const VerificationVersionSchema = z.literal(VERIFICATION_RECORD_VERSION).meta({
  id: 'urn:epoch:verification:chain-version',
  title: 'VerificationChainVersion',
  description: 'Version discriminator carried by every serialized verification chain (currently 1).',
});

/** The two distinct stages: verification vs validation (never fused). */
export const VerificationStageSchema = z.enum(VERIFICATION_STAGES).meta({
  id: 'urn:epoch:verification:stage',
  title: 'VerificationStage',
  description: 'Distinct chain stages: verification ("was the work done to spec") vs validation ("is the spec right").',
});

/** Result outcome vocabulary. */
export const ResultOutcomeSchema = z.enum(RESULT_OUTCOMES).meta({
  id: 'urn:epoch:verification:result-outcome',
  title: 'ResultOutcome',
  description: 'Judgment produced by a run about its claim: pass, fail, or inconclusive.',
});

/** Approval decision vocabulary. */
export const ApprovalDecisionSchema = z.enum(APPROVAL_DECISIONS).meta({
  id: 'urn:epoch:verification:approval-decision',
  title: 'ApprovalDecision',
  description: 'Authority act over a result: approved or rejected.',
});

/** Run execution status vocabulary. */
export const RunStatusSchema = z.enum(RUN_STATUSES).meta({
  id: 'urn:epoch:verification:run-status',
  title: 'RunStatus',
  description: 'Execution status of a run: completed, failed, or aborted.',
});

/** The requirement: what must hold. */
export const RequirementSchema = z
  .strictObject({
    schemaVersion: VerificationVersionSchema,
    requirementId: ChainId,
    statement: Statement,
  })
  .readonly()
  .meta({
    id: 'urn:epoch:verification:requirement',
    title: 'Requirement',
    description: 'The Requirement stage: what must hold (authored outside this kernel).',
  });

/** The claim: a testable assertion against a requirement. */
export const ClaimSchema = z
  .strictObject({
    schemaVersion: VerificationVersionSchema,
    claimId: ChainId,
    requirementId: ChainId,
    statement: Statement,
    stage: VerificationStageSchema,
  })
  .readonly()
  .meta({
    id: 'urn:epoch:verification:claim',
    title: 'Claim',
    description: 'The Claim stage: a testable assertion that a requirement can be verified or validated against.',
  });

/** The method: how a claim will be verified/validated. */
export const MethodSchema = z
  .strictObject({
    schemaVersion: VerificationVersionSchema,
    methodId: ChainId,
    claimId: ChainId,
    stage: VerificationStageSchema,
    description: Statement,
    deterministic: z.boolean(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:verification:method',
    title: 'Method',
    description: 'The Method stage: how a claim will be verified or validated (every claim needs at least one).',
  });

/** The run: one execution of a method, producing evidence. */
export const RunSchema = z
  .strictObject({
    schemaVersion: VerificationVersionSchema,
    runId: ChainId,
    methodId: ChainId,
    stage: VerificationStageSchema,
    executedBy: ChainId,
    executedByKind: ProvenanceAgentKindSchema,
    startedAt: TimestampSchema,
    endedAt: TimestampSchema,
    status: RunStatusSchema,
    producedEvidence: z.array(Sha256DigestSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:verification:run',
    title: 'Run',
    description: 'The Run stage: one execution of a method by an actor, producing content-addressed evidence.',
  });

/** The result: an evidence-grounded judgment about a claim. */
export const ResultSchema = z
  .strictObject({
    schemaVersion: VerificationVersionSchema,
    resultId: ChainId,
    claimId: ChainId,
    runId: ChainId,
    stage: VerificationStageSchema,
    outcome: ResultOutcomeSchema,
    evidenceDigests: z.array(Sha256DigestSchema).min(1).readonly(),
    confidence: ConfidenceSchema,
    decidedAt: TimestampSchema,
    rationale: Statement.optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:verification:result',
    title: 'Result',
    description: 'The Result stage: the judgment a run produced about its claim, grounded in exact-revision evidence.',
  });

/** The approval: a distinct authority act over a result. */
export const ApprovalSchema = z
  .strictObject({
    schemaVersion: VerificationVersionSchema,
    approvalId: ChainId,
    resultId: ChainId,
    approverId: ChainId,
    approverKind: ProvenanceAgentKindSchema,
    decision: ApprovalDecisionSchema,
    decidedAt: TimestampSchema,
    rationale: Statement.optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:verification:approval',
    title: 'Approval',
    description: 'The Approval stage: a distinct authority act — results do not self-approve; the approver must differ from the run executor.',
  });

/** The full chain: Requirement -> Claim -> Method -> Run -> Evidence -> Result -> Approval. */
export const VerificationChainSchema = z
  .strictObject({
    schemaVersion: VerificationVersionSchema,
    requirements: z.array(RequirementSchema).readonly(),
    claims: z.array(ClaimSchema).readonly(),
    methods: z.array(MethodSchema).readonly(),
    runs: z.array(RunSchema).readonly(),
    evidence: z.array(EvidenceRecordSchema).readonly(),
    results: z.array(ResultSchema).readonly(),
    approvals: z.array(ApprovalSchema).readonly(),
    provenance: z.array(ProvenanceGraphSchema).readonly().optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:verification:chain',
    title: 'VerificationChain',
    description: 'The closed chain of Requirement, Claim, Method, Run, Evidence, Result, and Approval records plus attached provenance.',
  });
