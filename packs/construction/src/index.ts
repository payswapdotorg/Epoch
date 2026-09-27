/**
 * @epoch/pack-construction — public API (W026, DP1.0).
 *
 * The Construction domain pack: DATA + PURE PROJECTION FUNCTIONS over the
 * universal solution-delivery state (W036). The pack holds NO lifecycle
 * authority, keeps NO parallel ledger, writes NO canonical state, renders
 * NO UI, and names NO provider. Every exported entry point is total
 * (errors are values), deterministic (identical inputs -> identical
 * digests), in-memory and IO-free.
 *
 * Public surface:
 * - the DP1.0 pack profile (built per tenant, admitted through the W036
 *   `admitPackProfile` path) and its sealed round-trip envelope;
 * - the construction vocabulary as typed data (entity bindings,
 *   measurement methods, cost classifications, verification methods,
 *   constraint descriptors, outcome types) and the sealed vocabulary
 *   bundle;
 * - deterministic measurement derivations (net/gross rules) and
 *   cost/resource classification folds over the W036 schedules;
 * - versioned, content-addressed work templates with a caller-side
 *   instantiation fold producing plan-compatible shapes;
 * - the synchronized projections: the BOQ view (`projectBoq`), the
 *   construction programme view (`projectConstructionProgramme`), the
 *   derived delivery-link index (`foldDeliveryLinks`) and the
 *   construction outcome projection (`projectConstructionOutcomes`).
 *
 * There is deliberately NO admission surface for BOQ state: the BOQ is a
 * projection recomputed on every call (`boq-direct-write-rejected` /
 * `parallel-ledger-rejected` classify stored-BOQ and parallel-ledger
 * attempts at the vocabulary/template verification surfaces).
 */
export {
  CONSTRUCTION_PACK_CONTRACT_VERSION,
  CONSTRUCTION_PACK_ID,
  CONSTRUCTION_PACK_RECORD_VERSION,
  CONSTRUCTION_PACK_VERSION,
  CONSTRUCTION_SUPPORTED_LIFECYCLE_VERSION,
  CONSTRUCTION_CONCEPTS,
  CONSTRUCTION_CONCEPT_TERMS,
  MEASUREMENT_BASES,
  NET_GROSS_RULE_KINDS,
  CONSTRUCTION_RESOURCE_CLASSES,
  CONSTRUCTION_VERIFICATION_KINDS,
  CONSTRUCTION_CONSTRAINT_CATEGORIES,
  MILESTONE_STATUS_TERMS,
  REALIZATION_VARIANT_TERMS,
  BOQ_PRELIMINARIES_SECTION_CODE,
  FORBIDDEN_BOQ_WRITE_FIELDS,
  FORBIDDEN_PARALLEL_LEDGER_FIELDS,
  TEMPLATE_SLOT_ID_PATTERN,
  MEASUREMENT_CODE_PATTERN,
  COST_CODE_PATTERN,
} from './version';
export type {
  ConstructionConcept,
  MeasurementBase,
  NetGrossRuleKind,
  ConstructionResourceClass,
  ConstructionVerificationKind,
  ConstructionConstraintCategory,
  ForbiddenBoqWriteField,
  ForbiddenParallelLedgerField,
} from './version';

export type { PackError, PackSpecificErrorCode, PackResult } from './errors';

export {
  CONSTRUCTION_STAGE_VOCABULARY,
  CONSTRUCTION_PROJECTION_RULES,
  CONSTRUCTION_CAPABILITY_DEPENDENCIES,
  CONSTRUCTION_MEASUREMENT_NOTE,
  CONSTRUCTION_MIGRATION_NOTE,
  constructionPackProfile,
  admitConstructionPackProfile,
  digestPackProfile,
  sealConstructionProfile,
  verifyConstructionProfile,
  SealedConstructionProfileSchema,
} from './profile';
export type { SealedConstructionProfile } from './profile';

export {
  EntityBindingSchema,
  CONSTRUCTION_ENTITY_BINDINGS,
  classifyWorldEntity,
  MeasurementMethodSchema,
  CONSTRUCTION_MEASUREMENT_METHODS,
  NetGrossRuleSchema,
  MeasuredQuantitySchema,
  MEASURED_QUANTITY_BASES,
  measureQuantity,
  foldMeasuredQuantities,
} from './measurement';
export type {
  EntityBinding,
  MeasurementMethod,
  NetGrossRule,
  MeasuredQuantity,
  MeasuredQuantityBasis,
  MeasuredQuantityRow,
  MeasuredQuantityFold,
} from './measurement';

export {
  CostClassificationSchema,
  CONSTRUCTION_COST_CLASSIFICATIONS,
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
  WorkTemplateContentSchema,
  SealedWorkTemplateSchema,
  TemplateActivitySlotSchema,
  TemplateInstantiationParamsSchema,
  sealWorkTemplate,
  verifyWorkTemplate,
  constructionWorkTemplates,
  instantiateWorkTemplate,
} from './templates';
export type {
  TemplateActivitySlot,
  WorkTemplateContent,
  SealedWorkTemplate,
  TemplateInstantiationParams,
} from './templates';

export {
  PACK_CONFIDENCE_METHODS,
  ConstructionVerificationMethodSchema,
  CONSTRUCTION_VERIFICATION_METHODS,
  describeVerificationGates,
} from './verification';
export type {
  PackConfidenceMethod,
  ConstructionVerificationMethod,
  DescribedVerificationGate,
} from './verification';

export {
  CONSTRAINT_ID_PATTERN,
  ConstraintPolicyBindingSchema,
  ConstructionConstraintDescriptorSchema,
  CONSTRUCTION_CONSTRAINT_DESCRIPTORS,
  findConstraintDescriptor,
} from './constraints';
export type {
  ConstraintPolicyBinding,
  ConstructionConstraintDescriptor,
} from './constraints';

export {
  UNIVERSAL_OUTCOME_KINDS,
  ConstructionOutcomeTypeSchema,
  ConstructionOutcomeViewSchema,
  CONSTRUCTION_OUTCOME_TYPES,
  projectConstructionOutcomes,
  digestOutcomeViews,
} from './outcomes';
export type { UniversalOutcomeKind, ConstructionOutcomeType, ConstructionOutcomeView } from './outcomes';

export {
  VocabularyBundleContentSchema,
  SealedVocabularyBundleSchema,
  sealVocabularyBundle,
  verifyVocabularyBundle,
  constructionVocabularyBundle,
} from './vocabulary';
export type { VocabularyBundleContent, SealedVocabularyBundle } from './vocabulary';

export {
  DeliveryLinkRowSchema,
  DeliveryLinkIndexSchema,
  foldDeliveryLinks,
} from './links';
export type { DeliveryLinkRow, DeliveryLinkIndex, DeliveryLinkInputs } from './links';

export {
  BoqLineItemSchema,
  BoqSectionSchema,
  BoqCurrencyTotalSchema,
  BoqViewSchema,
  projectBoq,
  verifyBoqView,
} from './boq';
export type {
  BoqLineItem,
  BoqSection,
  BoqCurrencyTotal,
  BoqView,
  WorldEntityView,
  BoqProjectionInputs,
} from './boq';

export {
  ProgrammeActivitySchema,
  ProgrammeMilestoneSchema,
  ProgrammeDependencySchema,
  ConstructionProgrammeViewSchema,
  projectConstructionProgramme,
  verifyConstructionProgrammeView,
} from './programme';
export type {
  ProgrammeActivity,
  ProgrammeMilestone,
  ProgrammeDependency,
  ConstructionProgrammeView,
} from './programme';
