/**
 * PURE billable-line derivation (the W024 billing arithmetic).
 *
 * Every derivation is a TOTAL, DETERMINISTIC function of UPSTREAM
 * authorities — the W023 pricing models, the W023 usage account folds,
 * the W023 seat accounts, and the W036 SealedDeliveryRecord actuals:
 *
 * - `deriveOneTimeLine` / `deriveSubscriptionLine` / `deriveSeatLine` /
 *   `deriveUsageLine` price the four W023 pricing components the
 *   marketplace revenue basis names (one-time, subscription, seat,
 *   usage);
 * - `deriveDeliveryActualLines` bills ONLY VALIDATED W036 actuals: the
 *   sealed delivery record is verified FIRST (digest + schema + the
 *   actuals' accepted-observation derivation is inherent to the sealed
 *   record's invariants — W036 admits actuals converted from ACCEPTED
 *   observations only). A tampered envelope is `digest-mismatch`; an
 *   unknown actual reference is `delivery-actual-rejected`. Cost
 *   measures bill at their recorded amount; quantity measures bill at a
 *   caller-supplied unit rate (a quantity actual without a rate is the
 *   typed `delivery-actual-rejected` — never a silent zero);
 * - `free` and `enterprise-private` pricing derive NO lines (the typed
 *   `unsupported-pricing-model` — free acquisitions are not billable,
 *   enterprise-private pricing is negotiated out of band).
 *
 * Money is exact decimal-string arithmetic (src/decimal.ts); amounts are
 * the canonical product quantity x unitAmount; zero-amount lines are
 * LEGITIMATE record-keeping (e.g. usage inside the included allowance)
 * and never silently dropped.
 */
import { z } from 'zod';
import {
  addNonNegativeDecimals,
  multiplyNonNegativeDecimals,
  subtractNonNegativeDecimalsClamped,
} from './decimal';
import { verifySealedDeliveryRecord } from '@epoch/solution-delivery';
import type { ActualRecord, SealedDeliveryRecord } from '@epoch/solution-delivery';
import type {
  OneTimePricing,
  SeatWorkspacePricing,
  SubscriptionPricing,
  UsageMeteredPricing,
} from '@epoch/marketplace';
import type { PricingModel, UsageAccount } from '@epoch/marketplace';
import type { InvoiceLine } from './invoice';
import { CurrencyCodeSchema, LineItemIdSchema, NonNegativeDecimalSchema } from './primitives';
import type { EntitlementsResult } from './errors';

/** One derived billable line (the sealed-invoice line shape). */
export type DerivedLine = InvoiceLine;

/** Validate a caller-supplied line id against the line grammar. */
function requireLineId(lineId: string): EntitlementsResult<string> {
  const parsed = LineItemIdSchema.safeParse(lineId);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `line id "${lineId}" does not match the line grammar`,
        issues: [{ path: 'lineId', message: 'must match /^line:[a-z0-9][a-z0-9-]{0,62}$/' }],
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** Derive the one-time acquisition line of one entitlement (quantity 1). */
export function deriveOneTimeLine(input: {
  pricing: OneTimePricing;
  entitlementId: string;
  lineId: string;
  description?: string | undefined;
}): EntitlementsResult<DerivedLine> {
  const id = requireLineId(input.lineId);
  if (!id.ok) {
    return id;
  }
  return {
    ok: true,
    value: {
      lineId: id.value,
      basis: 'one-time',
      description: input.description ?? 'One-time acquisition',
      quantity: '1',
      unitAmount: input.pricing.amount,
      amount: input.pricing.amount,
      currency: input.pricing.currency,
      entitlementId: input.entitlementId,
    },
  };
}

/** Derive one subscription-period line (quantity 1 per period). */
export function deriveSubscriptionLine(input: {
  pricing: SubscriptionPricing;
  entitlementId: string;
  periodStart: string;
  periodEnd: string;
  lineId: string;
  description?: string | undefined;
}): EntitlementsResult<DerivedLine> {
  const id = requireLineId(input.lineId);
  if (!id.ok) {
    return id;
  }
  if (input.periodStart > input.periodEnd) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'the subscription period bounds are inverted',
        issues: [{ path: 'periodStart', message: 'periodStart must not be after periodEnd' }],
      },
    };
  }
  return {
    ok: true,
    value: {
      lineId: id.value,
      basis: 'subscription',
      description:
        input.description ?? `Subscription (${input.pricing.billingPeriod})`,
      quantity: '1',
      unitAmount: input.pricing.recurringAmount,
      amount: input.pricing.recurringAmount,
      currency: input.pricing.currency,
      entitlementId: input.entitlementId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    },
  };
}

