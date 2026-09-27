/**
 * Software cost/resource classifications (DP1.0 "cost/resource
 * classifications"): typed classification records for engineering /
 * infrastructure / licensing / operations, applied as DETERMINISTIC folds
 * over the W036 `CostSchedule` and `ResourceSchedule` (the synchronized
 * schedule folds of the ProgramOfWork).
 *
 * The classifications are VOCABULARY DATA; the fold inputs are a
 * caller-supplied classification index (typed data mapping canonical
 * activity/resource ids to resource classes — a rate-library-shaped
 * record, never a parallel ledger: the index references canonical W036
 * ids and stores nothing). Rows the index does not classify roll into the
 * deterministic `unclassified` bucket (SN1.0 partial-data behavior).
 */
import { z } from 'zod';
import {
  addNonNegativeDecimals,
  QualifiedNameSchema,
  type CostSchedule,
  type ResourceSchedule,
} from '@epoch/solution-delivery';
import {
  COST_CLASSIFICATION_SCHEMA_NAME,
  COST_CODE_PATTERN,
  SOFTWARE_PACK_RECORD_VERSION,
  SOFTWARE_RESOURCE_CLASSES,
} from './version';
import { refineSortedUnique } from './util';

// --------------------------------------------------------------------------------
// The classification records (vocabulary data).
// --------------------------------------------------------------------------------

/** One software cost/resource classification record. */
export const CostClassificationSchema = z
  .strictObject({
    schema: z.literal(COST_CLASSIFICATION_SCHEMA_NAME),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    classId: QualifiedNameSchema,
    resourceClass: z.enum(SOFTWARE_RESOURCE_CLASSES),
    costCode: z.string().regex(COST_CODE_PATTERN),
    description: z.string().max(2048),
  })
  .readonly()
  .meta({
    id: 'CostClassification',
    title: 'CostClassification',
    description:
      'One software cost/resource classification: a resource class (engineering/infrastructure/licensing/operations) with a stable cost code — vocabulary data folded over the W036 cost/resource schedules.',
  });

/** One cost/resource classification. */
export type CostClassification = z.infer<typeof CostClassificationSchema>;

/**
 * The software cost classifications: one per resource class, sorted by
 * classId ascending, duplicate-free.
 */
export const SOFTWARE_COST_CLASSIFICATIONS: readonly CostClassification[] = [
  {
    schema: 'epoch.pack-software.cost-classification',
    schemaVersion: 1,
    classId: 'software.cost.engineering',
    resourceClass: 'engineering',
    costCode: 'software.cost.code.engineering',
    description:
      'Engineering — product engineering effort over the cost schedule: implementation, review and test activities realizing solution lines.',
  },
  {
    schema: 'epoch.pack-software.cost-classification',
    schemaVersion: 1,
    classId: 'software.cost.infrastructure',
    resourceClass: 'infrastructure',
    costCode: 'software.cost.code.infrastructure',
    description:
      'Infrastructure — compute, pipeline and platform capacity provisioned over the resource schedule (cloud-service-provisioning acquisitions).',
  },
  {
    schema: 'epoch.pack-software.cost-classification',
    schemaVersion: 1,
    classId: 'software.cost.licensing',
    resourceClass: 'licensing',
    costCode: 'software.cost.code.licensing',
    description:
      'Licensing — subscription and license commitments (seats, terms) acquired against plan lines and allocated to observability and tooling activities.',
  },
  {
    schema: 'epoch.pack-software.cost-classification',
    schemaVersion: 1,
    classId: 'software.cost.operations',
    resourceClass: 'operations',
    costCode: 'software.cost.code.operations',
    description:
      'Operations — release rollout, on-call and run activities over the cost schedule (deployment operations and SLO stewardship).',
  },
];

// --------------------------------------------------------------------------------
// The classification indexes (typed data referencing canonical ids).
// --------------------------------------------------------------------------------

/**
 * The cost-classification index: activity ids of the ProgramOfWork mapped
 * to software resource classes. Sorted by activityId ascending,
 * duplicate-free — a typed rate-library-shaped record that REFERENCES
 * canonical activity ids and stores nothing.
 */
export const CostClassIndexSchema = z
  .strictObject({
    schema: z.literal('epoch.pack-software.cost-class-index'),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    assignments: z
      .array(
        z
          .strictObject({
            activityId: z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/),
            resourceClass: z.enum(SOFTWARE_RESOURCE_CLASSES),
          })
          .readonly(),
      )
      .max(512),
  })
  .readonly()
  .superRefine((index, ctx) => {
    refineSortedUnique(index.assignments, ctx, 'assignments', 'activityId');
  })
  .meta({
    id: 'CostClassIndex',
    title: 'CostClassIndex',
    description:
      'The cost-classification index: activity ids mapped to software resource classes (sorted, duplicate-free; references canonical ProgramOfWork activity ids).',
  });

/** One cost-classification index. */
export type CostClassIndex = z.infer<typeof CostClassIndexSchema>;

/**
 * The resource-classification index: opaque resource ids of the resource
 * schedule mapped to software resource classes. Sorted by resourceId
 * ascending, duplicate-free.
 */
export const ResourceClassIndexSchema = z
  .strictObject({
    schema: z.literal('epoch.pack-software.resource-class-index'),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    assignments: z
      .array(
        z
          .strictObject({
            resourceId: z.string().min(1).max(256),
            resourceClass: z.enum(SOFTWARE_RESOURCE_CLASSES),
          })
          .readonly(),
      )
      .max(512),
  })
  .readonly()
  .superRefine((index, ctx) => {
    refineSortedUnique(index.assignments, ctx, 'assignments', 'resourceId');
  })
  .meta({
    id: 'ResourceClassIndex',
    title: 'ResourceClassIndex',
    description:
      'The resource-classification index: opaque resource ids mapped to software resource classes (sorted, duplicate-free; references canonical resource-schedule ids).',
  });

