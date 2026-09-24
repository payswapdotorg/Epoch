/**
 * @epoch/evaluation-protocol — public API.
 *
 * Epoch Evaluation Protocol v1 (kernel layer, Work Order W005):
 * provider-neutral evaluator registration, evaluation request/verdict
 * messages with machine-referenceable justifications, cross-document
 * conformance checks, and a reference-grade threshold evaluator.
 *
 * Evaluation JUDGES; simulation PREDICTS (architecture lock rule 6).
 * This package has no runtime dependency on
 * `@epoch/simulation-protocol` — subjects are referenced neutrally by
 * kind, id, and canonical digest. The simulation package appears only
 * as a devDependency of the end-to-end composition test.
 *
 * The published contract surface lives IN-PACKAGE at
 * `packages/evaluation-protocol/contracts/` because W005 owns no
 * repository-root `contracts/*` directory.
 */
// Mirrored shared primitives, re-exported for one-stop imports. Their
// canonical home is @epoch/agent-protocol (contracts/agent); the
// self-contained redeclarations in this package's contracts/index.d.ts
// are parity-checked against these.
export type { JsonValue, MessageId, Timestamp } from '@epoch/agent-protocol';
export {
  CostProfileSchema,
  JsonValueSchema,
  LatencyProfileSchema,
  MessageIdSchema,
  ParameterKindSchema,
  ParameterSpecSchema,
  TimestampSchema,
  type CostProfile,
  type LatencyProfile,
  type ParameterKind,
  type ParameterSpec,
} from '@epoch/agent-protocol';
export {
  admitMessage,
  unwrapOrThrow,
  ProtocolValidationError,
  type AdmitMessageOptions,
  type ParseFailure,
  type ParseOutcome,
  type ParseSuccess,
  type ProtocolError,
  type ProtocolIssue,
} from '@epoch/agent-protocol';

// Version + message-kind vocabulary.
export {
  EVALUATION_CONTRACT_VERSION,
  EVALUATION_MESSAGE_KIND_REGISTRATION,
  EVALUATION_MESSAGE_KIND_REQUEST,
  EVALUATION_MESSAGE_KIND_VERDICT,
  EVALUATION_PROTOCOL_MESSAGE_KINDS,
  EVALUATION_PROTOCOL_VERSION,
  EvaluationMessageKindSchema,
  EvaluationProtocolVersionSchema,
  type EvaluationMessageKind,
  type EvaluationProtocolVersion,
} from './version';

// Evaluation subjects (neutral references).
export {
  EVALUATION_SUBJECT_KINDS,
  EvaluationSubjectKindSchema,
  EvaluationSubjectSchema,
  SHA256_HEX_PATTERN,
  type EvaluationSubject,
  type EvaluationSubjectKind,
} from './subject';

// Evaluator registration message.
export {
  EVALUATOR_ID_PATTERN,
  EvaluatorIdSchema,
  EvaluatorRegistrationSchema,
  JudgmentBasisSchema,
  VERDICT_FORMS,
  VerdictFormSchema,
  parseEvaluatorRegistration,
  validateEvaluatorRegistration,
  type EvaluatorId,
  type EvaluatorRegistration,
  type JudgmentBasis,
  type VerdictForm,
} from './registration';

// Evaluation request message + evaluator references.
export {
  EvaluationRequestSchema,
  EvaluatorReferenceSchema,
  parseEvaluationRequest,
  validateEvaluationRequest,
  type EvaluationRequest,
  type EvaluatorReference,
} from './request';

// Verdict message + outcome union + justification references.
export {
  EvaluationRequestReferenceSchema,
  EvaluationVerdictSchema,
  JUSTIFICATION_KINDS,
  JustificationKindSchema,
  JustificationReferenceSchema,
  PassFailVerdictSchema,
  ScoredVerdictSchema,
  VerdictOutcomeSchema,
  parseEvaluationVerdict,
  validateEvaluationVerdict,
  type EvaluationRequestReference,
  type EvaluationVerdict,
  type JustificationKind,
  type JustificationReference,
  type PassFailVerdict,
  type ScoredVerdict,
  type VerdictOutcome,
} from './verdict';

// Cross-document conformance checks.
export {
  checkEvaluationRequestConformance,
  checkVerdictConformance,
  evaluationRequestDigest,
  evaluatorRegistrationDigest,
  valueConformsToSpec,
  type ConformanceViolation,
} from './conformance';

// Reference-grade threshold evaluator (reference only, not a judge
// product).
export {
  REFERENCE_EVALUATOR_ID,
  REFERENCE_EVALUATOR_REGISTRATION,
  REFERENCE_OPERATORS,
  deriveReferenceVerdictId,
  referenceEvaluatorRegistrationDigest,
  runReferenceEvaluation,
  type ReferenceEvaluationFailure,
  type ReferenceEvaluationOutcome,
  type ReferenceEvaluationRun,
  type ReferenceOperator,
  type ReferenceSubjectPayload,
} from './reference';

// Published schema surface + contract emission.
export {
  EVALUATION_PROTOCOL_SCHEMA_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  EVALUATION_CONTRACT_DIR,
  renderEvaluationContractFiles,
  typeToKebabCase,
} from './contract-emission';
