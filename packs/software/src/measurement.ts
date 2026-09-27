/**
 * Software measurement methods (DP1.0 "units and measurement methods" +
 * "quantity derivations"): typed descriptors for effort-hours and
 * deliverable/deployment/environment counts with measurement codes and
 * net/contingency rules, plus the DETERMINISTIC quantity derivations as
 * pure functions over plan quantity schedules.
 *
 * - Every derivation is EXACT decimal-string arithmetic (bigint-scaled,
 *   trailing-zero-trimmed, canonical output) — no floats, ever.
 * - Effort with a contingency rule derives the commitment-shaped effort
 *   from the net plan estimate through the method's explicit contingency
 *   factor (net × factor); the derivation is one direction only so it is
 *   always exact and reversible by record, never by re-estimation.
 * - Units the pack vocabulary does not match project as `unmatched`
 *   (SN1.0 partial-data behavior: the quantity still carries through with
 *   the plan value; measurement is never a blocker).
 */
import { z } from 'zod';
import { QualifiedNameSchema, UnitLabelSchema } from '@epoch/solution-delivery';
import {
  EFFORT_RULE_KINDS,
  MEASUREMENT_CODE_PATTERN,
  MEASUREMENT_METHOD_SCHEMA_NAME,
  SOFTWARE_MEASUREMENT_BASES,
  SOFTWARE_PACK_RECORD_VERSION,
} from './version';
import { compareNonNegativeDecimals, multiplyNonNegativeDecimals } from './util';

// --------------------------------------------------------------------------------
// The net/contingency rule (carried by every effort measurement method).
// --------------------------------------------------------------------------------

/**
 * The net/contingency rule of one effort measurement method: either effort
 * is measured net (no allowance), or the contingency-shaped effort derives
 * from the net plan estimate through an explicit contingency factor >= 1
 * (review, rework and coordination allowance).
 */
export const EffortRuleSchema = z.discriminatedUnion('rule', [
  z
    .strictObject({
      rule: z.literal(EFFORT_RULE_KINDS[0]),
    })
    .readonly(),
  z
    .strictObject({
      rule: z.literal(EFFORT_RULE_KINDS[1]),
      contingencyFactor: z
        .string()
        .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/, 'must be a non-negative decimal string'),
    })
    .readonly()
    .superRefine((contingency, ctx) => {
      if (compareNonNegativeDecimals(contingency.contingencyFactor, '1') < 0) {
        ctx.addIssue({
          code: 'custom',
          message:
            'contingencyFactor must be at least 1 (a review/rework allowance never shrinks the net estimate)',
          path: ['contingencyFactor'],
        });
      }
    }),
]);

/** One net/contingency rule. */
export type EffortRule = z.infer<typeof EffortRuleSchema>;

// --------------------------------------------------------------------------------
// The measurement-method descriptor.
// --------------------------------------------------------------------------------

/** One measurement-method descriptor: base, unit, code, net/contingency rule. */
export const MeasurementMethodSchema = z
  .strictObject({
    schema: z.literal(MEASUREMENT_METHOD_SCHEMA_NAME),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    methodId: QualifiedNameSchema,
    base: z.enum(SOFTWARE_MEASUREMENT_BASES),
    unit: UnitLabelSchema,
    measurementCode: z.string().regex(MEASUREMENT_CODE_PATTERN),
    effortRule: EffortRuleSchema,
    description: z.string().max(2048),
  })
  .readonly()
  .meta({
    id: 'MeasurementMethod',
    title: 'MeasurementMethod',
    description:
      'One software measurement method: measurement base (effort/count), canonical unit, stable measurement code, and the net/contingency rule (an explicit review/rework factor for contingency methods).',
  });

/** One measurement-method descriptor. */
export type MeasurementMethod = z.infer<typeof MeasurementMethodSchema>;

/**
 * The software measurement methods: typed vocabulary data over the
 * measurement bases (effort-hours with a contingency rule;
 * deliverable/deployment/environment counts measured net), sorted by
 * methodId ascending, duplicate-free.
 */
export const SOFTWARE_MEASUREMENT_METHODS: readonly MeasurementMethod[] = [
  {
    schema: 'epoch.pack-software.measurement-method',
    schemaVersion: 1,
    methodId: 'software.measure.deliverable-count',
    base: 'count',
    unit: 'deliverable',
    measurementCode: 'software.measure.count.deliverable.net',
    effortRule: { rule: 'net' },
    description:
      'Deliverable counts (deliverable) — specified solution deliverables counted net from the plan lines; no allowance.',
  },
  {
    schema: 'epoch.pack-software.measurement-method',
    schemaVersion: 1,
    methodId: 'software.measure.deployment-count',
    base: 'count',
    unit: 'deployment',
    measurementCode: 'software.measure.count.deployment.net',
    effortRule: { rule: 'net' },
    description:
      'Deployment counts (deployment) — release rollouts counted net per environment from the rollout steps; no allowance.',
  },
  {
    schema: 'epoch.pack-software.measurement-method',
    schemaVersion: 1,
    methodId: 'software.measure.effort-hours',
    base: 'effort',
    unit: 'hour',
    measurementCode: 'software.measure.effort.contingency-15',
    effortRule: { rule: 'contingency', contingencyFactor: '1.15' },
    description:
      'Effort hours (hour) — net planned engineering hours with a 15% contingency allowance for reviews, rework and coordination.',
  },
  {
    schema: 'epoch.pack-software.measurement-method',
    schemaVersion: 1,
    methodId: 'software.measure.environment-count',
    base: 'count',
    unit: 'environment',
    measurementCode: 'software.measure.count.environment.net',
    effortRule: { rule: 'net' },
    description:
      'Environment counts (environment) — deployment environments counted net per plan line; no allowance.',
  },
];

