// W034 — the BUDGET CATALOG: the performance budget records, scale
// ladders, workload grammar and complexity models as DATA (swap a
// budget record, no code change). Envelope slopes derive from the
// MEASURED per-rung counts of the reference compositions with declared
// engineering headroom (~10-30% over the measured coefficient, plus
// intercepts covering small-rung constants); the derivation is
// documented per budget and reproducible via the scale-budgets suite.
//
// The workload GRAMMAR (per subject): which workload dimension scales
// along the ladder and what the other dimensions are pinned to. The
// budgets apply to workloads of exactly this grammar — the suite
// generates them accordingly.
import {
  sealBudget,
  sealComplexityModel,
  generateWorkload,
  DEFAULT_BUDGET_POLICY,
  type ScaleLadder,
  type SealedBudgetRecord,
  type SealedComplexityModel,
  type SealedWorkloadRecord,
  type WorkloadShape,
} from '@epoch/performance';
import { TENANT } from './materialize';

// --------------------------------------------------------------------------------
// The scale ladders (sizes as DATA; doubling rungs for ratio analysis).
// --------------------------------------------------------------------------------

export const LADDER_PLAN_LINES: ScaleLadder = {
  ladderId: 'ladder:plan-lines',
  rungs: [
    { label: 'small', inputSize: 32 },
    { label: 'medium', inputSize: 64 },
    { label: 'large', inputSize: 128 },
    { label: 'x-large', inputSize: 256 },
    { label: 'xx-large', inputSize: 512 },
  ],
};

export const LADDER_PACK_PROJECTIONS: ScaleLadder = {
  ladderId: 'ladder:pack-projections',
  rungs: [
    { label: 'small', inputSize: 5 },
    { label: 'medium', inputSize: 10 },
    { label: 'large', inputSize: 20 },
    { label: 'x-large', inputSize: 40 },
    { label: 'xx-large', inputSize: 80 },
  ],
};

export const LADDER_OBSERVATIONS: ScaleLadder = {
  ladderId: 'ladder:observations',
  rungs: [
    { label: 'small', inputSize: 8 },
    { label: 'medium', inputSize: 16 },
    { label: 'large', inputSize: 32 },
    { label: 'x-large', inputSize: 64 },
    { label: 'xx-large', inputSize: 128 },
  ],
};

export const LADDER_SCENARIO_STEPS: ScaleLadder = {
  ladderId: 'ladder:scenario-steps',
  rungs: [
    { label: 'small', inputSize: 32 },
    { label: 'medium', inputSize: 64 },
    { label: 'large', inputSize: 128 },
    { label: 'x-large', inputSize: 256 },
    { label: 'xx-large', inputSize: 512 },
  ],
};

// --------------------------------------------------------------------------------
// The workload grammar per subject (the pinned dimensions + the scaler).
// --------------------------------------------------------------------------------

export interface SubjectGrammar {
  readonly subject: string;
  readonly inputUnit: 'planLines' | 'observations' | 'packProjections' | 'scenarioSteps';
  readonly ladder: ScaleLadder;
  /** The workload shape at one rung input size (the grammar the budgets apply to). */
  readonly shapeAt: (inputSize: number) => WorkloadShape;
}

