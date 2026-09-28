/**
 * Complexity MODEL records + measured count-ratio analysis.
 *
 * A complexity model DECLARES the complexity class of one (subject,
 * operation class) pair — derived from the kernels' documented
 * behavior (linear folds, linear projections, constant single-call
 * admissions). Verification is DATA, not belief: the analysis feeds
 * the MEASURED operation counts at every rung of a DOUBLING scale
 * ladder and checks each consecutive count ratio against the class's
 * exact rational bounds:
 *
 *   constant  — doubling ratio in [1/2, 3/2]   (ideal 1);
 *   linear    — doubling ratio in [3/2, 5/2]   (ideal 2);
 *   quadratic — doubling ratio in [3, 5]       (ideal 4 — the
 *               composition-level regression signature, e.g. refolding
 *               after every admission).
 *
 * All ratio comparisons use integer cross-multiplication (a/b >= p/q
 * iff a*q >= p*b) — exact, deterministic, never floats. The analysis
 * result is a SEALED record: `complexity-class-verified` or
 * `complexity-class-mismatch` with the offending pair.
 */
import { z } from 'zod';
import {
  ComplexityModelIdSchema,
  LadderIdSchema,
  NonNegativeIntSchema,
  PositiveIntSchema,
  ProvenanceStateSchema,
  Sha256HexSchema,
  SubjectSchema,
  TenantIdSchema,
  digestOfJson,
  sealedContentOf,
  serializeSealed,
} from './primitives';
import { validationError, type PerformanceError, type PerformanceResult } from './errors';
import { COMPLEXITY_CLASSES, OPERATION_CLASSES, PERFORMANCE_CONTRACT_VERSION, type ComplexityClass } from './version';

// --------------------------------------------------------------------------------
// The exact rational ratio bounds per complexity class.
// --------------------------------------------------------------------------------

/** One exact rational bound pair: lower = lowerNum/lowerDen, upper = upperNum/upperDen. */
export interface RatioBounds {
  readonly lowerNum: number;
  readonly lowerDen: number;
  readonly upperNum: number;
  readonly upperDen: number;
}

/**
 * The doubling-ratio bounds per declared complexity class (exact
 * rationals; comparisons by integer cross-multiplication).
 */
export const COMPLEXITY_CLASS_BOUNDS: Readonly<Record<ComplexityClass, RatioBounds>> = {
  constant: { lowerNum: 1, lowerDen: 2, upperNum: 3, upperDen: 2 },
  linear: { lowerNum: 3, lowerDen: 2, upperNum: 5, upperDen: 2 },
  quadratic: { lowerNum: 3, lowerDen: 1, upperNum: 5, upperDen: 1 },
};

/** Exact test: is numerator/denominator within [lower, upper]? (integer cross-multiplication) */
export function ratioWithinBounds(num: number, den: number, bounds: RatioBounds): boolean {
  if (den <= 0 || num < 0) {
    return false;
  }
  const atLeastLower = num * bounds.lowerDen >= bounds.lowerNum * den;
  const atMostUpper = num * bounds.upperDen <= bounds.upperNum * den;
  return atLeastLower && atMostUpper;
}

// --------------------------------------------------------------------------------
// The scale ladder (sizes as DATA; doubling required for ratio analysis).
// --------------------------------------------------------------------------------

/** One ladder rung: a label plus an input size. */
export const LadderRungSchema = z
  .strictObject({
    label: z.string().min(1).max(64),
    inputSize: PositiveIntSchema,
  })
  .readonly()
  .meta({
    id: 'LadderRung',
    title: 'LadderRung',
    description: 'One scale-ladder rung: a label (small/medium/large...) plus an input size. Sizes are DATA.',
  });
export type LadderRung = z.infer<typeof LadderRungSchema>;

/** The scale ladder: strictly increasing rungs (a doubling ladder for analysis). */
export const ScaleLadderSchema = z
  .strictObject({
    ladderId: LadderIdSchema,
    rungs: z.array(LadderRungSchema).min(2),
  })
  .readonly()
  .refine((ladder) => ladder.rungs.every((rung, index) => index === 0 || rung.inputSize > ladder.rungs[index - 1]!.inputSize), {
    message: 'ladder rung sizes must be strictly increasing',
    path: ['rungs'],
  })
  .meta({
    id: 'ScaleLadder',
    title: 'ScaleLadder',
    description: 'The scale ladder: labeled, strictly increasing input sizes (small/medium/large as DATA).',
  });
export type ScaleLadder = z.infer<typeof ScaleLadderSchema>;

/** A doubling ladder (each rung doubles the previous) — required for ratio analysis. */
export function isDoublingLadder(ladder: ScaleLadder): boolean {
  return ladder.rungs.every((rung, index) => index === 0 || rung.inputSize === ladder.rungs[index - 1]!.inputSize * 2);
}

// --------------------------------------------------------------------------------
// The sealed COMPLEXITY MODEL record.
// --------------------------------------------------------------------------------

/** The content of one complexity-model record: the declared class of one (subject, class) pair. */
const complexityModelContentShape = z.strictObject({
  schema: z.string().min(1),
  schemaVersion: z.literal(PERFORMANCE_CONTRACT_VERSION),
  tenantId: TenantIdSchema,
  modelId: ComplexityModelIdSchema,
  /** The measurement subject whose operation counts are modeled. */
  subject: SubjectSchema,
  /** The operation class whose counts are modeled. */
  operationClass: z.enum(OPERATION_CLASSES),
  /** The declared complexity class (from the kernels' documented behavior). */
  declaredClass: z.enum(COMPLEXITY_CLASSES),
  /** The rationale (documented kernel behavior the declaration derives from). */
  rationale: z.string().min(1).max(2048),
  provenance: ProvenanceStateSchema,
});
export const ComplexityModelContentSchema = complexityModelContentShape
  .readonly()
  .meta({
    id: 'ComplexityModelContent',
    title: 'ComplexityModelContent',
    description:
      'The content of one complexity-model record: the subject, the operation class, the declared complexity class, and the documented rationale.',
  });
export type ComplexityModelContent = z.infer<typeof ComplexityModelContentSchema>;

/** A sealed complexity-model record (content + canonical contentDigest). */
export const SealedComplexityModelSchema = z
  .strictObject({
    ...complexityModelContentShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedComplexityModel',
    title: 'SealedComplexityModel',
    description: 'The sealed complexity-model record: content plus its SHA-256 content digest (exact-revision addressing).',
  });
export type SealedComplexityModel = z.infer<typeof SealedComplexityModelSchema>;

/** Compute the canonical digest of complexity-model content. */
export function computeComplexityModelDigest(content: ComplexityModelContent): string {
  return digestOfJson(content);
}

/** Seal valid complexity-model content into its published record. */
export function sealComplexityModel(content: unknown): PerformanceResult<SealedComplexityModel> {
  const parsed = ComplexityModelContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError('the complexity-model content does not conform to the performance record schema', parsed.error),
    };
  }
  return { ok: true, value: { ...parsed.data, contentDigest: digestOfJson(parsed.data) } };
}

/** Verify a sealed complexity-model record (schema + digest recomputation). */
export function verifySealedComplexityModel(sealed: unknown): PerformanceResult<SealedComplexityModel> {
  const parsed = SealedComplexityModelSchema.safeParse(sealed);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError('the sealed complexity-model record does not conform to the performance record schema', parsed.error),
    };
  }
  const expected = digestOfJson(sealedContentOf(parsed.data as unknown as { contentDigest: string } & Record<string, unknown>));
  if (expected !== parsed.data.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed complexity-model record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: parsed.data.contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

export interface DeserializedModel {
  readonly record: SealedComplexityModel;
  readonly claimedDigest: string;
  readonly digestVerifies: boolean;
}

/** Deserialize + digest-verify a serialized complexity-model record. */
export function deserializeComplexityModel(text: string, claimedDigest: string):
  | { ok: true; value: DeserializedModel }
  | { ok: false; error: PerformanceError } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: { code: 'serialization-invalid', message: `invalid complexity-model JSON: ${(err as Error).message}` } };
  }
  const sealed = sealComplexityModel(raw);
  if (!sealed.ok) {
    return sealed;
  }
  const recomputed = digestOfJson(sealedContentOf(sealed.value as unknown as { contentDigest: string } & Record<string, unknown>));
  return { ok: true, value: { record: sealed.value, claimedDigest, digestVerifies: recomputed === claimedDigest } };
}

/** Canonical JSON serialization (byte-identical for equal models). */
export function serializeComplexityModel(sealed: SealedComplexityModel): string {
  return serializeSealed(sealed as unknown as { contentDigest: string } & Record<string, unknown>);
}

// --------------------------------------------------------------------------------
// The analysis (measured ratios across ladder rungs -> the sealed verdict).
// --------------------------------------------------------------------------------

/** One measured sample: the operation count measured at one input size. */
export const ComplexitySampleSchema = z
  .strictObject({
    inputSize: PositiveIntSchema,
    measuredCount: NonNegativeIntSchema,
  })
  .readonly()
  .meta({
    id: 'ComplexitySample',
    title: 'ComplexitySample',
    description: 'One measured complexity sample: the operation count measured at one input size (deterministic counts).',
  });
export type ComplexitySample = z.infer<typeof ComplexitySampleSchema>;

/** One consecutive-rung ratio finding (exact integer ratio + bounds verdict). */
export const RatioFindingSchema = z
  .strictObject({
    fromLabel: z.string().min(1),
    toLabel: z.string().min(1),
    fromSize: PositiveIntSchema,
    toSize: PositiveIntSchema,
    measuredFrom: NonNegativeIntSchema,
    measuredTo: NonNegativeIntSchema,
    /** The exact ratio measuredTo/measuredFrom as a reduced fraction. */
    ratioNumerator: NonNegativeIntSchema,
    ratioDenominator: PositiveIntSchema,
    withinBounds: z.boolean(),
  })
  .readonly()
  .meta({
    id: 'RatioFinding',
    title: 'RatioFinding',
    description: 'One consecutive-rung count ratio: sizes, measured counts, the exact reduced fraction, and the bounds verdict.',
  });
export type RatioFinding = z.infer<typeof RatioFindingSchema>;

/** The content of one complexity-analysis record: the measured ratio evidence + verdict. */
const complexityAnalysisContentShape = z.strictObject({
  schema: z.string().min(1),
  schemaVersion: z.literal(PERFORMANCE_CONTRACT_VERSION),
  tenantId: TenantIdSchema,
  modelId: ComplexityModelIdSchema,
  subject: SubjectSchema,
  operationClass: z.enum(OPERATION_CLASSES),
  declaredClass: z.enum(COMPLEXITY_CLASSES),
  ladderId: LadderIdSchema,
  findings: z.array(RatioFindingSchema).min(1),
  verdict: z.enum(['complexity-class-verified', 'complexity-class-mismatch']),
  provenance: ProvenanceStateSchema,
});
export const ComplexityAnalysisContentSchema = complexityAnalysisContentShape
  .readonly()
  .meta({
    id: 'ComplexityAnalysisContent',
    title: 'ComplexityAnalysisContent',
    description:
      'The content of one complexity-analysis record: the measured consecutive-rung ratios across the ladder and the verification verdict.',
  });
export type ComplexityAnalysisContent = z.infer<typeof ComplexityAnalysisContentSchema>;

/** A sealed complexity-analysis record (content + canonical contentDigest). */
export const SealedComplexityAnalysisSchema = z
  .strictObject({
    ...complexityAnalysisContentShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedComplexityAnalysis',
    title: 'SealedComplexityAnalysis',
    description: 'The sealed complexity-analysis record: content plus its SHA-256 content digest (exact-revision addressing).',
  });
export type SealedComplexityAnalysis = z.infer<typeof SealedComplexityAnalysisSchema>;

/** Compute the canonical digest of complexity-analysis content. */
export function computeComplexityAnalysisDigest(content: ComplexityAnalysisContent): string {
  return digestOfJson(content);
}

/** Seal valid complexity-analysis content (round-trip + digest verification path). */
export function sealComplexityAnalysis(content: unknown): PerformanceResult<SealedComplexityAnalysis> {
  const parsed = ComplexityAnalysisContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError('the complexity-analysis content does not conform to the performance record schema', parsed.error),
    };
  }
  return { ok: true, value: { ...parsed.data, contentDigest: digestOfJson(parsed.data) } };
}

/** Verify a sealed complexity-analysis record (schema + digest recomputation). */
export function verifySealedComplexityAnalysis(sealed: unknown): PerformanceResult<SealedComplexityAnalysis> {
  const parsed = SealedComplexityAnalysisSchema.safeParse(sealed);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError('the sealed complexity-analysis record does not conform to the performance record schema', parsed.error),
    };
  }
  const expected = digestOfJson(sealedContentOf(parsed.data as unknown as { contentDigest: string } & Record<string, unknown>));
  if (expected !== parsed.data.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed complexity-analysis record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: parsed.data.contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

export interface DeserializedAnalysis {
  readonly record: SealedComplexityAnalysis;
  readonly claimedDigest: string;
  readonly digestVerifies: boolean;
}

/** Deserialize + digest-verify a serialized complexity-analysis record. */
export function deserializeComplexityAnalysis(text: string, claimedDigest: string):
  | { ok: true; value: DeserializedAnalysis }
  | { ok: false; error: PerformanceError } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: { code: 'serialization-invalid', message: `invalid complexity-analysis JSON: ${(err as Error).message}` } };
  }
  const sealed = sealComplexityAnalysis(raw);
  if (!sealed.ok) {
    return sealed;
  }
  const recomputed = digestOfJson(sealedContentOf(sealed.value as unknown as { contentDigest: string } & Record<string, unknown>));
  return { ok: true, value: { record: sealed.value, claimedDigest, digestVerifies: recomputed === claimedDigest } };
}

/** Canonical JSON serialization (byte-identical for equal analyses). */
export function serializeComplexityAnalysis(sealed: SealedComplexityAnalysis): string {
  return serializeSealed(sealed as unknown as { contentDigest: string } & Record<string, unknown>);
}

/** The analysis input: the sealed model, the ladder, and the measured samples. */
export interface AnalyzeComplexityInput {
  readonly model: unknown;
  readonly ladder: unknown;
  readonly samples: readonly ComplexitySample[];
}

/**
 * Analyze one complexity model against measured counts — the ratio
 * evidence producer:
 *
 * - the model and the ladder are VERIFIED records (tamper detection);
 * - the ladder must be a DOUBLING ladder (`complexity-mismatch` is
 *   reserved for ratio violations, so a non-doubling ladder is a typed
 *   validation failure);
 * - the samples must cover EVERY ladder rung exactly once;
 * - each consecutive rung pair yields the exact reduced ratio
 *   measuredTo/measuredFrom, checked against the declared class bounds;
 * - the verdict is `complexity-class-verified` iff every pair is within
 *   bounds (else `complexity-class-mismatch`);
 * - the result is a SEALED, content-addressed analysis record.
 */
export function analyzeComplexity(input: AnalyzeComplexityInput): PerformanceResult<SealedComplexityAnalysis> {
  const modelVerified = verifySealedComplexityModel(input.model);
  if (!modelVerified.ok) {
    return modelVerified;
  }
  const ladderVerified = ScaleLadderSchema.safeParse(input.ladder);
  if (!ladderVerified.success) {
    return {
      ok: false,
      error: validationError('the scale ladder does not conform to the ladder schema', ladderVerified.error),
    };
  }
  const model = modelVerified.value;
  const ladder = ladderVerified.data;
  if (!isDoublingLadder(ladder)) {
    return {
      ok: false,
      error: {
        code: 'performance-invalid',
        message: 'complexity ratio analysis requires a doubling scale ladder (each rung doubles the previous size)',
        issues: [{ path: 'rungs', message: 'ladder is not a doubling ladder' }],
      },
    };
  }
  const bySize = new Map<number, number>();
  for (const sample of input.samples) {
    if (bySize.has(sample.inputSize)) {
      return {
        ok: false,
        error: {
          code: 'performance-invalid',
          message: `duplicate complexity sample at input size ${sample.inputSize}`,
          issues: [{ path: 'samples', message: `duplicate sample size ${sample.inputSize}` }],
        },
      };
    }
    bySize.set(sample.inputSize, sample.measuredCount);
  }
  const rungs = ladder.rungs;
  const findings: RatioFinding[] = [];
  for (let index = 1; index < rungs.length; index += 1) {
    const from = rungs[index - 1]!;
    const to = rungs[index]!;
    const measuredFrom = bySize.get(from.inputSize);
    const measuredTo = bySize.get(to.inputSize);
    if (measuredFrom === undefined || measuredTo === undefined) {
      return {
        ok: false,
        error: {
          code: 'performance-invalid',
          message: `complexity samples are incomplete: no measurement at input size ${measuredFrom === undefined ? from.inputSize : to.inputSize}`,
          issues: [{ path: 'samples', message: 'samples must cover every ladder rung exactly once' }],
        },
      };
    }
    const gcd = greatestCommonDivisor(measuredTo, measuredFrom);
    const ratioNum = gcd === 0 ? 0 : measuredTo / gcd;
    const ratioDen = gcd === 0 ? 1 : measuredFrom / gcd;
    const bounds = COMPLEXITY_CLASS_BOUNDS[model.declaredClass];
    findings.push({
      fromLabel: from.label,
      toLabel: to.label,
      fromSize: from.inputSize,
      toSize: to.inputSize,
      measuredFrom,
      measuredTo,
      ratioNumerator: ratioNum,
      ratioDenominator: ratioDen,
      withinBounds: ratioWithinBounds(measuredTo, measuredFrom, bounds),
    });
  }
  const verdict = findings.every((finding) => finding.withinBounds)
    ? ('complexity-class-verified' as const)
    : ('complexity-class-mismatch' as const);
  const content: ComplexityAnalysisContent = {
    schema: 'epoch.performance.complexity-analysis',
    schemaVersion: 1,
    tenantId: model.tenantId,
    modelId: model.modelId,
    subject: model.subject,
    operationClass: model.operationClass,
    declaredClass: model.declaredClass,
    ladderId: ladder.ladderId,
    findings,
    verdict,
    provenance: { kind: 'derived', sourceRef: '@epoch/performance/analyzeComplexity' },
  };
  return { ok: true, value: { ...content, contentDigest: digestOfJson(content) } };
}

/** Exact integer greatest common divisor (0 when both are 0). */
function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}
