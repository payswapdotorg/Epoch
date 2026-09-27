/**
 * CALIBRATION METRICS (the W040 pin): deterministic folds per (model,
 * version, applicability scope) — bias, MAE-class summaries, hit-rate
 * against tolerance bands, per-domain-pack and per-realization-variant
 * breakdowns — every metric record carrying the DATASET DIGEST + the
 * EXACT FOLD DEFINITION that produced it.
 *
 * - The fold selects the dataset rows matching one APPLICABILITY scope
 *   (measure class + optional domain-pack id + optional realization
 *   variant); the scope is the model revision's applicability (the
 *   registry pins it; a metric set calibrates a model IN ITS SCOPE);
 * - BIAS: counts by forecast-bias direction + the exact over/under
 *   totals + the signed net and mean deviation (truncating fixed-point
 *   division at scale 9 — the exact totals ride alongside, nothing is
 *   lost);
 * - MAE: the exact total absolute deviation + the truncating mean + the
 *   worst deviation with its row reference;
 * - HIT-RATE: the within-tolerance fraction per DECLARED tolerance band
 *   (the W005 scored-scale discipline: non-degenerate, sorted, declared
 *   scales — never implicit defaults);
 * - BREAKDOWNS: per-domain-pack and per-realization-variant slices of
 *   the SAME selected rows (DP1.0 context preserved WITHOUT pack-keyed
 *   stores — the pack dimension of the universal dataset, projected);
 * - every metric set carries W005-convention JUSTIFICATION entries
 *   naming the dataset, model revision, and fold definition it rests on
 *   (judgment without a referenceable justification is inexpressible);
 * - the metric id derives deterministically from the fold definition —
 *   identical fold inputs derive identical metric ids AND identical
 *   metric digests (pure fold: no timestamps, no principals, zero
 *   wall-clock; the fold instant lives in the `learning:metrics-folded`
 *   EVENT, never in the record);
 * - ZERO float math: every arithmetic step is exact decimal-string
 *   arithmetic (decimal.ts).
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { REALIZATION_VARIANTS } from '@epoch/solution-delivery';
import {
  CALIBRATION_METRIC_SET_SCHEMA_NAME,
  LEARNING_CALIBRATION_RECORD_VERSION,
  LEARNING_JUSTIFICATION_KINDS,
  LEARNING_METRIC_SPEC_VERSION,
  LEARNING_METRIC_SUMMARY_KINDS,
  scopeSlug,
} from './version';
import {
  LearningDatasetIdSchema,
  LearningMetricIdSchema,
  LearningModelIdSchema,
  LearningRevisionIdSchema,
  LearningRowIdSchema,
  NonNegativeDecimalSchema,
  Sha256HexSchema,
  SolutionIdSchema,
} from './primitives';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  addNonNegativeDecimals,
  compareNonNegativeDecimals,
  divideNonNegativeDecimals,
  subtractNonNegativeDecimals,
} from './decimal';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { LearningResult } from './errors';
import type { SealedLearningDataset, SealedDatasetRow } from './dataset';

// --------------------------------------------------------------------------------
// The applicability scope (the fold's row selector).
// --------------------------------------------------------------------------------

/** The qualified pack-id grammar (the W036 pack-reference id grammar). */
const PACK_ID_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9-]+)+$/;

/**
 * The APPLICABILITY SCOPE of one metric fold (and of the model revision
 * it calibrates): the measure class plus the optional domain-pack and
 * realization-variant selectors. `null` means ALL packs / ALL variants
 * (the universal slice). DP1.0 context enters by TYPED pack id — never
 * a pack-keyed history store (the projection discipline of
 * projections.ts).
 */
export const LearningApplicabilitySchema = z
  .strictObject({
    measureClass: z.enum(['quantity', 'cost', 'progress', 'instant']),
    packId: z.string().regex(PACK_ID_PATTERN).nullable(),
    realizationVariant: z.enum(REALIZATION_VARIANTS).nullable(),
  })
  .readonly()
  .meta({
    id: 'LearningApplicability',
    title: 'LearningApplicability',
    description:
      'The applicability scope of one calibration fold (and of the model revision it calibrates): measure class plus optional domain-pack and realization-variant selectors (null = all).',
  });

