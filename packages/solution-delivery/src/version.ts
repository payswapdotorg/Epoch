/**
 * Solution Delivery contract versions and the closed vocabularies (W036).
 *
 * spec/universal-solution-lifecycle.md (USL1.0, binding): the universal
 * lifecycle is `Understand -> Decide -> Plan -> Acquire -> Realize ->
 * Observe -> Actualize -> Verify -> Forecast -> Close -> Learn` — eleven
 * STAGES that are projections over the canonical semantic model; they may
 * branch, pause, resume, loop and overlap as TYPED RELATIONS, never a
 * strict linear FSM. The nine SEMANTIC DISTINCTIONS (Prediction, Estimate,
 * Baseline, Commitment, Observation, Actual, Forecast, Outcome, Learning
 * Record) are separate concepts; no domain pack may collapse them into one
 * mutable value (DP1.0 forbidden list).
 *
 * Every vocabulary below is CLOSED (a typed union, never an open string) and
 * provider-neutral: no entry names a vendor, brand, marketplace, ERP, PM
 * tool, or API surface. Procurement is ONE acquisition variant; construction
 * execution is ONE realization variant — domain projections, never the
 * universal authority.
 *
 * Versioning policy (v1, mirrors @epoch/marketplace / @epoch/tenancy): a
 * serialized solution-delivery record is admitted only when its
 * `schemaVersion` equals {@link SOLUTION_DELIVERY_RECORD_VERSION} exactly;
 * skew surfaces as a `validation` issue at path ["schemaVersion"] before
 * other schema diagnostics. {@link SOLUTION_DELIVERY_CONTRACT_VERSION}
 * versions the published contract surface (schemas/ + the typed index
 * export). {@link SOLUTION_DELIVERY_USL_VERSION} is the universal lifecycle
 * version this implementation teaches — a domain pack profile must declare
 * exactly this version (DP1.0 acceptance checklist item 1).
 */

/** Version of the published solution-delivery contract surface (schemas/ + types). */
export const SOLUTION_DELIVERY_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized solution-delivery record. */
export const SOLUTION_DELIVERY_RECORD_VERSION = 1 as const;

/** The universal solution lifecycle version taught by this kernel (USL1.0). */
export const SOLUTION_DELIVERY_USL_VERSION = '1.0.0' as const;

/**
 * The eleven universal lifecycle stages (USL1.0, binding). The order is the
 * canonical presentation order (the Navigator spine), NOT an enforced
 * sequence — stages branch/pause/resume/loop/overlap through typed
 * relations (src/lifecycle.ts). Domain packs bind display vocabulary onto
 * these stages; they never add, rename, or remove stages.
 */
export const UNIVERSAL_LIFECYCLE_STAGES = [
  'understand',
  'decide',
  'plan',
  'acquire',
  'realize',
  'observe',
  'actualize',
  'verify',
  'forecast',
  'close',
  'learn',
] as const;

/** One universal lifecycle stage. */
export type UniversalLifecycleStage = (typeof UNIVERSAL_LIFECYCLE_STAGES)[number];

/** Canonical ordinal of a universal stage (presentation order, not FSM order). */
export function stageOrdinal(stage: UniversalLifecycleStage): number {
  return UNIVERSAL_LIFECYCLE_STAGES.indexOf(stage);
}

/**
 * The typed lifecycle TRANSITION relations (USL1.0: "they may branch, pause,
 * resume, loop and overlap"). These are typed relations between stage
 * records — never an FSM arc table:
 * - `precedes` — forward flow between different stages (may overlap in time);
 * - `branch` — an alternative path from a stage record;
 * - `overlap` — concurrent stages (both records active);
 * - `loop` — re-entry: backward or same-stage repetition;
 * - `pause` — a self-relation parking an active stage record;
 * - `resume` — a self-relation resuming a paused stage record.
 */
export const LIFECYCLE_TRANSITION_RELATIONS = [
  'precedes',
  'branch',
  'overlap',
  'loop',
  'pause',
  'resume',
] as const;

/** One typed lifecycle transition relation. */
export type LifecycleTransitionRelation = (typeof LIFECYCLE_TRANSITION_RELATIONS)[number];

/**
 * The nine semantic-distinction record kinds (USL1.0, binding): Prediction,
 * Estimate, Baseline, Commitment, Observation, Actual, Forecast, Outcome,
 * Learning Record. SEPARATE immutable record types — a record id belongs to
 * exactly ONE kind for its lifetime (collapsing them into one mutable value
 * is a typed `distinction-collapse-rejected`).
 */
