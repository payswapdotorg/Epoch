/**
 * Software pack contract versions and the closed vocabularies (W027,
 * DP1.0). A domain pack is DATA + PURE PROJECTION FUNCTIONS over the
 * universal solution-delivery state — every vocabulary below is CLOSED (a
 * typed union, never an open string) and provider-neutral: no entry names
 * a vendor, brand, marketplace, cloud, devops tool, issue tracker or API
 * surface.
 *
 * The pack TEACHES the universal lifecycle (USL1.0, taught by
 * `@epoch/solution-delivery`); it never claims lifecycle, baseline,
 * schedule, delivery, actualization or verification authority (DP1.0
 * forbidden list — pre-classified by the W036 `classifyLifecycleAuthority`
 * path and the pack-local tracker/gateway write-intent classifiers).
 *
 * Measurement bases, cost classes, verification kinds, work-item kinds,
 * deployment-environment tiers and outcome types are software-domain
 * vocabularies that SPECIALIZE universal concepts (quantity+unit lines,
 * cost/resource schedules, verification gates, work packages/activities,
 * realization variants, distinction outcomes) — they never replace them.
 */

/** Version of the published software-pack contract surface. */
export const SOFTWARE_PACK_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized software-pack record. */
export const SOFTWARE_PACK_RECORD_VERSION = 1 as const;

/** The pack identity (qualified-name grammar, provider-neutral). */
export const SOFTWARE_PACK_ID = 'software.core' as const;

/** The pack version (semver core). */
export const SOFTWARE_PACK_VERSION = '1.0.0' as const;

/**
 * The universal lifecycle version this pack targets — MUST equal the
 * `SOLUTION_DELIVERY_USL_VERSION` taught by the W036 kernel (checked by the
 * W036 admit path and pinned by the runtime parity test).
 */
export const SOFTWARE_SUPPORTED_LIFECYCLE_VERSION = '1.0.0' as const;

// --------------------------------------------------------------------------------
// Schema discriminators (the sealed-envelope discipline: a literal `schema`
// names the record family so mixed envelopes cannot be confused).
// --------------------------------------------------------------------------------

export const ENTITY_BINDING_SCHEMA_NAME = 'epoch.pack-software.entity-binding' as const;
export const MEASUREMENT_METHOD_SCHEMA_NAME =
  'epoch.pack-software.measurement-method' as const;
export const COST_CLASSIFICATION_SCHEMA_NAME =
  'epoch.pack-software.cost-classification' as const;
export const VERIFICATION_METHOD_SCHEMA_NAME =
  'epoch.pack-software.verification-method' as const;
export const CONSTRAINT_DESCRIPTOR_SCHEMA_NAME =
  'epoch.pack-software.constraint-descriptor' as const;
export const OUTCOME_TYPE_SCHEMA_NAME = 'epoch.pack-software.outcome-type' as const;
export const WORK_ITEM_SCHEMA_NAME = 'epoch.pack-software.work-item' as const;
export const ENVIRONMENT_SCHEMA_NAME = 'epoch.pack-software.environment' as const;
export const WORK_TEMPLATE_SCHEMA_NAME = 'epoch.pack-software.work-template' as const;
export const VOCABULARY_BUNDLE_SCHEMA_NAME = 'epoch.pack-software.vocabulary-bundle' as const;
export const ROADMAP_VIEW_SCHEMA_NAME = 'epoch.pack-software.roadmap-view' as const;
export const BACKLOG_VIEW_SCHEMA_NAME = 'epoch.pack-software.backlog-view' as const;
export const DEPLOYMENT_PLAN_VIEW_SCHEMA_NAME =
  'epoch.pack-software.deployment-plan-view' as const;
export const DEPLOY_PROPOSAL_TEMPLATE_SCHEMA_NAME =
  'epoch.pack-software.deploy-proposal-template' as const;
export const OUTCOME_VIEW_SCHEMA_NAME = 'epoch.pack-software.outcome-view' as const;

// --------------------------------------------------------------------------------
// Software concepts (World Model entity bindings).
// --------------------------------------------------------------------------------

/**
 * The software concepts a World Model entity kind may bind to (DP1.0
 * "entity/relationship extensions"): system, service, environment,
 * repository, release unit. Descriptive bindings onto W002 entity-type
 * keys — never new authorities.
 */
export const SOFTWARE_CONCEPTS = [
  'system',
  'service',
  'environment',
  'repository',
  'release-unit',
] as const;

/** One software concept. */
export type SoftwareConcept = (typeof SOFTWARE_CONCEPTS)[number];

/** Display terms for the software concepts. */
export const SOFTWARE_CONCEPT_TERMS = {
  system: 'Systems',
  service: 'Services',
  environment: 'Environments',
  repository: 'Repositories',
  'release-unit': 'Release units',
} as const;

// --------------------------------------------------------------------------------
// Work-item vocabulary (epics / issues / tasks / changes as DISPLAY terms).
// --------------------------------------------------------------------------------

