/**
 * Learning-calibration contract versions and the closed vocabularies
 * (W040).
 *
 * spec/universal-solution-lifecycle.md (USL1.0, binding): the lifecycle
 * spine ends `... Forecast -> Close -> Learn` — LEARN turns validated
 * delivery outcomes into governed calibration records for future
 * prediction improvement, across domain packs (DP1.0 context by TYPED
 * REFERENCE, never domain-specific history stores) and universal
 * lifecycle realization variants (the W036 closed catalog).
 *
 * Composition policy (the W036/W037/W038/W039 precedent): the W036
 * grammars (measures, subjects, realization variants, outcome kinds,
 * pack ids, record ids, timestamps) are composed at RUNTIME from
 * @epoch/solution-delivery — genuine dependencies, the same objects.
 * The W039 comparison-fact and variance vocabularies arrive as OPAQUE
 * typed mirrors pinned by compile-time kernel parity
 * (src/kernel-parity.ts) and runtime parity tests (test/parity.test.ts)
 * — @epoch/actualization and @epoch/variance are devDependencies only,
 * never runtime edges (the W037 kernel-parity pattern).
 *
 * Every vocabulary below is CLOSED (a typed union, never an open
 * string) and provider-neutral: no entry names a vendor, brand,
 * marketplace, ERP, PM tool, or API surface (architecture lock rule
 * 13). There is NO ML runtime and NO model training here — calibration
 * is deterministic folds over sealed records.
 *
 * Versioning policy (mirrors @epoch/solution-delivery and
 * @epoch/actualization): a serialized learning-calibration record is
 * admitted only when its `schemaVersion` equals
 * {@link LEARNING_CALIBRATION_RECORD_VERSION} exactly; skew surfaces as
 * a `validation` issue at path ["schemaVersion"] before other schema
 * diagnostics. {@link LEARNING_CALIBRATION_CONTRACT_VERSION} versions
 * the published contract surface (schemas/ + the typed index export +
 * contracts/learning-calibration).
 */

/** Version of the published learning-calibration contract surface (schemas/ + types). */
export const LEARNING_CALIBRATION_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized learning-calibration record. */
export const LEARNING_CALIBRATION_RECORD_VERSION = 1 as const;

/**
 * Version discriminator carried by every serialized learning event —
 * MIRRORED from @epoch/event-log's EVENT_LOG_RECORD_VERSION (learning
 * events are append-only typed events over the W010 event shapes, the
 * open `learning:` payload namespace). The runtime parity test asserts
 * the constants are equal; a future W010 bump intentionally breaks that
 * parity and surfaces here as a review gate.
 */
export const LEARNING_EVENT_RECORD_VERSION = 1 as const;

/**
 * Version of the ELIGIBILITY RULESET the dataset fold applies — pinned
 * into every dataset's assembly policy so a dataset is reproducible by
 * construction (the exact ruleset version is part of the sealed
 * content, not an implicit ambient default).
 */
export const LEARNING_ELIGIBILITY_RULESET_VERSION = 1 as const;

/**
 * Version of the METRIC SPEC the calibration metric folds apply —
 * pinned into every metric set's fold definition (the exact fold
 * definition carries this version; identical inputs + identical spec
 * version derive identical metric digests).
 */
export const LEARNING_METRIC_SPEC_VERSION = 1 as const;

// --------------------------------------------------------------------------------
// Record-id grammars (kind-prefixed opaque slugs — the W036 grammar).
// --------------------------------------------------------------------------------

/** Learning-dataset record identity: `dataset:<slug>`. */
export const LEARNING_DATASET_ID_PATTERN = /^dataset:[a-z0-9][a-z0-9-]{0,62}$/;

/** Dataset-row record identity: `row:<slug>`. */
export const LEARNING_ROW_ID_PATTERN = /^row:[a-z0-9][a-z0-9-]{0,62}$/;

/** Exclusion-record identity: `exclusion:<slug>`. */
export const LEARNING_EXCLUSION_ID_PATTERN = /^exclusion:[a-z0-9][a-z0-9-]{0,62}$/;

