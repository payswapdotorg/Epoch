/**
 * @epoch/action-protocol — public API.
 *
 * Epoch Action Protocol v1 (kernel layer): typed action proposals and
 * authorization request/decision messages. Agents propose; the Action
 * Gateway (W022) authorizes and executes — the protocol encodes that split
 * structurally (see `authorization.ts`).
 *
 * The published contract surface lives at `contracts/actions/`; this
 * package is the runtime implementation of that contract. Shared protocol
 * primitives (canonical serialization, digests, admission pipeline) come
 * from `@epoch/agent-protocol`, the base protocol package (kernel → kernel
 * edge).
 */
// Mirrored shared primitives, re-exported for one-stop imports. Their
// canonical home is @epoch/agent-protocol (contracts/agent); the
// self-contained redeclarations in contracts/actions/index.d.ts are
// parity-checked against these.
export type {
  AgentId,
  JsonValue,
  MessageId,
  Timestamp,
} from '@epoch/agent-protocol';

// Version + message-kind vocabulary.
export {
  ACTION_CONTRACT_VERSION,
  ACTION_MESSAGE_KIND_AUTHORIZATION_DECISION,
  ACTION_MESSAGE_KIND_AUTHORIZATION_REQUEST,
  ACTION_MESSAGE_KIND_PROPOSAL,
  ACTION_PROTOCOL_MESSAGE_KINDS,
  ACTION_PROTOCOL_VERSION,
  ActionMessageKindSchema,
  ActionProtocolVersionSchema,
  type ActionMessageKind,
  type ActionProtocolVersion,
} from './version';

// Targets and effect vocabulary.
export {
  ACTION_TARGET_KINDS,
  ActionTargetKindSchema,
  ActionTargetSchema,
  EffectConfidenceSchema,
  PreconditionSchema,
  PredictedEffectSchema,
  ReversibilityClassificationSchema,
  SideEffectSchema,
  type ActionTarget,
  type ActionTargetKind,
  type EffectConfidence,
  type Precondition,
  type PredictedEffect,
  type ReversibilityClassification,
  type SideEffect,
} from './targets';

// Authority requirements.
export {
  AUTHORITY_SCOPE_PATTERN,
  ApprovalQuorumSchema,
  AuthorityRequirementsSchema,
  AuthorityScopeSchema,
  type ApprovalQuorum,
  type AuthorityRequirements,
  type AuthorityScope,
} from './authority';

// Action proposals.
export {
  ActionTypeReferenceSchema,
  ActionProposalSchema,
  ProposalReferenceSchema,
  parseActionProposal,
  validateActionProposal,
  type ActionProposal,
  type ActionTypeReference,
  type ProposalReference,
} from './proposal';

// Authorization messages.
export {
  AUTHORIZER_ROLES,
  AuthorizationConditionSchema,
  AuthorizationDecisionSchema,
  AuthorizationRequestSchema,
  AuthorizerReferenceSchema,
  AuthorizedDecisionSchema,
  DecisionSchema,
  DeniedDecisionSchema,
  DenialCodeSchema,
  EscalatedDecisionSchema,
  PrincipalReferenceSchema,
  AuthorizerRoleSchema,
  RequestingRoleSchema,
  REQUESTING_ROLES,
  parseAuthorizationDecision,
  parseAuthorizationRequest,
  validateAuthorizationDecision,
  validateAuthorizationRequest,
  type AuthorizationCondition,
  type AuthorizationDecision,
  type AuthorizationRequest,
  type AuthorizerReference,
  type AuthorizerRole,
  type AuthorizedDecision,
  type Decision,
  type DeniedDecision,
  type DenialCode,
  type EscalatedDecision,
  type PrincipalReference,
  type RequestingRole,
} from './authorization';

// Message union.
export {
  ActionProtocolMessageSchema,
  parseActionProtocolMessage,
  type ActionProtocolMessage,
} from './message';

// Published schema surface + contract emission.
export {
  ACTION_PROTOCOL_SCHEMA_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  ACTION_CONTRACT_DIR,
  renderActionContractFiles,
  typeToKebabCase,
} from './contract-emission';
