/**
 * @epoch/deploy-model — public API (Work Order W033).
 *
 * The typed DEPLOYMENT MODEL of Epoch, in-repo and provider-neutral:
 *
 *   TOPOLOGY  — components (workspace packages/services/apps/adapters/
 *               packs), environments (dev/staging/prod, tenant-scoped,
 *               caller-supplied instants), placement + wiring — all
 *               content-addressed DATA; swapping environments changes
 *               nothing in code.
 *   PLANS     — planDeployment: a DETERMINISTIC function of (topology
 *               revision + component set + environment + gate policy) ->
 *               an ordered, dependency-sorted plan of typed, sealed steps
 *               (build, verify, promote, health-check, rollback-point);
 *               identical inputs -> identical plan digest (replay-stable).
 *   GATES     — the verification battery AS DATA (typed, content-addressed
 *               policy records); a plan may not promote without the
 *               battery green (`gate-skip-rejected` / `gate-failed-rejected`).
 *   EXECUTOR  — the in-memory REFERENCE executor: plans execute against
 *               fixture environment models, emitting typed step outcomes +
 *               sealed receipts; health-check failure -> typed outcome +
 *               ATOMIC ROLLBACK to the recorded rollback points.
 *
 * Cross-cutting invariants (all pinned by deploy/test/*.test.ts): tenant
 * isolation on environment-scoped records, provenance on every
 * plan/step/outcome/receipt, determinism + replay (identical inputs ->
 * identical digests; rerun = identical receipts), provider neutrality
 * (`provider-vocabulary-rejected`), round-trip + digest verification for
 * every public record type.
 *
 * Runtime dependency policy (W033 Tech Lead pin, frozen):
 * @epoch/agent-protocol (canonical digests + timestamp primitive),
 * @epoch/tenancy (tenant-id primitive) and zod — NOTHING else. deploy/ and
 * ops/ are NOT workspace packages (no package.json): typed TS modules +
 * data consumed by the thin deploy/ test suite (deploy/README.md).
 * Zero wall-clock, zero randomness, zero network.
 */

// Versions + closed vocabularies.
export {
  COMPONENT_KINDS,
  DEPLOY_ERROR_CODES,
  DEPLOY_MODEL_CONTRACT_VERSION,
  DEPLOY_MODEL_RECORD_VERSION,
  ENVIRONMENT_TIERS,
  HEALTH_CHECK_KINDS,
  HEALTH_PROBE_RESULTS,
  OUTCOME_STATUSES,
  RUN_STATUSES,
  STEP_KINDS,
} from './version';
export type {
  ComponentKind,
  DeployErrorCode,
  EnvironmentTier,
  HealthCheckKind,
  HealthProbeResultKind,
  OutcomeStatus,
  RunStatus,
  StepKind,
} from './version';

// Primitives: ids, digests, typed errors, the total-result shape.
export {
  ACTOR_ID_PATTERN,
  COMPONENT_ID_PATTERN,
  ActorIdSchema,
  ComponentIdSchema,
  DeployRecordVersionSchema,
  ENVIRONMENT_ID_PATTERN,
  EnvironmentIdSchema,
  GATE_ID_PATTERN,
  GateIdSchema,
  PLAN_ID_PATTERN,
  PlanIdSchema,
  REVISION_PATTERN,
  RUN_ID_PATTERN,
  RevisionSchema,
  SHA256_HEX_PATTERN,
  Sha256DigestSchema,
  TenantIdSchema,
  TOPOLOGY_ID_PATTERN,
  TopologyIdSchema,
  digestOf,
  digestPrefix,
  fail,
  isOk,
  unwrapOrThrow,
  validationError,
} from './primitives';
export type {
  ActorId,
  ComponentId,
  DeployError,
  DeployIssue,
  DeployResult,
  EnvironmentId,
  GateId,
  PlanId,
  Revision,
  RunId,
  Sha256Digest,
  TenantId,
  TopologyId,
} from './primitives';

// Provenance (on every record).
export {
  PROVENANCE_ROLES,
  DeployActorSchema,
  DeployProvenanceSchema,
} from './provenance';
export type { DeployActor, DeployProvenance, ProvenanceRole } from './provenance';

// Provider neutrality (the active blocklist scan).
export {
  PROVIDER_VALUE_PREFIXES,
  PROVIDER_VOCABULARY_TOKENS,
  providerTokenInKey,
  providerTokenInValue,
  renderNeutralityFindings,
  scanProviderVocabulary,
} from './neutrality';
export type { NeutralityFinding } from './neutrality';

