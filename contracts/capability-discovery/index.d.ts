/**
 * Epoch Capability Discovery v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * `contracts/capability-discovery` ownership boundary (Work Order W045,
 * ACR-004). It is self-contained: no imports, no runtime code, no
 * provider/model/vendor vocabulary. The runtime implementation is
 * `@epoch/capability-discovery` (kernel layer); `parity.ts` in this
 * directory proves at compile time that the implementation's zod-inferred
 * types are identical to these declarations.
 *
 * Contract version: 1.0.0 (see manifest.json)
 *
 * Authority (ACR-004 "adds no lifecycle authority"): this surface owns
 * DISCOVERY records only. World Model, SolutionPackage/SolutionVersion,
 * DeliveryRecord, Constraint Engine, Verification, Action Gateway and the
 * Capability Registry each keep their own authority — discovery records
 * reference them OPAQUELY (digests + slugs), never embedded copies. A
 * role proposal's authority boundary structurally admits exactly
 * `executionAuthority: 'none'` (the W003 convention): discovery NEVER
 * grants execution authority (architecture-lock autonomous-discovery
 * invariants). External candidates remain non-consequential until the
 * sandbox/profile/evaluation/policy promotion gates pass (CC1.0).
 */

// ---------------------------------------------------------------------------
// Versions and closed vocabularies (member-for-member identical to the
// constants in @epoch/capability-discovery src/version.ts).
// ---------------------------------------------------------------------------

/** Version of the published capability-discovery contract surface. */
export type CapabilityDiscoveryContractVersion = '1.0.0';

/** Version discriminator on serialized discovery records (v1). */
export type CapabilityDiscoveryRecordVersion = 1;

/** Version of the universal demand compiler + role synthesizer. */
export type DiscoveryCompilerVersion = '1.0.0';

/** The eleven universal lifecycle stages (USL1.0, mirrored closed union). */
export type UniversalLifecycleStage =
  | 'understand'
  | 'decide'
  | 'plan'
  | 'acquire'
  | 'realize'
  | 'observe'
  | 'actualize'
  | 'verify'
  | 'forecast'
  | 'close'
  | 'learn';

/** Universal task/problem signal kind (the demand-compiler input facet). */
export type TaskSignalKind =
  | 'operation'
  | 'decision'
  | 'verification'
  | 'artifact'
  | 'quality'
  | 'unknown'
  | 'failure'
  | 'work'
  | 'budget'
  | 'environment'
  | 'authority'
  | 'dependency'
  | 'outcome';

/** Neutral representation/modality kind (compatibility vocabulary). */
export type RepresentationKind =
  | 'text'
  | 'numeric'
  | 'tabular'
  | 'geometry'
  | 'image'
  | 'signal'
  | 'document'
  | 'structured'
  | 'code';

/** Capability-gap lifecycle state (ARCD1.0). */
export type CapabilityGapState =
  | 'UNSATISFIED'
  | 'CANDIDATE_FOUND'
  | 'EVALUATED'
  | 'VERIFIED'
  | 'DEGRADED'
  | 'REQUIRES_HUMAN';

/** Candidate nature resolvable against role demands. */
export type CandidateKind = 'agent' | 'human' | 'capability' | 'external';

/** Candidate evaluation lifecycle state (CC1.0). */
export type CandidateEvaluationState =
  | 'discovered'
  | 'ingested'
  | 'sandboxed'
  | 'profiled'
  | 'evaluated'
  | 'verified'
  | 'deprecated'
  | 'retired';

/** Basis of a capability claim. */
export type ClaimBasis = 'measured' | 'declared';

/** Declared evaluation criterion kind. */
export type EvaluationCriterionKind = 'hard-constraint' | 'objective' | 'evidence-coverage';

/** Deterministic organization-evaluation metric. */
export type EvaluationMetric =
  | 'demand-coverage'
  | 'unmet-demand-count'
  | 'evidence-coverage'
  | 'redundancy-coverage'
  | 'estimated-latency'
  | 'estimated-cost'
  | 'gap-count'
  | 'critical-single-point-count';

/** Discovery run kind (the two ARCD1.0 streams). */
export type DiscoveryRunKind = 'problem-driven' | 'ecosystem';

/** What triggered a discovery run. */
export type DiscoveryTrigger = 'manual' | 'gap' | 'scheduled' | 'event';

/** Lineage stage name (per run kind; the digest-chain vocabulary). */
export type DiscoveryStageName =
  | 'inputs'
  | 'demands'
  | 'roles'
  | 'resolution'
  | 'organizations'
  | 'evaluation'
  | 'selection'
  | 'candidates'
  | 'gap-updates'
  | 'promotions';

/** Ecosystem proposal kind (adapter / extension / new domain pack). */
export type EcosystemProposalKind = 'adapter' | 'extension' | 'domain-pack';

