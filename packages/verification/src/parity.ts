/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W006 contract
 * guarantee; the JSON-Schema half is test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type {
  Approval,
  ApprovalDecision,
  Claim,
  Method,
  Requirement,
  Result,
  ResultOutcome,
  Run,
  RunStatus,
  VerificationChain,
  VerificationStage,
} from './types';
import type {
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

export type VerificationSchemaSync = [
  Expect<Equals<z.infer<typeof VerificationVersionSchema>, 1>>,
  Expect<Equals<z.infer<typeof VerificationStageSchema>, VerificationStage>>,
  Expect<Equals<z.infer<typeof ResultOutcomeSchema>, ResultOutcome>>,
  Expect<Equals<z.infer<typeof ApprovalDecisionSchema>, ApprovalDecision>>,
  Expect<Equals<z.infer<typeof RunStatusSchema>, RunStatus>>,
  Expect<Equals<z.infer<typeof RequirementSchema>, Requirement>>,
  Expect<Equals<z.infer<typeof ClaimSchema>, Claim>>,
  Expect<Equals<z.infer<typeof MethodSchema>, Method>>,
  Expect<Equals<z.infer<typeof RunSchema>, Run>>,
  Expect<Equals<z.infer<typeof ResultSchema>, Result>>,
  Expect<Equals<z.infer<typeof ApprovalSchema>, Approval>>,
  Expect<Equals<z.infer<typeof VerificationChainSchema>, VerificationChain>>,
];

/** String-literal unions are additionally pinned member-for-member. */
export type VerificationLiteralSync = [
  Expect<Equals<VerificationStage, 'verification' | 'validation'>>,
  Expect<Equals<ResultOutcome, 'pass' | 'fail' | 'inconclusive'>>,
  Expect<Equals<ApprovalDecision, 'approved' | 'rejected'>>,
  Expect<Equals<RunStatus, 'completed' | 'failed' | 'aborted'>>,
];