/** Calibration-metric-set record identity: `metrics:<slug>`. */
export const LEARNING_METRIC_ID_PATTERN = /^metrics:[a-z0-9][a-z0-9-]{0,62}$/;

/** Model registry identity: `model:<slug>`. */
export const LEARNING_MODEL_ID_PATTERN = /^model:[a-z0-9][a-z0-9-]{0,62}$/;

/** Model-revision record identity: `model-revision:<slug>`. */
export const LEARNING_REVISION_ID_PATTERN = /^model-revision:[a-z0-9][a-z0-9-]{0,62}$/;

/** Model-revision-proposal record identity: `proposal:<slug>`. */
export const LEARNING_PROPOSAL_ID_PATTERN = /^proposal:[a-z0-9][a-z0-9-]{0,62}$/;

/** Outcome-learning candidate record identity: `candidate:<slug>`. */
export const LEARNING_CANDIDATE_ID_PATTERN = /^candidate:[a-z0-9][a-z0-9-]{0,62}$/;

/** Learning event-stream identity: `stream:learning-<slug>` (one stream per solution scope). */
export const LEARNING_STREAM_ID_PATTERN = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;

/** The event-actor/principal grammar — MIRRORED from @epoch/event-log (the W009 grammar). */
export const LEARNING_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/** The W039 observation-group validation states (opaque mirror — kernel parity). */
export const LEARNING_VALIDATION_STATES = [
  'insufficient',
  'corroborated',
  'conflicting',
  'resolved',
] as const;

/** One mirrored W039 validation state. */
export type LearningValidationState = (typeof LEARNING_VALIDATION_STATES)[number];

/** The W039 forecast-bias directions (opaque mirror — kernel parity). */
export const LEARNING_FORECAST_BIAS_DIRECTIONS = [
  'over-forecast',
  'under-forecast',
  'exact',
] as const;

/** One mirrored W039 forecast-bias direction. */
export type LearningForecastBiasDirection = (typeof LEARNING_FORECAST_BIAS_DIRECTIONS)[number];

// --------------------------------------------------------------------------------
// Eligibility (the W040 pin: "data eligibility states" + "exclusion of
// unresolved/unvalidated observations").
// --------------------------------------------------------------------------------

/**
 * The typed ELIGIBILITY STATES of one outcome-learning candidate:
 * - `eligible` — the comparison fact folds a VALIDATED actual (its
 *   observation group is corroborated or resolved) and the outcome
 *   record is ACCEPTED (delivered / accepted / handover): the row
 *   enters the dataset;
 * - `excluded-unvalidated` — an axis never validated: the observation
 *   group is INSUFFICIENT (below quorum — no validated actual) or the
 *   outcome kind was never accepted (rejected / abandoned);
 * - `excluded-unresolved` — an axis is still unresolved: the
 *   observation group is CONFLICTING (awaiting a conflict resolution)
 *   or the outcome carries unresolved RESIDUALS;
 * - `excluded-foreign-tenant` — a component of the row (the embedded
 *   comparison fact or outcome record) belongs to a tenant other than
 *   the dataset scope (R12). The fold excludes the row with a typed
 *   record; a candidate whose OWN scope is foreign is rejected harder —
 *   `tenant-isolation-rejected` at admission.
 *
 * State precedence when several axes fail at once (documented, deterministic):
 * foreign-tenant > unvalidated > unresolved.
 */
export const LEARNING_ELIGIBILITY_STATES = [
  'eligible',
  'excluded-unvalidated',
  'excluded-unresolved',
  'excluded-foreign-tenant',
] as const;

/** One typed learning-eligibility state. */
export type LearningEligibilityState = (typeof LEARNING_ELIGIBILITY_STATES)[number];

/** The three EXCLUSION states (the eligibility states minus `eligible`). */
export const LEARNING_EXCLUSION_STATES = [
  'excluded-unvalidated',
  'excluded-unresolved',
  'excluded-foreign-tenant',
] as const;

