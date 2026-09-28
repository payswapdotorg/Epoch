/**
 * @epoch/performance — the W034 Performance kernel public surface.
 *
 * The performance discipline: deterministic, wall-clock-FREE
 * performance engineering — budgets, workload generators, operation
 * counters, budget evaluation and complexity models as TYPED DATA.
 * NEVER measure real time in tests; express scale as INPUT SIZE and
 * complexity as derived OPERATION COUNTS.
 *
 * Composition policy (frozen): runtime dependencies are
 * @epoch/agent-protocol, @epoch/tenancy and zod ONLY. The measurement
 * SUBJECTS (solution-delivery, actualization, variance, the packs, the
 * test harness) compose as devDependencies of the TEST trees — never
 * as dependencies of this library. Everything here is provider-neutral
 * (architecture lock rule 13): no vendor, brand, marketplace, ERP, PM
 * tool or API surface appears in any schema or vocabulary.
 */
export {
  PERFORMANCE_CONTRACT_VERSION,
  OPERATION_CLASSES,
  INPUT_UNITS,
  BUDGET_VERDICTS,
  COMPLEXITY_CLASSES,
  PROVENANCE_KINDS,
  PACK_PROJECTION_SURFACES,
  SCENARIO_STEP_OPS,
  WORKLOAD_ID_PATTERN,
  BUDGET_ID_PATTERN,
  VERDICT_ID_PATTERN,
  COUNTS_ID_PATTERN,
  MODEL_ID_PATTERN,
  LADDER_ID_PATTERN,
  SUBJECT_PATTERN,
} from './version';
export type {
  OperationClass,
  InputUnit,
  BudgetVerdict,
  ComplexityClass,
  ProvenanceKind,
  PackProjectionSurface,
  ScenarioStepOp,
} from './version';

export {
  flattenIssues,
  validationError,
} from './errors';
export type { PerformanceIssue, PerformanceErrorCode, PerformanceError, PerformanceResult } from './errors';

export {
  SHA256_HEX_PATTERN,
  Sha256HexSchema,
  NonNegativeIntSchema,
  PositiveIntSchema,
  TenantIdSchema,
  WorkloadIdSchema,
  BudgetIdSchema,
  VerdictIdSchema,
  CountsIdSchema,
  ComplexityModelIdSchema,
  LadderIdSchema,
  SubjectSchema,
  ProvenanceStateSchema,
  digestOfJson,
  sealedContentOf,
  serializeSealed,
} from './primitives';
export type { Sha256Hex, NonNegativeInt, PositiveInt, TenantId, WorkloadId, BudgetId, VerdictId, CountsId, ComplexityModelId, LadderId, Subject, ProvenanceState } from './primitives';

export {
  OperationCountsSchema,
  emptyCounts,
  sumCounts,
  countsJson,
  countsDigestOf,
  createCounterHub,
  MeasuredCountsContentSchema,
  SealedMeasuredCountsSchema,
  computeMeasuredCountsDigest,
  sealMeasuredCounts,
  verifySealedMeasuredCounts,
  serializeMeasuredCounts,
  deserializeMeasuredCounts,
} from './counts';
export type { OperationCounts, CounterHub, MeasuredCountsContent, SealedMeasuredCounts, DeserializedCounts } from './counts';

export {
  WorkloadShapeSchema,
  WorkloadSizesSchema,
  WorkloadSeedSchema,
  instantAt,
  quantityValueAt,
  unitAt,
  unitCostAt,
  acquisitionVariantAt,
  PlanLinePayloadSchema,
  ObservationPayloadSchema,
  PackProjectionRequestSchema,
  ScenarioStepPayloadSchema,
  WorkloadContentSchema,
  SealedWorkloadSchema,
  computeWorkloadDigest,
  workloadSizes,
  inputSizeOf,
  generateWorkload,
  sealWorkload,
  verifySealedWorkload,
  serializeWorkload,
  deserializeWorkload,
  WorkloadLedgerSchema,
  openWorkloadLedger,
  admitWorkload,
} from './workloads';
export type {
  WorkloadShape,
  WorkloadSizes,
  WorkloadSeed,
  PlanLinePayload,
  ObservationPayload,
  PackProjectionRequest,
  ScenarioStepPayload,
  WorkloadContent,
  SealedWorkloadRecord,
  DeserializedWorkload,
  WorkloadLedger,
} from './workloads';

export {
  OperationEnvelopeSchema,
  BudgetPolicySchema,
  DEFAULT_BUDGET_POLICY,
  allowedCountAt,
  nearFloorOf,
  EnvelopesSchema,
  BudgetContentSchema,
  SealedBudgetSchema,
  computeBudgetDigest,
  sealBudget,
  verifySealedBudget,
  serializeBudget,
  deserializeBudget,
  ClassVerdictSchema,
  BudgetVerdictContentSchema,
  SealedBudgetVerdictSchema,
  computeBudgetVerdictDigest,
  sealBudgetVerdict,
  verifySealedBudgetVerdict,
  serializeBudgetVerdict,
  deserializeBudgetVerdict,
  verdictIdOf,
  evaluateBudget,
  collectBudgetViolations,
  enforceBudgets,
  PerformanceBudgetExceededError,
} from './budgets';
export type {
  OperationEnvelope,
  BudgetPolicy,
  Envelopes,
  BudgetContent,
  SealedBudgetRecord,
  DeserializedBudget,
  ClassVerdict,
  BudgetVerdictContent,
  SealedBudgetVerdictRecord,
  DeserializedVerdict,
  EvaluateBudgetInput,
  BudgetViolation,
} from './budgets';

export {
  COMPLEXITY_CLASS_BOUNDS,
  ratioWithinBounds,
  LadderRungSchema,
  ScaleLadderSchema,
  isDoublingLadder,
  ComplexityModelContentSchema,
  SealedComplexityModelSchema,
  computeComplexityModelDigest,
  sealComplexityModel,
  verifySealedComplexityModel,
  serializeComplexityModel,
  deserializeComplexityModel,
  ComplexitySampleSchema,
  RatioFindingSchema,
  ComplexityAnalysisContentSchema,
  SealedComplexityAnalysisSchema,
  computeComplexityAnalysisDigest,
  sealComplexityAnalysis,
  verifySealedComplexityAnalysis,
  serializeComplexityAnalysis,
  deserializeComplexityAnalysis,
  analyzeComplexity,
} from './complexity';
export type {
  RatioBounds,
  LadderRung,
  ScaleLadder,
  ComplexityModelContent,
  SealedComplexityModel,
  DeserializedModel,
  ComplexitySample,
  RatioFinding,
  ComplexityAnalysisContent,
  SealedComplexityAnalysis,
  DeserializedAnalysis,
  AnalyzeComplexityInput,
} from './complexity';
