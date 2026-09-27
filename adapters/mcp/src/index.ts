/**
 * @epoch/adapter-mcp — public API (service layer, Work Order W029).
 *
 * The external-tool REFERENCE adapter (the tool protocol's vocabulary is
 * quarantined in src/provider). Two W007 surfaces:
 *
 * - ACTION: tool discovery derives typed invocation surfaces + W007
 *   registration documents; tool invocation builds deterministic W003
 *   proposals routed EXCLUSIVELY through the W022 action-authority seam
 *   (policy decision first — allow / deny / requires-approval — then
 *   the authority's typed outcome records). The adapter holds NO
 *   credentials (credential-rejected) and never bypasses the gateway
 *   (gateway-bypass-rejected);
 * - EVALUATOR: judging recorded tool invocations against declared
 *   criteria with mandatory justification (evaluation is judgment,
 *   distinct from execution).
 *
 * Cross-cutting invariants (tested): tenant isolation
 * (tenant-isolation-rejected), tamper detection (digest-mismatch),
 * tool-argument conformance (tool-argument-rejected), determinism
 * (identical inputs -> identical digests), provider neutrality
 * (per-adapter blocklist), and W007 registration under the action +
 * evaluator categories.
 *
 * In-memory reference behavior: NO network, NO live tool calls, NO real
 * side effects — fixtures stand in for provider payloads. Zero
 * wall-clock, zero randomness.
 *
 * Runtime dependency policy (W029 Tech Lead pin, frozen):
 * @epoch/adapter-sdk, @epoch/agent-protocol, @epoch/action-protocol,
 * @epoch/tenancy, and zod — NOTHING else at runtime. Compatibility with
 * @epoch/capability-registry, @epoch/evidence, @epoch/event-log,
 * @epoch/action-policy and the W022 action-gateway service types is
 * exercised via devDependencies + compile-time parity (src/parity.ts) +
 * runtime parity tests — never runtime deps.
 */

// Version + vocabularies.
export {
  CREDENTIAL_PARAMETER_KEYS,
  INVOCATION_DISPOSITIONS,
  MCP_ADAPTER_CATEGORIES,
  MCP_ADAPTER_CONTRACT_VERSION,
  MCP_ADAPTER_RECORD_VERSION,
  MCP_ACTION_CONTRACT_ID,
  MCP_EVALUATOR_CONTRACT_ID,
  PROPOSING_AGENT_ID,
  TOOL_ACTION_TYPE_IDS,
  TOOL_ACTION_TYPE_VERSION,
  TOOL_AUTHORITY_SCOPES,
} from './version';
export type {
  InvocationDisposition,
  ToolActionTypeId,
} from './version';

// Published contract types (the NEUTRAL seam).
export type {
  ActionAuthorityDecisionResult,
  ActionAuthorityExecutionRequest,
  ActionAuthorityExecutionResult,
  ActionAuthorityPort,
  ActionAuthoritySubmission,
  AuthorityAuthorization,
  AuthorityDecisionRecord,
  AuthorityOutcomeRecord,
  InvocationCriteria,
  InvocationEvaluation,
  InvocationPlan,
  ToolInvocationRecord,
  ToolInvocationSurface,
} from './types';

// Typed error taxonomy (values, never thrown).
export type {
  McpAdapterError,
  McpAdapterErrorCode,
  McpAdapterIssue,
  McpAdapterResult,
} from './errors';

// Runtime validators (the NEUTRAL seam).
export {
  AuthorityDecisionRecordSchema,
  AuthorityOutcomeRecordSchema,
  EnvelopeCriteriaSchema,
  InvocationCriteriaSchema,
  InvocationEvaluationSchema,
  InvocationInputSchema,
  InvocationPlanSchema,
  ToolInvocationRecordSchema,
  ToolInvocationSurfaceSchema,
  ToolRefSchema,
} from './schema';

// The provider seam (the tool protocol's vocabulary — fixtures + payload parsing).
export {
  PROVIDER_CATALOG_VERSION,
  PROVIDER_PROTOCOL_NAME,
  ProviderToolArgumentSchema,
  ProviderToolCatalogSchema,
  ProviderToolSchema,
  neutralToolCapabilityIdOf,
  neutralToolRefOf,
  parseProviderCatalog,
} from './provider/payload';
export type {
  ProviderCatalogParse,
  ProviderTool,
  ProviderToolArgument,
  ProviderToolCatalog,
} from './provider/payload';
export { conflictingCatalog, malformedCatalog, referenceCatalog } from './provider/fixtures';

// Tool discovery (typed invocation surfaces + W007 registration derivation).
export {
  catalogDigestOf,
  deriveToolRegistration,
  discoverTools,
} from './discovery';
export type { DiscoveryInput, ToolCapabilityRegistration } from './discovery';

// The action surface (proposal construction + gates + routing).
export {
  buildInvocationProposal,
  credentialGate,
  routeInvocation,
  toolArgumentGate,
  verifyInvocationRecord,
} from './action';
export type {
  BuildInvocationProposalInput,
  RouteInvocationInput,
} from './action';

// The evaluator surface (judgment over recorded invocations).
export { evaluateInvocation } from './evaluation';
export type { EvaluationInput as DomainEvaluationInput } from './evaluation';

// The W007 adapter surfaces.
export { McpActionAdapter, McpEvaluatorAdapter, verifyInvocationRecord as verifyRecord } from './adapters';
export type {
  McpActionAdapterOptions,
  McpEvaluatorAdapterOptions,
} from './adapters';

// W007 descriptor discipline (content-addressed, protocol-neutral).
export {
  ACTION_ADAPTER_DESCRIPTOR,
  ACTION_ADAPTER_DESCRIPTOR_DIGEST,
  CAPABILITY_VERSION,
  EVALUATOR_ADAPTER_DESCRIPTOR,
  EVALUATOR_ADAPTER_DESCRIPTOR_DIGEST,
  MCP_ADAPTER_DESCRIPTORS,
} from './descriptor';

// W007 capability-registration derivation (the registration conventions).
export { deriveCapabilityRegistrations } from './registration';
export type {
  DerivedCapabilityManifest,
  DerivedCapabilityRegistration,
} from './registration';
