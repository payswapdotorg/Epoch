/**
 * PURE PROJECTIONS (the W040 pins: "domain-pack context ... without
 * creating domain-specific history stores" + the derived state):
 *
 * - the PACK VIEW is a PURE PROJECTION over the universal dataset: the
 *   rows whose pack reference names one domain pack, re-derived on
 *   demand — NEVER a stored pack-keyed history. The typed guard
 *   {@link openPackScopedLearningStore} rejects any attempt to open a
 *   pack-keyed duplicate store (`parallel-history-store-rejected`);
 * - the LEARNING-STATE PROJECTION is the pure derived snapshot over one
 *   store's state (counts; caller-supplied instant — zero wall-clock).
 */
import { z } from 'zod';
import { scopeSlug } from './version';
import { SolutionIdSchema } from './primitives';
import { validationError } from './issues';
import type { LearningResult } from './errors';
import type { SealedLearningDataset, SealedDatasetRow } from './dataset';

// --------------------------------------------------------------------------------
// The pack view (pure projection — never a store).
// --------------------------------------------------------------------------------

/** The pack-id grammar of the view selector (the W036 pack-reference grammar). */
const PACK_ID_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9-]+)+$/;

/** The selector of one pack view. */
export const PackViewSelectorSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    packId: z.string().regex(PACK_ID_PATTERN),
  })
  .readonly()
  .meta({
    id: 'PackViewSelector',
    title: 'PackViewSelector',
    description:
      'The selector of one domain-pack learning view: the solution scope plus the qualified pack id.',
  });

/** One pack-view selector. */
export type PackViewSelector = z.infer<typeof PackViewSelectorSchema>;

/** One pack-scoped learning view — a PURE PROJECTION, never a stored history. */
export const PackLearningViewSchema = z
  .strictObject({
    solutionId: SolutionIdSchema,
    packId: z.string().regex(PACK_ID_PATTERN),
    rows: z.array(z.unknown()),
    rowCount: z.number().int().min(1).max(4096),
  })
  .readonly()
  .meta({
    id: 'PackLearningView',
    title: 'PackLearningView',
    description:
      'One domain-pack learning view: the rows of the universal dataset whose pack reference names the pack (a pure projection over the universal dataset — never a pack-keyed history store).',
  });

/**
 * One pack-scoped learning view: the dataset rows carrying one domain
 * pack's context (packRef.packId), re-derived from the universal
 * dataset on every call. This view IS the pack's learning surface —
 * there is no pack-keyed store anywhere.
 */
export interface PackLearningView {
  /** The solution scope of the projection. */
  readonly solutionId: string;
  /** The projected domain pack. */
  readonly packId: string;
  /** The pack's rows of the universal dataset (rowId order). */
  readonly rows: readonly SealedDatasetRow[];
  /** How many rows the pack carries. */
  readonly rowCount: number;
}

/**
 * PROJECT the learning view of one domain pack over the universal
 * dataset — the pure fold: the rows whose `packRef.packId` matches the
 * selector, in rowId order. A pack with no rows in the dataset is a
 * typed validation rejection (an empty projection is not a surface).
 */
export function projectPackView(
  dataset: SealedLearningDataset,
  selector: { readonly solutionId: string; readonly packId: string },
): LearningResult<PackLearningView> {
  const parsed = PackViewSelectorSchema.safeParse(selector);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  if (dataset.solutionId !== selector.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `dataset "${dataset.datasetId}" subjects solution "${dataset.solutionId}" but the projection scope is "${selector.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'dataset/projection solution mismatch' }],
      },
    };
  }
  const rows = dataset.rows.filter((row) => row.packRef.packId === selector.packId);
  if (rows.length === 0) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `domain pack "${selector.packId}" carries no rows in dataset "${dataset.datasetId}" — an empty pack projection is not a learning surface`,
        issues: [{ path: 'packId', message: 'the pack has no rows in the dataset' }],
      },
    };
  }
  return {
    ok: true,
    value: {
      solutionId: selector.solutionId,
      packId: selector.packId,
      rows: [...rows].sort((a, b) => (a.rowId < b.rowId ? -1 : 1)),
      rowCount: rows.length,
    },
  };
}


/**
 * THE GUARD against pack-keyed duplicate history stores: any attempt to
 * open a domain-pack-scoped learning STORE returns the typed
 * `parallel-history-store-rejected` — pack learning surfaces are PURE
 * PROJECTIONS ({@link projectPackView}) over the universal dataset
 * (spec/domain-pack-contract.md: a pack NEVER gets its own parallel
 * history). This trap exists so the prohibition is machine-checkable,
 * not just documented.
 */
export function openPackScopedLearningStore(options: {
  readonly solutionId: string;
  readonly packId: string;
}): LearningResult<never> {
  return {
    ok: false,
    error: {
      code: 'parallel-history-store-rejected',
      message: `a domain-pack-scoped learning store for pack "${options.packId}" of solution "${scopeSlug(options.solutionId)}" is REJECTED — pack learning surfaces are PURE PROJECTIONS over the universal dataset (projectPackView); domain-pack context travels by typed reference inside the universal rows, never through pack-keyed duplicate stores (spec/domain-pack-contract.md)`,
      subjectId: options.packId,
    },
  };
}

// --------------------------------------------------------------------------------
// The derived learning-state projection.
// --------------------------------------------------------------------------------

/** The structural state-shape the projection folds (any store satisfies it). */
export interface LearningStateInput {
  readonly solutionId: string;
  readonly candidates: readonly unknown[];
  readonly comparisonFacts: readonly unknown[];
  readonly outcomeRecords: readonly unknown[];
  readonly datasets: readonly unknown[];
  readonly metricSets: readonly unknown[];
  readonly revisions: readonly unknown[];
}

/** One derived learning-state snapshot (pure fold; caller-supplied instant). */
export interface LearningStateProjection {
  readonly solutionId: string;
  readonly candidateCount: number;
  readonly registeredFactCount: number;
  readonly registeredOutcomeCount: number;
  readonly datasetCount: number;
  readonly rowCount: number;
  readonly exclusionCount: number;
  readonly metricSetCount: number;
  readonly modelCount: number;
  readonly revisionCount: number;
  readonly projectedAt: string;
}

/**
 * PROJECT the derived learning state of one store-shaped state — the
 * pure deterministic fold (counts over the admitted history; the
 * projection is never stored). The instant is caller-supplied (zero
 * wall-clock).
 */
export function projectLearningState(
  state: LearningStateInput,
  projectedAt: string,
): LearningStateProjection {
  const datasets = state.datasets as readonly { rows: readonly unknown[]; exclusions: readonly unknown[] }[];
  const models = new Set(
    (state.revisions as readonly { modelId: string }[]).map((revision) => revision.modelId),
  );
  return {
    solutionId: state.solutionId,
    candidateCount: state.candidates.length,
    registeredFactCount: state.comparisonFacts.length,
    registeredOutcomeCount: state.outcomeRecords.length,
    datasetCount: datasets.length,
    rowCount: datasets.reduce((total, dataset) => total + dataset.rows.length, 0),
    exclusionCount: datasets.reduce((total, dataset) => total + dataset.exclusions.length, 0),
    metricSetCount: state.metricSets.length,
    modelCount: models.size,
    revisionCount: state.revisions.length,
    projectedAt,
  };
}