/** One applicability scope. */
export type LearningApplicability = z.infer<typeof LearningApplicabilitySchema>;

/** Whether one dataset row falls inside one applicability scope (deterministic). */
export function rowMatchesApplicability(
  row: SealedDatasetRow,
  applicability: LearningApplicability,
): boolean {
  if (row.measureClass !== applicability.measureClass) {
    return false;
  }
  if (applicability.packId !== null && row.packRef.packId !== applicability.packId) {
    return false;
  }
  if (
    applicability.realizationVariant !== null &&
    row.realizationVariant !== applicability.realizationVariant
  ) {
    return false;
  }
  return true;
}

// --------------------------------------------------------------------------------
// The tolerance bands (the W005 scored-scale discipline).
// --------------------------------------------------------------------------------

/**
 * The DECLARED tolerance bands of one hit-rate fold — non-degenerate
 * scales: canonical non-negative decimals, STRICTLY ascending (sorted,
 * duplicate-free), at least one, at most sixteen. Never implicit
 * defaults: the bands are part of the sealed fold definition.
 */
export const ToleranceBandsSchema = z
  .array(NonNegativeDecimalSchema)
  .min(1, 'a hit-rate fold declares at least one tolerance band')
  .max(16)
  .superRefine((bands, ctx) => {
    for (let i = 1; i < bands.length; i += 1) {
      if (compareNonNegativeDecimals(bands[i]!, bands[i - 1]!) <= 0) {
        ctx.addIssue({
          code: 'custom',
          message:
            'tolerance bands are non-degenerate declared scales: strictly ascending, duplicate-free',
          path: [i],
        });
        break;
      }
    }
  })
  .meta({
    id: 'ToleranceBands',
    title: 'ToleranceBands',
    description:
      'The declared tolerance bands of one hit-rate fold: canonical non-negative decimals, strictly ascending (non-degenerate scored scales).',
  });

/** One declared tolerance-band set. */
export type ToleranceBands = z.infer<typeof ToleranceBandsSchema>;

// --------------------------------------------------------------------------------
// The summaries.
// --------------------------------------------------------------------------------

/** One signed deviation value: sign + canonical non-negative magnitude. */
export const SignedDeviationSchema = z
  .strictObject({
    negative: z.boolean(),
    magnitude: NonNegativeDecimalSchema,
  })
  .readonly()
  .meta({
    id: 'SignedDeviation',
    title: 'SignedDeviation',
    description:
      'One signed deviation value: whether the net deviation is negative (under-forecast exceeds over-forecast) plus the canonical non-negative magnitude.',
  });

/** One signed deviation. */
export type SignedDeviation = z.infer<typeof SignedDeviationSchema>;

/** The BIAS summary of one fold: direction counts + exact totals + signed net/mean. */
export const BiasSummarySchema = z
  .strictObject({
    overCount: z.number().int().min(0).max(4096),
    underCount: z.number().int().min(0).max(4096),
    exactCount: z.number().int().min(0).max(4096),
    overTotalDeviation: NonNegativeDecimalSchema,
    underTotalDeviation: NonNegativeDecimalSchema,
    netDeviation: SignedDeviationSchema,
    meanDeviation: SignedDeviationSchema,
  })
  .readonly()
  .meta({
    id: 'BiasSummary',
    title: 'BiasSummary',
    description:
      'The bias summary of one calibration fold: counts by forecast-bias direction, the exact over/under totals, and the signed net and (truncating) mean deviation.',
  });

/** One bias summary. */
export type BiasSummary = z.infer<typeof BiasSummarySchema>;

/** The MAE-class summary of one fold: exact total + truncating mean + worst row. */
export const MeanAbsoluteErrorSummarySchema = z
  .strictObject({
    totalAbsoluteDeviation: NonNegativeDecimalSchema,
    mean: NonNegativeDecimalSchema,
    worstDeviation: z
      .strictObject({
        rowId: LearningRowIdSchema,
        deviation: NonNegativeDecimalSchema,
      })
      .readonly()
      .nullable(),
  })
  .readonly()
  .meta({
    id: 'MeanAbsoluteErrorSummary',
    title: 'MeanAbsoluteErrorSummary',
    description:
      'The MAE-class summary of one calibration fold: the exact total absolute deviation, the truncating mean absolute error, and the worst deviation with its row reference.',
  });