/** One resource-classification index. */
export type ResourceClassIndex = z.infer<typeof ResourceClassIndexSchema>;

// --------------------------------------------------------------------------------
// Deterministic classification folds over the W036 schedules.
// --------------------------------------------------------------------------------

/** One classified cost total: resource class + currency + exact total amount. */
export interface ClassifiedCostTotal {
  readonly resourceClass: string;
  readonly currency: string;
  readonly totalAmount: string;
}

/** The classified cost fold over one W036 CostSchedule. */
export interface ClassifiedCostSummary {
  readonly totals: readonly ClassifiedCostTotal[];
  readonly unclassified: readonly { readonly currency: string; readonly totalAmount: string }[];
}

/**
 * Fold the W036 CostSchedule through the cost-classification index:
 * per-(resourceClass, currency) exact totals for classified activities,
 * plus a deterministic `unclassified` bucket per currency for rows the
 * index does not cover. Rows sort by (resourceClass, currency) and
 * (currency); input order never leaks.
 */
export function foldClassifiedCostSummary(
  schedule: CostSchedule,
  index: CostClassIndex,
): ClassifiedCostSummary {
  const classOf = new Map<string, string>();
  for (const assignment of index.assignments) {
    classOf.set(assignment.activityId, assignment.resourceClass);
  }
  const totals = new Map<string, string>();
  const unclassified = new Map<string, string>();
  for (const row of schedule.rows) {
    const resourceClass = classOf.get(row.activityId);
    if (resourceClass === undefined) {
      unclassified.set(
        row.currency,
        addNonNegativeDecimals(unclassified.get(row.currency) ?? '0', row.plannedAmount),
      );
      continue;
    }
    const key = `${resourceClass}\u0000${row.currency}`;
    totals.set(key, addNonNegativeDecimals(totals.get(key) ?? '0', row.plannedAmount));
  }
  const totalRows = [...totals.entries()]
    .map(([key, totalAmount]) => {
      const [resourceClass, currency] = key.split('\u0000');
      return { resourceClass: resourceClass!, currency: currency!, totalAmount };
    })
    .sort((a, b) => {
      if (a.resourceClass !== b.resourceClass) return a.resourceClass < b.resourceClass ? -1 : 1;
      return a.currency < b.currency ? -1 : 1;
    });
  const unclassifiedRows = [...unclassified.entries()]
    .map(([currency, totalAmount]) => ({ currency, totalAmount }))
    .sort((a, b) => (a.currency < b.currency ? -1 : 1));
  return { totals: totalRows, unclassified: unclassifiedRows };
}

/** One classified resource rollup: class + unit + exact total quantity + resource count. */
export interface ClassifiedResourceRow {
  readonly resourceClass: string;
  readonly unit: string;
  readonly totalQuantity: string;
  readonly resourceCount: number;
}

/** The classified resource fold over one W036 ResourceSchedule. */
export interface ClassifiedResourceSummary {
  readonly rows: readonly ClassifiedResourceRow[];
  readonly unclassified: readonly { readonly unit: string; readonly totalQuantity: string; readonly resourceCount: number }[];
}

/**
 * Fold the W036 ResourceSchedule through the resource-classification
 * index: per-(resourceClass, unit) exact quantity rollups with resource
 * counts, plus a deterministic `unclassified` bucket per unit. Rows sort by
 * (resourceClass, unit) / (unit); input order never leaks.
 */
export function foldClassifiedResourceSummary(
  schedule: ResourceSchedule,
  index: ResourceClassIndex,
): ClassifiedResourceSummary {
  const classOf = new Map<string, string>();
  for (const assignment of index.assignments) {
    classOf.set(assignment.resourceId, assignment.resourceClass);
  }
  const rows = new Map<string, { totalQuantity: string; resourceCount: number }>();
  const unclassified = new Map<string, { totalQuantity: string; resourceCount: number }>();
  for (const row of schedule.rows) {
    const resourceClass = classOf.get(row.resourceId);
    const target = resourceClass === undefined ? unclassified : rows;
    const key = resourceClass === undefined ? row.unit : `${resourceClass}\u0000${row.unit}`;
    const entry = target.get(key) ?? { totalQuantity: '0', resourceCount: 0 };
    entry.totalQuantity = addNonNegativeDecimals(entry.totalQuantity, row.totalQuantity);
    entry.resourceCount += 1;
    target.set(key, entry);
  }
  const classifiedRows = [...rows.entries()]
    .map(([key, entry]) => {
      const [resourceClass, unit] = key.split('\u0000');
      return {
        resourceClass: resourceClass!,
        unit: unit!,
        totalQuantity: entry.totalQuantity,
        resourceCount: entry.resourceCount,
      };
    })
    .sort((a, b) => {
      if (a.resourceClass !== b.resourceClass) return a.resourceClass < b.resourceClass ? -1 : 1;
      return a.unit < b.unit ? -1 : 1;
    });
  const unclassifiedRows = [...unclassified.entries()]
    .map(([unit, entry]) => ({
      unit,
      totalQuantity: entry.totalQuantity,
      resourceCount: entry.resourceCount,
    }))
    .sort((a, b) => (a.unit < b.unit ? -1 : 1));
  return { rows: classifiedRows, unclassified: unclassifiedRows };
}