/** Ecosystem proposal review status. */
export type EcosystemProposalStatus = 'proposed' | 'under-review' | 'accepted' | 'rejected';

/** Provider-neutral discovery source class. */
export type DiscoverySourceKind =
  | 'public-catalog'
  | 'private-catalog'
  | 'internal'
  | 'fixture';

/** Scheduler cadence kind. */
export type DiscoveryCadenceKind = 'weekly' | 'interval' | 'event';

// ---------------------------------------------------------------------------
// Primitives (opaque ids + digests + instants).
// ---------------------------------------------------------------------------

/** UTC instant in canonical wire form `YYYY-MM-DDTHH:MM:SS.mmmZ`. */
export type Timestamp = string;

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export type Sha256Hex = string;

/** Tenant identifier: `tenant:` + lowercase slug (W009 grammar mirror). */
export type DiscoveryTenantId = string;

/** Content-addressed discovery run id: `discrun:` + 16 hex chars. */
export type DiscoveryRunId = string;

/** Content-addressed capability demand id: `demand:` + 16 hex chars. */
export type CapabilityDemandId = string;

/** Content-addressed role proposal id: `drole:` + 16 hex chars. */
export type RoleProposalId = string;

/** Candidate id: `cand:` + lowercase slug. */
export type CandidateId = string;

/** Content-addressed capability gap id: `gap:` + 16 hex chars. */
export type CapabilityGapId = string;

/** Content-addressed organization proposal id: `org:` + 16 hex chars. */
export type OrganizationId = string;

/** Content-addressed ecosystem proposal id: `ecoprop:` + 16 hex chars. */
export type EcosystemProposalId = string;

/** Content-addressed promotion record id: `promo:` + 16 hex chars. */
export type PromotionId = string;

/** Opaque signal/identifier slug. */
export type DiscoverySlug = string;

// ---------------------------------------------------------------------------
// Provider-neutral operation references.
// ---------------------------------------------------------------------------

/**
 * Reference to a provider-neutral operation: a dot-namespaced qualified
 * name (e.g. `engineering.stress-analysis`) plus a version constraint
 * (`*` = any). Operation ids name CAPABILITY OPERATIONS, never vendors or
 * models — resolution goes through measured capability claims, not names
 * (ARCD1.0 "Never infer profession from model label").
 */
export type OperationRef = {
  readonly id: string;
  readonly versionConstraint: string;
};

/** A quality/fidelity target bound to a demand or a measured claim. */
export type QualityTarget = {
  readonly metric: string;
  readonly threshold: number;
  readonly unit: string;
  readonly direction: 'min' | 'max';
};

/** A cost budget/estimate: ISO 4217 currency + decimal amount string. */
export type MoneyAmount = {
  readonly currency: string;
  readonly amount: string;
};

// ---------------------------------------------------------------------------
// Discovery input (task / world / evidence / constraint signals).
// ---------------------------------------------------------------------------

/**
 * Opaque reference to an affected world/solution/delivery identity. The
 * discovery plane stores the reference and its content digest; it NEVER
 * embeds or interprets the referenced state (one responsibility, one
 * authority — lock rule 16).
 */
export type WorldRef = {
  readonly refId: string;
  readonly contentDigest: Sha256Hex;
  readonly summary?: string | undefined;
};

/** Evidence signal: a content-addressed observation about the problem. */
export type EvidenceSignal = {
  readonly evidenceDigest: Sha256Hex;
  readonly kind: 'failure' | 'verification-gap' | 'unknown' | 'measurement' | 'observation' | 'outcome';
  readonly summary: string;
  readonly subjectRefs: readonly string[];
};

/** Constraint signal: a provider-neutral constraint binding on the task. */
export type ConstraintSignal = {
  readonly constraintId: string;
  readonly kind: 'hard' | 'soft' | 'authority' | 'budget' | 'quality' | 'interface';
  readonly summary: string;
  readonly subjectRefs: readonly string[];
  readonly parameters?: Record<string, number | string> | undefined;
};

/**
 * One universal task/problem signal. Signal kinds map onto demand facets
 * through the UNIVERSAL compiler rules; `operationRef` pins the operation
 * for operation/failure/dependency signals; representation/output hints
 * carry neutral modality hints; kind-specific payloads carry
 * quality/budget/uncertainty/requirement data.
 */
