/**
 * The pricing-model vocabulary as TYPED DATA (extension-architecture.md,
 * binding): free, one-time, subscription, seat/workspace, usage-metered,
 * hybrid, enterprise/private. A closed discriminated union — per-model
 * typed fields, strict objects, no monetization logic beyond record shape +
 * validation. Money travels as canonical decimal strings with ISO 4217
 * currency codes (agent-protocol primitives) so records digest stably.
 */
import { z } from 'zod';
import { BILLING_PERIODS, PRICING_MODEL_KINDS } from './version';
import type { MarketplaceError } from './errors';
import {
  CurrencyCodeSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PositiveIntegerSchema,
  TenantIdSchema,
} from './primitives';

const AmountSchema = NonNegativeDecimalSchema;

/** Free pricing: no fields (the model is the record). */
export const FreePricingSchema = z
  .strictObject({
    kind: z.literal('free'),
  })
  .readonly()
  .meta({
    id: 'FreePricing',
    title: 'FreePricing',
    description: 'Free pricing model: no monetary fields.',
  });

/** One-time pricing: a single price for a permanent grant. */
export const OneTimePricingSchema = z
  .strictObject({
    kind: z.literal('one-time'),
    amount: AmountSchema,
    currency: CurrencyCodeSchema,
  })
  .readonly()
  .meta({
    id: 'OneTimePricing',
    title: 'OneTimePricing',
    description: 'One-time pricing: a single non-negative decimal amount plus ISO 4217 currency.',
  });

/** Subscription pricing: a recurring amount on a billing period. */
export const SubscriptionPricingSchema = z
  .strictObject({
    kind: z.literal('subscription'),
    recurringAmount: AmountSchema,
    currency: CurrencyCodeSchema,
    billingPeriod: z.enum(BILLING_PERIODS),
  })
  .readonly()
  .meta({
    id: 'SubscriptionPricing',
    title: 'SubscriptionPricing',
    description: 'Subscription pricing: recurring amount, currency, and billing period (monthly or annual).',
  });

/** Seat/workspace pricing: per-seat amount on a billing period with optional bounds. */
export const SeatWorkspacePricingSchema = z
  .strictObject({
    kind: z.literal('seat-workspace'),
    perSeatAmount: AmountSchema,
    currency: CurrencyCodeSchema,
    billingPeriod: z.enum(BILLING_PERIODS),
    minSeats: PositiveIntegerSchema.optional(),
    maxSeats: PositiveIntegerSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.minSeats !== undefined &&
      value.maxSeats !== undefined &&
      value.minSeats > value.maxSeats
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'minSeats must not exceed maxSeats',
        path: ['minSeats'],
      });
    }
  })
  .readonly()
  .meta({
    id: 'SeatWorkspacePricing',
    title: 'SeatWorkspacePricing',
    description: 'Seat/workspace pricing: per-seat amount, currency, billing period, and optional seat bounds.',
  });

/** Usage-metered pricing: price per metered unit, with an optional included allowance. */
export const UsageMeteredPricingSchema = z
  .strictObject({
    kind: z.literal('usage-metered'),
    unitAmount: AmountSchema,
    currency: CurrencyCodeSchema,
    unitName: z.string().min(1).max(64),
    includedUnits: NonNegativeDecimalSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'UsageMeteredPricing',
    title: 'UsageMeteredPricing',
    description: 'Usage-metered pricing: per-unit amount, currency, unit name, and optional included allowance.',
  });

/** One fixed pricing component (the non-metered, non-hybrid models). */
export const FixedPricingComponentSchema = z
  .discriminatedUnion('kind', [
    FreePricingSchema,
    OneTimePricingSchema,
    SubscriptionPricingSchema,
    SeatWorkspacePricingSchema,
  ])
  .meta({
    id: 'FixedPricingComponent',
    title: 'FixedPricingComponent',
    description: 'One fixed pricing component: free, one-time, subscription, or seat/workspace.',
  });

/** Hybrid pricing: a fixed component plus a usage-metered component. */
export const HybridPricingSchema = z
  .strictObject({
    kind: z.literal('hybrid'),
    fixed: FixedPricingComponentSchema,
    metered: UsageMeteredPricingSchema,
  })
  .readonly()
  .meta({
    id: 'HybridPricing',
    title: 'HybridPricing',
    description: 'Hybrid pricing: one fixed component (free, one-time, subscription, or seat/workspace) plus a usage-metered component.',
  });

/**
 * Enterprise/private pricing: negotiated out-of-band; the record carries an
 * opaque contact route and the private audience (tenant ids on the listing
 * visibility allow-list). NO negotiation or contract logic — record shape
 * only.
 */
