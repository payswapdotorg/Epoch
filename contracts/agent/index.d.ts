/**
 * Epoch Agent Protocol v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * `contracts/agent` ownership boundary (Work Order W003). It is
 * self-contained: no imports, no runtime code, no vendor/framework
 * vocabulary. The runtime implementation lives in `@epoch/agent-protocol`
 * (kernel layer); `parity.ts` in this directory proves at compile time that
 * the implementation's inferred types are identical to these declarations.
 *
 * Contract version: 1.0.0 (see manifest.json)
 * Protocol version: 1.0.0 (carried by every message as `protocolVersion`)
 */

/** Exact agent-protocol version admitted by contract version 1.0.0. */
export type ProtocolVersion = '1.0.0';

/** Discriminating message kinds of the agent protocol. */
export type MessageKind = 'agent.registration';

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

/**
 * Reference to a versioned, protocol-defined type: dot-namespaced id plus
 * semantic-version core string (e.g. `engineering.stress-analysis` at
 * `1.4.0`). Never names a vendor product.
 */
export type QualifiedTypeReference = {
  id: string;
  version: string;
};

/**
 * Neutral executor nature. `human` — a person; `program` — any software
 * executor (deterministic solver, script, robot); `model` — any
 * model-backed executor (LLM or otherwise); `hybrid` — mixed human/automated
 * execution. No vendor, framework, or model family is encoded.
 */
export type ExecutorKind = 'human' | 'program' | 'model' | 'hybrid';

/** What implements the agent, neutrally. */
export type Executor = {
  kind: ExecutorKind;
  deterministic: boolean;
};

/** Value kinds a capability parameter can carry. */
export type ParameterKind =
  | 'integer'
  | 'number'
  | 'string'
  | 'boolean'
  | 'enum'
  | 'entity-reference'
  | 'json';

/**
 * A named capability parameter. `enumValues` is present if and only if
 * `kind` is `"enum"`; `unit` may only be present for the numeric kinds
 * (runtime refinements).
 */
export type ParameterSpec = {
  name: string;
  kind: ParameterKind;
  required: boolean;
  description: string;
  enumValues?: string[] | undefined;
  unit?: string | undefined;
};

/**
 * A provider-neutral capability declaration: namespaced id, kebab-slug
 * domain, parameter specs, and stated assumptions. Validatable as a
 * standalone document and embedded in every agent registration.
 */
export type CapabilityDeclaration = {
  protocolVersion: ProtocolVersion;
  capabilityId: string;
  summary: string;
  domain: string;
  inputs: ParameterSpec[];
  outputs: ParameterSpec[];
  assumptions: string[];
};

/**
 * A neutral tool declaration. `category` uses the canonical Capability
 * Fabric adapter categories (`source`, `semantic`, `reconstruction`,
 * `visualization`, `simulation`, `evaluator`, `action`, `verification`).
 */
export type ToolDeclaration = {
  toolId: string;
  summary: string;
  category:
    | 'source'
    | 'semantic'
    | 'reconstruction'
    | 'visualization'
    | 'simulation'
    | 'evaluator'
    | 'action'
    | 'verification';
  capabilityRef?: string | undefined;
};

/**
 * Agent authority declaration. Proposal-scoped by construction: agents
 * propose actions; only the Action Gateway authorizes and executes
 * (architecture lock rules 2/3). `executionAuthority` admits exactly one
 * value, `"none"` — encoded structurally so granting execution authority
 * requires a major protocol change.
 */
export type AuthorityDeclaration = {
  executionAuthority: 'none';
  proposableActionTypes: QualifiedTypeReference[];
  requiresHumanCosign: boolean;
};

/**
 * Cost profile. `basis: "none"` means no cost accounting applies; every
 * other basis requires exactly one ISO 4217 currency and one non-negative
 * decimal amount string (canonical-friendly, ledger-neutral).
 */
export type CostProfile =
  | { basis: 'none' }
  | { basis: 'per-proposal'; currency: string; amount: string }
  | { basis: 'per-session'; currency: string; amount: string }
  | { basis: 'per-hour'; currency: string; amount: string };

/** Latency profile in whole milliseconds (p95 >= p50, runtime refinement). */
export type LatencyProfile = {
  p50Milliseconds: number;
  p95Milliseconds: number;
};

/**
 * Evidence an agent must attach to action proposals (verification/evidence
 * semantics are owned by the evidence domain; the protocol carries only the
 * requirements).
 */
export type EvidenceRequirements = {
  requiresRationale: boolean;
  requiresPredictedEffects: boolean;
  requiresEvidenceRefs: boolean;
  requiredArtifactKinds: string[];
};

/**
 * The agent registration message (`messageKind: "agent.registration"`):
 * one provider-neutral declaration of an agent's executor, capabilities,
 * tools, proposal authority, cost/latency characteristics, and evidence
 * requirements. Unknown fields are rejected (strict objects), so no
 * framework-specific field can be smuggled into a registration.
 */
export type AgentRegistration = {
  protocolVersion: ProtocolVersion;
  messageKind: MessageKind;
  messageId: MessageId;
  createdAt: Timestamp;
  agentId: AgentId;
  displayName: string;
  description?: string | undefined;
  executor: Executor;
  capabilities: CapabilityDeclaration[];
  tools: ToolDeclaration[];
  authority: AuthorityDeclaration;
  costProfile: CostProfile;
  latencyProfile: LatencyProfile;
  evidenceRequirements: EvidenceRequirements;
};