export type TaskSignal = {
  readonly signalId: string;
  readonly kind: TaskSignalKind;
  readonly summary: string;
  readonly operationRef?: OperationRef | undefined;
  readonly subjectRefs: readonly string[];
  readonly evidenceRefs: readonly Sha256Hex[];
  readonly constraintRefs: readonly string[];
  readonly representationHints?: readonly RepresentationKind[] | undefined;
  readonly outputHints?: readonly RepresentationKind[] | undefined;
  readonly artifactKind?: string | undefined;
  /** Present for `quality` signals: the declared quality/fidelity target. */
  readonly qualityTarget?: QualityTarget | undefined;
  /** Present for `budget` signals: a latency budget in milliseconds. */
  readonly latencyBudgetMs?: number | undefined;
  /** Present for `budget` signals: a cost budget. */
  readonly costBudget?: MoneyAmount | undefined;
  /** Present for `unknown` signals: the minimum acceptable confidence. */
  readonly uncertaintyConfidence?: number | undefined;
  /** Present for `environment` signals: neutral requirement slugs. */
  readonly requirementSlugs?: readonly string[] | undefined;
  /** Present for `dependency` signals: the operation depended upon. */
  readonly dependsOnOperation?: OperationRef | undefined;
  readonly weight?: number | undefined;
};

/** The task description heading a discovery input. */
export type TaskDescription = {
  readonly summary: string;
  readonly lifecycleStage: UniversalLifecycleStage;
  readonly domainRefs: readonly string[];
  readonly objectives: readonly string[];
};

// ---------------------------------------------------------------------------
// Domain-pack contributions (reusable priors; never a second compiler).
// ---------------------------------------------------------------------------

/**
 * A reusable capability-demand template from a domain pack. A template is
 * a PRIOR: the compiler may admit it as an ADDITIONAL demand when its
 * applicability matches the task signals, and may only TIGHTEN universal
 * facets. A template can never remove, relax or override a universal
 * derivation — attempts are recorded as `template-override-rejected`
 * issues and ignored.
 */
export type CapabilityDemandTemplate = {
  readonly templateId: string;
  readonly summary: string;
  readonly operation: OperationRef;
  readonly inputRepresentations?: readonly RepresentationKind[] | undefined;
  readonly outputKinds?: readonly RepresentationKind[] | undefined;
  readonly qualityTarget?: QualityTarget | undefined;
  readonly evidenceRequirements?: readonly string[] | undefined;
  readonly requiresHumanCosign?: boolean | undefined;
  readonly notes?: readonly string[] | undefined;
  readonly applicability: TemplateApplicability;
};

/** When a pack template applies (matched against the task signals). */
export type TemplateApplicability = {
  readonly signalKinds?: readonly TaskSignalKind[] | undefined;
  readonly domainRefs?: readonly string[] | undefined;
  readonly lifecycleStages?: readonly UniversalLifecycleStage[] | undefined;
};

/**
 * A reusable role template from a domain pack: proposes grouping its
 * demand templates into one role. The universal compiler CONSIDERS the
 * grouping; if it conflicts with the universal demand clustering, the
 * template is recorded as overridden and the UNIVERSAL grouping stands.
 */
export type RoleTemplate = {
  readonly templateId: string;
  readonly summary: string;
  readonly mission: string;
  readonly demandTemplateRefs: readonly string[];
  readonly knowledgeRequirements?: readonly string[] | undefined;
  readonly applicability: TemplateApplicability;
};

/** A pack binding: this signal kind + domain implies this demand template. */
export type TaskSignalBinding = {
  readonly bindingId: string;
  readonly signalKind: TaskSignalKind;
  readonly domainRef?: string | undefined;
  readonly impliesDemandTemplate: string;
};

/**
 * A domain pack's reusable discovery knowledge (DP1.0 "Role and capability
 * demand profile"). Contributions are INPUTS to the universal compiler,
 * consumed as priors; the pack never becomes a compiler authority.
 */
export type DomainPackContribution = {
  readonly packId: string;
  readonly packVersion: string;
  readonly demandTemplates: readonly CapabilityDemandTemplate[];
  readonly roleTemplates: readonly RoleTemplate[];
  readonly taskSignalBindings: readonly TaskSignalBinding[];
};

/**
 * The complete provider-neutral discovery input (acceptance 1: task/world/
 * evidence/constraint input ONLY). Everything the compiler derives is a
 * deterministic function of this document — no wall-clock, no randomness,
 * no environment reads (acceptance 8).
 */
export type DiscoveryInput = {
  readonly schemaVersion: CapabilityDiscoveryRecordVersion;
  readonly tenantId: DiscoveryTenantId;
  readonly task: TaskDescription;
  readonly worldRefs: readonly WorldRef[];
  readonly evidenceSignals: readonly EvidenceSignal[];
  readonly constraintSignals: readonly ConstraintSignal[];
  readonly taskSignals: readonly TaskSignal[];
  readonly packContributions: readonly DomainPackContribution[];
};

// ---------------------------------------------------------------------------
// Capability demands (acceptance 1).
// ---------------------------------------------------------------------------

