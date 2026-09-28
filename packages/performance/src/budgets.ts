/**
 * Typed PERFORMANCE BUDGETS + BUDGET EVALUATION + the regression GATE.
 *
 * A budget record is DATA: per operation class, an input-size ->
 * allowed-operation-count ENVELOPE (exact integer arithmetic —
 * intercept + floor(slopeNumerator * size / slopeDenominator); never
 * floats, never time). Swapping a budget record is a data change, not
 * a code change.
 *
 * `evaluateBudget` is a PURE function of (sealed workload + sealed
 * measured counts + sealed budget) -> a sealed, content-addressed
 * VERDICT record carrying the EXACT measured/allowed counts per class:
 * within-budget | near-budget | over-budget. Identical inputs derive
 * identical verdict digests — reproducible by construction
 * (`budget-verdict-reproducible`).
 *
 * `enforceBudgets` is the regression gate and the ONE deliberately
 * throwing API in the performance kernel: an over-budget verdict
 * throws a typed `PerformanceBudgetExceededError` carrying the exact
 * verdicts — this is what FAILS a test suite when a composition
 * regression exceeds an envelope.
 */
import { z } from 'zod';
import {
  BudgetIdSchema,
  NonNegativeIntSchema,
  PositiveIntSchema,
  ProvenanceStateSchema,
  Sha256HexSchema,
  SubjectSchema,
  TenantIdSchema,
  VerdictIdSchema,
  digestOfJson,
  sealedContentOf,
  serializeSealed,
} from './primitives';
import { validationError, type PerformanceError, type PerformanceResult } from './errors';
import {
  BUDGET_VERDICTS,
  INPUT_UNITS,
  OPERATION_CLASSES,
  PERFORMANCE_CONTRACT_VERSION,
  type BudgetVerdict,
  type OperationClass,
} from './version';
import { verifySealedMeasuredCounts } from './counts';
import { verifySealedWorkload } from './workloads';

// --------------------------------------------------------------------------------
// Envelopes (exact integer input-size -> allowed-count math).
// --------------------------------------------------------------------------------

/**
 * One operation-count envelope: allowedCount(size) =
 * intercept + floor(slopeNumerator * size / slopeDenominator).
 * Exact integer arithmetic only — deterministic, never floats.
 */
export const OperationEnvelopeSchema = z
  .strictObject({
    intercept: NonNegativeIntSchema,
    slopeNumerator: NonNegativeIntSchema,
    slopeDenominator: PositiveIntSchema,
  })
  .readonly()
  .meta({
    id: 'OperationEnvelope',
    title: 'OperationEnvelope',
    description:
      'One operation-count envelope: allowed = intercept + floor(slopeNumerator * size / slopeDenominator) — exact integer arithmetic, never floats, never time.',
  });
export type OperationEnvelope = z.infer<typeof OperationEnvelopeSchema>;

/** The near-budget policy: `near` begins at ceil(allowed * numerator / denominator). */
export const BudgetPolicySchema = z
  .strictObject({
    nearThresholdNumerator: PositiveIntSchema,
    nearThresholdDenominator: PositiveIntSchema,
  })
  .readonly()
  .refine((policy) => policy.nearThresholdNumerator <= policy.nearThresholdDenominator, {
    message: 'the near threshold must be a fraction of 1 (numerator <= denominator)',
    path: ['nearThresholdNumerator'],
  })
  .meta({
    id: 'BudgetPolicy',
    title: 'BudgetPolicy',
    description: 'The near-budget threshold as an exact fraction of the allowed count (within < near <= allowed; over > allowed).',
  });
export type BudgetPolicy = z.infer<typeof BudgetPolicySchema>;

/** The canonical default policy: near begins at 9/10 of the allowed count. */
export const DEFAULT_BUDGET_POLICY: BudgetPolicy = { nearThresholdNumerator: 9, nearThresholdDenominator: 10 };

/** The allowed operation count of an envelope at one input size (exact integer math). */
export function allowedCountAt(envelope: OperationEnvelope, size: number): number {
  return envelope.intercept + Math.floor((envelope.slopeNumerator * size) / envelope.slopeDenominator);
}