/** Derive the seat line: active seats x per-seat amount (zero is legitimate). */
export function deriveSeatLine(input: {
  pricing: SeatWorkspacePricing;
  entitlementId: string;
  activeSeatCount: number;
  lineId: string;
  description?: string | undefined;
}): EntitlementsResult<DerivedLine> {
  const id = requireLineId(input.lineId);
  if (!id.ok) {
    return id;
  }
  if (
    !Number.isInteger(input.activeSeatCount) ||
    input.activeSeatCount < 0 ||
    input.activeSeatCount > Number.MAX_SAFE_INTEGER
  ) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'the active seat count must be a non-negative safe integer',
        issues: [{ path: 'activeSeatCount', message: 'expected a non-negative safe integer' }],
      },
    };
  }
  const quantity = String(input.activeSeatCount);
  return {
    ok: true,
    value: {
      lineId: id.value,
      basis: 'seat',
      description: input.description ?? `Seats (${input.pricing.billingPeriod})`,
      quantity,
      unitAmount: input.pricing.perSeatAmount,
      amount: multiplyNonNegativeDecimals(quantity, input.pricing.perSeatAmount),
      currency: input.pricing.currency,
      entitlementId: input.entitlementId,
    },
  };
}

/**
 * Derive the metered-usage line of one entitlement from its W023 usage
 * account: billable units = totalUnits - includedUnits (clamped at
 * zero); amount = billable x unitAmount; the line carries the exact
 * usage-event digests it bills. A zero line inside the allowance is
 * legitimate record-keeping, never dropped.
 */
export function deriveUsageLine(input: {
  pricing: UsageMeteredPricing;
  account: UsageAccount;
  lineId: string;
  description?: string | undefined;
}): EntitlementsResult<DerivedLine> {
  const id = requireLineId(input.lineId);
  if (!id.ok) {
    return id;
  }
  const included = input.pricing.includedUnits ?? '0';
  const billableUnits = subtractNonNegativeDecimalsClamped(input.account.totalUnits, included);
  return {
    ok: true,
    value: {
      lineId: id.value,
      basis: 'usage',
      description:
        input.description ??
        `Metered usage (${input.account.totalUnits} ${input.pricing.unitName}, ${included} included)`,
      quantity: billableUnits,
      unitAmount: input.pricing.unitAmount,
      amount: multiplyNonNegativeDecimals(billableUnits, input.pricing.unitAmount),
      currency: input.pricing.currency,
      entitlementId: input.account.entitlementId,
      listingId: input.account.listingId,
      usageEventDigests: [...input.account.eventDigests].sort(),
    },
  };
}

/** One caller-supplied unit rate for quantity-measure delivery actuals. */
export const UnitRateSchema = z
  .strictObject({
    unitAmount: NonNegativeDecimalSchema,
    currency: CurrencyCodeSchema,
  })
  .readonly()
  .meta({
    id: 'UnitRate',
    title: 'UnitRate',
    description:
      'One caller-supplied unit rate for billing quantity-measure delivery actuals: canonical decimal amount per unit plus ISO 4217 currency.',
  });

/** One unit rate. */
export type UnitRate = z.infer<typeof UnitRateSchema>;

/** The unit-rate card for quantity-measure delivery actuals (unit label -> rate). */
export type UnitRateCard = Readonly<Record<string, UnitRate>>;

/** Options of {@link deriveDeliveryActualLines}. */
export interface DeliveryActualLineOptions {
  /**
   * Optional line-id prefix slug (defaults to the delivery id suffix);
   * keeps line ids unique when one invoice bills several deliveries.
   */
  readonly lineIdPrefix?: string | undefined;
  /** Unit-rate card for quantity-measure actuals (unit label -> rate). */
  readonly unitRates?: UnitRateCard | undefined;
  /** Restrict billing to these actual record ids (default: every actual). */
  readonly actualRecordIds?: readonly string[] | undefined;
}

