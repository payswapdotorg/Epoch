/**
 * Construction pack contract versions and the closed vocabularies (W026,
 * DP1.0). A domain pack is DATA + PURE PROJECTION FUNCTIONS over the
 * universal solution-delivery state — every vocabulary below is CLOSED (a
 * typed union, never an open string) and provider-neutral: no entry names
 * a vendor, brand, marketplace, ERP, PM tool, CAD product or API surface.
 *
 * The pack TEACHES the universal lifecycle (USL1.0, taught by
 * `@epoch/solution-delivery`); it never claims lifecycle, baseline,
 * schedule, delivery, actualization or verification authority (DP1.0
 * forbidden list — pre-classified by the W036 `classifyLifecycleAuthority`
 * path and the pack-local BOQ/ledger write-intent classifier).
 *
 * Measurement bases, cost classes, verification kinds and outcome types are
 * construction-domain vocabularies that SPECIALIZE universal concepts
 * (quantity+unit lines, cost/resource schedules, verification gates,
 * distinction outcomes) — they never replace them.
 */

/** Version of the published construction-pack contract surface. */
export const CONSTRUCTION_PACK_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized construction-pack record. */
export const CONSTRUCTION_PACK_RECORD_VERSION = 1 as const;

/** The pack identity (qualified-name grammar, provider-neutral). */
export const CONSTRUCTION_PACK_ID = 'construction.core' as const;

/** The pack version (semver core). */
export const CONSTRUCTION_PACK_VERSION = '1.0.0' as const;

/**
 * The universal lifecycle version this pack targets — MUST equal the
 * `SOLUTION_DELIVERY_USL_VERSION` taught by the W036 kernel (checked by the
 * W036 admit path and pinned by the runtime parity test).
 */
export const CONSTRUCTION_SUPPORTED_LIFECYCLE_VERSION = '1.0.0' as const;

// --------------------------------------------------------------------------------
// Schema discriminators (the sealed-envelope discipline: a literal `schema`
// names the record family so mixed envelopes cannot be confused).
// --------------------------------------------------------------------------------

export const ENTITY_BINDING_SCHEMA_NAME = 'epoch.pack-construction.entity-binding' as const;
export const MEASUREMENT_METHOD_SCHEMA_NAME =
  'epoch.pack-construction.measurement-method' as const;
export const COST_CLASSIFICATION_SCHEMA_NAME =
  'epoch.pack-construction.cost-classification' as const;
export const VERIFICATION_METHOD_SCHEMA_NAME =
  'epoch.pack-construction.verification-method' as const;
export const CONSTRAINT_DESCRIPTOR_SCHEMA_NAME =
  'epoch.pack-construction.constraint-descriptor' as const;
export const OUTCOME_TYPE_SCHEMA_NAME = 'epoch.pack-construction.outcome-type' as const;
export const WORK_TEMPLATE_SCHEMA_NAME = 'epoch.pack-construction.work-template' as const;
export const VOCABULARY_BUNDLE_SCHEMA_NAME = 'epoch.pack-construction.vocabulary-bundle' as const;
export const BOQ_VIEW_SCHEMA_NAME = 'epoch.pack-construction.boq-view' as const;
export const PROGRAMME_VIEW_SCHEMA_NAME = 'epoch.pack-construction.programme-view' as const;
export const DELIVERY_LINKS_SCHEMA_NAME = 'epoch.pack-construction.delivery-links' as const;
export const OUTCOME_VIEW_SCHEMA_NAME = 'epoch.pack-construction.outcome-view' as const;

// --------------------------------------------------------------------------------
// Construction concepts (World Model entity bindings).
// --------------------------------------------------------------------------------

/**
 * The construction concepts a World Model entity kind may bind to
 * (DP1.0 "entity/relationship extensions"): element, space, system, zone.
 * Descriptive bindings onto W002 entity-type keys — never new authorities.
 */
export const CONSTRUCTION_CONCEPTS = ['element', 'space', 'system', 'zone'] as const;

/** One construction concept. */
export type ConstructionConcept = (typeof CONSTRUCTION_CONCEPTS)[number];

/** Display terms for the construction concepts (BOQ section titles). */
export const CONSTRUCTION_CONCEPT_TERMS = {
  element: 'Building elements',
  space: 'Spaces',
  system: 'Technical systems',
  zone: 'Zones',
} as const;

// --------------------------------------------------------------------------------
// Measurement vocabulary.
// --------------------------------------------------------------------------------

/** The quantity-measurement bases (DP1.0 "units and measurement methods"). */
export const MEASUREMENT_BASES = ['length', 'area', 'volume', 'count', 'mass'] as const;

/** One measurement base. */
export type MeasurementBase = (typeof MEASUREMENT_BASES)[number];