/** One typed exclusion state. */
export type LearningExclusionState = (typeof LEARNING_EXCLUSION_STATES)[number];

/**
 * The closed exclusion-reason vocabulary — every reason an eligibility
 * evaluation may record on a typed exclusion record (never a silent
 * drop):
 * - `tenant-mismatch` — an embedded component belongs to another tenant;
 * - `outcome-kind-unaccepted` — the outcome kind is `rejected` or
 *   `abandoned` (the outcome was never accepted);
 * - `outcome-kind-residual` — the outcome kind is `residual`
 *   (unresolved residuals remain);
 * - `observation-group-insufficient` — the observation group backing
 *   the actual is below the corroboration quorum (no validated actual);
 * - `observation-group-conflicting` — the observation group is still
 *   conflicting (the comparison fact judges an unresolved group).
 */
export const LEARNING_EXCLUSION_REASONS = [
  'tenant-mismatch',
  'outcome-kind-unaccepted',
  'outcome-kind-residual',
  'observation-group-insufficient',
  'observation-group-conflicting',
] as const;

/** One exclusion reason. */
export type LearningExclusionReason = (typeof LEARNING_EXCLUSION_REASONS)[number];

/**
 * The W036 outcome kinds partitioned onto the eligibility axes (the
 * acceptance mapping of the W036 OUTCOME_KINDS closed catalog):
 * - VALIDATED (accepted terminal outcomes): delivered, accepted,
 *   handover;
 * - UNRESOLVED (recorded but with unresolved residuals): residual;
 * - UNVALIDATED (never accepted): rejected, abandoned.
 */
export const VALIDATED_OUTCOME_KINDS = ['delivered', 'accepted', 'handover'] as const;
export const UNRESOLVED_OUTCOME_KINDS = ['residual'] as const;
export const UNVALIDATED_OUTCOME_KINDS = ['rejected', 'abandoned'] as const;

/** The outcome-eligibility axis one W036 outcome kind maps onto. */
export type OutcomeEligibilityAxis = 'validated' | 'unresolved' | 'unvalidated';

/** The deterministic outcome-kind -> eligibility-axis mapping (DP-neutral, closed). */
export const OUTCOME_KIND_ELIGIBILITY: Readonly<
  Record<(typeof VALIDATED_OUTCOME_KINDS | typeof UNRESOLVED_OUTCOME_KINDS | typeof UNVALIDATED_OUTCOME_KINDS)[number], OutcomeEligibilityAxis>
> = {
  delivered: 'validated',
  accepted: 'validated',
  handover: 'validated',
  residual: 'unresolved',
  rejected: 'unvalidated',
  abandoned: 'unvalidated',
} as const;

/** The validation-state -> eligibility-axis mapping (the W039 states, mirrored). */
export const VALIDATION_STATE_ELIGIBILITY: Readonly<
  Record<LearningValidationState, OutcomeEligibilityAxis>
> = {
  insufficient: 'unvalidated',
  corroborated: 'validated',
  conflicting: 'unresolved',
  resolved: 'validated',
} as const;

// --------------------------------------------------------------------------------
// The W039 variance vocabularies (opaque mirrors — kernel parity with
// @epoch/variance; every grammar member-identical, pinned by tests).
// --------------------------------------------------------------------------------

/**
 * The CLOSED variance-class vocabulary — MIRRORED from
 * @epoch/variance's VARIANCE_CLASSES (the W039 pin): quantity,
 * price/rate, productivity, schedule, waste, rework, change,
 * external-condition.
 */
export const LEARNING_VARIANCE_CLASSES = [
  'quantity',
  'price-rate',
  'productivity',
  'schedule',
  'waste',
  'rework',
  'change',
  'external-condition',
] as const;

/** One mirrored variance class. */
export type LearningVarianceClass = (typeof LEARNING_VARIANCE_CLASSES)[number];

