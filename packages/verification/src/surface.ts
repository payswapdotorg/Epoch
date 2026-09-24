/**
 * The verification schema surface registry: every data type published at
 * the `@epoch/verification` ownership boundary, paired with its zod schema
 * (W006 publishes its versioned contract surface inside the package; see
 * src/contract-emission.ts and test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
  ApprovalDecisionSchema,
  ApprovalSchema,
  ClaimSchema,
  MethodSchema,
  RequirementSchema,
  ResultOutcomeSchema,
  ResultSchema,
  RunSchema,
  RunStatusSchema,
  VerificationChainSchema,
  VerificationStageSchema,
  VerificationVersionSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the verification contract v1. */
export const VERIFICATION_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'Approval', schema: ApprovalSchema },
  { type: 'ApprovalDecision', schema: ApprovalDecisionSchema },
  { type: 'Claim', schema: ClaimSchema },
  { type: 'Method', schema: MethodSchema },
  { type: 'Requirement', schema: RequirementSchema },
  { type: 'Result', schema: ResultSchema },
  { type: 'ResultOutcome', schema: ResultOutcomeSchema },
  { type: 'Run', schema: RunSchema },
  { type: 'RunStatus', schema: RunStatusSchema },
  { type: 'VerificationChain', schema: VerificationChainSchema },
  { type: 'VerificationChainVersion', schema: VerificationVersionSchema },
  { type: 'VerificationStage', schema: VerificationStageSchema },
];
