/**
 * Actualization contract versions and the closed vocabularies (W039).
 *
 * spec/universal-solution-lifecycle.md (USL1.0, binding): "Observe /
 * Actualize — capture what actually happened and reconcile it into
 * validated delivery state" and "Forecast — project remaining work and
 * expected completion/cost/performance using the latest validated
 * delivery state. Forecasts never overwrite historical predictions,
 * baselines or actuals." prediction/baseline/commitment/actual/forecast
 * are lifecycle-first concepts across ALL realization variants.
 *
 * Every vocabulary below is CLOSED (a typed union, never an open string)
 * and provider-neutral: no entry names a vendor, brand, marketplace, ERP,
 * PM tool, or API surface. Observation sources (W038 field systems, W037
 * supplier systems) stay behind the service-layer ObservationSourcePort
 * adapter seam; their records enter here as W036 Observation-distinction
 * records (the common spine both upstream kernels already produce).
 *
 * Versioning policy (mirrors @epoch/solution-delivery): a serialized
 * actualization record is admitted only when its `schemaVersion` equals
 * {@link ACTUALIZATION_RECORD_VERSION} exactly; skew surfaces as a
 * `validation` issue at path ["schemaVersion"]. {@link
 * ACTUALIZATION_CONTRACT_VERSION} versions the published contract
 * surface (schemas/ + the typed index export +
 * contracts/actualization).
 */

/** Version of the published actualization contract surface (schemas/ + types). */
export const ACTUALIZATION_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized actualization record. */
export const ACTUALIZATION_RECORD_VERSION = 1 as const;

/**
 * Version discriminator carried by every serialized actualization event —
 * MIRRORED from @epoch/event-log's EVENT_LOG_RECORD_VERSION
 * (actualization events are append-only typed events over the W010 event
 * shapes, the open `actualization:` payload namespace). The runtime
 * parity test asserts the constants are equal; a future W010 bump
 * intentionally breaks that parity and surfaces here as a review gate.
 */
export const ACTUALIZATION_EVENT_RECORD_VERSION = 1 as const;

// --------------------------------------------------------------------------------
// Typed validation states (the W039 pin: "actualization rules and
// validation states").
// --------------------------------------------------------------------------------

/**
 * The typed validation states of one observation group:
 * - `insufficient` — fewer observations than the reconciliation policy's
 *   corroboration quorum;
 * - `corroborated` — the observations agree under the policy (exact or
 *   within tolerance) and fold into a validated actual;
 * - `conflicting` — the observations disagree beyond the policy's
 *   tolerance; the group cannot actualize until a typed conflict
 *   resolution selects the authoritative subset;
 * - `resolved` — a sealed conflict resolution partitions the conflicting
 *   observation set; the SELECTED subset folds into the validated actual.
 */
export const VALIDATION_STATES = [
  'insufficient',
  'corroborated',
  'conflicting',
  'resolved',
] as const;

/** One typed validation state. */
export type ValidationState = (typeof VALIDATION_STATES)[number];

/**
 * The reconciliation-policy agreement modes:
 * - `exact` — compared observation values must agree exactly;
 * - `tolerance` — compared observation values may deviate by at most the
 *   supplied canonical non-negative decimal tolerance (in the group's
 *   unit or currency; for instant measures, in milliseconds).
 */
export const RECONCILIATION_MODES = ['exact', 'tolerance'] as const;

/** One reconciliation-policy agreement mode. */
export type ReconciliationMode = (typeof RECONCILIATION_MODES)[number];

/**
 * The reconciliation-policy FOLD modes (the typed semantics of multiple
 * observations in one group):
 * - `accumulate` — the observations are INCREMENTS (partial deliveries,
 *   usage consumption — the W037 receipt pattern): the fold is the exact
 *   decimal SUM and increments NEVER conflict with each other;
 * - `snapshot` — the observations are REPEAT MEASUREMENTS of one state
 *   (the corroboration pattern): the fold is the LATEST capture by
 *   (observedAt, recordId) and captures must agree under the agreement
 *   mode — disagreement beyond it is the typed `conflicting` state.
 *
 * Progress and instant measures ALWAYS fold as snapshots (latest capture
 * wins; progression across instants is not conflict — only simultaneous
 * captures must agree).
 */
export const RECONCILIATION_FOLD_MODES = ['accumulate', 'snapshot'] as const;

/** One reconciliation-policy fold mode. */
export type ReconciliationFoldMode = (typeof RECONCILIATION_FOLD_MODES)[number];

// --------------------------------------------------------------------------------
// Lineage (the W039 pin: "prediction/baseline/commitment/actual/forecast
// lineage across all universal lifecycle realizations").
// --------------------------------------------------------------------------------

/**
 * The lineage node kinds — the FIVE lifecycle-first distinction kinds
 * (USL1.0) that chain across universal lifecycle realizations:
 * prediction -> baseline -> commitment -> actual -> forecast. Each node
 * is an exact-revision reference into a W036 semantic-distinction record
 * (the W037 commitment-reference discipline: kind-prefixed record id +
 * content digest, never an embedded copy).
 */
export const LINEAGE_NODE_KINDS = [
  'prediction',
  'baseline',
  'commitment',
  'actual',
  'forecast',
] as const;

/** One lineage node kind. */
export type LineageNodeKind = (typeof LINEAGE_NODE_KINDS)[number];

/**
 * Canonical lineage stage order (presentation order of the five
 * lifecycle-first kinds): prediction(0) -> baseline(1) -> commitment(2)
 * -> actual(3) -> forecast(4). A lineage edge must flow forward in this
 * order, or stay `forecast -> forecast` (rolling forecast revision
 * refinement); anything else is a typed `lineage-order-rejected`.
 */