// Topology.
export {
  admitTopologyRevision,
  buildTopologyRevision,
  componentById,
  componentContent,
  componentDependencyClosure,
  deploymentRevisionOf,
  deserializeTopologyRevision,
  environmentById,
  environmentContent,
  placementsInEnvironment,
  placementContent,
  sealComponent,
  sealEnvironment,
  sealPlacement,
  sealWiring,
  serializeTopologyRevision,
  topologyContentOf,
  validateTopologySemantics,
  verifyComponentDigest,
  verifyEnvironmentDigest,
  verifyPlacementDigest,
  verifyTopologyDigest,
  verifyWiringDigest,
  wiringContent,
} from './topology/topology';
export type { BuildTopologyInput } from './topology/topology';
export {
  CapacityDeclarationSchema,
  ComponentContentSchema,
  ComponentRecordSchema,
  EnvironmentContentSchema,
  EnvironmentRecordSchema,
  HealthDeclarationSchema,
  PlacementContentSchema,
  PlacementRecordSchema,
  TopologyContentSchema,
  TopologyRevisionSchema,
  WORKSPACE_PATH_PATTERN,
  WiringContentSchema,
  WiringRecordSchema,
  WorkspacePathSchema,
} from './topology/schema';
export type {
  CapacityDeclaration,
  ComponentContent,
  ComponentRecord,
  EnvironmentContent,
  EnvironmentRecord,
  HealthDeclaration,
  PlacementContent,
  PlacementRecord,
  TopologyContent,
  TopologyRevision,
  WiringContent,
  WiringRecord,
} from './topology/schema';

// Deploy gates.
export {
  REFERENCE_BATTERY_COMMANDS,
  REFERENCE_GATE_ID,
  deserializeGatePolicy,
  evaluateGateReports,
  gatePolicyContent,
  greenGateReports,
  referenceVerificationGatePolicy,
  sealGatePolicy,
  serializeGatePolicy,
  verifyGatePolicyDigest,
} from './gates/gates';
export type { DeployGatePolicy, DeployGatePolicyContent, GateCommand, GateReport } from './gates/gates';
export {
  DeployGatePolicyContentSchema,
  DeployGatePolicySchema,
  GateCommandSchema,
  GateReportSchema,
} from './gates/gates';

// Deploy plans.
export {
  admitDeployPlan,
  deserializeDeployPlan,
  planContent,
  planDeployment,
  serializeDeployPlan,
  stepContent,
  verifyPlanDigest,
  verifyStepDigest,
} from './plan/planner';
export type { PlanDeploymentInput } from './plan/planner';
export {
  DeployPlanContentSchema,
  DeployPlanSchema,
  GateRefSchema,
  PlanStepContentSchema,
  PlanStepSchema,
  TopologyRevisionRefSchema,
} from './plan/schema';
export type {
  DeployPlan,
  DeployPlanContent,
  GateRef,
  PlanStep,
  PlanStepContent,
  TopologyRevisionRef,
} from './plan/schema';

// The reference executor + fixture model.
export {
  DeployReceiptContentSchema,
  DeployReceiptSchema,
  DeployRunContentSchema,
  DeployRunSchema,
  RollbackReceiptContentSchema,
  RollbackReceiptSchema,
  StepOutcomeSchema,
  admitDeployRun,
  deployRunContent,
  deserializeDeployReceipt,
  deserializeDeployRun,
  executeDeployPlan,
  renderDeployReceipt,
  rollbackReceiptContent,
  serializeDeployReceipt,
  serializeDeployRun,
  stepOutcomeContent,
  verifyDeployReceiptDigest,
  verifyDeployRun,
  verifyRollbackReceiptDigest,
  verifyStepOutcomeDigest,
} from './executor/executor';
export type {
  DeployReceipt,
  DeployReceiptContent,
  DeployRun,
  DeployRunContent,
  ExecuteDeployPlanInput,
  RollbackReceipt,
  RollbackReceiptContent,
  StepOutcome,
  StepOutcomeContent,
} from './executor/executor';
export {
  EnvironmentStateSchema,
  HealthProbeObservationSchema,
  PlacementStateSchema,
  deserializeEnvironmentState,
  environmentStateContent,
  environmentStateDigest,
  environmentStateFromTopology,
  sealEnvironmentState,
  serializeEnvironmentState,
  verifyEnvironmentStateDigest,
  withPlacement,
  withoutPlacement,
} from './executor/fixtures';
export type {
  EnvironmentState,
  EnvironmentStateContent,
  HealthProbeObservation,
  PlacementState,
} from './executor/fixtures';
