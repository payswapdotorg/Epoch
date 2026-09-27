/**
 * ROLLING COMPLETION AND COST FORECASTS (the W039 pin): deterministic
 * forecast functions producing the NEXT forecast revision from current
 * actuals + remaining plan — forecasts are NEW sealed records
 * (append-only), never mutations of prior ones.
 *
 * - A rolling forecast IS a W036 Forecast-distinction record (kind
 *   `forecast`, measure = the projected total at completion, payload =
 *   { asOf, refines }): built here, sealed through the REAL W036
 *   `sealDistinctionRecord` — the forecast record is a W036 record,
 *   never an actualization-native re-implementation (the W037
 *   commitment precedent).
 * - The revision discipline is the W036 ledger's: `refines` may
 *   reference an EARLIER FORECAST only — a forecast refining any other
 *   record (or a missing one) is a typed `forecast-overwrite-rejected`
 *   surfaced through the W036 adapter. Revisions are APPEND-ONLY: the
 *   same record id + content re-admits idempotently (replay); the same
 *   id with different content is a typed `version-conflict`.
 * - Determinism: remaining = max(0, planned - actual) and
 *   atCompletion = actual + remaining x performanceFactor are EXACT
 *   fixed-point decimal folds (bigint-scaled, canonical output — never
 *   float math); identical inputs derive identical digests.
 * - Every forecast carries the full typed uncertainty state
 *   (provenance + freshness + confidence — the confidence/calibration
 *   state requirement).
 */
import { z } from 'zod';
import {
  type DistinctionLedger,
  type DistinctionSubject,
  type SealedDistinctionRecord,
  admitDistinctionRecord,
  sealDistinctionRecord,
} from '@epoch/solution-delivery';
import { ACTUALIZATION_RECORD_VERSION } from './version';
import { adaptDeliveryResult } from './w036-adapter';
import {
  addNonNegativeDecimals,
  clampSubtractNonNegativeDecimals,
  compareNonNegativeDecimals,
  multiplyNonNegativeDecimals,
} from './decimal';
import type { ActualizationResult } from './errors';

// --------------------------------------------------------------------------------
// The rolling-forecast plan measure (the remaining-plan input).
// --------------------------------------------------------------------------------

/** The planned quantity total (the plan side of a rolling completion forecast). */
export const PlannedQuantitySchema = z
  .strictObject({
    kind: z.literal('quantity'),
    value: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
    unit: z.string().min(1).max(32),
  })
  .readonly()
  .meta({
    id: 'PlannedQuantity',
    title: 'PlannedQuantity',
    description:
      'The planned quantity total of one rolling completion forecast: canonical decimal value plus unit-of-measure label.',
  });

/** The planned cost total (the plan side of a rolling cost forecast). */
export const PlannedCostSchema = z
  .strictObject({
    kind: z.literal('cost'),
    amount: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
    currency: z.string().regex(/^[A-Z]{3}$/),
  })
  .readonly()
  .meta({
    id: 'PlannedCost',
    title: 'PlannedCost',
    description:
      'The planned cost total of one rolling cost forecast: canonical decimal amount plus ISO 4217 currency code.',
  });

/** One planned measure (quantity or cost). */
export const PlannedMeasureSchema = z
  .discriminatedUnion('kind', [PlannedQuantitySchema, PlannedCostSchema])
  .meta({
    id: 'PlannedMeasure',
    title: 'PlannedMeasure',
    description:
      'One rolling-forecast plan measure: a planned quantity total or a planned cost total (the remaining-plan input).',
  });

/** One planned quantity. */
export type PlannedQuantity = z.infer<typeof PlannedQuantitySchema>;

/** One planned cost. */
export type PlannedCost = z.infer<typeof PlannedCostSchema>;

/** One planned measure. */
export type PlannedMeasure = z.infer<typeof PlannedMeasureSchema>;

/** The actuals-to-date measure of the same kind (the fold side). */
export const ActualsToDateSchema = PlannedMeasureSchema.meta({
  id: 'ActualsToDate',
  title: 'ActualsToDate',
  description:
    'The actuals-to-date measure of one rolling forecast: the same shape as the planned measure, carrying the validated actuals fold to date.',
});

/** One actuals-to-date measure. */
export type ActualsToDate = z.infer<typeof ActualsToDateSchema>;

// --------------------------------------------------------------------------------
// The rolling-forecast input + detail.
// --------------------------------------------------------------------------------

/** The input of one rolling-forecast computation. */
export interface RollingForecastInput {
  /** The forecast record id (`forecast:<slug>`) — a NEW id per revision. */
  readonly recordId: string;
  readonly tenantId: string;
  /** The W036 distinction subject the forecast attaches to. */
  readonly subject: DistinctionSubject;
  /** The plan total (quantity or cost). */
  readonly planned: PlannedMeasure;
  /** The validated actuals fold to date (the same measure kind). */
  readonly actualsToDate: ActualsToDate;
  /**
   * The remaining-work performance assumption as a canonical decimal
   * ratio (e.g. "1.10": the remaining work is projected to take 110% of
   * its planned amount). Defaults to "1".
   */
  readonly performanceFactor?: string | undefined;
  /** The as-of instant of the validated delivery state being projected. */
  readonly asOf: string;
  /** The prior forecast revision this one refines (exact revision), or null for the first. */
  readonly refines: { readonly recordId: string; readonly contentDigest: string } | null;
  readonly recordedAt: string;
  readonly recordedBy: string;
  /** The typed uncertainty state (mandatory: provenance + freshness + confidence). */
  readonly uncertainty: unknown;
}

