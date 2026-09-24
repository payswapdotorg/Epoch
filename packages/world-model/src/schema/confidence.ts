import { z } from 'zod';

/**
 * Runtime validators for confidence
 * (contracts/world/src/confidence.ts).
 */

const ConfidenceValue = z.number().min(0).max(1);

const PointDistribution = z
  .strictObject({
    kind: z.literal('point'),
    value: ConfidenceValue,
  })
  .readonly();

const IntervalDistribution = z
  .strictObject({
    kind: z.literal('interval'),
    lower: ConfidenceValue,
    upper: ConfidenceValue,
    bias: z.enum(['none', 'low', 'high']).optional(),
  })
  .readonly();

const SetDistribution = z
  .strictObject({
    kind: z.literal('set'),
    values: z.array(ConfidenceValue).min(1).readonly(),
    weights: z.array(z.number().min(0)).readonly().optional(),
  })
  .readonly();

export const ConfidenceDistributionSchema = z
  .discriminatedUnion('kind', [PointDistribution, IntervalDistribution, SetDistribution])
  .superRefine((value, ctx) => {
    if (value.kind === 'interval' && value.lower > value.upper) {
      ctx.addIssue({ code: 'custom', message: 'interval lower bound must not exceed upper bound', path: ['lower'] });
    }
    if (value.kind === 'set' && value.weights !== undefined && value.weights.length !== value.values.length) {
      ctx.addIssue({ code: 'custom', message: 'weights must align with values', path: ['weights'] });
    }
  })
  .meta({
    id: 'urn:epoch:contracts:world:confidence-distribution',
    title: 'ConfidenceDistribution',
  });

export const ConfidenceSchema = z
  .strictObject({
    distribution: ConfidenceDistributionSchema,
    method: z.enum(['stated', 'measured', 'estimated', 'derived', 'imported']).optional(),
    rationale: z.string().max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'urn:epoch:contracts:world:confidence',
    title: 'Confidence',
  });