export const EnterprisePrivatePricingSchema = z
  .strictObject({
    kind: z.literal('enterprise-private'),
    contactRoute: OpaqueReferenceSchema,
    audienceTenantIds: z.array(TenantIdSchema).max(256),
  })
  .superRefine((audience, ctx) => {
    for (let i = 1; i < audience.audienceTenantIds.length; i += 1) {
      if (audience.audienceTenantIds[i]! < audience.audienceTenantIds[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'audienceTenantIds must be sorted ascending (deterministic serialization)',
          path: ['audienceTenantIds'],
        });
        break;
      }
      if (audience.audienceTenantIds[i]! === audience.audienceTenantIds[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'audienceTenantIds must be duplicate-free',
          path: ['audienceTenantIds'],
        });
        break;
      }
    }
  })
  .readonly()
  .meta({
    id: 'EnterprisePrivatePricing',
    title: 'EnterprisePrivatePricing',
    description: 'Enterprise/private pricing: opaque contact route plus the sorted private audience of tenant ids (negotiation is out of band; record shape only).',
  });

/** The closed pricing-model union (typed data only). */
export const PricingModelSchema = z
  .discriminatedUnion('kind', [
    FreePricingSchema,
    OneTimePricingSchema,
    SubscriptionPricingSchema,
    SeatWorkspacePricingSchema,
    UsageMeteredPricingSchema,
    HybridPricingSchema,
    EnterprisePrivatePricingSchema,
  ])
  .meta({
    id: 'PricingModel',
    title: 'PricingModel',
    description:
      'The closed pricing-model vocabulary (typed data only): free, one-time, subscription, seat/workspace, usage-metered, hybrid, or enterprise/private.',
  });

/** One pricing model. */
export type PricingModel = z.infer<typeof PricingModelSchema>;

/** One fixed pricing component. */
export type FixedPricingComponent = z.infer<typeof FixedPricingComponentSchema>;

/** The per-kind literal members. */
export type FreePricing = z.infer<typeof FreePricingSchema>;
export type OneTimePricing = z.infer<typeof OneTimePricingSchema>;
export type SubscriptionPricing = z.infer<typeof SubscriptionPricingSchema>;
export type SeatWorkspacePricing = z.infer<typeof SeatWorkspacePricingSchema>;
export type UsageMeteredPricing = z.infer<typeof UsageMeteredPricingSchema>;
export type HybridPricing = z.infer<typeof HybridPricingSchema>;
export type EnterprisePrivatePricing = z.infer<typeof EnterprisePrivatePricingSchema>;

/** Billing period literal type. */
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

/** The typed error subset the pricing classifier can produce. */
export type PricingModelParseError = Extract<
  MarketplaceError,
  { code: 'invalid-pricing-model' } | { code: 'vendor-fields-rejected' }
>;

/** The total outcome of the pricing classifier. */
export type PricingModelParseOutcome =
  | { readonly ok: true; readonly value: PricingModel }
  | { readonly ok: false; readonly error: PricingModelParseError };

/**
 * Parse one pricing model (total). Classification: an unknown/malformed
 * discriminator or malformed per-model fields → `invalid-pricing-model`
 * with precise dotted-path issues; unknown structural fields →
 * `vendor-fields-rejected`.
 */
export function parsePricingModelValue(value: unknown): PricingModelParseOutcome {
  const discriminatorKnown =
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    typeof (value as { kind: unknown }).kind === 'string' &&
    (PRICING_MODEL_KINDS as readonly string[]).includes((value as { kind: string }).kind);
  const parsed = PricingModelSchema.safeParse(value);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  const issues = parsed.error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
  }));
  if (parsed.error.issues.some((issue) => issue.code === 'unrecognized_keys')) {
    const pricingError: PricingModelParseError = {
      code: 'vendor-fields-rejected',
      message:
        'pricing model carries unknown structural fields — provider/vendor fields cannot enter marketplace records (strict objects; adapterize provider semantics behind the PaymentPort seam instead)',
      issues,
      path: ['pricing'],
    };
    return { ok: false, error: pricingError };
  }
  if (!discriminatorKnown) {
    const kind =
      typeof value === 'object' && value !== null && 'kind' in value
        ? (value as { kind: unknown }).kind
        : undefined;
    const pricingError: PricingModelParseError = {
      code: 'invalid-pricing-model',
      message: `pricing model is outside the closed vocabulary (free, one-time, subscription, seat-workspace, usage-metered, hybrid, enterprise-private); encountered kind ${JSON.stringify(kind)}`,
      issues,
    };
    return { ok: false, error: pricingError };
  }
  const pricingError: PricingModelParseError = {
    code: 'invalid-pricing-model',
    message: 'pricing model fields failed validation',
    issues,
  };
  return { ok: false, error: pricingError };
}
