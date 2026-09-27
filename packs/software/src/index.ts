/**
 * @epoch/pack-software — public API (W027, DP1.0).
 *
 * The Software/Infrastructure domain pack: DATA + PURE PROJECTION
 * FUNCTIONS over the universal solution-delivery state (W036). The pack
 * holds NO lifecycle authority, keeps NO parallel tracker/ledger, writes
 * NO canonical state, executes NO deployment, renders NO UI, and names NO
 * provider. Every exported entry point is total (errors are values),
 * deterministic (identical inputs -> identical digests), in-memory and
 * IO-free.
 *
 * Public surface:
 * - the DP1.0 pack profile (built per tenant, admitted through the W036
 *   `admitPackProfile` path) and its sealed round-trip envelope;
 * - the software vocabulary as typed data (entity bindings, work items,
 *   measurement methods, cost classifications, verification methods,
 *   constraint descriptors, outcome types, deployment environments) and
 *   the sealed vocabulary bundle;
 * - deterministic measurement derivations (net/contingency effort rules)
 *   and cost/resource classification folds over the W036 schedules;
 * - the canonical activity display-state derivation (issue-tracker and
 *   deployment states are PROJECTIONS of canonical lifecycle states);
 * - versioned, content-addressed work templates with a caller-side
 *   instantiation fold producing plan-compatible shapes;
 * - the synchronized projections: the roadmap view
 *   (`projectRoadmap`), the issue-tracker view (`projectBacklog`) and
 *   the deployment-plan view (`projectDeploymentPlan`);
 * - the deploy-proposal TEMPLATES and `renderDeployProposal` — the ONLY
 *   exit path of a deployment action from this pack: a typed W003
 *   `ActionProposal` validated through the W003 admission pipeline,
 *   addressed to the W022 Action Gateway. There is deliberately NO
 *   execution surface: `parallel-tracker-rejected` /
 *   `gateway-bypass-rejected` classify stored-tracker and
 *   execution-intent attempts at the pack admission surfaces.
 */
export {
  SOFTWARE_PACK_CONTRACT_VERSION,
  SOFTWARE_PACK_ID,
  SOFTWARE_PACK_RECORD_VERSION,
  SOFTWARE_PACK_VERSION,
  SOFTWARE_SUPPORTED_LIFECYCLE_VERSION,
  SOFTWARE_CONCEPTS,
  SOFTWARE_CONCEPT_TERMS,
  SOFTWARE_MEASUREMENT_BASES,
  EFFORT_RULE_KINDS,
  SOFTWARE_RESOURCE_CLASSES,
  SOFTWARE_VERIFICATION_KINDS,
  SOFTWARE_CONSTRAINT_CATEGORIES,
  WORK_ITEM_KINDS,
  WORK_ITEM_TERMS,
  ACTIVITY_DISPLAY_STATES,
  ISSUE_DISPLAY_STATE_TERMS,
  DEPLOYMENT_STEP_STATE_TERMS,
  DEPLOYMENT_ENVIRONMENT_TIERS,
  DEPLOYMENT_ENVIRONMENT_ROW_TIERS,
  MILESTONE_STATUS_TERMS,
  REALIZATION_VARIANT_TERMS,
  UNASSIGNED_ENVIRONMENT_ID,
  UNASSIGNED_ENVIRONMENT_TIER,
  FORBIDDEN_PARALLEL_TRACKER_FIELDS,
  FORBIDDEN_GATEWAY_BYPASS_FIELDS,
  TEMPLATE_SLOT_ID_PATTERN,
  MEASUREMENT_CODE_PATTERN,
  COST_CODE_PATTERN,
  PARAMETER_NAME_PATTERN,
} from './version';
export type {
  SoftwareConcept,
  SoftwareMeasurementBase,
  EffortRuleKind,
  SoftwareResourceClass,
  SoftwareVerificationKind,
  SoftwareConstraintCategory,
  WorkItemKind,
  ActivityDisplayState,
  DeploymentEnvironmentTier,
  DeploymentEnvironmentRowTier,
  ForbiddenParallelTrackerField,
  ForbiddenGatewayBypassField,
} from './version';

export type { PackError, PackSpecificErrorCode, PackResult } from './errors';

export {
  SOFTWARE_STAGE_VOCABULARY,
  SOFTWARE_PROJECTION_RULES,
  SOFTWARE_CAPABILITY_DEPENDENCIES,
  SOFTWARE_MEASUREMENT_NOTE,
  SOFTWARE_MIGRATION_NOTE,
  softwarePackProfile,
  admitSoftwarePackProfile,
  digestPackProfile,
  sealSoftwareProfile,
  verifySoftwareProfile,
  SealedSoftwareProfileSchema,
} from './profile';
export type { SealedSoftwareProfile } from './profile';

export {
  EntityBindingSchema,
  SOFTWARE_ENTITY_BINDINGS,
  classifyWorldEntity,
} from './entities';
export type { EntityBinding } from './entities';

export {
  WorkItemDescriptorSchema,
  SOFTWARE_WORK_ITEMS,
  WorkItemIndexSchema,
  workItemKindOf,
  workItemTermOf,
  ActivityDisplayStateSchema,
  activityDisplayStateOf,
  workPackageDisplayStateOf,
} from './workitem';
export type { WorkItemDescriptor, WorkItemIndex, ActivityWorkItemKind } from './workitem';