/**
 * The variance-direction vocabulary — MIRRORED from @epoch/variance's
 * VARIANCE_DIRECTIONS: whether the actualized value deviated favorably,
 * adversely, or neutrally from the compared line.
 */
export const LEARNING_VARIANCE_DIRECTIONS = ['favorable', 'adverse', 'neutral'] as const;

/** One mirrored variance direction. */
export type LearningVarianceDirection = (typeof LEARNING_VARIANCE_DIRECTIONS)[number];

/**
 * The magnitude-band vocabulary — MIRRORED from @epoch/variance's
 * VARIANCE_MAGNITUDE_BANDS: immaterial (zero deviation), then
 * minor/material/severe by comparison against caller-supplied band
 * thresholds (typed thresholds in the assembly policy; never implicit
 * defaults).
 */
export const LEARNING_VARIANCE_MAGNITUDE_BANDS = [
  'immaterial',
  'minor',
  'material',
  'severe',
] as const;

/** One mirrored magnitude band. */
export type LearningVarianceMagnitudeBand = (typeof LEARNING_VARIANCE_MAGNITUDE_BANDS)[number];

/**
 * The class-polarity table — MIRRORED from @epoch/variance's
 * VARIANCE_CLASS_POLARITY: which direction of deviation is favorable
 * per class. `change` is direction-neutral (the magnitude carries the
 * introduced delta).
 */
export const LEARNING_VARIANCE_CLASS_POLARITY: Readonly<
  Record<LearningVarianceClass, 'higher-is-favorable' | 'lower-is-favorable' | 'direction-neutral'>
> = {
  quantity: 'higher-is-favorable',
  'price-rate': 'lower-is-favorable',
  productivity: 'higher-is-favorable',
  schedule: 'lower-is-favorable',
  waste: 'lower-is-favorable',
  rework: 'lower-is-favorable',
  change: 'direction-neutral',
  'external-condition': 'lower-is-favorable',
} as const;

/**
 * The attribution cause kinds — MIRRORED from @epoch/variance's cause
 * grammar (change-record / issue-record / external-condition), plus the
 * learning-local `unattributed` member for rows whose comparison facts
 * carry no root-cause attribution.
 */
export const LEARNING_ATTRIBUTION_CAUSE_KINDS = [
  'change-record',
  'issue-record',
  'external-condition',
] as const;

/** One mirrored attribution cause kind. */
export type LearningAttributionCauseKind = (typeof LEARNING_ATTRIBUTION_CAUSE_KINDS)[number];

/** The learning-local attribution kind when no root-cause attribution exists. */
export const ATTRIBUTION_UNATTRIBUTED = 'unattributed' as const;

/**
 * The attribution-cause-kind FEATURE vocabulary — the mirrored W039
 * cause kinds plus the learning-local `unattributed` member (rows
 * whose comparisons carry no root-cause attribution).
 */
export const LEARNING_ATTRIBUTION_FEATURE_KINDS = [
  'change-record',
  'issue-record',
  'external-condition',
  'unattributed',
] as const;

/** One attribution-cause-kind feature value (mirrored kinds plus `unattributed`). */
export type LearningAttributionFeatureKind = (typeof LEARNING_ATTRIBUTION_FEATURE_KINDS)[number];

// --------------------------------------------------------------------------------
// Measure classes + metric vocabulary (the W005 evaluation grammar the
// calibration metrics reference).
// --------------------------------------------------------------------------------

/**
 * The measure-class vocabulary of dataset rows and model
 * applicability — the W036 measure kinds (quantity / cost / progress /
 * instant), composed grammar-identically.
 */
export const LEARNING_MEASURE_CLASSES = ['quantity', 'cost', 'progress', 'instant'] as const;

/** One measure class (the W036 measure kind). */
export type LearningMeasureClass = (typeof LEARNING_MEASURE_CLASSES)[number];

