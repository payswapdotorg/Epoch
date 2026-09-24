/**
 * Cost and latency profiles for registered agents.
 *
 * Costs are non-negative decimal strings with an ISO 4217 currency code —
 * string amounts keep canonical digests stable (no float formatting) and
 * stay provider/ledger-neutral. Latency is expressed in whole milliseconds
 * with the p95 ≥ p50 invariant enforced by a runtime refinement.
 */
import { z } from 'zod';
import { ISO_CURRENCY_PATTERN, NON_NEGATIVE_DECIMAL_PATTERN } from './primitives';

/** Cost bases admitted by the protocol. */
export const COST_BASES = ['none', 'per-proposal', 'per-session', 'per-hour'] as const;

/**
 * Cost profile. `basis: "none"` means no cost accounting applies; every other
 * basis requires exactly one currency and one non-negative decimal amount
 * (discriminated union — impossible combinations cannot be expressed).
 */
export const CostProfileSchema = z
  .discriminatedUnion('basis', [
    z.strictObject({ basis: z.literal('none') }),
    z.strictObject({
      basis: z.literal('per-proposal'),
      currency: z.string().regex(ISO_CURRENCY_PATTERN),
      amount: z.string().regex(NON_NEGATIVE_DECIMAL_PATTERN),
    }),
    z.strictObject({
      basis: z.literal('per-session'),
      currency: z.string().regex(ISO_CURRENCY_PATTERN),
      amount: z.string().regex(NON_NEGATIVE_DECIMAL_PATTERN),
    }),
    z.strictObject({
      basis: z.literal('per-hour'),
      currency: z.string().regex(ISO_CURRENCY_PATTERN),
      amount: z.string().regex(NON_NEGATIVE_DECIMAL_PATTERN),
    }),
  ])
  .meta({
    id: 'CostProfile',
    title: 'CostProfile',
    description:
      'Neutral cost declaration; amounts are non-negative decimal strings with ISO 4217 currency codes.',
  });

export type CostProfile = z.infer<typeof CostProfileSchema>;

/**
 * Latency profile in whole milliseconds. Runtime refinement: p95 must be
 * greater than or equal to p50 (not representable in the structural JSON
 * Schema projection).
 */
export const LatencyProfileSchema = z
  .strictObject({
    p50Milliseconds: z.number().int().min(0),
    p95Milliseconds: z.number().int().min(0),
  })
  .refine(
    (profile) => profile.p95Milliseconds >= profile.p50Milliseconds,
    'p95Milliseconds must be greater than or equal to p50Milliseconds',
  )
  .meta({
    id: 'LatencyProfile',
    title: 'LatencyProfile',
    description: 'Whole-millisecond latency profile with p50/p95 percentiles (p95 >= p50).',
  });

export type LatencyProfile = z.infer<typeof LatencyProfileSchema>;