export const SUBJECT_GRAMMARS: readonly SubjectGrammar[] = [
  {
    subject: 'solution-admission',
    inputUnit: 'planLines',
    ladder: LADDER_PLAN_LINES,
    shapeAt: (planLines) => ({ planLines, observations: 8, packProjections: 5, scenarioSteps: 16 }),
  },
  {
    subject: 'program-fold',
    inputUnit: 'planLines',
    ladder: LADDER_PLAN_LINES,
    shapeAt: (planLines) => ({ planLines, observations: 8, packProjections: 5, scenarioSteps: 16 }),
  },
  {
    subject: 'pack-projection',
    inputUnit: 'packProjections',
    ladder: LADDER_PACK_PROJECTIONS,
    shapeAt: (packProjections) => ({ planLines: 64, observations: 8, packProjections, scenarioSteps: 16 }),
  },
  {
    subject: 'observation-stack',
    inputUnit: 'observations',
    ladder: LADDER_OBSERVATIONS,
    shapeAt: (observations) => ({ planLines: 256, observations, packProjections: 5, scenarioSteps: 16 }),
  },
  {
    subject: 'variance-stack',
    inputUnit: 'observations',
    ladder: LADDER_OBSERVATIONS,
    shapeAt: (observations) => ({ planLines: 64, observations, packProjections: 5, scenarioSteps: 16 }),
  },
  {
    subject: 'harness-scenario',
    inputUnit: 'scenarioSteps',
    ladder: LADDER_SCENARIO_STEPS,
    shapeAt: (scenarioSteps) => ({ planLines: 32, observations: 8, packProjections: 5, scenarioSteps }),
  },
  {
    subject: 'delivery-stack-composition',
    inputUnit: 'planLines',
    ladder: LADDER_PLAN_LINES,
    shapeAt: (planLines) => ({
      planLines,
      observations: Math.ceil(planLines / 8),
      packProjections: 5,
      scenarioSteps: 16,
    }),
  },
  {
    subject: 'distinction-refold',
    inputUnit: 'observations',
    ladder: LADDER_OBSERVATIONS,
    shapeAt: (observations) => ({ planLines: 256, observations, packProjections: 5, scenarioSteps: 16 }),
  },
];

/** The grammar of one subject (throws on unknown subject). */
export function grammarOf(subject: string): SubjectGrammar {
  const grammar = SUBJECT_GRAMMARS.find((candidate) => candidate.subject === subject);
  if (grammar === undefined) {
    throw new Error(`budget catalog: unknown subject "${subject}"`);
  }
  return grammar;
}

/** Generate the canonical workload of one subject at one rung. */
export function workloadAtRung(subject: string, label: string, salt = ''): SealedWorkloadRecord {
  const grammar = grammarOf(subject);
  const rung = grammar.ladder.rungs.find((candidate) => candidate.label === label);
  if (rung === undefined) {
    throw new Error(`budget catalog: unknown rung "${label}" of ladder ${grammar.ladder.ladderId}`);
  }
  const suffix = salt === '' ? '' : `-${salt}`;
  const generated = generateWorkload({
    workloadId: `workload:${subject}-${label}${suffix}`,
    tenantId: TENANT,
    shape: grammar.shapeAt(rung.inputSize),
    salt,
  });
  if (!generated.ok) {
    throw new Error(`budget catalog: workload generation failed: ${JSON.stringify(generated.error)}`);
  }
  return generated.value;
}

// --------------------------------------------------------------------------------
// The budget catalog (sealed records; slopes from measured coefficients
// + declared headroom).
// --------------------------------------------------------------------------------