/** The net/gross rule kinds carried by a measurement method. */
export const NET_GROSS_RULE_KINDS = ['net', 'gross'] as const;

/** One net/gross rule kind. */
export type NetGrossRuleKind = (typeof NET_GROSS_RULE_KINDS)[number];

// --------------------------------------------------------------------------------
// Cost/resource vocabulary.
// --------------------------------------------------------------------------------

/**
 * The construction resource classes (DP1.0 "cost/resource classifications")
 * applied as folds over the W036 CostSchedule/ResourceSchedule.
 */
export const CONSTRUCTION_RESOURCE_CLASSES = [
  'labour',
  'plant',
  'material',
  'subcontract',
  'overhead',
] as const;

/** One construction resource class. */
export type ConstructionResourceClass = (typeof CONSTRUCTION_RESOURCE_CLASSES)[number];

// --------------------------------------------------------------------------------
// Verification vocabulary.
// --------------------------------------------------------------------------------

/**
 * The construction verification-method kinds (DP1.0 "verification
 * methods"): inspection, measurement-against-BOQ, material certificate,
 * commissioning test. Descriptors referencing the W006 evidence/provenance
 * conventions — the verification AUTHORITY is never re-implemented here.
 */
export const CONSTRUCTION_VERIFICATION_KINDS = [
  'inspection',
  'measurement-against-boq',
  'material-certificate',
  'commissioning-test',
] as const;

/** One construction verification-method kind. */
export type ConstructionVerificationKind = (typeof CONSTRUCTION_VERIFICATION_KINDS)[number];

// --------------------------------------------------------------------------------
// Constraint vocabulary.
// --------------------------------------------------------------------------------

/**
 * The construction constraint categories (DP1.0 "constraints"): the
 * classification dimension of the constraint descriptor vocabulary —
 * entries are data compatible with the W004 policy-contract shapes; the
 * Constraint Engine remains the authority.
 */
export const CONSTRUCTION_CONSTRAINT_CATEGORIES = [
  'safety',
  'regulatory',
  'technical',
  'environmental',
  'commercial',
] as const;

/** One construction constraint category. */
export type ConstructionConstraintCategory = (typeof CONSTRUCTION_CONSTRAINT_CATEGORIES)[number];

// --------------------------------------------------------------------------------
// Presentation vocabularies (pure display terms over universal states).
// --------------------------------------------------------------------------------

/**
 * Construction display terms for the universal milestone statuses
 * (presentation vocabulary only — the statuses stay the W036 values).
 */
export const MILESTONE_STATUS_TERMS = {
  planned: 'Programmed',
  reached: 'Achieved',
  missed: 'Missed',
} as const;

/** Construction display terms for the realization variants this pack renders. */
export const REALIZATION_VARIANT_TERMS = {
  'construction-build': 'Construction',
} as const;

/** The fallback BOQ section concept for plan lines without a world-entity binding. */
export const BOQ_PRELIMINARIES_SECTION_CODE = 'sec-preliminaries' as const;

// --------------------------------------------------------------------------------
// Write-intent pre-classification blocklists (the DP1.0 forbidden-list
// pattern, specialized for BOQ/ledger discipline): a record that carries one
// of these fields is attempting to store or mutate BOQ/parallel-ledger state
// through the pack — a typed `boq-direct-write-rejected` /
// `parallel-ledger-rejected` BEFORE schema validation surfaces it.
// --------------------------------------------------------------------------------

/**
 * BOQ stored-state/write-intent field names: a pack record carrying one of
 * these claims a stored BOQ or a direct write path into BOQ state — the BOQ
 * is a PROJECTION recomputed on every call, never a stored parallel ledger.
 */
export const FORBIDDEN_BOQ_WRITE_FIELDS = [
  'boqLedger',
  'storedBoq',
  'boqStore',
  'boqWrite',
  'writeBoq',
  'appendBoqLine',
  'amendBoqLine',
  'removeBoqLine',
  'boqMutations',
  'boqRevision',
] as const;

/** One forbidden BOQ write-intent field name. */
export type ForbiddenBoqWriteField = (typeof FORBIDDEN_BOQ_WRITE_FIELDS)[number];

/**
 * Parallel-ledger field names: a pack record carrying one of these claims a
 * second quantity/cost/delivery ledger beside the W036 sealed state — a
 * pack NEVER keeps a parallel ledger (DP1.0 forbidden list).
 */
export const FORBIDDEN_PARALLEL_LEDGER_FIELDS = [
  'parallelLedger',
  'quantityLedger',
  'costLedger',
  'deliveryLedger',
  'actualLedger',
  'ledgerStore',
  'ledgerEntries',
] as const;

/** One forbidden parallel-ledger field name. */
export type ForbiddenParallelLedgerField = (typeof FORBIDDEN_PARALLEL_LEDGER_FIELDS)[number];

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
