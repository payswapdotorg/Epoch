/**
 * @epoch/capability-discovery — public API (kernel layer, Work Order W045,
 * ACR-004).
 *
 * The universal Role & Capability Discovery Plane:
 * - the provider-neutral task-signal -> capability-demand COMPILER;
 * - universal role-proposal SYNTHESIS (no predefined role/model pairs;
 *   domain-pack templates are priors, never a second compiler authority);
 * - candidate RESOLUTION over agent registrations (W003), capability
 *   registry records (W007), human declarations and external profiles;
 * - the capability-gap LIFECYCLE with append-only hash-linked transitions;
 * - organization COMPOSITION + declared-criteria EVALUATION;
 * - reproducible, content-addressed discovery-run LINEAGE with a
 *   tamper-detecting verify function;
 * - the deployment-neutral ecosystem-discovery SCHEDULER CONTRACT (+ the
 *   in-memory reference driver);
 * - the provider-neutral SOURCE-ADAPTER interface (+ the static fixture
 *   adapter — no real external registry is integrated);
 * - the safe ingestion/sandbox/profile/evaluation/promotion BOUNDARY
 *   (discovery never grants execution authority, never mutates
 *   authoritative state);
 * - the ecosystem PROPOSAL mechanism (adapters/extensions/domain packs).
 *
 * Deterministic: ZERO wall-clock, ZERO randomness, ZERO environment
 * reads — instants are caller-supplied; identical inputs derive
 * identical content-addressed records (acceptance 8).
 *
 * Runtime dependency policy (W045 Tech Lead pin): @epoch/agent-protocol
 * (canonical JSON + digests + the real registration type),
 * @epoch/capability-registry (the real capability record type) and zod
 * are the ONLY runtime dependencies — nothing else.
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/schema.ts), compile-time
 * parity (src/parity.ts + contracts/capability-discovery/parity.ts), and
 * the committed JSON Schema projection under contracts/capability-discovery/
 * pinned by test/contract-drift.test.ts.
 */

// Versions + vocabularies + id grammars.
export {
  CAPABILITY_DISCOVERY_CONTRACT_VERSION,
  CAPABILITY_DISCOVERY_RECORD_VERSION,
  DISCOVERY_COMPILER_VERSION,
  TASK_SIGNAL_KINDS,
  REPRESENTATION_KINDS,
  CAPABILITY_GAP_STATES,
  CAPABILITY_GAP_TRANSITIONS,
  CANDIDATE_KINDS,
  CANDIDATE_EVALUATION_STATES,
  CANDIDATE_PROMOTION_TRANSITIONS,
  CLAIM_BASES,
  EVALUATION_CRITERION_KINDS,
  EVALUATION_METRICS,
  DISCOVERY_RUN_KINDS,
  DISCOVERY_TRIGGERS,
  DISCOVERY_STAGE_NAMES,
  PROBLEM_DRIVEN_STAGE_CHAIN,
  ECOSYSTEM_STAGE_CHAIN,
  ECOSYSTEM_PROPOSAL_KINDS,
  ECOSYSTEM_PROPOSAL_STATUSES,
  DISCOVERY_SOURCE_KINDS,
  DISCOVERY_CADENCE_KINDS,
  UNIVERSAL_LIFECYCLE_STAGES,
  DEFAULT_DISCOVERY_CADENCE_DAYS,
  DAY_MS,
  SHA256_HEX_PATTERN,
  DISCOVERY_TENANT_ID_PATTERN,
  DISCOVERY_TIMESTAMP_PATTERN,
  QUALIFIED_OPERATION_PATTERN,
  DISCOVERY_RUN_ID_PATTERN,
  DEMAND_ID_PATTERN,
  ROLE_PROPOSAL_ID_PATTERN,
  CANDIDATE_ID_PATTERN,
  GAP_ID_PATTERN,
  ORGANIZATION_ID_PATTERN,
  ECOSYSTEM_PROPOSAL_ID_PATTERN,
  PROMOTION_ID_PATTERN,
  DISCOVERY_SLUG_PATTERN,
} from './version';

// Published contract types (the full surface; the contracts/capability-
// discovery declarations mirror these one-for-one).
export type * from './types';

// Runtime validators (the complete schema surface).
export * as schemas from './schema';

