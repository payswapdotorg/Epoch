/**
 * @epoch/verification — public API (kernel layer, Work Order W006).
 *
 * The verification chain (architecture.md, binding):
 *   Requirement -> Claim -> Method -> Run -> Evidence -> Result -> Approval.
 *
 * - Verification and validation are DISTINCT typed stages (lock rule 7
 *   corollary); the reference chain validator rejects stage confusion.
 * - Evidence is exact-revision addressable (@epoch/evidence); runs and
 *   results reference evidence by canonical SHA-256 digest, and digest
 *   mismatches are rejected.
 * - Approval is a distinct authority act: results do not self-approve.
 * - Provenance is first-class: a validated chain maps deterministically to
 *   a PROV-DM-adapted graph (@epoch/provenance) via `chainProvenance`.
 * - No UI, no persistence, no workflow engine: the typed model, chain
 *   validation, digest discipline, and reference chain-validation only.
 *
 * Versioned contract surface: version constants + typed index export (this
 * file), runtime zod validators (src/schema.ts), compile-time parity
 * (src/parity.ts), and the committed JSON Schema projection under schemas/
 * pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  APPROVAL_DECISIONS,
  RESULT_OUTCOMES,
  RUN_STATUSES,
  VERIFICATION_CONTRACT_VERSION,
  VERIFICATION_RECORD_VERSION,
  VERIFICATION_STAGES,
} from './version';

// Published contract types.
export type {
  Approval,
  ApprovalDecision,
  ChainIssue,
  ChainIssueCode,
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

// Runtime validators.
export {
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

// Compile-time contract parity (type-only).
export type { VerificationLiteralSync, VerificationSchemaSync } from './parity';

// Total parse surface.
export { parseVerificationChain, type ChainParse } from './parse';

// Reference chain validation.
export {
  admitChain,
  validateChain,
  type ChainValidation,
} from './validate';

// Provenance construction from validated chains.
export { chainProvenance, type ChainProvenanceResult } from './provenance';

// Digest discipline (canonical SHA-256 content addressing).
export { computeChainDigest, VerificationError } from './digest';

// Published schema surface + contract emission.
export { VERIFICATION_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  VERIFICATION_CONTRACT_DIR,
  renderVerificationContractFiles,
  typeToKebabCase,
} from './contract-emission';
