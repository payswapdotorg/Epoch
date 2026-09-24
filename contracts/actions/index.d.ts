/**
 * Epoch Action Protocol v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * `contracts/actions` ownership boundary (Work Order W003). It is
 * self-contained: no imports, no runtime code, no vendor/framework
 * vocabulary. The runtime implementation lives in `@epoch/action-protocol`
 * (kernel layer); `parity.ts` in this directory proves at compile time
 * that the implementation's inferred types are identical to these
 * declarations.
 *
 * The authority split (architecture lock rules 2/3) is encoded
 * structurally: proposals carry no authorization power, and only the
 * Action Gateway or a human approver can be expressed as the source of an
 * authorization decision.
 *
 * Contract version: 1.0.0 (see manifest.json)
 * Protocol version: 1.0.0 (carried by every message as `protocolVersion`)
 */

/**
 * Mirrored shared primitives (owned and versioned at `contracts/agent`);
 * redeclared here so this contract surface is self-contained. They MUST
 * stay structurally identical — enforced by parity assertions against
 * `@epoch/action-protocol`, whose proposal shape embeds them.
 */

/** UTC instant in canonical wire form `YYYY-MM-DDTHH:MM:SS.mmmZ`. */
export type Timestamp = string;

/** Opaque message identifier (unique within the emitting scope; UUIDs fit). */
export type MessageId = string;

/** Registered agent identifier: `agent:` + lowercase slug. */
export type AgentId = string;

/** JSON-representable value (finite numbers only). */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Exact action-protocol version admitted by contract version 1.0.0. */
export type ActionProtocolVersion = '1.0.0';

/** Discriminating message kinds of the action protocol. */
export type ActionMessageKind =
  | 'action.proposal'
  | 'action.authorization-request'
  | 'action.authorization-decision';

/** What a proposed intervention acts upon. */
export type ActionTargetKind =
  | 'world-entity'
  | 'world-relation'
  | 'world-assertion'
  | 'external-resource';

/**
 * The target of a proposed intervention. `ref` is opaque: world reference
 * formats are owned by the canonical World Model (W002), external
 * references by their adapters (lock rule 13).
 */
export type ActionTarget = {
  kind: ActionTargetKind;
  ref: string;
};

/**
 * A condition that must hold before execution. `constraintRef` is an
 * opaque reference into the constraint registry (W004 owns the constraint
 * language and compiled enforcement).
 */
export type Precondition = {
  description: string;
  constraintRef?: string | undefined;
  targetRef?: ActionTarget | undefined;
};

/** Confidence in a predicted effect — deterministic, quantified, or qualitative. */
export type EffectConfidence =
  | { kind: 'deterministic' }
  | { kind: 'quantified'; value: number }
  | { kind: 'qualitative'; level: 'high' | 'medium' | 'low' };

/** A predicted primary effect (every proposal declares at least one). */
export type PredictedEffect = {
  description: string;
  targetRef?: ActionTarget | undefined;
  confidence: EffectConfidence;
};

/** A secondary effect outside the action's primary intent. */
export type SideEffect = {
  description: string;
  targetRef?: ActionTarget | undefined;
  reversible: boolean;
};

/**
 * Exhaustive reversibility classification. `partially-reversible` requires
 * notes stating the irreversible residue (runtime refinement).
 */
export type ReversibilityClassification =
  | {
      kind: 'reversible';
      via: 'automatic' | 'manual' | 'compensating-action';
      notes?: string | undefined;
    }
  | { kind: 'partially-reversible'; notes: string }
  | { kind: 'irreversible'; notes?: string | undefined };

/** Colon-namespaced authority scope, e.g. `world:write`. */
export type AuthorityScope = string;

/** Human approval quorum (roles are opaque; W009 owns role semantics). */
export type ApprovalQuorum = {
  approvals: number;
  roles: string[];
};

/**
 * Authority requirements — REQUIRED on every action proposal with a
 * non-empty scope list. `approvalQuorum` is present if and only if
 * `requiresHumanApproval` is true (runtime refinement). The Action Gateway
 * (W022) evaluates these requirements; this type declares them only.
 */
export type AuthorityRequirements = {
  requiredScopes: AuthorityScope[];
  requiresHumanApproval: boolean;
  approvalQuorum?: ApprovalQuorum | undefined;
};

/** Reference to a versioned action type: dot-namespaced id + semver core. */
export type ActionTypeReference = {
  id: string;
  version: string;
};

/**
 * Exact-revision reference to a proposal: the proposal id plus the SHA-256
 * digest of the proposal's canonical JSON. Authorization requests and
 * decisions bind to the exact proposal revision they concern.
 */