function mustSealBudget(content: Record<string, unknown>): SealedBudgetRecord {
  const sealed = sealBudget({ ...content, tenantId: TENANT, policy: DEFAULT_BUDGET_POLICY });
  if (!sealed.ok) {
    throw new Error(`budget catalog: seal failed: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

/** The reference composition: one admission path regardless of plan-line count. */
export const BUDGET_SOLUTION_ADMISSION: SealedBudgetRecord = mustSealBudget({
  schema: 'epoch.performance.budget',
  schemaVersion: 1,
  budgetId: 'budget:solution-admission',
  name: 'Solution admission budget',
  description:
    'The W036 solution-version admission path at N plan lines. Measured: 1 admission (chain admission) + 4 digest computations (workload verification, version seal, chain verification, baseline approval) — CONSTANT in N. Envelopes pin the constant with headroom; a per-line re-admission regression (slope > 0) exceeds the envelope.',
  subject: 'solution-admission',
  inputUnit: 'planLines',
  envelopes: {
    'kernel-admission': { intercept: 4, slopeNumerator: 0, slopeDenominator: 1 },
    'digest-compute': { intercept: 16, slopeNumerator: 0, slopeDenominator: 1 },
  },
  provenance: { kind: 'derived', sourceRef: 'tests/performance/src/budget-catalog.ts', actor: 'principal:platform-engineer' },
});

/** The five synchronized schedule folds: measured 3N + N/16 + N/8 fold records. */
export const BUDGET_PROGRAM_FOLD: SealedBudgetRecord = mustSealBudget({
  schema: 'epoch.performance.budget',
  schemaVersion: 1,
  budgetId: 'budget:program-fold',
  name: 'Program fold budget',
  description:
    'The five synchronized W036 schedule folds over a program of N activities (quantity, cost, resource: N records each; milestones: N/16; realization: N/8) — measured kernel-fold = 3N + N/16 + N/8 (3.1875N). Envelope slope 15/4 (+~18% headroom, comfortably under the near threshold, intercept 16). Admission (build) and digest (seal + verify) are constant.',
  subject: 'program-fold',
  inputUnit: 'planLines',
  envelopes: {
    'kernel-admission': { intercept: 8, slopeNumerator: 0, slopeDenominator: 1 },
    'digest-compute': { intercept: 16, slopeNumerator: 0, slopeDenominator: 1 },
    'kernel-fold': { intercept: 16, slopeNumerator: 15, slopeDenominator: 4 },
  },
  provenance: { kind: 'derived', sourceRef: 'tests/performance/src/budget-catalog.ts', actor: 'principal:platform-engineer' },
});

/** Pack projections at planLines=64: measured 54.4 rows per projection. */
export const BUDGET_PACK_PROJECTION: SealedBudgetRecord = mustSealBudget({
  schema: 'epoch.performance.budget',
  schemaVersion: 1,
  budgetId: 'budget:pack-projection',
  name: 'Pack projection budget',
  description:
    'The W026/W027 pack projections (BOQ, construction programme, roadmap, backlog, deployment plan — one row per emitted view record) at the pinned grammar planLines=64: measured 54.4 rows per projection (a full 5-surface cycle emits 272 rows). Envelope slope 62 (+~14% headroom, intercept 32) along P pack projections.',
  subject: 'pack-projection',
  inputUnit: 'packProjections',
  envelopes: {
    'kernel-admission': { intercept: 8, slopeNumerator: 0, slopeDenominator: 1 },
    'digest-compute': { intercept: 16, slopeNumerator: 0, slopeDenominator: 1 },
    'projection-compute': { intercept: 32, slopeNumerator: 62, slopeDenominator: 1 },
  },
  provenance: { kind: 'derived', sourceRef: 'tests/performance/src/budget-catalog.ts', actor: 'principal:platform-engineer' },
});

/** The full observation authority path: measured 4M+1 admissions, 2M+2 digests, 3M folds. */
export const BUDGET_OBSERVATION_STACK: SealedBudgetRecord = mustSealBudget({
  schema: 'epoch.performance.budget',
  schemaVersion: 1,
  budgetId: 'budget:observation-stack',
  name: 'Observation stack budget',
  description:
    'The W036/W039 observation authority path at M observations (planLines=256 pinned so every observation addresses a distinct activity): seal+record+ledger-admit+intake+apply per observation (4M+1 admissions), M seals + M sealed assessments + final verification (2M+2 digests), ledger fold + delivery actuals fold (3M fold records). Envelopes: slopes 5/3/4 with intercept 8.',
  subject: 'observation-stack',
  inputUnit: 'observations',
  envelopes: {
    'kernel-admission': { intercept: 8, slopeNumerator: 5, slopeDenominator: 1 },
    'digest-compute': { intercept: 8, slopeNumerator: 3, slopeDenominator: 1 },
    'kernel-fold': { intercept: 8, slopeNumerator: 4, slopeDenominator: 1 },
  },
  provenance: { kind: 'derived', sourceRef: 'tests/performance/src/budget-catalog.ts', actor: 'principal:platform-engineer' },
});

/** The variance layer: measured M admissions, M digests, 2M folds. */
export const BUDGET_VARIANCE_STACK: SealedBudgetRecord = mustSealBudget({
  schema: 'epoch.performance.budget',
  schemaVersion: 1,
  budgetId: 'budget:variance-stack',
  name: 'Variance stack budget',
  description:
    'The W039 variance layer at M variance computations: compute+admit per record (M admissions, M sealed records), records fold + summary fold (2M fold records). Envelopes: slopes 2/2/3 with intercept 8.',
  subject: 'variance-stack',
  inputUnit: 'observations',
  envelopes: {
    'kernel-admission': { intercept: 8, slopeNumerator: 2, slopeDenominator: 1 },
    'digest-compute': { intercept: 8, slopeNumerator: 2, slopeDenominator: 1 },
    'kernel-fold': { intercept: 8, slopeNumerator: 3, slopeDenominator: 1 },
  },
  provenance: { kind: 'derived', sourceRef: 'tests/performance/src/budget-catalog.ts', actor: 'principal:platform-engineer' },
});

/** The harness runner at its driver seam: measured 4S+4 seam invocations (double-run). */
export const BUDGET_HARNESS_SCENARIO: SealedBudgetRecord = mustSealBudget({
  schema: 'epoch.performance.budget',
  schemaVersion: 1,
  budgetId: 'budget:harness-scenario',
  name: 'Harness scenario budget',
  description:
    'The W032 test-harness runner at its driver seam at S scenario steps: begin + initial state digest + S x (runStep + state digest) per execution, DOUBLED by the runner built-in replay-determinism double-run — measured 4S+4 seam invocations. Envelope slope 5 (+25% headroom, intercept 16).',
  subject: 'harness-scenario',
  inputUnit: 'scenarioSteps',
  envelopes: {
    'harness-scenario': { intercept: 16, slopeNumerator: 5, slopeDenominator: 1 },
  },
  provenance: { kind: 'derived', sourceRef: 'tests/performance/src/budget-catalog.ts', actor: 'principal:platform-engineer' },
});

/** The composed stack at size: measured 0.5N+3 admissions, 0.375N+2 digests, 3.6875N folds, 7.6875N+7 rows, 68 seam calls. */
export const BUDGET_DELIVERY_STACK_COMPOSITION: SealedBudgetRecord = mustSealBudget({
  schema: 'epoch.performance.budget',
  schemaVersion: 1,
  budgetId: 'budget:delivery-stack-composition',
  name: 'Delivery stack composition budget',
  description:
    'The composed stack at N plan lines (grammar: observations = ceil(N/8), packProjections = 5 = one full surface cycle, scenarioSteps = 16): measured admissions 4*(N/8)+3 = 0.5N+3, digests 3*(N/8)+2 = 0.375N+2, folds 3.1875N (program) + N/2 (variance + delivery) = 3.6875N, projection rows 7.6875N+7 (pack cycle + navigator), harness seam invocations 68 (constant). Envelopes carry ~15-30% headroom over the measured coefficients.',
  subject: 'delivery-stack-composition',
  inputUnit: 'planLines',
  envelopes: {
    'kernel-admission': { intercept: 8, slopeNumerator: 1, slopeDenominator: 1 },
    'digest-compute': { intercept: 8, slopeNumerator: 1, slopeDenominator: 2 },
    'kernel-fold': { intercept: 16, slopeNumerator: 9, slopeDenominator: 2 },
    'projection-compute': { intercept: 32, slopeNumerator: 9, slopeDenominator: 1 },
    'harness-scenario': { intercept: 96, slopeNumerator: 0, slopeDenominator: 1 },
  },
  provenance: { kind: 'derived', sourceRef: 'tests/performance/src/budget-catalog.ts', actor: 'principal:platform-engineer' },
});

/**
 * The fold-discipline budget: the LINEAR envelope the distinction-refold
 * composition MUST respect (batched fold: M fold records). The INFLATED
 * composition (re-fold after every admission — M(M+1)/2 fold records)
 * violates this envelope: the regression-gate evidence.
 */
export const BUDGET_DISTINCTION_REFOLD: SealedBudgetRecord = mustSealBudget({
  schema: 'epoch.performance.budget',
  schemaVersion: 1,
  budgetId: 'budget:distinction-refold',
  name: 'Distinction refold discipline budget',
  description:
    'The fold-discipline envelope of the distinction-ledger composition at M observations: the CORRECT batched composition seals+admits M observations and folds ONCE (M fold records); envelopes pin admission/digest at slope 2 and fold at slope 2 with intercept 8. A composition that re-folds after every admission measures M(M+1)/2 fold records — the quadratic signature — and exceeds the envelope (the regression the gate must catch).',
  subject: 'distinction-refold',
  inputUnit: 'observations',
  envelopes: {
    'kernel-admission': { intercept: 8, slopeNumerator: 2, slopeDenominator: 1 },
    'digest-compute': { intercept: 8, slopeNumerator: 2, slopeDenominator: 1 },
    'kernel-fold': { intercept: 8, slopeNumerator: 2, slopeDenominator: 1 },
  },
  provenance: { kind: 'derived', sourceRef: 'tests/performance/src/budget-catalog.ts', actor: 'principal:platform-engineer' },
});

/** The complete budget catalog (DATA — swap a record, no code change). */
export const BUDGET_CATALOG: readonly SealedBudgetRecord[] = [
  BUDGET_SOLUTION_ADMISSION,
  BUDGET_PROGRAM_FOLD,
  BUDGET_PACK_PROJECTION,
  BUDGET_OBSERVATION_STACK,
  BUDGET_VARIANCE_STACK,
  BUDGET_HARNESS_SCENARIO,
  BUDGET_DELIVERY_STACK_COMPOSITION,
  BUDGET_DISTINCTION_REFOLD,
];

/** The catalog entry of one subject (throws on unknown subject). */
export function budgetOf(subject: string): SealedBudgetRecord {
  const budget = BUDGET_CATALOG.find((candidate) => candidate.subject === subject);
  if (budget === undefined) {
    throw new Error(`budget catalog: no budget for subject "${subject}"`);
  }
  return budget;
}

// --------------------------------------------------------------------------------
// The complexity models (declared classes from documented kernel
// behavior; verified by measured count ratios across the ladders).
// --------------------------------------------------------------------------------

function mustSealModel(
  modelId: string,
  subject: string,
  operationClass: string,
  declaredClass: 'constant' | 'linear' | 'quadratic',
  rationale: string,
): SealedComplexityModel {
  const sealed = sealComplexityModel({
    schema: 'epoch.performance.complexity-model',
    schemaVersion: 1,
    tenantId: TENANT,
    modelId,
    subject,
    operationClass,
    declaredClass,
    rationale,
    provenance: { kind: 'derived', sourceRef: 'tests/performance/src/budget-catalog.ts', actor: 'principal:platform-engineer' },
  });
  if (!sealed.ok) {
    throw new Error(`budget catalog: model seal failed: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

export const COMPLEXITY_MODELS: readonly SealedComplexityModel[] = [
  mustSealModel(
    'complexity-model:solution-admission-constant',
    'solution-admission',
    'digest-compute',
    'constant',
    'The W036 admission path (seal, chain admission, chain verification, baseline approval) is one fixed sequence of digest-bearing calls — the documented kernel behavior is independent of the plan-line count.',
  ),
  mustSealModel(
    'complexity-model:program-fold-linear',
    'program-fold',
    'kernel-fold',
    'linear',
    'The five synchronized W036 schedule folds iterate their input records once each (documented: one row per activity/milestone/resource) — fold records grow linearly in the plan-line count.',
  ),
  mustSealModel(
    'complexity-model:pack-projection-linear',
    'pack-projection',
    'projection-compute',
    'linear',
    'The W026/W027 pack projections emit one view row per input record (documented DP1.0 projection rule) — emitted rows grow linearly in the number of projection computations.',
  ),
  mustSealModel(
    'complexity-model:observation-stack-linear',
    'observation-stack',
    'kernel-admission',
    'linear',
    'The observation authority path (seal, record, ledger admit, intake, apply) is per-observation (documented W036/W039 append-only discipline) — admissions grow linearly in the observation count.',
  ),
  mustSealModel(
    'complexity-model:variance-stack-linear',
    'variance-stack',
    'kernel-fold',
    'linear',
    'The W039 variance records fold and summary fold iterate the ledger records once each (documented) — fold records grow linearly in the variance count.',
  ),
  mustSealModel(
    'complexity-model:harness-scenario-linear',
    'harness-scenario',
    'harness-scenario',
    'linear',
    'The W032 runner performs a fixed per-step driver-seam sequence (runStep + state digest, doubled by the replay double-run) — seam invocations grow linearly in the step count.',
  ),
  mustSealModel(
    'complexity-model:composition-fold-linear',
    'delivery-stack-composition',
    'kernel-fold',
    'linear',
    'The composed stack folds the program schedules (linear in plan lines) plus the variance and delivery folds (linear in observations = ceil(N/8)) — total fold records grow linearly in the plan-line count.',
  ),
  mustSealModel(
    'complexity-model:refold-quadratic',
    'distinction-refold',
    'kernel-fold',
    'quadratic',
    'The INFLATED refold composition (re-fold the ledger after EVERY admission) measures the triangular sum M(M+1)/2 — the composition-level quadratic regression signature this model exists to detect.',
  ),
];
