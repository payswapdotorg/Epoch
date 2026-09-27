/**
 * Variance contract versions and the closed vocabularies (W039).
 *
 * The variance kernel explains PREDICTED-VS-ACTUAL deviations (USL1.0:
 * prediction/baseline/commitment/actual/forecast are lifecycle-first
 * concepts; "Forecasts never overwrite historical predictions, baselines
 * or actuals"). Every record references its compared lines by OPAQUE
 * exact-revision typed references — never embedded copies, never a
 * runtime edge to the actualization or solution-delivery kernels.
 *
 * Every vocabulary below is CLOSED (a typed union, never an open string)
 * and provider-neutral: no entry names a vendor, brand, marketplace,
 * ERP, PM tool, or API surface (architecture lock rule 13).
 *
 * Versioning policy (mirrors @epoch/solution-delivery): a serialized
 * variance record is admitted only when its `schemaVersion` equals
 * {@link VARIANCE_RECORD_VERSION} exactly; skew surfaces as a
 * `validation` issue at path ["schemaVersion"]. {@link
 * VARIANCE_CONTRACT_VERSION} versions the published contract surface
 * (schemas/ + the typed index export). The W039 owned surfaces include
 * NO contracts/variance tree — the in-package schema surface under
 * packages/variance/schemas is this kernel's published contract.
 */

/** Version of the published variance contract surface (schemas/ + types). */
export const VARIANCE_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized variance record. */
export const VARIANCE_RECORD_VERSION = 1 as const;

// --------------------------------------------------------------------------------
// The variance class set (the W039 pin: quantity, price/rate,
// productivity, schedule, waste, rework, change, external-condition).
// --------------------------------------------------------------------------------

/**
 * The CLOSED variance class vocabulary — the full class set, each
 * comparing a baseline/commitment/forecast line to actualized values:
 * - `quantity` — actual quantity vs the planned/committed quantity;
 * - `price-rate` — actual unit price/rate vs the planned/committed rate;
 * - `productivity` — actual output-per-input vs the planned productivity;
 * - `schedule` — actual dates/durations vs the baseline schedule;
 * - `waste` — material/consumption loss vs the planned allowance;
 * - `rework` — redo volume vs the planned zero-rework assumption;
 * - `change` — scope/quantity deltas introduced by change records;
 * - `external-condition` — deviation caused by conditions outside the
 *   plan (weather, market, regulation).
 */
export const VARIANCE_CLASSES = [
  'quantity',
  'price-rate',
  'productivity',
  'schedule',
  'waste',
  'rework',
  'change',
  'external-condition',
] as const;

/** One variance class. */
export type VarianceClass = (typeof VARIANCE_CLASSES)[number];

/**
 * The polarity table mapping each variance class to its favorable
 * direction over the signed delta (actual - baseline):
 * - `higher-is-favorable` — a positive delta is favorable (quantity
 *   delivered, productivity);
 * - `lower-is-favorable` — a negative delta is favorable (price/rate,
 *   schedule dates, waste, rework, external-condition cost impact);
 * - `change` is DIRECTION-NEUTRAL: a change-record deviation is neither
 *   favorable nor adverse by itself — the direction is always `neutral`
 *   and the magnitude carries the introduced delta.
 */
export const VARIANCE_CLASS_POLARITY: Readonly<
  Record<VarianceClass, 'higher-is-favorable' | 'lower-is-favorable' | 'direction-neutral'>
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

// --------------------------------------------------------------------------------
// Directions + magnitude bands.
// --------------------------------------------------------------------------------

/**
 * The direction vocabulary of one variance: whether the actualized value
 * deviated favorably, adversely, or neutrally from the compared line
 * (deterministic under the class polarity table).
 */
export const VARIANCE_DIRECTIONS = ['favorable', 'adverse', 'neutral'] as const;

/** One variance direction. */
export type VarianceDirection = (typeof VARIANCE_DIRECTIONS)[number];

/**
 * The magnitude band vocabulary of one variance: `immaterial` when the
 * deviation is zero, `minor`/`material`/`severe` by comparison against
 * the caller-supplied band thresholds (typed thresholds in the
 * computation input; never implicit defaults).
 */
export const VARIANCE_MAGNITUDE_BANDS = ['immaterial', 'minor', 'material', 'severe'] as const;

/** One variance magnitude band. */
export type VarianceMagnitudeBand = (typeof VARIANCE_MAGNITUDE_BANDS)[number];

// --------------------------------------------------------------------------------
// Attribution (root cause with evidence).
// --------------------------------------------------------------------------------