/** The explainability detail of one rolling forecast (deterministic, serializable). */
export interface RollingForecastDetail {
  /** The sealed W036 Forecast-distinction record (the append-only revision). */
  readonly record: SealedDistinctionRecord;
  /** The remaining planned amount: max(0, planned - actualsToDate) (exact). */
  readonly remaining: string;
  /** The projected total at completion: actualsToDate + remaining x factor (exact). */
  readonly atCompletion: string;
  /** The performance factor applied to the remaining work. */
  readonly performanceFactor: string;
  /** Whether the actuals-to-date already exhausted the plan (remaining clamped to 0). */
  readonly planExhausted: boolean;
}

/** The planned/actual value string of one measure side. */
function measureValue(measure: PlannedMeasure): string {
  return measure.kind === 'quantity' ? measure.value : measure.amount;
}

/**
 * Roll the NEXT forecast revision (completion or cost):
 *
 * - remaining = max(0, planned - actualsToDate) — EXACT clamped decimal
 *   subtraction;
 * - atCompletion = actualsToDate + remaining x performanceFactor — EXACT
 *   decimal multiplication and addition;
 * - the forecast measure is the projected TOTAL at completion in the
 *   plan's kind/unit/currency; the record is a W036
 *   Forecast-distinction record sealed through the REAL W036 machinery;
 * - the plan and the actuals must share kind AND unit/currency
 *   (`validation`);
 * - `refines` is carried verbatim into the W036 payload — the ledger
 *   admission enforces the forecast-refinement discipline.
 */
export function rollForecast(input: RollingForecastInput): ActualizationResult<RollingForecastDetail> {
  const factor = input.performanceFactor ?? '1';
  const factorPattern = /^(0|[1-9][0-9]*)(\.[0-9]+)?$/;
  if (!factorPattern.test(factor)) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'the performance factor must be a canonical non-negative decimal string (e.g. "1", "1.10")',
        issues: [{ path: 'performanceFactor', message: 'invalid canonical decimal' }],
      },
    };
  }
  if (input.planned.kind !== input.actualsToDate.kind) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `the plan is a ${input.planned.kind} measure but the actuals-to-date fold is a ${input.actualsToDate.kind} measure — a rolling forecast folds one measure kind`,
        issues: [
          { path: 'actualsToDate.kind', message: 'planned/actuals measure-kind mismatch' },
        ],
      },
    };
  }
  if (input.planned.kind === 'quantity' && input.actualsToDate.kind === 'quantity') {
    if (input.planned.unit !== input.actualsToDate.unit) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `the plan unit is "${input.planned.unit}" but the actuals-to-date fold carries "${input.actualsToDate.unit}" — a rolling quantity forecast folds one unit`,
          issues: [{ path: 'actualsToDate.unit', message: 'planned/actuals unit mismatch' }],
        },
      };
    }
  }
  if (input.planned.kind === 'cost' && input.actualsToDate.kind === 'cost') {
    if (input.planned.currency !== input.actualsToDate.currency) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `the plan currency is "${input.planned.currency}" but the actuals-to-date fold carries "${input.actualsToDate.currency}" — a rolling cost forecast folds one currency`,
          issues: [
            { path: 'actualsToDate.currency', message: 'planned/actuals currency mismatch' },
          ],
        },
      };
    }
  }
  const plannedValue = measureValue(input.planned);
  const actualValue = measureValue(input.actualsToDate);
  const remaining = clampSubtractNonNegativeDecimals(plannedValue, actualValue);
  const atCompletion = addNonNegativeDecimals(
    actualValue,
    multiplyNonNegativeDecimals(remaining, factor),
  );
  const measure =
    input.planned.kind === 'quantity'
      ? {
          kind: 'quantity' as const,
          value: atCompletion,
          unit: (input.planned as { readonly unit: string }).unit,
        }
      : {
          kind: 'cost' as const,
          amount: atCompletion,
          currency: (input.planned as { readonly currency: string }).currency,
        };
  const content = {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: ACTUALIZATION_RECORD_VERSION,
    kind: 'forecast' as const,
    recordId: input.recordId,
    tenantId: input.tenantId,
    subject: input.subject,
    measure,
    payload: {
      asOf: input.asOf,
      refines: input.refines === null ? null : input.refines.recordId,
    },
    recordedAt: input.recordedAt,
    recordedBy: input.recordedBy,
    uncertainty: input.uncertainty,
  };
  const sealed = sealDistinctionRecord(content);
  if (!sealed.ok) {
    // The uncertainty state is the one field this builder does not
    // pre-validate — surface W036's typed rejection through the adapter.
    return adaptDeliveryResult(sealed, input.recordId);
  }
  return {
    ok: true,
    value: {
      record: sealed.value,
      remaining,
      atCompletion,
      performanceFactor: factor,
      planExhausted: remaining === '0' && compareNonNegativeDecimals(actualValue, plannedValue) > 0,
    },
  };
}

// --------------------------------------------------------------------------------
// Forecast-revision admission (the append-only ledger discipline).
// --------------------------------------------------------------------------------

/**
 * Admit a sealed rolling-forecast record into a W036 DistinctionLedger
 * (append-only). The ledger enforces the revision discipline: `refines`
 * must target an EXISTING EARLIER FORECAST — refining a prediction,
 * baseline, commitment, actual or a missing record is a typed
 * `forecast-overwrite-rejected` (surfaced through the adapter); an exact
 * re-admission is idempotent (replay); the same id with different
 * content is a typed `version-conflict`.
 */
export function admitForecastRevision(
  ledger: DistinctionLedger,
  record: unknown,
): ActualizationResult<DistinctionLedger> {
  const admitted = admitDistinctionRecord(ledger, record);
  if (!admitted.ok) {
    return adaptDeliveryResult(admitted, 'forecast-ledger');
  }
  return { ok: true, value: admitted.value };
}