/** The near-budget floor: ceil(allowed * numerator / denominator) (exact integer math). */
export function nearFloorOf(policy: BudgetPolicy, allowed: number): number {
  return Math.floor((allowed * policy.nearThresholdNumerator + policy.nearThresholdDenominator - 1) / policy.nearThresholdDenominator);
}

// --------------------------------------------------------------------------------
// The sealed BUDGET record.
// --------------------------------------------------------------------------------

/** The envelopes map: a partial per-class record (absent classes are unconstrained by this budget). */
export const EnvelopesSchema = z.partialRecord(z.enum(OPERATION_CLASSES), OperationEnvelopeSchema);
export type Envelopes = Partial<Record<OperationClass, OperationEnvelope>>;

/** The content of one budget record: subject, input unit, envelopes, policy. */
const budgetContentShape = z.strictObject({
  schema: z.string().min(1),
  schemaVersion: z.literal(PERFORMANCE_CONTRACT_VERSION),
  tenantId: TenantIdSchema,
  budgetId: BudgetIdSchema,
  name: z.string().min(1).max(128),
  description: z.string().min(1).max(2048),
  /** The measurement subject this budget governs. */
  subject: SubjectSchema,
  /** The workload dimension the envelopes scale along. */
  inputUnit: z.enum(INPUT_UNITS),
  /** Per-class allowed-operation-count envelopes (at least one). */
  envelopes: EnvelopesSchema.refine((envelopes) => Object.keys(envelopes).length >= 1, {
    message: 'a budget must carry at least one operation-class envelope',
  }),
  policy: BudgetPolicySchema,
  provenance: ProvenanceStateSchema,
});
export const BudgetContentSchema = budgetContentShape
  .readonly()
  .meta({
    id: 'BudgetContent',
    title: 'BudgetContent',
    description:
      'The content of one performance budget record: the governed subject, the input unit, the per-class operation-count envelopes, and the near-budget policy. Budgets are DATA.',
  });
export type BudgetContent = z.infer<typeof BudgetContentSchema>;

/** A sealed budget record (content + canonical contentDigest). */
export const SealedBudgetSchema = z
  .strictObject({
    ...budgetContentShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedBudget',
    title: 'SealedBudget',
    description: 'The sealed budget record: content plus its SHA-256 content digest (exact-revision addressing).',
  });
export type SealedBudgetRecord = z.infer<typeof SealedBudgetSchema>;

/** Compute the canonical digest of budget content. */
export function computeBudgetDigest(content: BudgetContent): string {
  return digestOfJson(content);
}

/** Seal valid budget content into its published record. */
export function sealBudget(content: unknown): PerformanceResult<SealedBudgetRecord> {
  const parsed = BudgetContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError('the budget content does not conform to the performance record schema', parsed.error),
    };
  }
  return { ok: true, value: { ...parsed.data, contentDigest: digestOfJson(parsed.data) } };
}

/** Verify a sealed budget record (schema + digest recomputation; tamper detection). */
export function verifySealedBudget(sealed: unknown): PerformanceResult<SealedBudgetRecord> {
  const parsed = SealedBudgetSchema.safeParse(sealed);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError('the sealed budget record does not conform to the performance record schema', parsed.error),
    };
  }
  const expected = digestOfJson(sealedContentOf(parsed.data as unknown as { contentDigest: string } & Record<string, unknown>));
  if (expected !== parsed.data.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed budget record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: parsed.data.contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

export interface DeserializedBudget {
  readonly record: SealedBudgetRecord;
  readonly claimedDigest: string;
  readonly digestVerifies: boolean;
}

/** Deserialize + digest-verify a serialized budget record (the round-trip gate). */
export function deserializeBudget(text: string, claimedDigest: string):
  | { ok: true; value: DeserializedBudget }
  | { ok: false; error: PerformanceError } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: { code: 'serialization-invalid', message: `invalid budget JSON: ${(err as Error).message}` } };
  }
  const sealed = sealBudget(raw);
  if (!sealed.ok) {
    return sealed;
  }
  const recomputed = digestOfJson(sealedContentOf(sealed.value as unknown as { contentDigest: string } & Record<string, unknown>));
  return { ok: true, value: { record: sealed.value, claimedDigest, digestVerifies: recomputed === claimedDigest } };
}