export const SEMANTIC_DISTINCTION_KINDS = [
  'prediction',
  'estimate',
  'baseline',
  'commitment',
  'observation',
  'actual',
  'forecast',
  'outcome',
  'learning',
] as const;

/** One semantic-distinction record kind. */
export type SemanticDistinctionKind = (typeof SEMANTIC_DISTINCTION_KINDS)[number];

/**
 * The CLOSED acquisition-variant catalog (USL1.0, binding): external
 * procurement, internal allocation, subscription/license acquisition,
 * cloud/service provisioning, fabrication request, specialist capability
 * assignment, data/evidence acquisition. Procurement is a domain-specific
 * acquisition projection, NOT the universal authority — it is one entry in
 * a provider-neutral catalog.
 */
export const ACQUISITION_VARIANTS = [
  'external-procurement',
  'internal-allocation',
  'subscription-license',
  'cloud-service-provisioning',
  'fabrication-request',
  'specialist-capability-assignment',
  'data-evidence-acquisition',
] as const;

/** One acquisition variant. */
export type AcquisitionVariant = (typeof ACQUISITION_VARIANTS)[number];

/**
 * The CLOSED realization-variant catalog (USL1.0, binding): construction
 * build, software implementation/deployment, mechanical
 * fabrication/assembly, electrical installation/commissioning,
 * manufacturing, infrastructure provisioning, field service/repair.
 * Construction execution is one entry — the universal semantic concept is
 * Realization.
 */
export const REALIZATION_VARIANTS = [
  'construction-build',
  'software-implementation-deployment',
  'mechanical-fabrication-assembly',
  'electrical-installation-commissioning',
  'manufacturing',
  'infrastructure-provisioning',
  'field-service-repair',
] as const;

/** One realization variant. */
export type RealizationVariant = (typeof REALIZATION_VARIANTS)[number];

/**
 * Provenance vocabulary carried on every delivery fact: where the fact
 * came from. `unknown` is a first-class value — the decision-sufficiency
 * rule (USL1.0) preserves uncertainty with provenance instead of
 * fabricating completeness.
 */
export const PROVENANCE_KINDS = [
  'observed',
  'reported',
  'derived',
  'assumed',
  'imported',
  'unknown',
] as const;

/** One provenance kind. */
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

/**
 * Freshness vocabulary carried on every delivery fact: how current the
 * fact's assessment is. Freshness is a STATE plus an assessed-at instant
 * (producer-supplied — this package never reads a clock).
 */
export const FRESHNESS_STATES = ['fresh', 'aging', 'stale', 'unknown'] as const;

/** One freshness state kind (the freshness vocabulary member). */
export type FreshnessStateKind = (typeof FRESHNESS_STATES)[number];

/**
 * Confidence acquisition methods — MIRRORED from the W006/W002
 * CONFIDENCE_METHODS vocabulary (stated/measured/estimated/derived/
 * imported) so delivery confidence states are evidence-shaped. Pinned by
 * the runtime parity test; never a runtime dependency on @epoch/evidence.
 */
export const CONFIDENCE_METHODS = [
  'stated',
  'measured',
  'estimated',
  'derived',
  'imported',
] as const;

/** One confidence method. */
export type ConfidenceMethod = (typeof CONFIDENCE_METHODS)[number];

/**
 * Outcome-kind vocabulary for Outcome distinction records (USL1.0 Close:
 * completion, acceptance, unresolved residuals, handover, final state).
 */
export const OUTCOME_KINDS = [
  'delivered',
  'accepted',
  'handover',
  'residual',
  'rejected',
  'abandoned',
] as const;

/** One outcome kind. */
export type OutcomeKind = (typeof OUTCOME_KINDS)[number];

/**
 * The delivery lifecycle event vocabulary: discriminators in the
 * `delivery` payload namespace (the W010 open-namespace family owned by
 * this package). Every delivery-domain lifecycle fact projects onto one of
 * these event kinds over the W010 event shapes (src/events.ts).
 */