// Canonical helpers (determinism primitives, exported for the service
// layer and tests).
export {
  canonicalStringUnion,
  canonicalOperations,
  contentDigest,
  digestSuffix16,
  operationKey,
  timestampToEpochMs,
  epochMsToTimestamp,
  epochDayFloor,
  sumDecimalAmounts,
} from './canonical';

// Error taxonomy + result helpers.
export { ok, fail, validationError, typedError, zodIssuesToDiscoveryIssues } from './errors';

// The universal demand compiler (acceptance 1).
export {
  compileCapabilityDemands,
  compileDemands,
  demandDigestOf,
  type DemandCompilation,
} from './compile';

// Universal role synthesis (acceptance 2).
export { synthesizeRoleProposals, roleDigestOf, namespaceOf } from './roles';

// Candidate resolution + the real-surface candidate adapters (acceptance 3).
export {
  resolveCandidates,
  matchDemandToCandidate,
  operationSatisfies,
  candidateFromAgentRegistration,
  candidateFromCapabilityRecord,
  candidateFromHumanDeclaration,
  PARAMETER_KIND_TO_REPRESENTATION,
  type CandidatePool,
  type ResolutionOutcome,
} from './resolve';

// The capability-gap lifecycle (acceptance 5).
export {
  createCapabilityGap,
  transitionCapabilityGap,
  verifyGapChain,
  gapDigestOf,
  gapTransitionDigestOf,
  type GapTransitionInput,
} from './gap';

// Organization composition + consequential eligibility (acceptance 4, 6).
export {
  composeOrganizations,
  isConsequentialEligible,
  isStageable,
  organizationDigestOf,
  type OrganizationComposition,
  type OrganizationCompositionOptions,
} from './organization';

// Organization evaluation (acceptance 4).
export {
  computeOrganizationMetrics,
  evaluateOrganizations,
  type EvaluationOutcome,
  type OrganizationMetrics,
  type CandidateMatchOutcome,
} from './evaluate';

// Discovery runs + lineage verification (acceptance 8).
export {
  canonicalDiscoveryInput,
  discoveryInputDigest,
  discoveryRunIdOf,
  runProblemDrivenDiscovery,
  verifyDiscoveryRun,
  defaultEvaluationCriteria,
  chainStages,
  roleSetDigestOf,
  resolutionDigestOf,
  organizationSetDigestOf,
  ecosystemRunIdOf,
  assembleEcosystemRun,
  verifyEcosystemRunStageChain,
  candidatesStageDigest,
  gapUpdatesStageDigest,
  promotionsStageDigest,
  type ProblemDrivenRunOptions,
} from './run';

// Ecosystem discovery (stream B).
export {
  runEcosystemDiscovery,
  shouldProposeEcosystemArtifact,
  type EcosystemRunInput,
  type EcosystemRunOutcome,
} from './ecosystem';

// Ingestion + the promotion gate (acceptance 6, negative c).
export {
  ingestExternalCandidate,
  promoteCandidate,
  verifyPromotionChain,
  promotionRecordDigestOf,
  type PromotionInput,
  type PromotionOutcome,
} from './candidates';

// Source adapters (pin 8).
export {
  StaticCatalogSourceAdapter,
  validateScanQuery,
  scanOperationKey,
  type DiscoverySourceAdapter,
} from './adapters';

// The scheduler contract + reference driver (pin 7).
export {
  REFERENCE_SCHEDULER,
  InMemoryDiscoveryScheduler,
  DISCOVERY_CADENCE_KINDS_VOCAB,
  type EcosystemDiscoverySchedulerContract,
} from './scheduler';

// Ecosystem proposals (R41).
export {
  deriveEcosystemProposal,
  reviewEcosystemProposal,
  ecosystemProposalDigestOf,
  type EcosystemProposalInput,
} from './proposals';

// The reference in-memory store (tenant-scoped).
export { CapabilityDiscoveryStore } from './store';

// Compile-time contract parity (type-only).
export type { CapabilityDiscoverySchemaSync } from './parity';

// Published schema surface + contract emission.
export {
  CAPABILITY_DISCOVERY_SCHEMA_SURFACE,
  type SchemaSurfaceEntry,
} from './surface';
export {
  CAPABILITY_DISCOVERY_CONTRACT_DIR,
  renderCapabilityDiscoveryContractFiles,
  typeToKebabCase,
} from './contract-emission';