/** One MAE-class summary. */
export type MeanAbsoluteErrorSummary = z.infer<typeof MeanAbsoluteErrorSummarySchema>;

/** One hit-rate summary: the within-tolerance fraction at one declared band. */
export const HitRateSummarySchema = z
  .strictObject({
    tolerance: NonNegativeDecimalSchema,
    withinCount: z.number().int().min(0).max(4096),
    outsideCount: z.number().int().min(0).max(4096),
    hitRate: NonNegativeDecimalSchema,
  })
  .readonly()
  .meta({
    id: 'HitRateSummary',
    title: 'HitRateSummary',
    description:
      'One hit-rate summary: the declared tolerance band, the within/outside counts, and the exact truncating within fraction.',
  });

/** One hit-rate summary. */
export type HitRateSummary = z.infer<typeof HitRateSummarySchema>;

/** One per-domain-pack breakdown slice of a fold's selected rows. */
export const PackBreakdownSchema = z
  .strictObject({
    packId: z.string().regex(PACK_ID_PATTERN),
    rowCount: z.number().int().min(1).max(4096),
    overCount: z.number().int().min(0).max(4096),
    underCount: z.number().int().min(0).max(4096),
    exactCount: z.number().int().min(0).max(4096),
    totalAbsoluteDeviation: NonNegativeDecimalSchema,
  })
  .readonly()
  .meta({
    id: 'PackBreakdown',
    title: 'PackBreakdown',
    description:
      'One per-domain-pack breakdown slice: the pack id, the row/direction counts, and the exact total absolute deviation of that pack rows.',
  });

/** One pack breakdown. */
export type PackBreakdown = z.infer<typeof PackBreakdownSchema>;

/** One per-realization-variant breakdown slice of a fold's selected rows. */
export const VariantBreakdownSchema = z
  .strictObject({
    realizationVariant: z.enum(REALIZATION_VARIANTS),
    rowCount: z.number().int().min(1).max(4096),
    overCount: z.number().int().min(0).max(4096),
    underCount: z.number().int().min(0).max(4096),
    exactCount: z.number().int().min(0).max(4096),
    totalAbsoluteDeviation: NonNegativeDecimalSchema,
  })
  .readonly()
  .meta({
    id: 'VariantBreakdown',
    title: 'VariantBreakdown',
    description:
      'One per-realization-variant breakdown slice: the variant, the row/direction counts, and the exact total absolute deviation of that variant rows.',
  });

/** One variant breakdown. */
export type VariantBreakdown = z.infer<typeof VariantBreakdownSchema>;

/** One W005-convention machine-referenceable justification entry. */
export const MetricJustificationSchema = z
  .strictObject({
    kind: z.enum(LEARNING_JUSTIFICATION_KINDS),
    reference: z.string().min(1).max(128),
  })
  .readonly()
  .meta({
    id: 'MetricJustification',
    title: 'MetricJustification',
    description:
      'One machine-referenceable justification entry of a metric set: the kind (dataset / model / fold-definition / observation) plus the record id or digest it rests on.',
  });

/** One metric justification entry. */
export type MetricJustification = z.infer<typeof MetricJustificationSchema>;

// --------------------------------------------------------------------------------
// The calibration-metric-set record.
// --------------------------------------------------------------------------------

/**
 * The immutable content of one calibration-metric set — the
 * deterministic fold of one (model revision, applicability scope) over
 * one sealed dataset: the exact fold definition (dataset reference by
 * digest, applicability, tolerance bands, metric-spec version), the
 * three summaries (bias / mean-absolute-error / hit-rate), the
 * per-domain-pack and per-realization-variant breakdowns, and the
 * W005-convention justification entries. NO timestamps, NO principals —
 * the fold instant lives in the `learning:metrics-folded` event.
 */