export const DELIVERY_EVENT_DISCRIMINATORS = [
  'delivery:stage-entered',
  'delivery:stage-transition',
  'delivery:baseline-approved',
  'delivery:baseline-revision',
  'delivery:observation-recorded',
  'delivery:observation-accepted',
  'delivery:observation-rejected',
  'delivery:observation-actualized',
  'delivery:acquisition-requested',
  'delivery:acquisition-fulfilled',
  'delivery:milestone-reached',
  'delivery:forecast-recorded',
  'delivery:outcome-recorded',
  'delivery:learning-recorded',
  'delivery:info-request-issued',
] as const;

/** One delivery event payload discriminator. */
export type DeliveryEventDiscriminator = (typeof DELIVERY_EVENT_DISCRIMINATORS)[number];

/**
 * The synchronized Solution Navigator projection kinds (SN1.0): World View,
 * Solution, Decision, ProgramOfWork, Schedule, Acquisition, Realization,
 * Verification, Forecast, Outcomes, Learning. A domain pack binds
 * presentation rules onto these projection kinds — it never adds a
 * twelfth authority-bearing projection.
 */
export const NAVIGATOR_PROJECTION_KINDS = [
  'world-view',
  'solution',
  'decision',
  'program-of-work',
  'schedule',
  'acquisition',
  'realization',
  'verification',
  'forecast',
  'outcomes',
  'learning',
] as const;

/** One Navigator projection kind. */
export type NavigatorProjectionKind = (typeof NAVIGATOR_PROJECTION_KINDS)[number];

/**
 * The DP1.0-forbidden authority-claim field names: a domain pack profile
 * (or any pack-style record) that declares one of these fields is claiming
 * a second lifecycle/baseline/schedule/delivery authority — a typed
 * `authority-violation-rejected` (classified BEFORE schema validation, the
 * marketplace pricing pre-classification pattern).
 */
export const FORBIDDEN_AUTHORITY_FIELDS = [
  'lifecycleAuthority',
  'baselineAuthority',
  'scheduleAuthority',
  'deliveryAuthority',
  'actualizationAuthority',
  'verificationAuthority',
  'worldAuthority',
  'semanticAuthority',
  'mutableActual',
  'mutableBaseline',
  'mutableForecast',
] as const;

/** One forbidden authority-claim field name. */
export type ForbiddenAuthorityField = (typeof FORBIDDEN_AUTHORITY_FIELDS)[number];

/**
 * Schema discriminator carried by every sealed solution-delivery record
 * family (the W011/W023 sealed-envelope discipline: a literal `schema`
 * names the record family so mixed envelopes cannot be confused at
 * admission).
 */
export const SOLUTION_VERSION_SCHEMA_NAME = 'epoch.solution-delivery.solution-version' as const;
export const PROGRAM_OF_WORK_SCHEMA_NAME = 'epoch.solution-delivery.program-of-work' as const;
export const DELIVERY_RECORD_SCHEMA_NAME = 'epoch.solution-delivery.delivery-record' as const;
export const DISTINCTION_RECORD_SCHEMA_NAME = 'epoch.solution-delivery.distinction-record' as const;
export const LIFECYCLE_STAGE_SCHEMA_NAME = 'epoch.solution-delivery.lifecycle-stage' as const;
export const LIFECYCLE_TRANSITION_SCHEMA_NAME =
  'epoch.solution-delivery.lifecycle-transition' as const;
export const ACQUISITION_REQUEST_SCHEMA_NAME =
  'epoch.solution-delivery.acquisition-request' as const;
export const INFO_REQUEST_SCHEMA_NAME = 'epoch.solution-delivery.info-request' as const;
export const EXTERNAL_REQUEST_SCHEMA_NAME = 'epoch.solution-delivery.external-request' as const;
export const EXTERNAL_EVENT_SCHEMA_NAME = 'epoch.solution-delivery.external-event' as const;
export const PACK_PROFILE_SCHEMA_NAME = 'epoch.solution-delivery.pack-profile' as const;
export const BASELINE_APPROVAL_SCHEMA_NAME = 'epoch.solution-delivery.baseline-approval' as const;

// --------------------------------------------------------------------------------
// Opaque, kind-prefixed identity grammars (the W002/W009/W010/W023 house
// pattern). The segment before `:` is the record kind; the slug is a
// lowercase kebab of length <= 63.
// --------------------------------------------------------------------------------

/** Solution package identity: `solution:<slug>` (stable across versions). */
export const SOLUTION_ID_PATTERN = /^solution:[a-z0-9][a-z0-9-]{0,62}$/;

/** Solution line identity: `line:<slug>` (a line item within a version). */
export const SOLUTION_LINE_ID_PATTERN = /^line:[a-z0-9][a-z0-9-]{0,62}$/;