// --------------------------------------------------------------------------------
// Deterministic quantity derivation (pure functions over plan quantities).
// --------------------------------------------------------------------------------

/** The measurement basis of one derived quantity. */
export const MEASURED_QUANTITY_BASES = ['net', 'contingency', 'unmatched'] as const;

/** One measured-quantity basis. */
export type MeasuredQuantityBasis = (typeof MEASURED_QUANTITY_BASES)[number];

/** The measured quantity of one plan line under the measurement vocabulary. */
export const MeasuredQuantitySchema = z
  .strictObject({
    /** The net plan value (always the plan quantity, unchanged). */
    net: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
    /** The contingency-shaped value (net × contingencyFactor; contingency methods only). */
    withContingency: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/).optional(),
    /** The matched measurement-method id (undefined when no unit matches). */
    measurementMethodId: QualifiedNameSchema.optional(),
    /** The measurement basis of the plan value. */
    basis: z.enum(MEASURED_QUANTITY_BASES),
  })
  .readonly()
  .meta({
    id: 'MeasuredQuantity',
    title: 'MeasuredQuantity',
    description:
      'The measured quantity of one plan line: the unchanged net plan value, the derived contingency-shaped value (contingency methods), the matched measurement method and the measurement basis.',
  });

/** One measured quantity. */
export type MeasuredQuantity = z.infer<typeof MeasuredQuantitySchema>;

/**
 * Measure one plan quantity against the measurement vocabulary:
 * - a method whose unit matches derives the contingency-shaped value from
 *   the net plan value through the method's contingency factor (exact
 *   decimal arithmetic);
 * - a unit with no matching method projects as `unmatched` — the quantity
 *   carries through unchanged (SN1.0: measurement is never a blocker);
 * - the net plan value is NEVER rewritten.
 *
 * Deterministic: the FIRST method (in methodId order) matching the unit
 * wins, so a duplicated unit in a caller-supplied vocabulary cannot make
 * the derivation order-dependent.
 */
export function measureQuantity(
  methods: readonly MeasurementMethod[],
  unit: string,
  plannedValue: string,
): MeasuredQuantity {
  const sorted = [...methods].sort((a, b) => (a.methodId < b.methodId ? -1 : 1));
  const method = sorted.find((candidate) => candidate.unit === unit);
  if (method === undefined) {
    return { net: plannedValue, withContingency: undefined, measurementMethodId: undefined, basis: 'unmatched' };
  }
  if (method.effortRule.rule === 'net') {
    return {
      net: plannedValue,
      withContingency: undefined,
      measurementMethodId: method.methodId,
      basis: 'net',
    };
  }
  return {
    net: plannedValue,
    withContingency: multiplyNonNegativeDecimals(plannedValue, method.effortRule.contingencyFactor),
    measurementMethodId: method.methodId,
    basis: 'contingency',
  };
}

/**
 * Fold the measured quantities of a whole quantity-schedule-shaped row set
 * (rows carrying `{ unit, plannedValue }`): one measured row per input row,
 * in the input order, plus per-method rollups (count of rows per matched
 * methodId, sorted by methodId). Deterministic.
 */
export interface MeasuredQuantityRow {
  readonly unit: string;
  readonly plannedValue: string;
  readonly measured: MeasuredQuantity;
}

/** The measured-quantity fold over plan quantity rows. */
export interface MeasuredQuantityFold {
  readonly rows: readonly MeasuredQuantityRow[];
  readonly methodCounts: readonly { readonly methodId: string; readonly rowCount: number }[];
}

/** Fold measured quantities over `{ unit, plannedValue }` rows (deterministic). */
export function foldMeasuredQuantities(
  methods: readonly MeasurementMethod[],
  rows: readonly { readonly unit: string; readonly plannedValue: string }[],
): MeasuredQuantityFold {
  const measuredRows = rows.map((row) => ({
    unit: row.unit,
    plannedValue: row.plannedValue,
    measured: measureQuantity(methods, row.unit, row.plannedValue),
  }));
  const counts = new Map<string, number>();
  for (const row of measuredRows) {
    const methodId = row.measured.measurementMethodId;
    if (methodId === undefined) continue;
    counts.set(methodId, (counts.get(methodId) ?? 0) + 1);
  }
  const methodCounts = [...counts.entries()]
    .map(([methodId, rowCount]) => ({ methodId, rowCount }))
    .sort((a, b) => (a.methodId < b.methodId ? -1 : 1));
  return { rows: measuredRows, methodCounts };
}