/**
 * The work-item kinds (DP1.0 "terminology"): epic / issue / task / change —
 * DISPLAY terms bound onto canonical work-package/activity lines. The
 * issue-tracker view is a PROJECTION of ProgramOfWork lines; the pack keeps
 * NO stored issue state (`parallel-tracker-rejected`).
 */
export const WORK_ITEM_KINDS = ['epic', 'issue', 'task', 'change'] as const;

/** One work-item kind. */
export type WorkItemKind = (typeof WORK_ITEM_KINDS)[number];

/** Display terms for the work-item kinds. */
export const WORK_ITEM_TERMS = {
  epic: 'Epic',
  issue: 'Issue',
  task: 'Task',
  change: 'Change',
} as const;

// --------------------------------------------------------------------------------
// Display-state vocabulary (derived from canonical lifecycle states).
// --------------------------------------------------------------------------------

/**
 * The canonical activity display-state basis: DERIVED from the canonical
 * lifecycle states on a ProgramOfWork activity (actualFinish / actualStart /
 * actualProgress / blockers) — the display states are PROJECTIONS; the
 * canonical DeliveryRecord state is the ONLY truth.
 */
export const ACTIVITY_DISPLAY_STATES = [
  'not-started',
  'in-progress',
  'impeded',
  'complete',
] as const;

/** One activity display state. */
export type ActivityDisplayState = (typeof ACTIVITY_DISPLAY_STATES)[number];

/** Issue-tracker display terms for the activity display states. */
export const ISSUE_DISPLAY_STATE_TERMS = {
  'not-started': 'Backlog',
  'in-progress': 'In Progress',
  impeded: 'Blocked',
  complete: 'Done',
} as const;

/** Deployment-rollout display terms for the activity display states. */
export const DEPLOYMENT_STEP_STATE_TERMS = {
  'not-started': 'Pending',
  'in-progress': 'Running',
  impeded: 'Impeded',
  complete: 'Complete',
} as const;

// --------------------------------------------------------------------------------
// Measurement vocabulary.
// --------------------------------------------------------------------------------

/** The quantity-measurement bases (DP1.0 "units and measurement methods"). */
export const SOFTWARE_MEASUREMENT_BASES = ['effort', 'count'] as const;

/** One measurement base. */
export type SoftwareMeasurementBase = (typeof SOFTWARE_MEASUREMENT_BASES)[number];

/** The net/contingency rule kinds carried by an effort measurement method. */
export const EFFORT_RULE_KINDS = ['net', 'contingency'] as const;

/** One net/contingency rule kind. */
export type EffortRuleKind = (typeof EFFORT_RULE_KINDS)[number];

// --------------------------------------------------------------------------------
// Cost/resource vocabulary.
// --------------------------------------------------------------------------------

/**
 * The software resource classes (DP1.0 "cost/resource classifications")
 * applied as folds over the W036 CostSchedule/ResourceSchedule:
 * engineering, infrastructure, licensing, operations.
 */
export const SOFTWARE_RESOURCE_CLASSES = [
  'engineering',
  'infrastructure',
  'licensing',
  'operations',
] as const;

/** One software resource class. */
export type SoftwareResourceClass = (typeof SOFTWARE_RESOURCE_CLASSES)[number];

// --------------------------------------------------------------------------------
// Verification vocabulary.
// --------------------------------------------------------------------------------

/**
 * The software verification-method kinds (DP1.0 "verification methods"):
 * test-suite pass, review approval, deploy gate, SLO check. Descriptors
 * referencing the W006 evidence/provenance conventions — the verification
 * AUTHORITY is never re-implemented here.
 */
export const SOFTWARE_VERIFICATION_KINDS = [
  'test-suite-pass',
  'review-approval',
  'deploy-gate',
  'slo-check',
] as const;

/** One software verification-method kind. */
export type SoftwareVerificationKind = (typeof SOFTWARE_VERIFICATION_KINDS)[number];

// --------------------------------------------------------------------------------
// Constraint vocabulary.
// --------------------------------------------------------------------------------

/**
 * The software constraint categories (DP1.0 "constraints"): the
 * classification dimension of the constraint descriptor vocabulary —
 * entries are data compatible with the W004 policy-contract shapes; the
 * Constraint Engine remains the authority.
 */
export const SOFTWARE_CONSTRAINT_CATEGORIES = [
  'security',
  'compliance',
  'technical',
  'operational',
  'commercial',
] as const;

/** One software constraint category. */
export type SoftwareConstraintCategory = (typeof SOFTWARE_CONSTRAINT_CATEGORIES)[number];

// --------------------------------------------------------------------------------
// Deployment vocabulary.
// --------------------------------------------------------------------------------

/**
 * The deployment-environment tiers (provider-neutral): development,
 * integration, staging, production. Vocabulary data for the deployment-plan
 * projection — environments are NEVER a second authority (canonical world
 * entities and ProgramOfWork ids stay the identity).
 */
export const DEPLOYMENT_ENVIRONMENT_TIERS = [
  'development',
  'integration',
  'staging',
  'production',
] as const;