/** Derive the line-id slug of one actual record (deterministic, bounded). */
function lineSlugOf(prefix: string, actualRecordId: string): string {
  const suffix = actualRecordId.slice(actualRecordId.indexOf(':') + 1);
  return `line:${prefix}-${suffix}`.slice(0, 67);
}

/**
 * Derive the billable lines of one W036 SealedDeliveryRecord — ONLY
 * VALIDATED ACTUALS MAY BILL:
 *
 * 1. the sealed record is verified FIRST through the REAL W036
 *    `verifySealedDeliveryRecord` (schema + digest + the sealed-record
 *    invariants that every actual derives from an ACCEPTED observation
 *    recorded in the same delivery) — tampered or malformed input is the
 *    typed upstream rejection mapped onto `digest-mismatch`/`validation`;
 * 2. cost-measure actuals bill at their recorded amount + currency;
 * 3. quantity-measure actuals bill at the caller-supplied unit rate for
 *    their unit label (a missing rate is the typed
 *    `delivery-actual-rejected` — never a silent zero);
 * 4. instant/progress measures are not billable and are skipped;
 * 5. every line carries the exact (deliveryId, actualRecordId,
 *    actualContentDigest) provenance.
 *
 * An empty result (no billable actuals) is an EMPTY array, not an error —
 * invoice-level emptiness is rejected at invoice admission.
 */
export function deriveDeliveryActualLines(input: {
  delivery: SealedDeliveryRecord;
  options?: DeliveryActualLineOptions | undefined;
}): EntitlementsResult<readonly DerivedLine[]> {
  const verified = verifySealedDeliveryRecord(input.delivery);
  if (!verified.ok) {
    const error = verified.error as { code: string; message: string; expected?: string; encountered?: string };
    if (error.code === 'digest-mismatch') {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: `the W036 delivery record failed digest verification — only VALIDATED actuals may bill (${error.message})`,
          expected: error.expected ?? '',
          encountered: error.encountered ?? '',
          subject: input.delivery.deliveryId,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'delivery-actual-rejected',
        message: `the W036 delivery record failed verification — only VALIDATED actuals may bill (${error.message})`,
        deliveryId: input.delivery.deliveryId,
      },
    };
  }
  const delivery = verified.value;
  const options = input.options ?? {};
  const prefix =
    options.lineIdPrefix !== undefined && options.lineIdPrefix !== ''
      ? options.lineIdPrefix
      : delivery.deliveryId.slice(delivery.deliveryId.indexOf(':') + 1);

  const selected =
    options.actualRecordIds !== undefined
      ? delivery.actuals.filter((actual) => options.actualRecordIds!.includes(actual.recordId))
      : delivery.actuals;
  if (options.actualRecordIds !== undefined) {
    const found = new Set(selected.map((actual) => actual.recordId));
    for (const wanted of options.actualRecordIds) {
      if (!found.has(wanted)) {
        return {
          ok: false,
          error: {
            code: 'delivery-actual-rejected',
            message: `actual "${wanted}" is not recorded in delivery "${delivery.deliveryId}"`,
            deliveryId: delivery.deliveryId,
            actualRecordId: wanted,
          },
        };
      }
    }
  }

  const lines: DerivedLine[] = [];
  for (const actual of [...selected].sort((a, b) => (a.recordId < b.recordId ? -1 : 1))) {
    const line = lineOfActual(actual, delivery.deliveryId, prefix, options.unitRates);
    if (!line.ok) {
      return line;
    }
    if (line.value !== null) {
      lines.push(line.value);
    }
  }
  return { ok: true, value: lines };
}