/**
 * The root-cause kinds a variance attribution may link to (the W039
 * pin): a change record (W038 change), a W038 issue record
 * (change/delay/rework/defect/blocker), or an external condition.
 * Cause references are OPAQUE typed record ids — never embedded
 * objects.
 */
export const ATTRIBUTION_CAUSE_KINDS = ['change-record', 'issue-record', 'external-condition'] as const;

/** One attribution cause kind. */
export type AttributionCauseKind = (typeof ATTRIBUTION_CAUSE_KINDS)[number];

// --------------------------------------------------------------------------------
// Historical prediction comparison.
// --------------------------------------------------------------------------------

/**
 * The comparison kinds of the immutable historical prediction
 * comparison:
 * - `forecast-revision` — one forecast revision compared to the earlier
 *   forecast revision it refined;
 * - `forecast-to-actual` — a past forecast compared to the eventual
 *   actualized outcome.
 */
export const COMPARISON_KINDS = ['forecast-revision', 'forecast-to-actual'] as const;

/** One comparison kind. */
export type ComparisonKind = (typeof COMPARISON_KINDS)[number];

/**
 * The band of one historical comparison deviation: `exact` (zero
 * deviation), `within-tolerance`, or `outside-tolerance` against the
 * caller-supplied tolerance decimal.
 */
export const COMPARISON_BANDS = ['exact', 'within-tolerance', 'outside-tolerance'] as const;

/** One comparison band. */
export type ComparisonBand = (typeof COMPARISON_BANDS)[number];

/**
 * The compared-line kinds: the lifecycle-first record kinds a variance
 * or comparison may reference on the BASELINE side (prediction,
 * baseline, commitment, forecast) and the ACTUAL side (actual). Opaque
 * exact-revision references — the W037 commitment-reference discipline.
 */
export const COMPARED_LINE_KINDS = [
  'prediction',
  'baseline',
  'commitment',
  'forecast',
  'actual',
] as const;

/** One compared-line kind. */
export type ComparedLineKind = (typeof COMPARED_LINE_KINDS)[number];

// --------------------------------------------------------------------------------
// Schema discriminators (the W011/W023 sealed-envelope discipline).
// --------------------------------------------------------------------------------

/** Schema discriminator of the variance-record family. */
export const VARIANCE_RECORD_SCHEMA_NAME = 'epoch.variance.variance-record' as const;

/** Schema discriminator of the attribution-record family. */
export const ATTRIBUTION_RECORD_SCHEMA_NAME = 'epoch.variance.attribution-record' as const;

/** Schema discriminator of the prediction-comparison family. */
export const PREDICTION_COMPARISON_SCHEMA_NAME = 'epoch.variance.prediction-comparison' as const;

// --------------------------------------------------------------------------------
// Opaque, kind-prefixed identity grammars (the W002/W009/W010/W023 house
// pattern). The segment before `:` is the record kind; the slug is a
// lowercase kebab of length <= 63.
// --------------------------------------------------------------------------------

/** Variance-record identity: `variance:<slug>`. */
export const VARIANCE_ID_PATTERN = /^variance:[a-z0-9][a-z0-9-]{0,62}$/;

/** Attribution-record identity: `attribution:<slug>`. */
export const ATTRIBUTION_ID_PATTERN = /^attribution:[a-z0-9][a-z0-9-]{0,62}$/;

/** Prediction-comparison identity: `comparison:<slug>`. */
export const COMPARISON_ID_PATTERN = /^comparison:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Acting principal grammar — MIRRORED from @epoch/event-log's
 * EVENT_ACTOR_PATTERN (the W009 identity grammar; runtime parity test
 * pins the pattern). Identity is NOT a runtime dependency.
 */
export const VARIANCE_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/** The per-kind record-id grammar of one compared line (the W036 distinction id grammar). */
export const COMPARED_LINE_ID_PATTERNS: Readonly<Record<ComparedLineKind, RegExp>> = {
  prediction: /^prediction:[a-z0-9][a-z0-9-]{0,62}$/,
  baseline: /^baseline:[a-z0-9][a-z0-9-]{0,62}$/,
  commitment: /^commitment:[a-z0-9][a-z0-9-]{0,62}$/,
  forecast: /^forecast:[a-z0-9][a-z0-9-]{0,62}$/,
  actual: /^actual:[a-z0-9][a-z0-9-]{0,62}$/,
};

/** The kind prefix of a variance opaque id (the segment before `:`). */
export function kindPrefixOf(id: string): string {
  const separator = id.indexOf(':');
  return separator === -1 ? '' : id.slice(0, separator);
}