/**
 * The calibration-metric summary kinds every metric set folds (the
 * W005-evaluation-vocabulary-referencing metric set):
 * - `bias` — the signed net/mean deviation of the selected rows;
 * - `mean-absolute-error` — the MAE-class summary (exact total, exact
 *   mean, worst deviation with its row);
 * - `hit-rate` — the within-tolerance fraction per declared tolerance
 *   band (the W005 scored-scale discipline: bands are non-degenerate
 *   declared scales).
 */
export const LEARNING_METRIC_SUMMARY_KINDS = [
  'bias',
  'mean-absolute-error',
  'hit-rate',
] as const;

/** One calibration metric summary kind. */
export type LearningMetricSummaryKind = (typeof LEARNING_METRIC_SUMMARY_KINDS)[number];

/**
 * The justification kinds of a metric set — the W005
 * machine-referenceable-justification discipline (judgment without a
 * referenceable justification is inexpressible): every metric set
 * carries at least one justification entry naming the dataset, model,
 * fold definition, or observation it rests on.
 */
export const LEARNING_JUSTIFICATION_KINDS = [
  'dataset',
  'model',
  'fold-definition',
  'observation',
] as const;

/** One metric-set justification kind. */
export type LearningJustificationKind = (typeof LEARNING_JUSTIFICATION_KINDS)[number];

// --------------------------------------------------------------------------------
// The learning:* event vocabulary (W010 open payload namespace).
// --------------------------------------------------------------------------------

/**
 * The learning lifecycle event payload discriminators (the W010
 * open-namespace family owned by this package): dataset assembly,
 * metric folds, model-registry proposal/admission, the derived state
 * projection, the pack-view projection, dataset replay idempotence, and
 * record intake.
 */
export const LEARNING_EVENT_DISCRIMINATORS = [
  'learning:record-intaken',
  'learning:dataset-assembled',
  'learning:dataset-replayed',
  'learning:metrics-folded',
  'learning:revision-proposed',
  'learning:revision-admitted',
  'learning:state-projected',
  'learning:pack-view-projected',
] as const;

/** One learning event payload discriminator. */
export type LearningEventDiscriminator = (typeof LEARNING_EVENT_DISCRIMINATORS)[number];

// --------------------------------------------------------------------------------
// Schema names (the sealed-envelope discriminator literals).
// --------------------------------------------------------------------------------

export const CANDIDATE_SCHEMA_NAME = 'epoch.learning-calibration.candidate' as const;
export const EXCLUSION_RECORD_SCHEMA_NAME = 'epoch.learning-calibration.exclusion-record' as const;
export const DATASET_ROW_SCHEMA_NAME = 'epoch.learning-calibration.dataset-row' as const;
export const ERROR_VARIANCE_FEATURES_SCHEMA_NAME =
  'epoch.learning-calibration.error-variance-features' as const;
export const LEARNING_DATASET_SCHEMA_NAME = 'epoch.learning-calibration.dataset' as const;
export const CALIBRATION_METRIC_SET_SCHEMA_NAME =
  'epoch.learning-calibration.calibration-metric-set' as const;
export const MODEL_REVISION_SCHEMA_NAME = 'epoch.learning-calibration.model-revision' as const;
export const MODEL_REVISION_PROPOSAL_SCHEMA_NAME =
  'epoch.learning-calibration.model-revision-proposal' as const;
export const MIRRORED_COMPARISON_FACT_SCHEMA_NAME =
  'epoch.actualization.comparison-fact' as const;

// --------------------------------------------------------------------------------
// Deterministic id/slug derivations.
// --------------------------------------------------------------------------------

/** Slug-ify one scoped id (strip the kind prefix, sanitize to [a-z0-9-]). */
export function scopeSlug(id: string): string {
  const suffix = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
  return suffix.replace(/[^a-z0-9-]/g, '');
}

/**
 * Derive the learning event-stream id of one solution scope:
 * `stream:learning-<solution-slug>` (one stream per solution; the
 * W039 one-stream-per-delivery precedent adapted to the solution-scoped
 * learning host).
 */
export function learningStreamIdOf(solutionId: string): string {
  return `stream:learning-${scopeSlug(solutionId)}`;
}
