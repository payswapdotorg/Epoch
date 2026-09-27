/**
 * Construction measurement methods (DP1.0 "units and measurement methods"
 * + "quantity derivations"): typed descriptors for length/area/volume/
 * count/mass with measurement codes and net/gross rules, plus the
 * DETERMINISTIC quantity derivations as pure functions over plan quantity
 * schedules.
 *
 * - Every derivation is EXACT decimal-string arithmetic (bigint-scaled,
 *   trailing-zero-trimmed, canonical output) — no floats, ever.
 * - Gross quantities derive from net plan quantities through the method's
 *   explicit waste allowance factor (net × factor); the derivation is one
 *   direction only (gross-from-net) so it is always exact and reversible by
 *   record, never by re-measurement.
 * - Units the pack vocabulary does not match project as `unmatched`
 *   (SN1.0 partial-data behavior: the quantity still carries through with
 *   the plan value; measurement is never a blocker).
 */
import { z } from 'zod';
import { QualifiedNameSchema, UnitLabelSchema } from '@epoch/solution-delivery';
import { TypeKeySchema } from '@epoch/world-model';
import {
  CONSTRUCTION_CONCEPTS,
  CONSTRUCTION_PACK_RECORD_VERSION,
  ENTITY_BINDING_SCHEMA_NAME,
  MEASUREMENT_BASES,
  MEASUREMENT_CODE_PATTERN,
  MEASUREMENT_METHOD_SCHEMA_NAME,
  NET_GROSS_RULE_KINDS,
  type ConstructionConcept,
} from './version';
import { compareNonNegativeDecimals, multiplyNonNegativeDecimals } from './util';

// --------------------------------------------------------------------------------
// The net/gross rule (carried by every measurement method).
// --------------------------------------------------------------------------------

/**
 * The net/gross rule of one measurement method: either quantities are
 * measured net (no allowance), or gross quantities derive from net plan
 * quantities through an explicit waste allowance factor >= 1.
 */
export const NetGrossRuleSchema = z.discriminatedUnion('rule', [
  z
    .strictObject({
      rule: z.literal(NET_GROSS_RULE_KINDS[0]),
    })
    .readonly(),
  z
    .strictObject({
      rule: z.literal(NET_GROSS_RULE_KINDS[1]),
      allowanceFactor: z
        .string()
        .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/, 'must be a non-negative decimal string'),
    })
    .readonly()
    .superRefine((gross, ctx) => {
      if (compareNonNegativeDecimals(gross.allowanceFactor, '1') < 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'allowanceFactor must be at least 1 (a waste allowance never shrinks the net quantity)',
          path: ['allowanceFactor'],
        });
      }
    }),
]);

/** One net/gross rule. */
export type NetGrossRule = z.infer<typeof NetGrossRuleSchema>;

// --------------------------------------------------------------------------------
// The measurement-method descriptor.
// --------------------------------------------------------------------------------

/** One measurement-method descriptor: base, unit, code, net/gross rule. */
export const MeasurementMethodSchema = z
  .strictObject({
    schema: z.literal(MEASUREMENT_METHOD_SCHEMA_NAME),
    schemaVersion: z.literal(CONSTRUCTION_PACK_RECORD_VERSION),
    methodId: QualifiedNameSchema,
    base: z.enum(MEASUREMENT_BASES),
    unit: UnitLabelSchema,
    measurementCode: z.string().regex(MEASUREMENT_CODE_PATTERN),
    netGrossRule: NetGrossRuleSchema,
    description: z.string().max(2048),
  })
  .readonly()
  .meta({
    id: 'MeasurementMethod',
    title: 'MeasurementMethod',
    description:
      'One construction measurement method: measurement base (length/area/volume/count/mass), canonical unit, stable measurement code, and the net/gross rule (an explicit waste allowance factor for gross methods).',
  });

/** One measurement-method descriptor. */
export type MeasurementMethod = z.infer<typeof MeasurementMethodSchema>;

/**
 * The construction measurement methods: typed vocabulary data over the
 * measurement bases, sorted by methodId ascending, duplicate-free.
 */
export const CONSTRUCTION_MEASUREMENT_METHODS: readonly MeasurementMethod[] = [
  {
    schema: 'epoch.pack-construction.measurement-method',
    schemaVersion: 1,
    methodId: 'construction.measure.area',
    base: 'area',
    unit: 'm2',
    measurementCode: 'construction.measure.area.gross-10',
    netGrossRule: { rule: 'gross', allowanceFactor: '1.10' },
    description:
      'Measured areas (m2) — wall/floor finishes measured net from the model with a 10% gross waste allowance for cuts and openings.',
  },
  {
    schema: 'epoch.pack-construction.measurement-method',
    schemaVersion: 1,
    methodId: 'construction.measure.count',
    base: 'count',
    unit: 'number',
    measurementCode: 'construction.measure.count.net',
    netGrossRule: { rule: 'net' },
    description:
      'Counted items (number) — door sets, fixtures and fittings counted net from the schedule; no waste allowance.',
  },
  {
    schema: 'epoch.pack-construction.measurement-method',
    schemaVersion: 1,
    methodId: 'construction.measure.length',
    base: 'length',
    unit: 'm',
    measurementCode: 'construction.measure.length.gross-5',
    netGrossRule: { rule: 'gross', allowanceFactor: '1.05' },
    description:
      'Measured lengths (m) — linear elements (ducts, conduits, trim) measured net with a 5% gross offcut allowance.',
  },
  {
    schema: 'epoch.pack-construction.measurement-method',
    schemaVersion: 1,
    methodId: 'construction.measure.mass',
    base: 'mass',
    unit: 'tonne',
    measurementCode: 'construction.measure.mass.gross-3',
    netGrossRule: { rule: 'gross', allowanceFactor: '1.03' },
    description:
      'Measured mass (tonne) — structural steel and reinforcement measured net with a 3% gross fabrication/wastage allowance.',
  },
  {
    schema: 'epoch.pack-construction.measurement-method',
    schemaVersion: 1,
    methodId: 'construction.measure.volume',
    base: 'volume',
    unit: 'm3',
    measurementCode: 'construction.measure.volume.gross-4',
    netGrossRule: { rule: 'gross', allowanceFactor: '1.04' },
    description:
      'Measured volumes (m3) — excavated/poured quantities measured net with a 4% gross compaction/shrinkage allowance.',
  },
];

// --------------------------------------------------------------------------------
// Deterministic quantity derivation (pure functions over plan quantities).
// --------------------------------------------------------------------------------

/** The measurement basis of one derived quantity. */
export const MEASURED_QUANTITY_BASES = ['net', 'gross', 'unmatched'] as const;

/** One measured-quantity basis. */
export type MeasuredQuantityBasis = (typeof MEASURED_QUANTITY_BASES)[number];

/** The measured quantity of one plan line under the measurement vocabulary. */
export const MeasuredQuantitySchema = z
  .strictObject({
    /** The net plan value (always the plan quantity, unchanged). */
    net: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/),
    /** The gross value (net × allowanceFactor; gross methods only). */
    gross: z.string().regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/).optional(),
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
      'The measured quantity of one plan line: the unchanged net plan value, the derived gross value (gross methods), the matched measurement method and the measurement basis.',
  });

/** One measured quantity. */
export type MeasuredQuantity = z.infer<typeof MeasuredQuantitySchema>;

/**
 * Measure one plan quantity against the measurement vocabulary:
 * - a method whose unit matches derives the gross value from the net plan
 *   value through the method's allowance factor (exact decimal arithmetic);
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
    return { net: plannedValue, gross: undefined, measurementMethodId: undefined, basis: 'unmatched' };
  }
  if (method.netGrossRule.rule === 'net') {
    return {
      net: plannedValue,
      gross: undefined,
      measurementMethodId: method.methodId,
      basis: 'net',
    };
  }
  return {
    net: plannedValue,
    gross: multiplyNonNegativeDecimals(plannedValue, method.netGrossRule.allowanceFactor),
    measurementMethodId: method.methodId,
    basis: 'gross',
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

// --------------------------------------------------------------------------------
// Entity bindings (co-located with the measurement vocabulary for the
// single VocabularyBundle record; the binding fold lives here too).
// --------------------------------------------------------------------------------

/**
 * One World Model entity binding: a W002 entity-type key bound to a
 * construction concept (element/space/system/zone). DESCRIPTIVE data — the
 * World Model remains the semantic world authority; the pack never defines
 * new entity authorities.
 */
export const EntityBindingSchema = z
  .strictObject({
    schema: z.literal(ENTITY_BINDING_SCHEMA_NAME),
    schemaVersion: z.literal(CONSTRUCTION_PACK_RECORD_VERSION),
    bindingId: QualifiedNameSchema,
    entityTypeKey: TypeKeySchema,
    constructionConcept: z.enum(CONSTRUCTION_CONCEPTS),
    description: z.string().max(2048),
  })
  .readonly()
  .meta({
    id: 'EntityBinding',
    title: 'EntityBinding',
    description:
      'One descriptive World Model entity binding: a W002 entity-type key bound to a construction concept (element/space/system/zone) — never a new authority.',
  });

/** One entity binding. */
export type EntityBinding = z.infer<typeof EntityBindingSchema>;

/**
 * The construction entity bindings: W002 entity-type keys in the
 * `construction:` namespace for the four construction concepts, sorted by
 * bindingId ascending.
 */
export const CONSTRUCTION_ENTITY_BINDINGS: readonly EntityBinding[] = [
  {
    schema: 'epoch.pack-construction.entity-binding',
    schemaVersion: 1,
    bindingId: 'construction.bind.element',
    entityTypeKey: 'construction:element',
    constructionConcept: 'element',
    description:
      'Building elements — the fabricated/installed physical parts (foundations, frame members, wall assemblies) referenced by solution lines and work packages.',
  },
  {
    schema: 'epoch.pack-construction.entity-binding',
    schemaVersion: 1,
    bindingId: 'construction.bind.space',
    entityTypeKey: 'construction:space',
    constructionConcept: 'space',
    description:
      'Spaces — the bounded volumes of the building (rooms, shafts, circulation) that elements enclose and that verification walks.',
  },
  {
    schema: 'epoch.pack-construction.entity-binding',
    schemaVersion: 1,
    bindingId: 'construction.bind.system',
    entityTypeKey: 'construction:system',
    constructionConcept: 'system',
    description:
      'Technical systems — discipline assemblies (structural, mechanical, electrical, drainage) grouping elements for realization and commissioning.',
  },
  {
    schema: 'epoch.pack-construction.entity-binding',
    schemaVersion: 1,
    bindingId: 'construction.bind.zone',
    entityTypeKey: 'construction:zone',
    constructionConcept: 'zone',
    description:
      'Zones — site/building partitions for phasing, access and logistics (work areas, hoarding zones, laydown areas).',
  },
];

/**
 * Classify one World Model entity against the entity bindings: a pure fold
 * mapping `{ id, type }` to the bound construction concept (undefined when
 * the entity type carries no construction binding — partial data, never a
 * blocker). Deterministic: the FIRST binding (bindingId order) matching the
 * entity type wins.
 */
export function classifyWorldEntity(
  bindings: readonly EntityBinding[],
  entity: { readonly id: string; readonly type: string },
): { readonly entityId: string; readonly concept: ConstructionConcept | undefined } {
  const sorted = [...bindings].sort((a, b) => (a.bindingId < b.bindingId ? -1 : 1));
  const binding = sorted.find((candidate) => candidate.entityTypeKey === entity.type);
  return { entityId: entity.id, concept: binding?.constructionConcept };
}