const calibrationMetricSetShape = z.strictObject({
  schema: z.literal(CALIBRATION_METRIC_SET_SCHEMA_NAME),
  schemaVersion: z.literal(LEARNING_CALIBRATION_RECORD_VERSION),
  metricId: LearningMetricIdSchema,
  tenantId: TenantIdSchema,
  solutionId: SolutionIdSchema,
  modelRef: z
    .strictObject({
      modelId: LearningModelIdSchema,
      revisionId: LearningRevisionIdSchema,
      contentDigest: Sha256HexSchema,
    })
    .readonly(),
  foldDefinition: z
    .strictObject({
      datasetRef: z
        .strictObject({
          datasetId: LearningDatasetIdSchema,
          contentDigest: Sha256HexSchema,
        })
        .readonly(),
      applicability: LearningApplicabilitySchema,
      toleranceBands: ToleranceBandsSchema,
      metricSpecVersion: z.literal(LEARNING_METRIC_SPEC_VERSION),
    })
    .readonly(),
  summaryKinds: z.array(z.enum(LEARNING_METRIC_SUMMARY_KINDS)).min(1).max(3),
  selectedRowCount: z.number().int().min(1).max(4096),
  bias: BiasSummarySchema,
  meanAbsoluteError: MeanAbsoluteErrorSummarySchema,
  hitRates: z.array(HitRateSummarySchema).min(1).max(16),
  packBreakdowns: z.array(PackBreakdownSchema).max(64),
  variantBreakdowns: z.array(VariantBreakdownSchema).max(8),
  justification: z.array(MetricJustificationSchema).min(1).max(8),
});

