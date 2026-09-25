/**
 * @epoch/agent-orchestration — public API (kernel layer, Work Order W020).
 *
 * The typed ORCHESTRATION MODEL (architecture.md, binding): "Agents
 * propose; the Action Gateway authorizes execution." This kernel owns
 * plans/runbooks as typed data (steps as typed action-PROPOSAL references,
 * never embedded action semantics), capability-scoped agent bindings,
 * deterministic content-addressed plan compilation, retry/reconciliation
 * policy shapes, idempotency keys, orchestration sessions as typed
 * documents, and the typed orchestration error taxonomy.
 *
 * - The orchestration layer SCHEDULES, it never authorizes: authorization
 *   decisions belong to @epoch/authorization and the future Action Gateway
 *   (W022). The handoff boundary is modeled as typed data (proposal
 *   envelope in, execution-tracking record out) WITHOUT implementing the
 *   gateway.
 * - Deterministic orchestration: identical inputs produce identical
 *   compiled plans (topological order with sorted ready admission;
 *   content-addressed by SHA-256 over canonical JSON). ZERO wall-clock
 *   reads and ZERO randomness in src — instants are caller-supplied data.
 * - Capability-scoped agents: orchestrated agents bind to REGISTERED
 *   capabilities through the real @epoch/capability-registry; binding to
 *   unknown capabilities is `unknown-capability`, retired ones are
 *   `lifecycle-conflict` (mirroring the registry's own resolution
 *   semantics).
 * - Provider-NEUTRAL (lock rule 13): agents are typed descriptors; ZERO
 *   model vendors, model clients, or API keys. Concrete model providers are
 *   future adapters (W028/W029 surfaces). Strict objects reject unknown
 *   (vendor) fields.
 * - Tenant isolation (R12): plans and sessions are tenant-scoped;
 *   cross-tenant access is the typed `cross-tenant-denied` rejection.
 * - Total admission: errors are values, never exceptions, with a fixed
 *   precedence so consumers branch deterministically.
 *
 * Runtime dependency policy (W020 Tech Lead pin): @epoch/agent-protocol
 * (ids, digests, canonical JSON, timestamps), @epoch/action-protocol (the
 * proposal vocabulary — genuine runtime consumption),
 * @epoch/capability-registry (capability binding vocabulary), and
 * @epoch/event-log (the W010 event vocabulary orchestration consumes) are
 * the ONLY @epoch runtime dependencies. Compatibility with
 * @epoch/world-model, @epoch/tenancy, @epoch/identity,
 * @epoch/authorization and @epoch/policy-contracts is pinned via
 * devDependencies + compile-time parity (src/kernel-parity.ts) and runtime
 * parity tests — never runtime deps.
 *
 * Versioned contract surface: version constants + typed index export (this
 * file), runtime zod validators (src/schema.ts), compile-time parity
 * (src/parity.ts + src/kernel-parity.ts), and the committed JSON Schema
 * projection under schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies (id patterns mirror tenancy/identity; the phase
// vocabulary mirrors the W010 event-log action lifecycle).
export {
  AGENT_ORCHESTRATION_CONTRACT_VERSION,
  MAX_RETRY_ATTEMPTS,
  ORCHESTRATION_PLAN_ID_PATTERN,
  ORCHESTRATION_PRINCIPAL_ID_PATTERN,
  ORCHESTRATION_RECORD_VERSION,
  ORCHESTRATION_SESSION_ID_PATTERN,
  ORCHESTRATION_STEP_ID_PATTERN,
  ORCHESTRATION_TENANT_ID_PATTERN,
  RETRYABLE_ACTION_PHASES,
  SESSION_LIFECYCLE_TRANSITIONS,
  SESSION_STATUSES,
  SESSION_TRANSITION_CAUSES,
  STEP_LIFECYCLE_TRANSITIONS,
  STEP_STATUSES,
  STEP_TRANSITION_CAUSES,
} from './version';
export type {
  RetryableActionPhase,
  SessionStatus,
  SessionTransitionCause,
  StepStatus,
  StepTransitionCause,
} from './version';

// Published contract types.
export type {
  AgentBinding,
  CapabilityPin,
  CapabilityVersionPin,
  CompiledPlan,
  CompiledPlanStep,
  IdempotencyKey,
  OrchestrationError,
  OrchestrationIssue,
  OrchestrationPlan,
  OrchestrationPrincipalId,
  OrchestrationResult,
  OrchestrationSession,
  OrchestrationTenantId,
  OrchestratedAgent,
  PlanId,
  PlanStep,
  ProposalHandoff,
  RetryPolicy,
  SessionId,
  SessionStatusTransition,
  StepId,
  StepState,
  StepTransition,
} from './types';

// Runtime validators.
export {
  BINDABLE_CAPABILITY_LIFECYCLES,
  SHA256_HEX_PATTERN,
  ActionEventPhaseSchema,
  AgentBindingSchema,
  CapabilityPinSchema,
  CapabilityVersionPinSchema,
  CompiledPlanSchema,
  CompiledPlanStepSchema,
  IdempotencyKeySchema,
  OrchestrationIssueSchema,
  OrchestrationPlanSchema,
  OrchestrationPrincipalIdSchema,
  OrchestrationRecordVersionSchema,
  OrchestrationSessionSchema,
  OrchestrationTenantIdSchema,
  OrchestratedAgentSchema,
  PlanIdSchema,
  PlanStepSchema,
  ProposalHandoffSchema,
  RetryPolicySchema,
  RetryableActionPhaseSchema,
  SessionIdSchema,
  SessionStatusSchema,
  SessionStatusTransitionSchema,
  Sha256DigestSchema,
  StepIdSchema,
  StepStateSchema,
  StepStatusSchema,
  StepTransitionSchema,
} from './schema';

// Total parse surface.
export {
  parseAgentBinding,
  parseCompiledPlan,
  parseOrchestrationPlan,
  parseOrchestrationSession,
  parseOrchestratedAgent,
  parseProposalHandoff,
} from './parse';

// Digest discipline (canonical SHA-256 content addressing + tamper detection).
export {
  canonicalSessionJson,
  computeAgentBindingDigest,
  computePlanDigest,
  computeProposalHandoffDigest,
  computeSessionStateDigest,
  normalizedPlanContent,
  verifyCompiledPlanDigest,
} from './digest';

// Idempotency keys (deterministic, content-addressed).
export {
  deriveEventIdempotencyKey,
  deriveSessionIdempotencyKey,
} from './idempotency';

// Deterministic plan compilation.
export {
  DEFAULT_RETRY_POLICY,
  compilePlan,
  type CompilePlanOptions,
} from './compile';

// Capability-scoped agent binding (the W007 registry vocabulary).
export { bindOrchestratedAgent, type BindAgentOptions } from './agent';

// Session records (pure typed machinery; the host model is the runtime service).
export {
  createSessionRecord,
  evaluateSessionOutcome,
  isTerminalSessionStatus,
  transitionSessionStatus,
  type CreateSessionRecordOptions,
} from './session';

// Flattened-issue helpers (typed validation errors).
export { flattenZodIssues, invalidPlanError, validationError } from './issues';

// Compile-time contract parity (type-only).
export type {
  AgentOrchestrationSchemaSync,
  AgentOrchestrationVocabularySync,
} from './parity';

// Published schema surface + contract emission.
export {
  AGENT_ORCHESTRATION_SCHEMA_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  AGENT_ORCHESTRATION_CONTRACT_DIR,
  renderAgentOrchestrationContractFiles,
  typeToKebabCase,
} from './contract-emission';