/** Canonical JSON serialization (byte-identical for equal budgets). */
export function serializeBudget(sealed: SealedBudgetRecord): string {
  return serializeSealed(sealed as unknown as { contentDigest: string } & Record<string, unknown>);
}

// --------------------------------------------------------------------------------
// Budget evaluation (pure) -> the sealed VERDICT record.
// --------------------------------------------------------------------------------

/** One per-class verdict finding: the exact measured/allowed counts. */
export const ClassVerdictSchema = z
  .strictObject({
    operationClass: z.enum(OPERATION_CLASSES),
    measured: NonNegativeIntSchema,
    allowed: NonNegativeIntSchema,
    nearFloor: NonNegativeIntSchema,
    verdict: z.enum(BUDGET_VERDICTS),
    /** measured - allowed (only meaningful when over; null otherwise). */
    exceededBy: z.number().int().nullable(),
  })
  .readonly()
  .meta({
    id: 'ClassVerdict',
    title: 'ClassVerdict',
    description: 'One per-class budget verdict with the exact measured and allowed operation counts.',
  });
export type ClassVerdict = z.infer<typeof ClassVerdictSchema>;

/** The content of one budget-verdict record: the reproducible evaluation result. */
const budgetVerdictContentShape = z.strictObject({
  schema: z.string().min(1),
  schemaVersion: z.literal(PERFORMANCE_CONTRACT_VERSION),
  tenantId: TenantIdSchema,
  verdictId: VerdictIdSchema,
  budgetId: BudgetIdSchema,
  budgetDigest: Sha256HexSchema,
  workloadId: z.string().min(1),
  workloadDigest: Sha256HexSchema,
  countsId: z.string().min(1),
  countsDigest: Sha256HexSchema,
  subject: SubjectSchema,
  inputUnit: z.enum(INPUT_UNITS),
  inputSize: NonNegativeIntSchema,
  perClass: z.array(ClassVerdictSchema).min(1),
  overall: z.enum(BUDGET_VERDICTS),
  provenance: ProvenanceStateSchema,
});
export const BudgetVerdictContentSchema = budgetVerdictContentShape
  .readonly()
  .meta({
    id: 'BudgetVerdictContent',
    title: 'BudgetVerdictContent',
    description:
      'The content of one budget-verdict record: the evaluated budget/workload/counts (by id + digest), the per-class exact counts, and the overall verdict. Reproducible by construction.',
  });
export type BudgetVerdictContent = z.infer<typeof BudgetVerdictContentSchema>;

/** A sealed budget-verdict record (content + canonical contentDigest). */
export const SealedBudgetVerdictSchema = z
  .strictObject({
    ...budgetVerdictContentShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedBudgetVerdict',
    title: 'SealedBudgetVerdict',
    description: 'The sealed budget-verdict record: content plus its SHA-256 content digest (exact-revision addressing).',
  });
export type SealedBudgetVerdictRecord = z.infer<typeof SealedBudgetVerdictSchema>;

/** Compute the canonical digest of budget-verdict content. */
export function computeBudgetVerdictDigest(content: BudgetVerdictContent): string {
  return digestOfJson(content);
}

/** Seal valid budget-verdict content (round-trip + digest verification path). */
export function sealBudgetVerdict(content: unknown): PerformanceResult<SealedBudgetVerdictRecord> {
  const parsed = BudgetVerdictContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError('the budget-verdict content does not conform to the performance record schema', parsed.error),
    };
  }
  return { ok: true, value: { ...parsed.data, contentDigest: digestOfJson(parsed.data) } };
}