export const LINEAGE_STAGE_ORDER: readonly LineageNodeKind[] = LINEAGE_NODE_KINDS;

/** Canonical ordinal of one lineage node kind (see {@link LINEAGE_STAGE_ORDER}). */
export function lineageStageOrdinal(kind: LineageNodeKind): number {
  return LINEAGE_STAGE_ORDER.indexOf(kind);
}

// --------------------------------------------------------------------------------
// Calibration (the W039 pin: "confidence/calibration state").
// --------------------------------------------------------------------------------

/**
 * The forecast-bias directions of one past-forecast-vs-actual comparison
 * fact (the calibration fold input): the forecast OVER-predicted, UNDER-
 * predicted, or was EXACT relative to the eventual actual.
 */
export const FORECAST_BIAS_DIRECTIONS = ['over-forecast', 'under-forecast', 'exact'] as const;

/** One forecast-bias direction. */
export type ForecastBiasDirection = (typeof FORECAST_BIAS_DIRECTIONS)[number];

// --------------------------------------------------------------------------------
// The actualization:* event vocabulary (over the W010 event shapes).
// --------------------------------------------------------------------------------

/**
 * The actualization lifecycle event vocabulary: discriminators in the
 * `actualization` payload namespace (the W010 open-namespace family owned
 * by this package). Every actualization-domain lifecycle fact projects
 * onto one of these event kinds over the W010 event shapes
 * (src/events.ts).
 */
export const ACTUALIZATION_EVENT_DISCRIMINATORS = [
  'actualization:observation-intaken',
  'actualization:validation-assessed',
  'actualization:conflict-resolved',
  'actualization:actuals-minted',
  'actualization:lineage-linked',
  'actualization:forecast-revised',
  'actualization:calibration-folded',
  'actualization:state-projected',
] as const;

/** One actualization event payload discriminator. */
export type ActualizationEventDiscriminator = (typeof ACTUALIZATION_EVENT_DISCRIMINATORS)[number];

// --------------------------------------------------------------------------------
// Schema discriminators (the W011/W023 sealed-envelope discipline).
// --------------------------------------------------------------------------------

/** Schema discriminator of the validation-assessment record family. */
export const VALIDATION_ASSESSMENT_SCHEMA_NAME =
  'epoch.actualization.validation-assessment' as const;

/** Schema discriminator of the conflict-resolution record family. */
export const CONFLICT_RESOLUTION_SCHEMA_NAME = 'epoch.actualization.conflict-resolution' as const;

/** Schema discriminator of the lineage-edge record family. */
export const LINEAGE_EDGE_SCHEMA_NAME = 'epoch.actualization.lineage-edge' as const;

/** Schema discriminator of the calibration-state record family. */
export const CALIBRATION_STATE_SCHEMA_NAME = 'epoch.actualization.calibration-state' as const;

// --------------------------------------------------------------------------------
// Opaque, kind-prefixed identity grammars (the W002/W009/W010/W023 house
// pattern). The segment before `:` is the record kind; the slug is a
// lowercase kebab of length <= 63.
// --------------------------------------------------------------------------------

/** Validation-assessment record identity: `validation:<slug>`. */
export const VALIDATION_ID_PATTERN = /^validation:[a-z0-9][a-z0-9-]{0,62}$/;

/** Conflict-resolution record identity: `resolution:<slug>`. */
export const RESOLUTION_ID_PATTERN = /^resolution:[a-z0-9][a-z0-9-]{0,62}$/;

/** Lineage-edge record identity: `lineage:<slug>`. */
export const LINEAGE_ID_PATTERN = /^lineage:[a-z0-9][a-z0-9-]{0,62}$/;

/** Calibration-state record identity: `calibration:<slug>`. */
export const CALIBRATION_ID_PATTERN = /^calibration:[a-z0-9][a-z0-9-]{0,62}$/;

/** Comparison-fact record identity: `comparison-fact:<slug>`. */
export const COMPARISON_FACT_ID_PATTERN = /^comparison-fact:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Acting principal grammar — MIRRORED from @epoch/event-log's
 * EVENT_ACTOR_PATTERN (the W009 identity grammar; runtime parity test
 * pins the pattern). Identity is NOT a runtime dependency.
 */
export const ACTUALIZATION_PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Actualization event stream identity — MIRRORED from @epoch/event-log's
 * EVENT_STREAM_ID_PATTERN (W010 grammar): `stream:<slug>`. One delivery's
 * actualization lifecycle events form ONE stream; pinned by the runtime
 * parity test.
 */
export const ACTUALIZATION_STREAM_ID_PATTERN = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * Derive the actualization event stream id of one delivery record
 * (deterministic): `stream:actualization-<delivery-suffix>`.
 */
export function actualizationStreamIdOf(deliveryId: string): string {
  const suffix = deliveryId.slice('delivery:'.length);
  return `stream:actualization-${suffix}`;
}

/**
 * Derive the deterministic actual record id of one observation
 * (`observation:<slug>` -> `actual:<slug>`): the W036 authority mints the
 * actual under this id when actualizing the observation — identical
 * inputs always derive identical ids (replay idempotence).
 */
export function actualIdOfObservation(observationId: string): string {
  return `actual:${observationId.slice('observation:'.length)}`;
}

/** The kind prefix of an actualization opaque id (the segment before `:`). */
export function kindPrefixOf(id: string): string {
  const separator = id.indexOf(':');
  return separator === -1 ? '' : id.slice(0, separator);
}
