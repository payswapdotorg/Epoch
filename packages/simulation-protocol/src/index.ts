/**
 * @epoch/simulation-protocol — public API.
 *
 * Epoch Simulation Protocol v1 (kernel layer, Work Order W005):
 * provider-neutral simulator registration, invocation request/result
 * messages, cross-document conformance checks, and a reference-grade
 * deterministic simulator that proves the protocol end-to-end.
 *
 * Simulation predicts; evaluation judges (they are distinct — evaluation
 * lives in `@epoch/evaluation-protocol`). Simulators remain external
 * capabilities (architecture lock rule 5): this package is the protocol,
 * not an engine and not an execution fabric (W021).
 *
 * The published contract surface lives IN-PACKAGE at
 * `packages/simulation-protocol/contracts/` (TypeScript declarations +
 * JSON Schema projection + manifest), because W005 owns no
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
  SIMULATION_CONTRACT_VERSION,
  SIMULATION_MESSAGE_KIND_INVOCATION_REQUEST,
  SIMULATION_MESSAGE_KIND_REGISTRATION,
  SIMULATION_MESSAGE_KIND_RESULT,
  SIMULATION_PROTOCOL_MESSAGE_KINDS,
  SIMULATION_PROTOCOL_VERSION,
  SimulationMessageKindSchema,
  SimulationProtocolVersionSchema,
  type SimulationMessageKind,
  type SimulationProtocolVersion,
} from './version';

// Simulator contract declarations (fidelity, validity domain,
// reproducibility, simulator ids).
export {
  FidelityProfileSchema,
  SEED_POLICIES,
  SeedPolicySchema,
  SIMULATOR_ID_PATTERN,
  SimulatorIdSchema,
  ValidityDomainSchema,
  type FidelityProfile,
  type SeedPolicy,
  type SimulatorId,
  type ValidityDomain,
} from './contract';
export {
  ReproducibilityProfileSchema,
  type ReproducibilityProfile,
} from './contract';

// Simulator registration message.
export {
  SimulatorRegistrationSchema,
  parseSimulatorRegistration,
  validateSimulatorRegistration,
  type SimulatorRegistration,
} from './registration';

// Invocation request message + simulator references.
export {
  MAX_SAFE_SEED,
  SHA256_HEX_PATTERN,
  SimulationInvocationRequestSchema,
  SimulatorReferenceSchema,
  parseSimulationInvocationRequest,
  validateSimulationInvocationRequest,
  type SimulationInvocationRequest,
  type SimulatorReference,
} from './invocation';

// Result message + outcome union.
export {
  CompletedSimulationResultSchema,
  FailedSimulationResultSchema,
  InvocationReferenceSchema,
  SIMULATION_FAILURE_CODES,
  SIMULATION_RESULT_STATUSES,
  SimulationFailureCodeSchema,
  SimulationFailureSchema,
  SimulationOutcomeSchema,
  SimulationResultSchema,
  SimulationResultStatusSchema,
  parseSimulationResult,
  validateSimulationResult,
  type CompletedSimulationResult,
  type FailedSimulationResult,
  type InvocationReference,
  type SimulationFailure,
  type SimulationFailureCode,
  type SimulationOutcome,
  type SimulationResult,
  type SimulationResultStatus,
} from './result';

// Cross-document conformance checks.
export {
  checkInvocationConformance,
  checkResultConformance,
  invocationRequestDigest,
  registrationDigest,
  valueConformsToSpec,
  type ConformanceViolation,
} from './conformance';

// Reference-grade deterministic simulator (reference only, not an engine).
export {
  REFERENCE_SIMULATOR_ID,
  REFERENCE_SIMULATOR_REGISTRATION,
  deriveReferenceResultId,
  documentDigest,
  referenceRegistrationDigest,
  runReferenceSimulation,
  type ReferenceSimulationFailure,
  type ReferenceSimulationOutcome,
  type ReferenceSimulationRun,
} from './reference';

// Published schema surface + contract emission.
export {
  SIMULATION_PROTOCOL_SCHEMA_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  SIMULATION_CONTRACT_DIR,
  renderSimulationContractFiles,
  typeToKebabCase,
} from './contract-emission';