export type ProposalReference = {
  proposalId: MessageId;
  canonicalDigest: string;
};

/**
 * The action proposal message (`messageKind: "action.proposal"`): a typed
 * intervention proposed by an agent. Safety-relevant metadata —
 * preconditions, predicted effects, side effects, reversibility,
 * authority requirements — is REQUIRED, and unknown fields are rejected
 * (strict objects), so authorization or execution vocabulary cannot be
 * smuggled into a proposal. The protocol confers no authority to execute;
 * only the Action Gateway (W022) authorizes execution.
 */
export type ActionProposal = {
  protocolVersion: ActionProtocolVersion;
  messageKind: 'action.proposal';
  messageId: MessageId;
  createdAt: Timestamp;
  proposalId: MessageId;
  proposedBy: AgentId;
  actionType: ActionTypeReference;
  target: ActionTarget;
  parameters: { [key: string]: JsonValue };
  preconditions: Precondition[];
  predictedEffects: PredictedEffect[];
  sideEffects: SideEffect[];
  reversibility: ReversibilityClassification;
  authorityRequirements: AuthorityRequirements;
  rationale?: string | undefined;
  evidenceRefs?: string[] | undefined;
  expiresAt?: Timestamp | undefined;
};

/** Roles that may request an authorization decision. */
export type RequestingRole = 'action-gateway' | 'agent-runtime' | 'human';

/** Who requested an authorization decision (opaque id; W009 reconciliation). */
export type PrincipalReference = {
  id: string;
  role: RequestingRole;
};

/**
 * Roles that may issue an authorization decision. Deliberately narrow:
 * agents are structurally excluded — only the Action Gateway or a human
 * approver it delegated to can decide.
 */
export type AuthorizerRole = 'action-gateway' | 'human-approver';

/** Who issued an authorization decision (opaque id; W009/W022 reconciliation). */
export type AuthorizerReference = {
  id: string;
  role: AuthorizerRole;
};

/** A condition attached to an authorization (constraintRef opaque; W004). */
export type AuthorizationCondition = {
  description: string;
  constraintRef?: string | undefined;
};

/** Machine-readable denial codes (protocol-level, provider-neutral). */
export type DenialCode =
  | 'missing-authority'
  | 'policy-violation'
  | 'precondition-unmet'
  | 'insufficient-evidence'
  | 'proposal-expired'
  | 'out-of-scope'
  | 'other';

/** An authorization to execute, possibly under conditions. */
export type AuthorizedDecision = {
  kind: 'authorized';
  conditions: AuthorizationCondition[];
  validUntil?: Timestamp | undefined;
};

/** A denial with a machine-readable code and a required reason. */
export type DeniedDecision = {
  kind: 'denied';
  code: DenialCode;
  reason: string;
};

/** Escalation to another authorizer (gateway role or human approver). */
export type EscalatedDecision = {
  kind: 'escalated';
  escalatedTo: AuthorizerReference;
  reason: string;
};

/** The decision itself: authorized, denied, or escalated (exhaustive union). */
export type Decision = AuthorizedDecision | DeniedDecision | EscalatedDecision;

/**
 * The authorization request message (`messageKind:
 * "action.authorization-request"`): a request for an authorization decision
 * over an exact proposal revision, with requested scopes, a mandatory
 * justification, and optional simulation/evaluation context (R4; the
 * references are opaque — W005/W021 and the evidence domain own them).
 */
export type AuthorizationRequest = {
  protocolVersion: ActionProtocolVersion;
  messageKind: 'action.authorization-request';
  messageId: MessageId;
  createdAt: Timestamp;
  requestId: MessageId;
  proposalRef: ProposalReference;
  requestedBy: PrincipalReference;
  requestedScopes: AuthorityScope[];
  justification: string;
  context?: {
    simulationRunRef?: string | undefined;
    evaluationRef?: string | undefined;
    evidenceRefs?: string[] | undefined;
  } | undefined;
};

/**
 * The authorization decision message (`messageKind:
 * "action.authorization-decision"`): the outcome for one request over one
 * exact proposal revision, issued by the Action Gateway or a human
 * approver. `decidedBy.role` structurally excludes agents.
 */
export type AuthorizationDecision = {
  protocolVersion: ActionProtocolVersion;
  messageKind: 'action.authorization-decision';
  messageId: MessageId;
  createdAt: Timestamp;
  requestId: MessageId;
  proposalRef: ProposalReference;
  decidedBy: AuthorizerReference;
  decision: Decision;
};

/** Discriminated union of all action-protocol v1 messages. */
export type ActionProtocolMessage =
  | ActionProposal
  | AuthorizationRequest
  | AuthorizationDecision;