/** Derive one actual's line (null when the measure is not billable). */
function lineOfActual(
  actual: ActualRecord,
  deliveryId: string,
  prefix: string,
  unitRates: UnitRateCard | undefined,
): EntitlementsResult<DerivedLine | null> {
  const lineId = lineSlugOf(prefix, actual.recordId);
  const id = requireLineId(lineId);
  if (!id.ok) {
    return id;
  }
  if (actual.measure.kind === 'cost') {
    return {
      ok: true,
      value: {
        lineId: id.value,
        basis: 'delivery-actual',
        description: `Delivered cost (${actual.subject.subjectId})`,
        quantity: '1',
        unitAmount: actual.measure.amount,
        amount: actual.measure.amount,
        currency: actual.measure.currency,
        delivery: {
          deliveryId,
          actualRecordId: actual.recordId,
          actualContentDigest: actual.contentDigest,
        },
      },
    };
  }
  if (actual.measure.kind === 'quantity') {
    const rate = unitRates?.[actual.measure.unit];
    if (rate === undefined) {
      return {
        ok: false,
        error: {
          code: 'delivery-actual-rejected',
          message: `quantity actual "${actual.recordId}" (${actual.measure.value} ${actual.measure.unit}) has no unit rate — quantity-measure actuals bill only at a caller-supplied rate, never a silent zero`,
          deliveryId,
          actualRecordId: actual.recordId,
        },
      };
    }
    return {
      ok: true,
      value: {
        lineId: id.value,
        basis: 'delivery-actual',
        description: `Delivered quantity (${actual.measure.value} ${actual.measure.unit})`,
        quantity: actual.measure.value,
        unitAmount: rate.unitAmount,
        amount: multiplyNonNegativeDecimals(actual.measure.value, rate.unitAmount),
        currency: rate.currency,
        delivery: {
          deliveryId,
          actualRecordId: actual.recordId,
          actualContentDigest: actual.contentDigest,
        },
      },
    };
  }
  // instant / progress measures are not billable.
  return { ok: true, value: null };
}

/** Sum the exact amounts of derived lines (deterministic, order-free). */
export function sumLineAmounts(lines: readonly DerivedLine[]): string {
  let total = '0';
  for (const line of lines) {
    total = addNonNegativeDecimals(total, line.amount);
  }
  return total;
}

/** The billable components one pricing model carries (the classifier). */
export interface BillablePricingComponents {
  /** The one-time component, when present. */
  readonly oneTime?: OneTimePricing | undefined;
  /** The subscription component, when present. */
  readonly subscription?: SubscriptionPricing | undefined;
  /** The seat component, when present. */
  readonly seat?: SeatWorkspacePricing | undefined;
  /** The metered-usage component, when present. */
  readonly usage?: UsageMeteredPricing | undefined;
}

/**
 * Classify one W023 pricing model into its billable components. The
 * closed vocabulary mapping (typed data only, no monetization logic):
 * free -> NOTHING billable; one-time/subscription/seat-workspace/
 * usage-metered -> the matching component; hybrid -> its fixed component
 * PLUS its metered component; enterprise-private -> NOTHING billable
 * (negotiated out of band — the typed `unsupported-pricing-model`
 * rejection surfaces when a caller attempts to price it).
 */
export function classifyPricingForBilling(pricing: PricingModel): BillablePricingComponents {
  switch (pricing.kind) {
    case 'one-time':
      return { oneTime: pricing };
    case 'subscription':
      return { subscription: pricing };
    case 'seat-workspace':
      return { seat: pricing };
    case 'usage-metered':
      return { usage: pricing };
    case 'hybrid':
      return {
        ...(pricing.fixed.kind === 'one-time'
          ? { oneTime: pricing.fixed }
          : pricing.fixed.kind === 'subscription'
            ? { subscription: pricing.fixed }
            : pricing.fixed.kind === 'seat-workspace'
              ? { seat: pricing.fixed }
              : {}),
        usage: pricing.metered,
      };
    case 'free':
    case 'enterprise-private':
    default:
      return {};
  }
}

/**
 * The typed rejection raised when a caller attempts to price a model
 * that carries no billable components (free or enterprise-private).
 */
export function unsupportedPricingModelError(pricingKind: string): {
  readonly code: 'unsupported-pricing-model';
  readonly message: string;
  readonly pricingKind: string;
} {
  return {
    code: 'unsupported-pricing-model',
    message: `pricing model "${pricingKind}" derives no billable lines (free acquisitions are not billable; enterprise-private pricing is negotiated out of band)`,
    pricingKind,
  };
}
