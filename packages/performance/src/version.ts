/**
 * Version + closed vocabularies of the performance kernel (W034).
 *
 * PERFORMANCE DISCIPLINE (the W034 Tech Lead pin): deterministic,
 * wall-clock-FREE performance engineering. Every vocabulary here is
 * closed and versioned; scale is expressed as INPUT SIZE and complexity
 * as derived OPERATION COUNTS — never measured time. Swapping a budget
 * record is a DATA change, not a code change.
 */

/** This contract's version (carried by every performance record). */
export const PERFORMANCE_CONTRACT_VERSION = 1 as const;

// --------------------------------------------------------------------------------
// Operation classes (what the counters count).
// --------------------------------------------------------------------------------

/**
 * The closed operation-class vocabulary — the units every budget,
 * counter, verdict and complexity model speaks:
 *
 * - `kernel-admission`   — one invocation of a state-extending kernel API
 *   (seal-into-chain / admit / append / record / intake / apply): the
 *   append-only admission path shared by every W036..W039 ledger and store;
 * - `kernel-fold`        — one record iterated by a fold invocation (the
 *   documented per-record step of foldQuantitySchedule,
 *   foldDistinctionRecords, foldDeliveryActuals, foldVarianceRecords, ...);
 * - `projection-compute` — one row emitted by a projection computation
 *   (pack views, the navigator projection: one computed output row);
 * - `digest-compute`     — one invocation of a digest-bearing kernel API
 *   (seal / verify / computeDigest / a sealed-record computation);
 * - `harness-scenario`   — one driver-seam invocation by the W032 test
 *   harness runner (begin / runStep / stateDigest — the runner's own
 *   double-run replay doubles these by design).
 */
export const OPERATION_CLASSES = [
  'kernel-admission',
  'kernel-fold',
  'projection-compute',
  'digest-compute',
  'harness-scenario',
] as const;
export type OperationClass = (typeof OPERATION_CLASSES)[number];

// --------------------------------------------------------------------------------
// Workload grammar (the dimensions a workload scales along).
// --------------------------------------------------------------------------------

/**
 * The closed input-unit vocabulary — the workload dimensions a budget
 * may scale along. Every workload carries a `sizes` record over exactly
 * these keys; a budget names ONE of them as its input unit.
 */
export const INPUT_UNITS = ['planLines', 'observations', 'packProjections', 'scenarioSteps'] as const;
export type InputUnit = (typeof INPUT_UNITS)[number];

// --------------------------------------------------------------------------------
// Budget verdicts.
// --------------------------------------------------------------------------------

/**
 * The closed budget-verdict vocabulary:
 *
 * - `within-budget` — measured count is comfortably under the envelope;
 * - `near-budget`   — measured count is at or above the near threshold
 *   (a declared fraction of the allowed count) but still within the
 *   envelope;
 * - `over-budget`   — measured count EXCEEDS the envelope (the regression
 *   gate bites; the verdict carries the exceeded envelope + exact counts).
 */
export const BUDGET_VERDICTS = ['within-budget', 'near-budget', 'over-budget'] as const;
export type BudgetVerdict = (typeof BUDGET_VERDICTS)[number];

// --------------------------------------------------------------------------------
// Complexity classes.
// --------------------------------------------------------------------------------

/**
 * The closed complexity-class vocabulary (declared per operation subject;
 * verified by measured count ratios across a doubling scale ladder):
 *
 * - `constant`  — count independent of input size (doubling ratio ~1);
 * - `linear`    — count proportional to input size (doubling ratio ~2);
 * - `quadratic` — count proportional to input size squared (doubling
 *   ratio ~4; the composition-level regression signature).
 */
export const COMPLEXITY_CLASSES = ['constant', 'linear', 'quadratic'] as const;
export type ComplexityClass = (typeof COMPLEXITY_CLASSES)[number];

// --------------------------------------------------------------------------------
// Provenance kinds (the W006/W036 uncertainty-provenance grammar, mirrored).
// --------------------------------------------------------------------------------

/**
 * The closed provenance-kind vocabulary of performance records (the same
 * shape the W036 uncertainty state carries — mirrored locally because the
 * performance kernel has no runtime edge to solution-delivery).
 */
export const PROVENANCE_KINDS = [
  'observed',
  'reported',
  'derived',
  'assumed',
  'imported',
  'unknown',
] as const;
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

// --------------------------------------------------------------------------------
// Record identity grammar (kind-prefixed slugs, the house convention).
// --------------------------------------------------------------------------------

export const WORKLOAD_ID_PATTERN = /^workload:[a-z0-9][a-z0-9-]{0,62}$/;
export const BUDGET_ID_PATTERN = /^budget:[a-z0-9][a-z0-9-]{0,62}$/;
export const VERDICT_ID_PATTERN = /^verdict:[a-z0-9][a-z0-9-]{0,126}$/;
export const COUNTS_ID_PATTERN = /^counts:[a-z0-9][a-z0-9-]{0,62}$/;
export const MODEL_ID_PATTERN = /^complexity-model:[a-z0-9][a-z0-9-]{0,62}$/;
export const LADDER_ID_PATTERN = /^ladder:[a-z0-9][a-z0-9-]{0,62}$/;

/** The measurement-subject label grammar (a slug naming the measured flow). */
export const SUBJECT_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** The pack-projection surface vocabulary of generated workloads. */
export const PACK_PROJECTION_SURFACES = [
  'boq',
  'construction-programme',
  'roadmap',
  'backlog',
  'deployment-plan',
] as const;
export type PackProjectionSurface = (typeof PACK_PROJECTION_SURFACES)[number];

/** The harness scenario-step op vocabulary of generated workloads. */
export const SCENARIO_STEP_OPS = ['ledger.append', 'ledger.head'] as const;
export type ScenarioStepOp = (typeof SCENARIO_STEP_OPS)[number];