export {
  EffortRuleSchema,
  MeasurementMethodSchema,
  SOFTWARE_MEASUREMENT_METHODS,
  MeasuredQuantitySchema,
  MEASURED_QUANTITY_BASES,
  measureQuantity,
  foldMeasuredQuantities,
} from './measurement';
export type {
  EffortRule,
  MeasurementMethod,
  MeasuredQuantity,
  MeasuredQuantityBasis,
  MeasuredQuantityRow,
  MeasuredQuantityFold,
} from './measurement';

export {
  CostClassificationSchema,
  SOFTWARE_COST_CLASSIFICATIONS,
  CostClassIndexSchema,
  ResourceClassIndexSchema,
  foldClassifiedCostSummary,
  foldClassifiedResourceSummary,
} from './cost';
export type {
  CostClassification,
  CostClassIndex,
  ResourceClassIndex,
  ClassifiedCostTotal,
  ClassifiedCostSummary,
  ClassifiedResourceRow,
  ClassifiedResourceSummary,
} from './cost';

export {
  PACK_CONFIDENCE_METHODS,
  SoftwareVerificationMethodSchema,
  SOFTWARE_VERIFICATION_METHODS,
  describeVerificationGates,
} from './verification';
export type {
  PackConfidenceMethod,
  SoftwareVerificationMethod,
  DescribedVerificationGate,
} from './verification';

export {
  CONSTRAINT_ID_PATTERN,
  ConstraintPolicyBindingSchema,
  SoftwareConstraintDescriptorSchema,
  SOFTWARE_CONSTRAINT_DESCRIPTORS,
  findConstraintDescriptor,
} from './constraints';
export type {
  ConstraintPolicyBinding,
  SoftwareConstraintDescriptor,
} from './constraints';

export {
  UNIVERSAL_OUTCOME_KINDS,
  SoftwareOutcomeTypeSchema,
  SoftwareOutcomeViewSchema,
  SOFTWARE_OUTCOME_TYPES,
  projectSoftwareOutcomes,
  digestOutcomeViews,
} from './outcomes';
export type { UniversalOutcomeKind, SoftwareOutcomeType, SoftwareOutcomeView } from './outcomes';

export {
  WorkTemplateContentSchema,
  SealedWorkTemplateSchema,
  TemplateActivitySlotSchema,
  TemplateInstantiationParamsSchema,
  sealWorkTemplate,
  verifyWorkTemplate,
  softwareWorkTemplates,
  instantiateWorkTemplate,
} from './templates';
export type {
  TemplateActivitySlot,
  WorkTemplateContent,
  SealedWorkTemplate,
  TemplateInstantiationParams,
} from './templates';

export {
  DeploymentEnvironmentSchema,
  SOFTWARE_DEPLOYMENT_ENVIRONMENTS,
  EnvironmentAssignmentIndexSchema,
  RolloutStepSchema,
  DeploymentEnvironmentRowSchema,
  DeploymentDependencySchema,
  DeploymentPlanViewSchema,
  projectDeploymentPlan,
  verifyDeploymentPlanView,
  deploymentStepStateTermOf,
  DeployProposalTemplateContentSchema,
  SealedDeployProposalTemplateSchema,
  sealDeployProposalTemplate,
  verifyDeployProposalTemplate,
  softwareDeployProposalTemplates,
  DeployProposalRenderParamsSchema,
  renderDeployProposal,
  ActionProposalSchema,
} from './deployment';
export type {
  DeploymentEnvironment,
  EnvironmentAssignmentIndex,
  RolloutStep,
  DeploymentEnvironmentRow,
  DeploymentDependency,
  DeploymentPlanView,
  DeploymentPlanInputs,
  DeployProposalTemplateContent,
  SealedDeployProposalTemplate,
  DeployProposalRenderParams,
} from './deployment';

export {
  VocabularyBundleContentSchema,
  SealedVocabularyBundleSchema,
  sealVocabularyBundle,
  verifyVocabularyBundle,
  softwareVocabularyBundle,
} from './vocabulary';
export type { VocabularyBundleContent, SealedVocabularyBundle } from './vocabulary';

export {
  ROADMAP_TRACK_KINDS,
  RoadmapTrackSchema,
  RoadmapReleaseSchema,
  RoadmapMilestoneSchema,
  RoadmapDependencySchema,
  RoadmapViewSchema,
  projectRoadmap,
  verifyRoadmapView,
} from './roadmap';
export type {
  RoadmapTrackKind,
  RoadmapTrack,
  RoadmapRelease,
  RoadmapMilestone,
  RoadmapDependency,
  RoadmapView,
} from './roadmap';

export {
  BacklogEpicSchema,
  BacklogIssueSchema,
  BacklogViewSchema,
  projectBacklog,
  verifyBacklogView,
  issueDisplayStateTermOf,
} from './backlog';
export type {
  BacklogEpic,
  BacklogIssue,
  BacklogView,
  BacklogProjectionInputs,
} from './backlog';