/** Verify a sealed budget-verdict record (schema + digest recomputation; tamper detection). */
export function verifySealedBudgetVerdict(sealed: unknown): PerformanceResult<SealedBudgetVerdictRecord> {
  const parsed = SealedBudgetVerdictSchema.safeParse(sealed);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError('the sealed budget-verdict record does not conform to the performance record schema', parsed.error),
    };
  }
  const expected = digestOfJson(sealedContentOf(parsed.data as unknown as { contentDigest: string } & Record<string, unknown>));
  if (expected !== parsed.data.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed budget-verdict record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: parsed.data.contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

export interface DeserializedVerdict {
  readonly record: SealedBudgetVerdictRecord;
  readonly claimedDigest: string;
  readonly digestVerifies: boolean;
}

/** Deserialize + digest-verify a serialized budget-verdict record. */
export function deserializeBudgetVerdict(text: string, claimedDigest: string):
  | { ok: true; value: DeserializedVerdict }
  | { ok: false; error: PerformanceError } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: { code: 'serialization-invalid', message: `invalid budget-verdict JSON: ${(err as Error).message}` } };
  }
  const sealed = sealBudgetVerdict(raw);
  if (!sealed.ok) {
    return sealed;
  }
  const recomputed = digestOfJson(sealedContentOf(sealed.value as unknown as { contentDigest: string } & Record<string, unknown>));
  return { ok: true, value: { record: sealed.value, claimedDigest, digestVerifies: recomputed === claimedDigest } };
}

/** Canonical JSON serialization (byte-identical for equal verdicts). */
export function serializeBudgetVerdict(sealed: SealedBudgetVerdictRecord): string {
  return serializeSealed(sealed as unknown as { contentDigest: string } & Record<string, unknown>);
}

/** The deterministic verdict identity: `verdict:<budget slug>--<workload slug>`. */
export function verdictIdOf(budgetId: string, workloadId: string): string {
  return `verdict:${budgetId.replace(/^budget:/, '')}--${workloadId.replace(/^workload:/, '')}`;
}

/** The evaluation input: the three sealed records the pure function composes. */
export interface EvaluateBudgetInput {
  readonly workload: unknown;
  readonly counts: unknown;
  readonly budget: unknown;
}

/**
 * Evaluate one budget against one measured workload run — the PURE
 * budget-evaluation function:
 *
 * - every input is VERIFIED first (tampered digests fail closed as
 *   `digest-mismatch`);
 * - tenant consistency is enforced across all three records
 *   (`cross-tenant-denied`);
 * - the counts must belong to the exact workload revision
 *   (`workload-mismatch`) and to the budget's subject
 *   (`subject-mismatch`);
 * - per envelope class, the verdict is within / near / over with the
 *   EXACT measured and allowed counts;
 * - the overall verdict is the worst per-class verdict;
 * - the result is a SEALED, content-addressed verdict record —
 *   identical inputs derive identical verdict digests.
 */
