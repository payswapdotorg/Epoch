/**
 * @epoch/agent-protocol — public API.
 *
 * Epoch Agent Protocol v1 (kernel layer): provider-neutral agent
 * registration, capability/tool declarations, and the shared protocol
 * primitives (canonical JSON serialization, SHA-256 digests, message
 * admission pipeline) reused by @epoch/action-protocol.
 *
 * The published contract surface lives at `contracts/agent/` (TypeScript
 * declarations + JSON Schema projection + manifest); this package is the
 * runtime implementation of that contract.
 */
// Canonical serialization + digests (shared protocol primitives).
export {
  canonicalJsonStringify,
  CanonicalizationError,
  type JsonValue,
} from './canonical';
export { canonicalDigest, sha256Hex, type Sha256Hex } from './digest';

// Shared zod primitives.
export {
  AGENT_ID_PATTERN,
  ISO_CURRENCY_PATTERN,
  MESSAGE_ID_PATTERN,
  NON_NEGATIVE_DECIMAL_PATTERN,
  PARAMETER_NAME_PATTERN,
  QUALIFIED_NAME_PATTERN,
  SEMVER_CORE_PATTERN,
  SLUG_PATTERN,
  TIMESTAMP_PATTERN,
} from './primitives';
export {
  AgentIdSchema,
  JsonValueSchema,
  MessageIdSchema,
  QualifiedTypeReferenceSchema,
  TimestampSchema,
  type AgentId,
  type MessageId,
  type QualifiedTypeReference,
  type Timestamp,
} from './primitives';

// Version + message-kind vocabulary.
export {
  AGENT_CONTRACT_VERSION,
  AGENT_MESSAGE_KIND_REGISTRATION,
  AGENT_PROTOCOL_MESSAGE_KINDS,
  AGENT_PROTOCOL_VERSION,
  MessageKindSchema,
  ProtocolVersionSchema,
  type MessageKind,
  type ProtocolVersion,
} from './version';

// Message admission pipeline.
export {
  admitMessage,
  ProtocolValidationError,
  unwrapOrThrow,
  type AdmitMessageOptions,
  type ParseFailure,
  type ParseOutcome,
  type ParseSuccess,
  type ProtocolError,
  type ProtocolIssue,
} from './envelope';

// Capability declarations.
export {
  CapabilityDeclarationSchema,
  ParameterKindSchema,
  ParameterSpecSchema,
  PARAMETER_KINDS,
  parseCapabilityDeclaration,
  validateCapabilityDeclaration,
  type CapabilityDeclaration,
  type ParameterKind,
  type ParameterSpec,
} from './capability';

// Tool declarations.
export {
  CAPABILITY_FABRIC_CATEGORIES,
  ToolDeclarationSchema,
  TOOL_ID_PATTERN,
  type ToolDeclaration,
} from './tool';

// Authority + evidence declarations.
export { AuthorityDeclarationSchema, type AuthorityDeclaration } from './authority';
export { EvidenceRequirementsSchema, type EvidenceRequirements } from './evidence';

// Cost/latency profiles.
export {
  COST_BASES,
  CostProfileSchema,
  LatencyProfileSchema,
  type CostProfile,
  type LatencyProfile,
} from './profiles';

// Agent registration message.
export {
  AgentRegistrationSchema,
  ExecutorKindSchema,
  ExecutorSchema,
  EXECUTOR_KINDS,
  parseAgentRegistration,
  validateAgentRegistration,
  type AgentRegistration,
  type Executor,
  type ExecutorKind,
} from './registration';

// Published schema surface + contract emission.
export {
  AGENT_PROTOCOL_SCHEMA_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  AGENT_CONTRACT_DIR,
  renderAgentContractFiles,
  typeToKebabCase,
} from './contract-emission';