/** One entry of a demand's output contract. */
export type OutputContractEntry = {
  readonly name: string;
  readonly kind: RepresentationKind;
};

/** Authority constraints attached to a demand (mirrors the W003 shape). */
export type DemandAuthorityConstraints = {
  /** Structurally always 'none': execution authority is inexpressible. */
  readonly executionAuthority: 'none';
  readonly requiresHumanCosign: boolean;
  readonly notes: readonly string[];
};

/**
 * A provider-neutral capability demand (ARCD1.0 canonical demand): what
 * must be done, with which input/output representations, quality targets,
 * uncertainty, evidence, tools, environment, latency/cost budgets, safety
 * constraints, dependencies, stage and affected identities. The demand id
 * is content-addressed (SHA-256 over the canonical body).
 */
export type CapabilityDemand = {
  readonly schemaVersion: CapabilityDiscoveryRecordVersion;
  readonly demandId: CapabilityDemandId;
  readonly operation: OperationRef;
  readonly summary: string;
  readonly requiredOutcome: string;
  readonly inputRepresentations: readonly RepresentationKind[];
  readonly outputContract: readonly OutputContractEntry[];
  readonly qualityTarget?: QualityTarget | undefined;
  readonly units?: readonly string[] | undefined;
  readonly acceptableUncertaintyConfidence?: number | undefined;
  readonly evidenceRequirements: readonly string[];
  readonly verificationRequired: boolean;
  readonly toolRequirements: readonly string[];
  readonly environmentRequirements: readonly string[];
  readonly latencyBudgetMs?: number | undefined;
  readonly costBudget?: MoneyAmount | undefined;
  readonly authorityConstraints: DemandAuthorityConstraints;
  readonly dependsOnOperations: readonly OperationRef[];
  readonly lifecycleStage: UniversalLifecycleStage;
  readonly domainRefs: readonly string[];
  readonly affectedRefs: readonly string[];
  readonly derivedFromSignals: readonly string[];
  readonly derivedFromTemplates: readonly string[];
};