/** One deployment-environment tier. */
export type DeploymentEnvironmentTier = (typeof DEPLOYMENT_ENVIRONMENT_TIERS)[number];

/**
 * The environment-row tier vocabulary of the deployment-plan view: the
 * four environment tiers plus the deterministic `unassigned` bucket rows
 * fold unclassified rollout steps into.
 */
export const DEPLOYMENT_ENVIRONMENT_ROW_TIERS = [
  ...DEPLOYMENT_ENVIRONMENT_TIERS,
  'unassigned',
] as const;

/** One deployment-environment row tier. */
export type DeploymentEnvironmentRowTier = (typeof DEPLOYMENT_ENVIRONMENT_ROW_TIERS)[number];

/**
 * The deterministic fallback environment of the deployment-plan projection:
 * rollout steps the caller's environment assignment does not classify fold
 * into this bucket (SN1.0 partial-data behavior — never a blocker).
 */
export const UNASSIGNED_ENVIRONMENT_ID = 'software.environment.unassigned' as const;

/** The fallback environment tier for unassigned rollout steps. */
export const UNASSIGNED_ENVIRONMENT_TIER = 'unassigned' as const;

// --------------------------------------------------------------------------------
// Presentation vocabularies (pure display terms over universal states).
// --------------------------------------------------------------------------------

/**
 * Software display terms for the universal milestone statuses
 * (presentation vocabulary only — the statuses stay the W036 values).
 */
export const MILESTONE_STATUS_TERMS = {
  planned: 'Planned',
  reached: 'Shipped',
  missed: 'Missed',
} as const;

/**
 * Software display terms for the realization variants this pack renders
 * (the universal variants stay the W036 values).
 */
export const REALIZATION_VARIANT_TERMS = {
  'software-implementation-deployment': 'Build & deploy',
  'infrastructure-provisioning': 'Infrastructure provisioning',
} as const;

// --------------------------------------------------------------------------------
// Write-intent pre-classification blocklists (the DP1.0 forbidden-list
// pattern, specialized for tracker/gateway discipline): a record that
// carries one of these fields is attempting to store or mutate issue/backlog
// state through the pack, or to execute a deployment outside the W003/W022
// authority seam — a typed `parallel-tracker-rejected` /
// `gateway-bypass-rejected` BEFORE schema validation surfaces it.
// --------------------------------------------------------------------------------

/**
 * Parallel-tracker field names: a pack record carrying one of these claims a
 * stored issue/backlog/roadmap/deployment tracker or a parallel schedule/
 * delivery ledger beside the W036 sealed state — the issue-tracker view is a
 * PROJECTION recomputed on every call, never a stored parallel tracker
 * (DP1.0 forbidden list).
 */
export const FORBIDDEN_PARALLEL_TRACKER_FIELDS = [
  'issueStore',
  'storedIssues',
  'backlogLedger',
  'issueLedger',
  'trackerState',
  'storedTracker',
  'roadmapStore',
  'storedRoadmap',
  'deploymentLedger',
  'parallelTracker',
  'appendIssue',
  'writeIssue',
  'amendIssue',
  'updateIssueState',
  'issueMutations',
  'trackerRevision',
  'quantityLedger',
  'costLedger',
  'deliveryLedger',
  'actualLedger',
  'scheduleLedger',
] as const;

/** One forbidden parallel-tracker field name. */
export type ForbiddenParallelTrackerField = (typeof FORBIDDEN_PARALLEL_TRACKER_FIELDS)[number];

/**
 * Gateway-bypass field names: a pack record carrying one of these claims a
 * direct deployment EXECUTION path outside the W003 action-proposal /
 * W022 authority seam — a domain pack proposes; the Action Gateway
 * authorizes and executes (`gateway-bypass-rejected`).
 */
export const FORBIDDEN_GATEWAY_BYPASS_FIELDS = [
  'executeDeploy',
  'executeDeployment',
  'deployNow',
  'runDeployment',
  'applyDeployment',
  'dispatchDeployment',
  'executeAction',
  'directExecution',
  'gatewayOverride',
  'bypassGateway',
  'autoExecute',
  'executeNow',
] as const;

/** One forbidden gateway-bypass field name. */
export type ForbiddenGatewayBypassField = (typeof FORBIDDEN_GATEWAY_BYPASS_FIELDS)[number];

// --------------------------------------------------------------------------------
// Opaque identity grammars (pack-local slugs; canonical ids are owned by the
// kernel packages and only REFERENCED here).
// --------------------------------------------------------------------------------

/** Template activity-slot identity: a bare lowercase slug (template-local). */
export const TEMPLATE_SLOT_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

/** Measurement code: a stable pack-qualified lowercase code. */
export const MEASUREMENT_CODE_PATTERN = /^[a-z][a-z0-9.-]{0,127}$/;

/** Cost code: a stable pack-qualified lowercase code. */
export const COST_CODE_PATTERN = /^[a-z][a-z0-9.-]{0,127}$/;

/** W003 action-proposal parameter-name grammar (agent-protocol mirror). */
export const PARAMETER_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