export function evaluateBudget(input: EvaluateBudgetInput): PerformanceResult<SealedBudgetVerdictRecord> {
  const workloadVerified = verifySealedWorkload(input.workload);
  if (!workloadVerified.ok) {
    return workloadVerified;
  }
  const countsVerified = verifySealedMeasuredCounts(input.counts);
  if (!countsVerified.ok) {
    return countsVerified;
  }
  const budgetVerified = verifySealedBudget(input.budget);
  if (!budgetVerified.ok) {
    return budgetVerified;
  }
  const workload = workloadVerified.value;
  const counts = countsVerified.value;
  const budget = budgetVerified.value;

  if (counts.tenantId !== workload.tenantId || budget.tenantId !== workload.tenantId) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: 'budget evaluation requires the workload, the measured counts and the budget to share one tenant',
        expectedTenantId: workload.tenantId,
        encounteredTenantId: counts.tenantId !== workload.tenantId ? counts.tenantId : budget.tenantId,
        subject: workload.workloadId,
      },
    };
  }
  if (counts.workloadDigest !== workload.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'workload-mismatch',
        message: 'the measured counts were taken against a different workload revision',
        expectedWorkloadDigest: workload.contentDigest,
        encounteredWorkloadDigest: counts.workloadDigest,
      },
    };
  }
  if (counts.subject !== budget.subject) {
    return {
      ok: false,
      error: {
        code: 'subject-mismatch',
        message: 'the measured counts belong to a different measurement subject than the budget governs',
        expectedSubject: budget.subject,
        encounteredSubject: counts.subject,
      },
    };
  }

  const inputSize = workload.sizes[budget.inputUnit];
  const perClass: ClassVerdict[] = [];
  for (const operationClass of OPERATION_CLASSES) {
    const envelope = budget.envelopes[operationClass];
    if (envelope === undefined) {
      continue;
    }
    const measured = counts.counts[operationClass];
    const allowed = allowedCountAt(envelope, inputSize);
    const nearFloor = nearFloorOf(budget.policy, allowed);
    let verdict: BudgetVerdict;
    if (measured > allowed) {
      verdict = 'over-budget';
    } else if (measured >= nearFloor) {
      verdict = 'near-budget';
    } else {
      verdict = 'within-budget';
    }
    perClass.push({
      operationClass,
      measured,
      allowed,
      nearFloor,
      verdict,
      exceededBy: verdict === 'over-budget' ? measured - allowed : null,
    });
  }

  const overall: BudgetVerdict = perClass.some((finding) => finding.verdict === 'over-budget')
    ? 'over-budget'
    : perClass.some((finding) => finding.verdict === 'near-budget')
      ? 'near-budget'
      : 'within-budget';

  const content: BudgetVerdictContent = {
    schema: 'epoch.performance.verdict',
    schemaVersion: 1,
    tenantId: workload.tenantId,
    verdictId: verdictIdOf(budget.budgetId, workload.workloadId),
    budgetId: budget.budgetId,
    budgetDigest: budget.contentDigest,
    workloadId: workload.workloadId,
    workloadDigest: workload.contentDigest,
    countsId: counts.countsId,
    countsDigest: counts.contentDigest,
    subject: budget.subject,
    inputUnit: budget.inputUnit,
    inputSize,
    perClass,
    overall,
    provenance: { kind: 'derived', sourceRef: '@epoch/performance/evaluateBudget' },
  };
  return { ok: true, value: { ...content, contentDigest: digestOfJson(content) } };
}

// --------------------------------------------------------------------------------
// The regression GATE (the one deliberately throwing API).
// --------------------------------------------------------------------------------

/** One over-budget violation: the verdict + the exact exceeded findings. */
export interface BudgetViolation {
  readonly verdict: SealedBudgetVerdictRecord;
  readonly exceeded: readonly ClassVerdict[];
}

/** The typed gate error: carries the exact over-budget verdicts (never a bare string). */
export class PerformanceBudgetExceededError extends Error {
  readonly violations: readonly BudgetViolation[];
  constructor(violations: readonly BudgetViolation[]) {
    const first = violations[0];
    const detail =
      first === undefined
        ? 'no detail'
        : first.exceeded
            .map((f) => `${f.operationClass}: measured ${f.measured} > allowed ${f.allowed} (exceeded by ${f.exceededBy})`)
            .join('; ');
    super(
      `PERFORMANCE-BUDGET-EXCEEDED: ${violations.length} verdict(s) over budget — ${first?.verdict.verdictId} [${first?.verdict.subject}] ${detail}`,
    );
    this.name = 'PerformanceBudgetExceededError';
    this.violations = violations;
  }
}

/** Collect the over-budget violations of a set of verdicts (pure). */
export function collectBudgetViolations(verdicts: readonly SealedBudgetVerdictRecord[]): readonly BudgetViolation[] {
  const violations: BudgetViolation[] = [];
  for (const verdict of verdicts) {
    const exceeded = verdict.perClass.filter((finding) => finding.verdict === 'over-budget');
    if (verdict.overall === 'over-budget' && exceeded.length > 0) {
      violations.push({ verdict, exceeded });
    }
  }
  return violations;
}

/**
 * The regression gate: throws `PerformanceBudgetExceededError` carrying
 * the typed over-budget verdicts when any verdict exceeds its budget.
 * This is the ONLY throwing API in the performance kernel — its job is
 * to FAIL the test suite (the W034 regression gate: the suite fails
 * when a budget is exceeded).
 */
export function enforceBudgets(verdicts: readonly SealedBudgetVerdictRecord[]): void {
  const violations = collectBudgetViolations(verdicts);
  if (violations.length > 0) {
    throw new PerformanceBudgetExceededError(violations);
  }
}