/** The sealed, canonically-ordered demand set of one run. */
export type CapabilityDemandSet = {
  readonly demands: readonly CapabilityDemand[];
  /** SHA-256 over the canonical [demandId, demandDigest] pairs (sorted). */
  readonly setDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// Role proposals (acceptance 2).
// ---------------------------------------------------------------------------

/** A role's interface entry (derived from member demand contracts). */
export type RoleInterfaceEntry = {
  readonly name: string;
  readonly kind: RepresentationKind;
};

/** The authority boundary of a synthesized role (W003 convention). */
export type RoleAuthorityBoundary = {
  /** Structurally always 'none': a role proposal can never carry it. */
  readonly executionAuthority: 'none';
  readonly requiresHumanCosign: boolean;
  readonly proposableOperations: readonly OperationRef[];
};

/** Derived planning/delegation behavior of a candidate role. */
export type RolePlanningBehavior = 'single-step' | 'multi-step' | 'supervised-multi-step';

/** Provenance of a synthesized role. */
export type RoleProvenance = {
  readonly derivedFromDemands: readonly CapabilityDemandId[];
  readonly consultedTemplates: readonly string[];
  readonly overriddenTemplates: readonly string[];
  readonly compilerVersion: DiscoveryCompilerVersion;
};

/**
 * A candidate role synthesized by the universal compiler from demand
 * evidence — without any predefined role/model pair (acceptance 2). The
 * id is content-addressed; the slug is derived from the member operations
 * (never a model/provider name).
 */
export type RoleProposal = {
  readonly schemaVersion: CapabilityDiscoveryRecordVersion;
  readonly roleProposalId: RoleProposalId;
  readonly roleSlug: string;
  readonly mission: string;
  readonly satisfiesDemands: readonly CapabilityDemandId[];
  readonly inputs: readonly RoleInterfaceEntry[];
  readonly outputs: readonly RoleInterfaceEntry[];
  readonly knowledgeRequirements: readonly string[];
  readonly toolRequirements: readonly string[];
  readonly planningBehavior: RolePlanningBehavior;
  readonly authorityBoundary: RoleAuthorityBoundary;
  readonly evidenceRequirements: readonly string[];
  readonly environmentRequirements: readonly string[];
  readonly evaluationSuiteRef?: string | undefined;
  readonly confidence: number;
  readonly provenance: RoleProvenance;
};

// ---------------------------------------------------------------------------
// Candidates (agent / human / capability / external) — acceptance 3, 6.
// ---------------------------------------------------------------------------

/** A candidate's claim to one operation, with neutral I/O kinds. */
export type ClaimedCapability = {
  readonly operation: OperationRef;
  readonly inputKinds: readonly RepresentationKind[];
  readonly outputKinds: readonly RepresentationKind[];
  readonly quality?: QualityTarget | undefined;
  readonly claimBasis: ClaimBasis;
};

/** Declared latency characteristics (whole milliseconds, p95 >= p50). */
export type LatencyClaim = {
  readonly p50Milliseconds: number;
  readonly p95Milliseconds: number;
};

/** Declared cost characteristics (ledger-neutral decimal string). */
export type CostClaim = {
  readonly currency: string;
  readonly amount: string;
  readonly basis: 'per-task' | 'per-hour' | 'per-run' | 'none';
};

/** Where a candidate comes from (provider identity stays metadata). */
export type CandidateProvenance = {
  readonly sourceKind: 'agent-protocol' | 'capability-registry' | 'human-declaration' | 'external-source';
  readonly sourceRef?: string | undefined;
  /** Content digest of the source document (registration/record/artifact). */
  readonly contentDigest: Sha256Hex;
  /** Present for external candidates: which adapter found the artifact. */
  readonly external?: {
    readonly adapterId: string;
    readonly artifactId: string;
  } | undefined;
};

/** Security posture of a candidate at the ingestion boundary. */
export type CandidateSecurity = {
  readonly sandboxRequired: boolean;
  readonly trustDomain: 'external' | 'epoch-verified';
  readonly notes: readonly string[];
};

/**
 * The provider-neutral candidate profile (acceptance 3, 6). An external
 * candidate is described ONLY by claimed capabilities + provenance —
 * never by a name-to-role mapping. External candidates enter at state
 * `discovered` with `sandboxRequired: true` and trustDomain `external`;
 * they remain NON-CONSEQUENTIAL until the promotion gate (sandbox /
 * profile / evaluation / policy) verifies them. There is structurally NO
 * field that could grant execution authority.
 */
export type CandidateProfile = {
  readonly schemaVersion: CapabilityDiscoveryRecordVersion;
  readonly candidateId: CandidateId;
  readonly kind: CandidateKind;
  readonly displayName: string;
  readonly summary: string;
  readonly claimedCapabilities: readonly ClaimedCapability[];
  readonly runtimeRequirements: readonly string[];
  readonly environmentRequirements: readonly string[];
  readonly latency?: LatencyClaim | undefined;
  readonly cost?: CostClaim | undefined;
  readonly provenance: CandidateProvenance;
  readonly evaluationState: CandidateEvaluationState;
  readonly security: CandidateSecurity;
};

/** A human specialist's authorized capability declaration. */
export type HumanDeclaration = {
  readonly declarationId: string;
  readonly tenantId: DiscoveryTenantId;
  readonly displayName: string;
  readonly claimedCapabilities: readonly ClaimedCapability[];
  readonly availability: 'available' | 'constrained' | 'unavailable';
  readonly environmentRequirements: readonly string[];
  readonly latency?: LatencyClaim | undefined;
  readonly cost?: CostClaim | undefined;
};

/** The outcome of matching one demand against one candidate. */
export type CandidateMatch = {
  readonly demandId: CapabilityDemandId;
  readonly candidateId: CandidateId;
  readonly outcome: 'satisfied' | 'claimed' | 'incompatible';
  readonly reasons: readonly string[];
};

/** One candidate bound to one role across zero or more demands. */
export type CandidateAssignment = {
  readonly candidateId: CandidateId;
  readonly matchedDemandIds: readonly CapabilityDemandId[];
  readonly claimedDemandIds: readonly CapabilityDemandId[];
  readonly incompatibleDemandIds: readonly CapabilityDemandId[];
  readonly score: number;
};

/** The resolution of one role proposal against the candidate pool. */
export type RoleResolution = {
  readonly roleProposalId: RoleProposalId;
  readonly assignments: readonly CandidateAssignment[];
  readonly unmetDemandIds: readonly CapabilityDemandId[];
  /** Gaps opened by this role's unmet demands (gap lifecycle linkage). */
  readonly gapIds: readonly CapabilityGapId[];
};

// ---------------------------------------------------------------------------
// Capability gaps (acceptance 5).
// ---------------------------------------------------------------------------

/** One append-only, hash-linked gap-state transition. */
export type GapTransition = {
  readonly toState: CapabilityGapState;
  readonly at: Timestamp;
  readonly cause: string;
  readonly evidenceDigest?: Sha256Hex | undefined;
  readonly actorRef?: string | undefined;
  readonly previousTransitionDigest: Sha256Hex | null;
  readonly transitionDigest: Sha256Hex;
};

/**
 * An explicit capability gap (ARCD1.0 lifecycle: UNSATISFIED ->
 * CANDIDATE_FOUND -> EVALUATED -> VERIFIED / DEGRADED / REQUIRES_HUMAN).
 * The gap id is content-addressed over the tenant + operation + run
 * origin; the transition chain is append-only and tamper-detecting.
 */
export type CapabilityGap = {
  readonly schemaVersion: CapabilityDiscoveryRecordVersion;
  readonly gapId: CapabilityGapId;
  readonly tenantId: DiscoveryTenantId;
  readonly operation: OperationRef;
  readonly demandSummary: string;
  readonly lifecycleStage: UniversalLifecycleStage;
  readonly state: CapabilityGapState;
  readonly originatingRunId?: DiscoveryRunId | undefined;
  readonly triggeringSignalIds: readonly string[];
  readonly firstObservedAt: Timestamp;
  readonly notes: readonly string[];
  readonly transitions: readonly GapTransition[];
};

/** A request for ecosystem discovery derived from unsatisfied gaps. */
export type EcosystemDiscoveryRequest = {
  readonly requestId: string;
  readonly gapIds: readonly CapabilityGapId[];
  readonly operations: readonly OperationRef[];
  readonly reason: string;
};

// ---------------------------------------------------------------------------
// Organization composition + evaluation (acceptance 4).
// ---------------------------------------------------------------------------

/** One role binding inside a candidate organization. */
export type OrganizationRoleBinding = {
  readonly roleProposalId: RoleProposalId;
  readonly primaryCandidateId: CandidateId;
  readonly backupCandidateIds: readonly CandidateId[];
  readonly carriedGapIds: readonly CapabilityGapId[];
};

/** A handoff edge between two roles (from an output to an input). */
export type HandoffEdge = {
  readonly fromRoleProposalId: RoleProposalId;
  readonly toRoleProposalId: RoleProposalId;
  readonly outputName: string;
  readonly inputName: string;
  readonly kind: RepresentationKind;
};

/** A supervision/escalation edge attached to a role. */
export type SupervisionEdge = {
  readonly supervisedRoleProposalId: RoleProposalId;
  readonly escalation: 'human-review' | 'peer-review' | 'automated-check';
};

/** Rollup estimates for an organization (deterministic sums). */
export type OrganizationEstimates = {
  readonly estimatedLatencyMs: number | null;
  readonly estimatedCost: MoneyAmount | null;
};

/**
 * A candidate organization (acceptance 4 input): roles + bindings +
 * handoff topology + supervision + redundancy + carried gaps. The id is
 * content-addressed. An organization binding an unverified external
 * candidate is `staged` — it can be evaluated but NEVER selected
 * (acceptance 6).
 */
export type OrganizationProposal = {
  readonly schemaVersion: CapabilityDiscoveryRecordVersion;
  readonly organizationId: OrganizationId;
  readonly label: string;
  readonly roleBindings: readonly OrganizationRoleBinding[];
  readonly handoffs: readonly HandoffEdge[];
  readonly supervision: readonly SupervisionEdge[];
  readonly estimates: OrganizationEstimates;
  readonly staged: boolean;
  readonly stagingReasons: readonly string[];
};

/** One declared evaluation criterion (objective/constraint/evidence). */
export type EvaluationCriterion = {
  readonly criterionId: string;
  readonly kind: EvaluationCriterionKind;
  readonly metric: EvaluationMetric;
  readonly direction: 'minimize' | 'maximize';
  readonly threshold?: number | undefined;
  readonly weight?: number | undefined;
};

/** The computed value of one criterion for one organization. */
export type CriterionResult = {
  readonly criterionId: string;
  readonly metric: EvaluationMetric;
  readonly value: number | null;
  readonly thresholdMet: boolean | null;
};

/** The evaluation of one candidate organization under declared criteria. */
export type OrganizationEvaluation = {
  readonly organizationId: OrganizationId;
  readonly criterionResults: readonly CriterionResult[];
  readonly admissible: boolean;
  readonly rejectionReasons: readonly string[];
  readonly score: number | null;
};

/** The selection (or staging) outcome over evaluated organizations. */
export type OrganizationSelection = {
  readonly selectedOrganizationId: OrganizationId | null;
  readonly stagedOrganizationIds: readonly OrganizationId[];
  readonly rejected: readonly {
    readonly organizationId: OrganizationId;
    readonly reasons: readonly string[];
  }[];
  readonly rationale: string;
};

// ---------------------------------------------------------------------------
// Discovery runs + content-addressed lineage (acceptance 8).
// ---------------------------------------------------------------------------

/** One link of the run's digest chain (stage -> digest -> previous). */
export type DiscoveryStageLink = {
  readonly stage: DiscoveryStageName;
  readonly stageDigest: Sha256Hex;
  readonly previousStageDigest: Sha256Hex | null;
};

/** The two-stream ARCD1.0 trigger record on a run. */
export type DiscoveryRunTrigger = {
  readonly trigger: DiscoveryTrigger;
  /** Present for scheduled/event runs: the invoking schedule or event id. */
  readonly invokedBy?: string | undefined;
};

/**
 * One reproducible discovery run (acceptance 8). The run id is
 * content-addressed over (runKind, tenantId, inputDigest,
 * compilerVersion); every stage of the lineage is digest-chained and
 * `verifyDiscoveryRun` re-derives the whole chain, rejecting tampered
 * digests and broken links (typed `lineage-mismatch`).
 */
export type DiscoveryRun = {
  readonly schemaVersion: CapabilityDiscoveryRecordVersion;
  readonly runId: DiscoveryRunId;
  readonly runKind: DiscoveryRunKind;
  readonly tenantId: DiscoveryTenantId;
  readonly compilerVersion: DiscoveryCompilerVersion;
  readonly contractVersion: CapabilityDiscoveryContractVersion;
  readonly trigger: DiscoveryRunTrigger;
  readonly inputDigest: Sha256Hex;
  readonly stages: readonly DiscoveryStageLink[];
  readonly createdAt: Timestamp;
  /** Template relaxations rejected by the universal compiler. */
  readonly templateOverrideRejections: readonly string[];
};

/** The full self-contained artifact of one problem-driven discovery run. */
export type DiscoveryRunArtifact = {
  readonly run: DiscoveryRun;
  readonly input: DiscoveryInput;
  /** The candidate pool the run resolved against (self-contained lineage). */
  readonly candidates: readonly CandidateProfile[];
  /** The declared evaluation criteria (self-contained lineage). */
  readonly criteria: readonly EvaluationCriterion[];
  /** The organization-composition bound used (self-contained lineage). */
  readonly maxOrganizations: number;
  readonly demandSet: CapabilityDemandSet;
  readonly roleProposals: readonly RoleProposal[];
  readonly resolutions: readonly RoleResolution[];
  readonly organizations: readonly OrganizationProposal[];
  readonly evaluations: readonly OrganizationEvaluation[];
  readonly selection: OrganizationSelection | null;
  readonly gaps: readonly CapabilityGap[];
  readonly ecosystemRequests: readonly EcosystemDiscoveryRequest[];
};

// ---------------------------------------------------------------------------
// External discovery: source adapters, ingestion, promotion (acceptance 5, 6).
// ---------------------------------------------------------------------------

/** One artifact discovered by a source adapter (provider-neutral). */
export type SourceArtifact = {
  readonly artifactId: string;
  readonly contentDigest: Sha256Hex;
  readonly summary: string;
  readonly claimedCapabilities: readonly ClaimedCapability[];
  readonly licenseNote?: string | undefined;
  readonly environmentNotes: readonly string[];
};

/** A scan query: the gap operations an adapter should try to satisfy. */
export type SourceScanQuery = {
  readonly operations: readonly OperationRef[];
  readonly limit: number;
};

/** A scan result from one adapter. */
export type SourceScanResult = {
  readonly adapterId: string;
  readonly artifacts: readonly SourceArtifact[];
};

/** Sandbox report required by the sandbox promotion step. */
export type SandboxReport = {
  readonly passed: boolean;
  readonly isolationLevel: 'none' | 'process' | 'vm' | 'network-isolated';
  readonly findings: readonly string[];
};

/** Evaluation evidence required by the evaluated promotion step. */
export type CandidateEvaluationEvidence = {
  readonly operation: OperationRef;
  readonly metric: string;
  readonly value: number;
  readonly unit: string;
  readonly passed: boolean;
  readonly evidenceDigest: Sha256Hex;
};

/** The policy approval required by the verified promotion step. */
export type PolicyApproval = {
  readonly approvedBy: string;
  readonly policyRef: string;
  readonly note?: string | undefined;
};

/**
 * One sealed promotion record (hash-chained). The promotion gate admits
 * ONLY the CC1.0 successor transitions, requires the sandbox report for
 * `sandboxed`, evaluation evidence for `evaluated`, and a policy approval
 * for `verified` — an unverified candidate can NEVER pass the gate.
 */
export type PromotionRecord = {
  readonly schemaVersion: CapabilityDiscoveryRecordVersion;
  readonly promotionId: PromotionId;
  readonly candidateId: CandidateId;
  readonly fromState: CandidateEvaluationState;
  readonly toState: CandidateEvaluationState;
  readonly evidenceDigest: Sha256Hex;
  readonly sandboxReport?: SandboxReport | undefined;
  readonly evaluationEvidence?: readonly CandidateEvaluationEvidence[] | undefined;
  readonly policyApproval?: PolicyApproval | undefined;
  readonly note?: string | undefined;
  readonly promotedAt: Timestamp;
  readonly previousPromotionDigest: Sha256Hex | null;
  readonly recordDigest: Sha256Hex;
};

/** The per-run view of an ecosystem scan (stream B). */
export type EcosystemScanReport = {
  readonly adapterIds: readonly string[];
  readonly scannedOperations: readonly OperationRef[];
  readonly ingestedCandidateIds: readonly CandidateId[];
  readonly duplicateArtifactDigests: readonly Sha256Hex[];
};

// ---------------------------------------------------------------------------
// Ecosystem proposals (R41: adapters / extensions / new domain packs).
// ---------------------------------------------------------------------------

/** Evidence carried by an ecosystem proposal. */
export type EcosystemProposalEvidence = {
  readonly gapIds: readonly CapabilityGapId[];
  readonly taskExamples: readonly string[];
  readonly missingSemantics: readonly string[];
  readonly recurringGapCount: number;
};

/** Domain-pack detail carried when kind is 'domain-pack'. */
export type DomainPackProposalDetail = {
  readonly proposedPackId: string;
  readonly requiredVocabulary: readonly string[];
  readonly worldModelBindings: readonly string[];
  readonly capabilityDependencies: readonly string[];
  readonly evaluationRequirements: readonly string[];
  readonly uxProjections: readonly string[];
};

/**
 * A proposal for a new adapter, extension or domain pack, derived from
 * discovery evidence (recurring gaps). A proposal is a RECORD ONLY —
 * activation remains Epoch governance (ACR-004: never auto-activated).
 */
export type EcosystemProposal = {
  readonly schemaVersion: CapabilityDiscoveryRecordVersion;
  readonly proposalId: EcosystemProposalId;
  readonly kind: EcosystemProposalKind;
  readonly summary: string;
  readonly evidence: EcosystemProposalEvidence;
  readonly domainPackDetail?: DomainPackProposalDetail | undefined;
  readonly status: EcosystemProposalStatus;
  readonly proposedAt: Timestamp;
  readonly proposedByRunId?: DiscoveryRunId | undefined;
  readonly reviewNote?: string | undefined;
};

// ---------------------------------------------------------------------------
// Scheduler contract (deployment-neutral).
// ---------------------------------------------------------------------------

/** A registered ecosystem-discovery schedule (tenant-scoped). */
export type DiscoverySchedule = {
  readonly scheduleId: string;
  readonly tenantId: DiscoveryTenantId;
  readonly cadence:
    | { readonly kind: 'weekly' }
    | { readonly kind: 'interval'; readonly intervalDays: number }
    | { readonly kind: 'event' };
  readonly adapterIds: readonly string[];
  readonly enabled: boolean;
  readonly lastRunAt?: Timestamp | undefined;
};

/** A due schedule emitted by a scheduler tick. */
export type DueDiscoveryRun = {
  readonly scheduleId: string;
  readonly tenantId: DiscoveryTenantId;
  readonly dueAt: Timestamp;
  readonly adapterIds: readonly string[];
};

// ---------------------------------------------------------------------------
// Errors (typed, total surface — errors are values, never exceptions).
// ---------------------------------------------------------------------------

/** One flattened validation issue. */
export type DiscoveryIssue = {
  readonly path: string;
  readonly message: string;
};

/** Issue codes reported by the discovery plane's total entry points. */
export type DiscoveryErrorCode =
  | 'validation'
  | 'unknown-run'
  | 'unknown-gap'
  | 'unknown-candidate'
  | 'unknown-template'
  | 'unknown-schedule'
  | 'duplicate-run'
  | 'duplicate-candidate'
  | 'duplicate-schedule'
  | 'gap-transition-conflict'
  | 'candidate-state-conflict'
  | 'promotion-gate-rejected'
  | 'template-override-rejected'
  | 'organization-composition-rejected'
  | 'cross-tenant-denied'
  | 'authorization-rejected'
  | 'lineage-mismatch';

/** The typed discovery error taxonomy (fixed precedence; total APIs). */
export type DiscoveryError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly DiscoveryIssue[];
    }
  | {
      readonly code:
        | 'unknown-run'
        | 'unknown-gap'
        | 'unknown-candidate'
        | 'unknown-template'
        | 'unknown-schedule'
        | 'duplicate-run'
        | 'duplicate-candidate'
        | 'duplicate-schedule'
        | 'gap-transition-conflict'
        | 'candidate-state-conflict'
        | 'promotion-gate-rejected'
        | 'template-override-rejected'
        | 'organization-composition-rejected'
        | 'cross-tenant-denied'
        | 'authorization-rejected';
      readonly message: string;
    }
  | {
      readonly code: 'lineage-mismatch';
      readonly message: string;
      readonly brokenStages: readonly DiscoveryStageName[];
    };

/** Result of a discovery operation: a value or a typed error. */
export type DiscoveryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DiscoveryError };
