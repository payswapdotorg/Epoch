/**
 * THE VARIANCE CLASS SET AS TYPED SEALED RECORDS (the W039 pin):
 * quantity, price/rate, productivity, schedule, waste, rework, change
 * and external-condition — each comparing a baseline/commitment/forecast
 * line to actualized values with MAGNITUDE + DIRECTION under the closed
 * zod vocabulary.
 *
 * - Every record references its compared lines by OPAQUE
 *   exact-revision references (`ComparedLineRef` — the W037
 *   commitment-reference discipline) and carries its own copy of the two
 *   measure VALUES (the explainability payload); the referenced records
 *   themselves are never embedded.
 * - `computeVariance` is the DETERMINISTIC total computation: the
 *   deviation magnitude is the EXACT fixed-point decimal fold of the two
 *   measure values (milliseconds for instants, canonical decimals for
 *   quantities/costs, fixed-9 fractions for progress); the direction
 *   derives from the class polarity table; the magnitude band derives
 *   from the caller-supplied thresholds. Identical inputs derive
 *   identical digests.
 * - Sealed records are immutable and content-addressed: exact
 *   re-admission is idempotent; the same id with different content is a
 *   typed `version-conflict`.
 * - W006-convention provenance on every variance record: evidence
 *   digests + the confidence state (source digests, confidence).
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  MeasureValueSchema,
  NonNegativeDecimalSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  TimestampSchema,
  VarianceIdSchema,
} from './primitives';
import {
  VARIANCE_CLASSES,
  VARIANCE_CLASS_POLARITY,
  VARIANCE_DIRECTIONS,
  VARIANCE_MAGNITUDE_BANDS,
  VARIANCE_RECORD_SCHEMA_NAME,
  VARIANCE_RECORD_VERSION,
  type VarianceClass,
  type VarianceDirection,
  type VarianceMagnitudeBand,
} from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import {
  addNonNegativeDecimals,
  compareNonNegativeDecimals,
  decimalFromFraction,
  subtractNonNegativeDecimals,
} from './decimal';
import type { VarianceResult } from './errors';

// --------------------------------------------------------------------------------
// The confidence state (the W006-shaped mirror).
// --------------------------------------------------------------------------------

/**
 * The confidence carried on every variance record (the W036/W006
 * evidence-shaped grammar, mirrored — see the dependency policy in
 * src/primitives.ts).
 */
export const VarianceConfidenceSchema = z
  .strictObject({
    method: z.enum(['stated', 'measured', 'estimated', 'derived', 'imported']),
    value: z.number().min(0).max(1),
    interval: z
      .strictObject({
        low: z.number().min(0).max(1),
        high: z.number().min(0).max(1),
      })
      .refine((interval) => interval.low <= interval.high, 'interval low must not exceed high')
      .readonly()
      .optional(),
    rationale: z.string().min(1).max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'VarianceConfidence',
    title: 'VarianceConfidence',
    description:
      'The confidence carried on one variance record: acquisition method (stated/measured/estimated/derived/imported), a 0..1 value, optional interval and rationale (the W006-shaped grammar).',
  });

/** One variance confidence state. */
export type VarianceConfidence = z.infer<typeof VarianceConfidenceSchema>;

// --------------------------------------------------------------------------------
// The variance record.
// --------------------------------------------------------------------------------

/** Sorted/duplicate-free refinement shared by evidence-digest arrays. */
function refineSortedDigests(digests: readonly string[], ctx: z.RefinementCtx, path: string): void {
  for (let i = 1; i < digests.length; i += 1) {
    if (digests[i]! < digests[i - 1]!) {
      ctx.addIssue({
        code: 'custom',
        message: `${path} must be sorted ascending (deterministic serialization)`,
        path: [path],
      });
      break;
    }
    if (digests[i]! === digests[i - 1]!) {
      ctx.addIssue({
        code: 'custom',
        message: `${path} must be duplicate-free`,
        path: [path],
      });
      break;
    }
  }
}

/**
 * The immutable content of one variance record: the compared lines (the
 * baseline-side and the actual-side opaque exact-revision references),
 * both measure values, the variance class, the magnitude + direction +
 * band, the evidence digests, and the confidence state.
 */
const varianceRecordShape = z.strictObject({
  schema: z.literal(VARIANCE_RECORD_SCHEMA_NAME),
  schemaVersion: z.literal(VARIANCE_RECORD_VERSION),
  varianceId: VarianceIdSchema,
  tenantId: TenantIdSchema,
  solutionId: z.string().regex(/^solution:[a-z0-9][a-z0-9-]{0,62}$/),
  subjectKind: z.string().min(1).max(64),
  subjectId: z.string().min(1).max(256),
  varianceClass: z.enum(VARIANCE_CLASSES),
  baselineRef: z.union([
    z
      .strictObject({
        kind: z.literal('prediction'),
        recordId: z.string().regex(/^prediction:[a-z0-9][a-z0-9-]{0,62}$/),
        contentDigest: Sha256HexSchema,
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('baseline'),
        recordId: z.string().regex(/^baseline:[a-z0-9][a-z0-9-]{0,62}$/),
        contentDigest: Sha256HexSchema,
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('commitment'),
        recordId: z.string().regex(/^commitment:[a-z0-9][a-z0-9-]{0,62}$/),
        contentDigest: Sha256HexSchema,
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('forecast'),
        recordId: z.string().regex(/^forecast:[a-z0-9][a-z0-9-]{0,62}$/),
        contentDigest: Sha256HexSchema,
      })
      .readonly(),
  ]),
  actualRef: z
    .strictObject({
      kind: z.literal('actual'),
      recordId: z.string().regex(/^actual:[a-z0-9][a-z0-9-]{0,62}$/),
      contentDigest: Sha256HexSchema,
    })
    .readonly(),
  baselineMeasure: MeasureValueSchema,
  actualMeasure: MeasureValueSchema,
  magnitude: NonNegativeDecimalSchema,
  direction: z.enum(VARIANCE_DIRECTIONS),
  band: z.enum(VARIANCE_MAGNITUDE_BANDS),
  evidence: z.array(Sha256HexSchema).max(64),
  confidence: VarianceConfidenceSchema,
  computedAt: TimestampSchema,
  computedBy: PrincipalIdSchema,
});

export const VarianceRecordContentSchema = varianceRecordShape
  .readonly()
  .superRefine((record, ctx) => {
    refineSortedDigests(record.evidence, ctx, 'evidence');
    if (record.baselineMeasure.kind !== record.actualMeasure.kind) {
      ctx.addIssue({
        code: 'custom',
        message: 'the baseline and actual measures of one variance share one measure kind',
        path: ['actualMeasure'],
      });
    }
    if (record.baselineRef.recordId === record.actualRef.recordId) {
      ctx.addIssue({
        code: 'custom',
        message: 'a variance compares two distinct records',
        path: ['actualRef'],
      });
    }
  })
  .meta({
    id: 'VarianceRecordContent',
    title: 'VarianceRecordContent',
    description:
      'The immutable content of one variance record: the compared baseline/commitment/forecast line and actualized line (opaque exact-revision references), both measure values, the variance class, magnitude + direction + band, sorted evidence digests, and the confidence state.',
  });

/** One variance-record content. */
export type VarianceRecordContent = z.infer<typeof VarianceRecordContentSchema>;

/** The SEALED variance record: content plus its SHA-256 content digest. */
export const SealedVarianceRecordSchema = z
  .strictObject({
    ...varianceRecordShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedVarianceRecord',
    title: 'SealedVarianceRecord',
    description:
      'The sealed variance record: immutable content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed variance record. */
export type SealedVarianceRecord = z.infer<typeof SealedVarianceRecordSchema>;

/** Compute the content digest of a variance-record content (canonical JSON). */
export function computeVarianceRecordDigest(content: VarianceRecordContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid variance-record content into its published record. */
export function sealVarianceRecord(content: unknown): VarianceResult<SealedVarianceRecord> {
  const parsed = VarianceRecordContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/**
 * Verify a sealed variance record: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedVarianceRecord(sealed: unknown): VarianceResult<SealedVarianceRecord> {
  const parsed = SealedVarianceRecordSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'sealed variance record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The deterministic computation.
// --------------------------------------------------------------------------------

/** The magnitude-band thresholds of one variance computation (caller-supplied). */
export const BandThresholdsSchema = z
  .strictObject({
    minor: NonNegativeDecimalSchema,
    material: NonNegativeDecimalSchema,
    severe: NonNegativeDecimalSchema,
  })
  .readonly()
  .superRefine((thresholds, ctx) => {
    if (
      compareNonNegativeDecimals(thresholds.minor, thresholds.material) > 0 ||
      compareNonNegativeDecimals(thresholds.material, thresholds.severe) > 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'band thresholds must ascend: minor <= material <= severe',
        path: ['material'],
      });
    }
  })
  .meta({
    id: 'BandThresholds',
    title: 'BandThresholds',
    description:
      'The magnitude-band thresholds of one variance computation: minor <= material <= severe canonical decimals (caller-supplied; never implicit defaults).',
  });

/** One band-thresholds set. */
export type BandThresholds = z.infer<typeof BandThresholdsSchema>;

/** The input of one variance computation. */
export interface ComputeVarianceInput {
  readonly varianceId: string;
  readonly tenantId: string;
  readonly solutionId: string;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly varianceClass: VarianceClass;
  /** The baseline-side compared line (prediction/baseline/commitment/forecast). */
  readonly baselineRef: { kind: 'prediction' | 'baseline' | 'commitment' | 'forecast'; recordId: string; contentDigest: string };
  /** The actual-side compared line (an actualized record). */
  readonly actualRef: { kind: 'actual'; recordId: string; contentDigest: string };
  readonly baselineMeasure: unknown;
  readonly actualMeasure: unknown;
  /** Sorted W006-convention evidence digests grounding the comparison. */
  readonly evidence: readonly string[];
  readonly confidence: unknown;
  /** The magnitude-band thresholds (mandatory — no implicit defaults). */
  readonly thresholds: BandThresholds;
  readonly computedAt: string;
  readonly computedBy: string;
}

/** The measure value string of one side (the exact decimal fold basis). */
function measureValueOf(measure: { kind: string; value?: string; amount?: string; fraction?: number; at?: string }): string {
  switch (measure.kind) {
    case 'quantity':
      return measure.value!;
    case 'cost':
      return measure.amount!;
    case 'progress':
      return decimalFromFraction(measure.fraction!);
    case 'instant':
      return String(Date.parse(measure.at!));
    default:
      return '';
  }
}

/**
 * Compute one variance record — the DETERMINISTIC total function:
 *
 * - the compared measures must share one measure kind (and unit or
 *   currency where applicable) — mismatches are typed
 *   `measure-kind-mismatch`;
 * - the MAGNITUDE is the exact fold: |actual - baseline| as a canonical
 *   decimal (instant measures fold as exact millisecond deltas);
 * - the DIRECTION derives from the class polarity table over the signed
 *   delta (actual - baseline);
 * - the BAND derives from the thresholds: 0 -> `immaterial`,
 *   <= minor -> `minor`, <= material -> `material`, else `severe`;
 * - the result is the SEALED variance record (content-addressed);
 *   identical inputs derive identical digests.
 */
export function computeVariance(input: ComputeVarianceInput): VarianceResult<SealedVarianceRecord> {
  const baseline = MeasureValueSchema.safeParse(input.baselineMeasure);
  if (!baseline.success) {
    return { ok: false, error: validationError(baseline.error) };
  }
  const actual = MeasureValueSchema.safeParse(input.actualMeasure);
  if (!actual.success) {
    return { ok: false, error: validationError(actual.error) };
  }
  if (baseline.data.kind !== actual.data.kind) {
    return {
      ok: false,
      error: {
        code: 'measure-kind-mismatch',
        message: `the baseline measure is a ${baseline.data.kind} but the actual measure is a ${actual.data.kind} — one variance folds one measure kind`,
        baselineKind: baseline.data.kind,
        actualKind: actual.data.kind,
        subject: input.varianceId,
      },
    };
  }
  if (
    baseline.data.kind === 'quantity' &&
    actual.data.kind === 'quantity' &&
    baseline.data.unit !== actual.data.unit
  ) {
    return {
      ok: false,
      error: {
        code: 'measure-kind-mismatch',
        message: `the baseline measure unit is "${baseline.data.unit}" but the actual measure carries "${actual.data.unit}" — one variance folds one unit`,
        baselineKind: `quantity:${baseline.data.unit}`,
        actualKind: `quantity:${actual.data.unit}`,
        subject: input.varianceId,
      },
    };
  }
  if (
    baseline.data.kind === 'cost' &&
    actual.data.kind === 'cost' &&
    baseline.data.currency !== actual.data.currency
  ) {
    return {
      ok: false,
      error: {
        code: 'measure-kind-mismatch',
        message: `the baseline measure currency is "${baseline.data.currency}" but the actual measure carries "${actual.data.currency}" — one variance folds one currency`,
        baselineKind: `cost:${baseline.data.currency}`,
        actualKind: `cost:${actual.data.currency}`,
        subject: input.varianceId,
      },
    };
  }
  const baselineValue = measureValueOf(baseline.data);
  const actualValue = measureValueOf(actual.data);
  const difference = subtractNonNegativeDecimals(actualValue, baselineValue);
  const magnitude = difference.magnitude;
  const isExact = compareNonNegativeDecimals(magnitude, '0') === 0;
  const direction = isExact ? 'neutral' : directionOf(input.varianceClass, difference.negative);
  const band = bandOf(magnitude, input.thresholds);
  const content = {
    schema: VARIANCE_RECORD_SCHEMA_NAME,
    schemaVersion: VARIANCE_RECORD_VERSION,
    varianceId: input.varianceId,
    tenantId: input.tenantId,
    solutionId: input.solutionId,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    varianceClass: input.varianceClass,
    baselineRef: input.baselineRef,
    actualRef: input.actualRef,
    baselineMeasure: baseline.data,
    actualMeasure: actual.data,
    magnitude,
    direction,
    band,
    evidence: [...input.evidence].sort(),
    confidence: input.confidence,
    computedAt: input.computedAt,
    computedBy: input.computedBy,
  };
  return sealVarianceRecord(content);
}

/** The direction of one NON-ZERO variance under the class polarity table. */
function directionOf(varianceClass: VarianceClass, actualBelowBaseline: boolean): VarianceDirection {
  if (varianceClass === 'change') {
    // Direction-neutral by construction (the class vocabulary pin).
    return 'neutral';
  }
  const polarity = VARIANCE_CLASS_POLARITY[varianceClass];
  if (polarity === 'direction-neutral') {
    return 'neutral';
  }
  // actual < baseline -> negative delta; actual > baseline -> positive delta.
  if (actualBelowBaseline) {
    return polarity === 'higher-is-favorable' ? 'adverse' : 'favorable';
  }
  return polarity === 'higher-is-favorable' ? 'favorable' : 'adverse';
}

/** The magnitude band of one deviation under the thresholds. */
function bandOf(magnitude: string, thresholds: BandThresholds): VarianceMagnitudeBand {
  if (compareNonNegativeDecimals(magnitude, '0') === 0) {
    return 'immaterial';
  }
  if (compareNonNegativeDecimals(magnitude, thresholds.minor) <= 0) {
    return 'minor';
  }
  if (compareNonNegativeDecimals(magnitude, thresholds.material) <= 0) {
    return 'material';
  }
  if (compareNonNegativeDecimals(magnitude, thresholds.severe) <= 0) {
    return 'severe';
  }
  return 'severe';
}

// --------------------------------------------------------------------------------
// The append-only variance ledger (reference in-memory).
// --------------------------------------------------------------------------------

/** The state of one variance ledger after admissions. */
export interface VarianceLedger {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly records: readonly SealedVarianceRecord[];
}

/** An empty variance ledger for one (tenant, solution) scope. */
export function openVarianceLedger(scope: {
  readonly tenantId: string;
  readonly solutionId: string;
}): VarianceLedger {
  return { tenantId: scope.tenantId, solutionId: scope.solutionId, records: [] };
}

/**
 * Admit a sealed variance record into the ledger (append-only): the
 * record verifies (tamper detection), the tenant/solution scope must
 * match, an exact re-admission is idempotent, and the same id with
 * different content is a typed `version-conflict`.
 */
export function admitVarianceRecord(
  ledger: VarianceLedger,
  record: unknown,
): VarianceResult<VarianceLedger> {
  const verified = verifySealedVarianceRecord(record);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  if (admitted.tenantId !== ledger.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `variance record "${admitted.varianceId}" belongs to tenant "${admitted.tenantId}" but the ledger is scoped to "${ledger.tenantId}" (R12)`,
        expectedTenantId: ledger.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.varianceId,
      },
    };
  }
  if (admitted.solutionId !== ledger.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `variance record "${admitted.varianceId}" subjects solution "${admitted.solutionId}" but the ledger is scoped to "${ledger.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'variance/ledger solution mismatch' }],
      },
    };
  }
  const existing = ledger.records.find((record) => record.varianceId === admitted.varianceId);
  if (existing !== undefined) {
    if (existing.contentDigest === admitted.contentDigest) {
      return { ok: true, value: ledger };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `variance record "${admitted.varianceId}" is already sealed with different content — a sealed variance record is immutable; changed content ships as a NEW variance id`,
        subject: 'variance-record',
        subjectId: admitted.varianceId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  return { ok: true, value: { ...ledger, records: [...ledger.records, admitted] } };
}

/** The ledger fold: records sorted by varianceId (deterministic). */
export function foldVarianceRecords(ledger: VarianceLedger): readonly SealedVarianceRecord[] {
  return [...ledger.records].sort((a, b) => (a.varianceId < b.varianceId ? -1 : 1));
}

/**
 * The explainable-variance fold: every admitted record summarized by
 * (class, direction, band) with exact magnitude totals — the
 * explainability view (input order never leaks).
 */
export interface VarianceClassSummary {
  readonly varianceClass: VarianceClass;
  readonly direction: VarianceDirection;
  readonly band: VarianceMagnitudeBand;
  readonly count: number;
  readonly totalMagnitude: string;
}

/** Fold the ledger into the per-(class, direction, band) explainability summary. */
export function foldVarianceSummary(ledger: VarianceLedger): readonly VarianceClassSummary[] {
  const groups = new Map<string, VarianceClassSummary & { total: string }>();
  for (const record of foldVarianceRecords(ledger)) {
    const key = `${record.varianceClass}\u0000${record.direction}\u0000${record.band}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, {
        varianceClass: record.varianceClass,
        direction: record.direction,
        band: record.band,
        count: 1,
        totalMagnitude: record.magnitude,
        total: record.magnitude,
      });
    } else {
      groups.set(key, {
        ...existing,
        count: existing.count + 1,
        total: addNonNegativeDecimals(existing.total, record.magnitude),
      });
    }
  }
  return [...groups.values()]
    .map(({ total, ...row }) => ({ ...row, totalMagnitude: total }))
    .sort((a, b) => {
      if (a.varianceClass !== b.varianceClass) return a.varianceClass < b.varianceClass ? -1 : 1;
      if (a.direction !== b.direction) return a.direction < b.direction ? -1 : 1;
      return a.band < b.band ? -1 : 1;
    });
}