/** Delivery record identity: `delivery:<slug>`. */
export const DELIVERY_ID_PATTERN = /^delivery:[a-z0-9][a-z0-9-]{0,62}$/;

/** Program of work identity: `program:<slug>`. */
export const PROGRAM_ID_PATTERN = /^program:[a-z0-9][a-z0-9-]{0,62}$/;

/** Work package identity: `work-package:<slug>`. */
export const WORK_PACKAGE_ID_PATTERN = /^work-package:[a-z0-9][a-z0-9-]{0,62}$/;

/** Activity identity: `activity:<slug>`. */
export const ACTIVITY_ID_PATTERN = /^activity:[a-z0-9][a-z0-9-]{0,62}$/;

/** Milestone identity: `milestone:<slug>`. */
export const MILESTONE_ID_PATTERN = /^milestone:[a-z0-9][a-z0-9-]{0,62}$/;

/** Distinction-record identity: `<kind>:<slug>` for each of the nine kinds. */
export const DISTINCTION_ID_PATTERN =
  /^(prediction|estimate|baseline|commitment|observation|actual|forecast|outcome|learning):[a-z0-9][a-z0-9-]{0,62}$/;

/** Lifecycle stage-record identity: `stage:<slug>`. */
export const STAGE_RECORD_ID_PATTERN = /^stage:[a-z0-9][a-z0-9-]{0,62}$/;

/** Lifecycle transition-record identity: `transition:<slug>`. */
export const TRANSITION_RECORD_ID_PATTERN = /^transition:[a-z0-9][a-z0-9-]{0,62}$/;

/** Acquisition request identity: `acquisition:<slug>`. */
export const ACQUISITION_ID_PATTERN = /^acquisition:[a-z0-9][a-z0-9-]{0,62}$/;

/** Information-acquisition request identity: `info-request:<slug>`. */
export const INFO_REQUEST_ID_PATTERN = /^info-request:[a-z0-9][a-z0-9-]{0,62}$/;

/** External request envelope identity: `external-request:<slug>`. */
export const EXTERNAL_REQUEST_ID_PATTERN = /^external-request:[a-z0-9][a-z0-9-]{0,62}$/;

/** External event envelope identity: `external-event:<slug>`. */
export const EXTERNAL_EVENT_ID_PATTERN = /^external-event:[a-z0-9][a-z0-9-]{0,62}$/;

/** Baseline approval record identity: `approval:<slug>`. */
export const BASELINE_APPROVAL_ID_PATTERN = /^approval:[a-z0-9][a-z0-9-]{0,62}$/;

/** Verification gate identity: `gate:<slug>`. */
export const GATE_ID_PATTERN = /^gate:[a-z0-9][a-z0-9-]{0,62}$/;

/** Blocker record identity: `blocker:<slug>`. */
export const BLOCKER_ID_PATTERN = /^blocker:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Acting principal grammar — MIRRORED from @epoch/event-log's
 * EVENT_ACTOR_PATTERN (the W009 identity grammar; runtime parity test pins
 * the constants pattern-identical). Identity is NOT a runtime dependency.
 */
export const DELIVERY_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Delivery event stream identity — MIRRORED from @epoch/event-log's
 * EVENT_STREAM_ID_PATTERN (W010 grammar): `stream:<slug>`. One delivery's
 * lifecycle events form one stream; pinned by the runtime parity test.
 */
export const DELIVERY_STREAM_ID_PATTERN = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Version discriminator carried by every serialized delivery event —
 * MIRRORED from @epoch/event-log's EVENT_LOG_RECORD_VERSION (delivery
 * events are append-only typed events over the W010 event shapes). The
 * runtime parity test asserts the constants are equal; a future W010 bump
 * intentionally breaks that parity and surfaces here as a review gate.
 */
export const DELIVERY_EVENT_RECORD_VERSION = 1 as const;

/** The kind prefix of a solution-delivery opaque id (the segment before `:`). */
export function kindPrefixOf(id: string): string {
  const separator = id.indexOf(':');
  return separator === -1 ? '' : id.slice(0, separator);
}

/** Derive the delivery event stream id of one delivery record (deterministic). */
export function deliveryStreamIdOf(deliveryId: string): string {
  const suffix = deliveryId.slice('delivery:'.length);
  return `stream:delivery-${suffix}`;
}