export const CalibrationMetricSetContentSchema = calibrationMetricSetShape
  .readonly()
  .superRefine((metricSet, ctx) => {
    // summaryKinds: exactly the closed vocabulary, canonically ordered.
    const expected = [...LEARNING_METRIC_SUMMARY_KINDS].sort();
    const actual = [...metricSet.summaryKinds].sort();
    if (actual.length !== expected.length || actual.some((kind, i) => kind !== expected[i])) {
      ctx.addIssue({
        code: 'custom',
        message: `summaryKinds is exactly the closed metric vocabulary in canonical order (${expected.join(', ')})`,
        path: ['summaryKinds'],
      });
    }
    // Bias counts sum to the selected row count.
    if (
      metricSet.bias.overCount + metricSet.bias.underCount + metricSet.bias.exactCount !==
      metricSet.selectedRowCount
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'the bias direction counts must sum to selectedRowCount',
        path: ['bias'],
      });
    }
    // Hit rates: one per declared band, in band order, partitioning the rows.
    if (metricSet.hitRates.length !== metricSet.foldDefinition.toleranceBands.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'hitRates carries exactly one summary per declared tolerance band',
        path: ['hitRates'],
      });
    } else {
      for (let i = 0; i < metricSet.hitRates.length; i += 1) {
        if (metricSet.hitRates[i]!.tolerance !== metricSet.foldDefinition.toleranceBands[i]) {
          ctx.addIssue({
            code: 'custom',
            message: 'hitRates follows the declared tolerance-band order',
            path: ['hitRates', i],
          });
          break;
        }
        if (
          metricSet.hitRates[i]!.withinCount + metricSet.hitRates[i]!.outsideCount !==
          metricSet.selectedRowCount
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'withinCount + outsideCount must sum to selectedRowCount',
            path: ['hitRates', i],
          });
          break;
        }
      }
    }
    // Pack breakdowns: sorted by packId, duplicate-free, counts consistent.
    for (let i = 1; i < metricSet.packBreakdowns.length; i += 1) {
      if (metricSet.packBreakdowns[i]!.packId <= metricSet.packBreakdowns[i - 1]!.packId) {
        ctx.addIssue({
          code: 'custom',
          message: 'packBreakdowns must be sorted by packId ascending, duplicate-free',
          path: ['packBreakdowns'],
        });
        break;
      }
    }
    for (const breakdown of metricSet.packBreakdowns) {
      if (
        breakdown.overCount + breakdown.underCount + breakdown.exactCount !==
        breakdown.rowCount
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'the pack breakdown direction counts must sum to rowCount',
          path: ['packBreakdowns'],
        });
        break;
      }
    }
    // Variant breakdowns: sorted by variant, duplicate-free, counts consistent.
    for (let i = 1; i < metricSet.variantBreakdowns.length; i += 1) {
      if (
        metricSet.variantBreakdowns[i]!.realizationVariant <=
        metricSet.variantBreakdowns[i - 1]!.realizationVariant
      ) {
        ctx.addIssue({
          code: 'custom',
          message:
            'variantBreakdowns must be sorted by realizationVariant ascending, duplicate-free',
          path: ['variantBreakdowns'],
        });
        break;
      }
    }
    for (const breakdown of metricSet.variantBreakdowns) {
      if (
        breakdown.overCount + breakdown.underCount + breakdown.exactCount !==
        breakdown.rowCount
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'the variant breakdown direction counts must sum to rowCount',
          path: ['variantBreakdowns'],
        });
        break;
      }
    }
    // Justification: sorted by (kind, reference), duplicate-free.
    for (let i = 1; i < metricSet.justification.length; i += 1) {
      const a = metricSet.justification[i - 1]!;
      const b = metricSet.justification[i]!;
      if (a.kind > b.kind || (a.kind === b.kind && a.reference >= b.reference)) {
        ctx.addIssue({
          code: 'custom',
          message: 'justification entries must be sorted by (kind, reference), duplicate-free',
          path: ['justification'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'CalibrationMetricSetContent',
    title: 'CalibrationMetricSetContent',
    description:
      'The immutable content of one calibration-metric set: the exact fold definition, the bias/MAE/hit-rate summaries, the per-pack and per-variant breakdowns, and the machine-referenceable justification entries.',
  });

/** One calibration-metric-set content. */
export type CalibrationMetricSetContent = z.infer<typeof CalibrationMetricSetContentSchema>;

/** The SEALED calibration-metric set: content plus its SHA-256 content digest. */
export const SealedCalibrationMetricSetSchema = z
  .strictObject({
    ...calibrationMetricSetShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedCalibrationMetricSet',
    title: 'SealedCalibrationMetricSet',
    description:
      'The sealed calibration-metric set: immutable fold content plus its SHA-256 content digest (identical fold inputs derive identical digests).',
  });

/** One sealed calibration-metric set. */
export type SealedCalibrationMetricSet = z.infer<typeof SealedCalibrationMetricSetSchema>;

/** Compute the content digest of a metric-set content (canonical JSON). */
export function computeCalibrationMetricSetDigest(
  content: CalibrationMetricSetContent,
): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid metric-set content into its published record. */
export function sealCalibrationMetricSet(
  content: unknown,
): LearningResult<SealedCalibrationMetricSet> {
  const parsed = CalibrationMetricSetContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed calibration-metric set (schema + digest recomputation). */
export function verifySealedCalibrationMetricSet(
  sealed: unknown,
): LearningResult<SealedCalibrationMetricSet> {
  const parsed = SealedCalibrationMetricSetSchema.safeParse(sealed);
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
          'sealed calibration-metric set digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The deterministic metric fold.
// --------------------------------------------------------------------------------

/** The model-revision reference + applicability a fold calibrates. */
export interface MetricModelScope {
  /** The model id. */
  readonly modelId: string;
  /** The exact model-revision id. */
  readonly revisionId: string;
  /** The content digest of that exact revision. */
  readonly contentDigest: string;
  /** The revision's applicability scope (the fold's row selector). */
  readonly applicability: LearningApplicability;
}

/** The options of {@link foldCalibrationMetrics}. */
export interface MetricFoldOptions {
  /** The declared tolerance bands of the hit-rate fold (never implicit defaults). */
  readonly toleranceBands: readonly string[];
}

/** Fold a non-empty list of canonical decimals into its exact total. */
function foldTotal(deviations: readonly string[]): string {
  return deviations.reduce((total, deviation) => addNonNegativeDecimals(total, deviation), '0');
}

/**
 * FOLD the calibration-metric set of one (model revision, applicability
 * scope) over one sealed dataset — the deterministic fold:
 *
 * 1. the applicability + tolerance bands VALIDATE (typed rejections);
 *    the dataset matches the fold scope (tenant R12 + solution);
 * 2. the rows SELECTED by the applicability scope must number at least
 *    one (an empty scope slice is a typed validation rejection — the
 *    bias/MAE/hit-rate folds are undefined over zero rows);
 * 3. BIAS / MAE / HIT-RATE fold over the selected rows with EXACT
 *    decimal arithmetic (truncating division at scale 9; the exact
 *    totals ride alongside every truncated mean);
 * 4. the pack and variant BREAKDOWNS group the SAME selected rows;
 * 5. the metric id derives from the canonical fold digest — identical
 *    fold inputs derive identical ids and digests;
 * 6. the result seals.
 *
 * The dataset is READ-ONLY (history-immutable — the fold never mutates
 * its source; no write path exists).
 */
export function foldCalibrationMetrics(
  scope: { readonly tenantId: string; readonly solutionId: string },
  dataset: SealedLearningDataset,
  model: MetricModelScope,
  options: MetricFoldOptions,
): LearningResult<SealedCalibrationMetricSet> {
  // 1. Validate the fold inputs.
  const applicability = LearningApplicabilitySchema.safeParse(model.applicability);
  if (!applicability.success) {
    return { ok: false, error: validationError(applicability.error) };
  }
  const bands = ToleranceBandsSchema.safeParse(options.toleranceBands);
  if (!bands.success) {
    return { ok: false, error: validationError(bands.error) };
  }
  const toleranceBands = bands.data;
  if (dataset.tenantId !== scope.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `dataset "${dataset.datasetId}" belongs to tenant "${dataset.tenantId}" but the fold scope is "${scope.tenantId}" (R12)`,
        expectedTenantId: scope.tenantId,
        encounteredTenantId: dataset.tenantId,
        subject: dataset.datasetId,
      },
    };
  }
  if (dataset.solutionId !== scope.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `dataset "${dataset.datasetId}" subjects solution "${dataset.solutionId}" but the fold scope is "${scope.solutionId}"`,
        issues: [{ path: 'datasetId', message: 'dataset/scope solution mismatch' }],
      },
    };
  }

  // 2. Select the rows inside the applicability scope.
  const selected = dataset.rows.filter((row) =>
    rowMatchesApplicability(row, applicability.data),
  );
  if (selected.length === 0) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message:
          'the applicability scope selects at least one dataset row — the bias/MAE/hit-rate folds are undefined over zero rows',
        issues: [{ path: 'applicability', message: 'empty scope slice' }],
      },
    };
  }

  // 3. Bias / MAE / hit-rate over the selected rows (exact decimals).
  const overRows = selected.filter((row) => row.features.bias === 'over-forecast');
  const underRows = selected.filter((row) => row.features.bias === 'under-forecast');
  const exactRows = selected.filter((row) => row.features.bias === 'exact');
  const overTotal = foldTotal(overRows.map((row) => row.features.deviationMagnitude));
  const underTotal = foldTotal(underRows.map((row) => row.features.deviationMagnitude));
  const totalAbsoluteDeviation = foldTotal(
    selected.map((row) => row.features.deviationMagnitude),
  );
  const netDeviation = subtractNonNegativeDecimals(overTotal, underTotal);
  const meanDeviation: SignedDeviation = {
    negative: netDeviation.negative,
    magnitude: divideNonNegativeDecimals(netDeviation.magnitude, selected.length, 9),
  };
  const mean = divideNonNegativeDecimals(totalAbsoluteDeviation, selected.length, 9);

  // The worst deviation with its row (first maximum in rowId order — deterministic).
  let worst: { rowId: string; deviation: string } | null = null;
  for (const row of selected) {
    if (
      worst === null ||
      compareNonNegativeDecimals(row.features.deviationMagnitude, worst.deviation) > 0
    ) {
      worst = { rowId: row.rowId, deviation: row.features.deviationMagnitude };
    }
  }

  // 4. Hit-rate per declared band + the pack/variant breakdowns.
  const hitRates: HitRateSummary[] = toleranceBands.map((tolerance) => {
    const withinCount = selected.filter(
      (row) => compareNonNegativeDecimals(row.features.deviationMagnitude, tolerance) <= 0,
    ).length;
    return {
      tolerance,
      withinCount,
      outsideCount: selected.length - withinCount,
      hitRate: divideNonNegativeDecimals(String(withinCount), selected.length, 9),
    };
  });

  const packGroups = new Map<string, SealedDatasetRow[]>();
  for (const row of selected) {
    const group = packGroups.get(row.packRef.packId) ?? [];
    group.push(row);
    packGroups.set(row.packRef.packId, group);
  }
  const packBreakdowns: PackBreakdown[] = [...packGroups.entries()]
    .map(([packId, rows]) => ({
      packId,
      rowCount: rows.length,
      overCount: rows.filter((row) => row.features.bias === 'over-forecast').length,
      underCount: rows.filter((row) => row.features.bias === 'under-forecast').length,
      exactCount: rows.filter((row) => row.features.bias === 'exact').length,
      totalAbsoluteDeviation: foldTotal(rows.map((row) => row.features.deviationMagnitude)),
    }))
    .sort((a, b) => (a.packId < b.packId ? -1 : 1));

  const variantGroups = new Map<string, SealedDatasetRow[]>();
  for (const row of selected) {
    const group = variantGroups.get(row.realizationVariant) ?? [];
    group.push(row);
    variantGroups.set(row.realizationVariant, group);
  }
  const variantBreakdowns: VariantBreakdown[] = [...variantGroups.entries()]
    .map(([realizationVariant, rows]) => ({
      realizationVariant: realizationVariant as (typeof REALIZATION_VARIANTS)[number],
      rowCount: rows.length,
      overCount: rows.filter((row) => row.features.bias === 'over-forecast').length,
      underCount: rows.filter((row) => row.features.bias === 'under-forecast').length,
      exactCount: rows.filter((row) => row.features.bias === 'exact').length,
      totalAbsoluteDeviation: foldTotal(rows.map((row) => row.features.deviationMagnitude)),
    }))
    .sort((a, b) => (a.realizationVariant < b.realizationVariant ? -1 : 1));

  // 5. The deterministic metric id + the auto-derived justification.
  const modelRef = {
    modelId: model.modelId,
    revisionId: model.revisionId,
    contentDigest: model.contentDigest,
  };
  const foldDefinition = {
    datasetRef: { datasetId: dataset.datasetId, contentDigest: dataset.contentDigest },
    applicability: applicability.data,
    toleranceBands,
    metricSpecVersion: LEARNING_METRIC_SPEC_VERSION,
  };
  const foldDigest = canonicalDigest({ modelRef, foldDefinition } as unknown as JsonValue);
  const metricId = `metrics:${scopeSlug(scope.solutionId)}-${foldDigest.slice(0, 8)}`;
  const justificationEntries: MetricJustification[] = [
    { kind: 'dataset', reference: dataset.datasetId },
    { kind: 'fold-definition', reference: foldDigest },
    { kind: 'model', reference: model.revisionId },
  ];
  const justification = justificationEntries.sort((a, b) =>
    a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.reference < b.reference ? -1 : 1,
  );

  // 6. Seal.
  return sealCalibrationMetricSet({
    schema: CALIBRATION_METRIC_SET_SCHEMA_NAME,
    schemaVersion: LEARNING_CALIBRATION_RECORD_VERSION,
    metricId,
    tenantId: scope.tenantId,
    solutionId: scope.solutionId,
    modelRef,
    foldDefinition,
    summaryKinds: [...LEARNING_METRIC_SUMMARY_KINDS].sort(),
    selectedRowCount: selected.length,
    bias: {
      overCount: overRows.length,
      underCount: underRows.length,
      exactCount: exactRows.length,
      overTotalDeviation: overTotal,
      underTotalDeviation: underTotal,
      netDeviation,
      meanDeviation,
    },
    meanAbsoluteError: {
      totalAbsoluteDeviation,
      mean,
      worstDeviation: worst,
    },
    hitRates,
    packBreakdowns,
    variantBreakdowns,
    justification,
  });
}
