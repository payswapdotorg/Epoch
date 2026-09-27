/**
 * Construction outcome schemas (DP1.0 "outcome schemas"): practical
 * completion and defects liability as typed PROJECTIONS over the universal
 * outcome shapes — each construction outcome type binds onto one of the
 * W036 `OUTCOME_KINDS` (delivered/accepted/handover/residual/rejected/
 * abandoned). The outcome records stay universal distinction records; the
 * pack folds them into construction outcome views carrying its vocabulary.
 */
import { z } from 'zod';
import {
  QualifiedNameSchema,
  Sha256HexSchema,
  type SealedDistinctionRecord,
} from '@epoch/solution-delivery';
import {
  CONSTRUCTION_PACK_RECORD_VERSION,
  OUTCOME_TYPE_SCHEMA_NAME,
  OUTCOME_VIEW_SCHEMA_NAME,
} from './version';
import { digestOf } from './util';

// --------------------------------------------------------------------------------
// The outcome-type descriptors (vocabulary data).
// --------------------------------------------------------------------------------

/** The universal outcome-kind vocabulary mirrored for the binding (W036 grammar). */
export const UNIVERSAL_OUTCOME_KINDS = [
  'delivered',
  'accepted',
  'handover',
  'residual',
  'rejected',
  'abandoned',
] as const;

/** One universal outcome kind (the W036 grammar). */
export type UniversalOutcomeKind = (typeof UNIVERSAL_OUTCOME_KINDS)[number];

/** One construction outcome-type descriptor: a projection binding onto a universal kind. */
export const ConstructionOutcomeTypeSchema = z
  .strictObject({
    schema: z.literal(OUTCOME_TYPE_SCHEMA_NAME),
    schemaVersion: z.literal(CONSTRUCTION_PACK_RECORD_VERSION),
    outcomeTypeId: QualifiedNameSchema,
    universalOutcomeKind: z.enum(UNIVERSAL_OUTCOME_KINDS),
    title: z.string().min(1).max(256),
    description: z.string().max(2048),
  })
  .readonly()
  .meta({
    id: 'ConstructionOutcomeType',
    title: 'ConstructionOutcomeType',
    description:
      'One construction outcome type: practical completion, defects liability or handover bound onto one universal W036 outcome kind — a projection, never a second outcome authority.',
  });

/** One construction outcome-type descriptor. */
export type ConstructionOutcomeType = z.infer<typeof ConstructionOutcomeTypeSchema>;

/**
 * The construction outcome types: typed vocabulary data binding
 * practical completion / defects liability / handover onto the universal
 * outcome kinds, sorted by outcomeTypeId ascending.
 */
export const CONSTRUCTION_OUTCOME_TYPES: readonly ConstructionOutcomeType[] = [
  {
    schema: 'epoch.pack-construction.outcome-type',
    schemaVersion: 1,
    outcomeTypeId: 'construction.outcome.defects-liability',
    universalOutcomeKind: 'residual',
    title: 'Defects liability',
    description:
      'The defects liability period after practical completion: outstanding defects and residuals carried as universal residual outcome records until discharged.',
  },
  {
    schema: 'epoch.pack-construction.outcome-type',
    schemaVersion: 1,
    outcomeTypeId: 'construction.outcome.handover',
    universalOutcomeKind: 'handover',
    title: 'Handover',
    description:
      'Handover of the completed works to the employer: the universal handover outcome kind carrying the construction handover vocabulary.',
  },
  {
    schema: 'epoch.pack-construction.outcome-type',
    schemaVersion: 1,
    outcomeTypeId: 'construction.outcome.practical-completion',
    universalOutcomeKind: 'accepted',
    title: 'Practical completion',
    description:
      'Practical completion of the works: the universal accepted outcome kind carrying the construction practical-completion vocabulary and verification references.',
  },
];

// --------------------------------------------------------------------------------
// The outcome projection (a pure fold over universal outcome records).
// --------------------------------------------------------------------------------

/** The zod validator of one projected construction outcome view (round-trip evidence). */
export const ConstructionOutcomeViewSchema = z
  .strictObject({
    schema: z.literal(OUTCOME_VIEW_SCHEMA_NAME),
    schemaVersion: z.literal(CONSTRUCTION_PACK_RECORD_VERSION),
    recordId: z.string().regex(/^(prediction|estimate|baseline|commitment|observation|actual|forecast|outcome|learning):[a-z0-9][a-z0-9-]{0,62}$/),
    tenantId: z.string().regex(/^tenant:[a-z0-9][a-z0-9-]{0,62}$/),
    subjectId: z.string().min(1).max(256),
    universalOutcomeKind: z.enum(UNIVERSAL_OUTCOME_KINDS),
    constructionOutcomeTypeIds: z.array(QualifiedNameSchema).max(16),
    constructionTitles: z.array(z.string().min(1).max(256)).max(16),
    note: z.string().max(2048).optional(),
    verificationRefs: z.array(Sha256HexSchema).max(64),
  })
  .readonly()
  .meta({
    id: 'ConstructionOutcomeView',
    title: 'ConstructionOutcomeView',
    description:
      'One projected construction outcome view: the canonical outcome record id, its universal outcome kind (unchanged), and the matched construction outcome-type vocabulary (sorted; empty when none binds).',
  });

/** One projected construction outcome view: the universal record plus construction vocabulary. */
export interface ConstructionOutcomeView {
  readonly schema: typeof OUTCOME_VIEW_SCHEMA_NAME;
  readonly schemaVersion: typeof CONSTRUCTION_PACK_RECORD_VERSION;
  /** The canonical distinction-record id of the universal outcome record. */
  readonly recordId: string;
  readonly tenantId: string;
  readonly subjectId: string;
  /** The universal outcome kind of the record (unchanged). */
  readonly universalOutcomeKind: string;
  /** The matched construction outcome-type ids (sorted; empty when none binds). */
  readonly constructionOutcomeTypeIds: readonly string[];
  /** The matched construction outcome-type titles (sorted by outcomeTypeId). */
  readonly constructionTitles: readonly string[];
  readonly note: string | undefined;
  readonly verificationRefs: readonly string[];
}

/**
 * Project the construction outcome views over universal outcome records: a
 * pure fold filtering kind `outcome` distinction records and binding each
 * onto the construction outcome-type vocabulary (a record may bind MULTIPLE
 * construction types when several bind the same universal kind — all
 * matches list, sorted by outcomeTypeId). Records with no binding still
 * project (SN1.0 partial data), with empty construction terms.
 *
 * Deterministic: sorted by recordId; input order never leaks.
 */
export function projectConstructionOutcomes(
  records: readonly SealedDistinctionRecord[],
  types: readonly ConstructionOutcomeType[],
): readonly ConstructionOutcomeView[] {
  const sortedTypes = [...types].sort((a, b) => (a.outcomeTypeId < b.outcomeTypeId ? -1 : 1));
  const outcomeRecords = records.filter(
    (record): record is Extract<SealedDistinctionRecord, { readonly kind: 'outcome' }> =>
      record.kind === 'outcome',
  );
  const views = outcomeRecords
    .map((record) => {
      const matched = sortedTypes.filter(
        (type) => type.universalOutcomeKind === record.payload.outcomeKind,
      );
      const universal = record.payload;
      return {
        schema: OUTCOME_VIEW_SCHEMA_NAME,
        schemaVersion: CONSTRUCTION_PACK_RECORD_VERSION,
        recordId: record.recordId,
        tenantId: record.tenantId,
        subjectId: record.subject.subjectId,
        universalOutcomeKind: universal.outcomeKind,
        constructionOutcomeTypeIds: matched.map((type) => type.outcomeTypeId),
        constructionTitles: matched.map((type) => type.title),
        note: universal.note,
        verificationRefs: [...universal.verificationRefs].sort(),
      } satisfies ConstructionOutcomeView;
    })
    .sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
  return views;
}

/** The canonical SHA-256 digest of the outcome-view fold (determinism evidence). */
export function digestOutcomeViews(
  views: readonly ConstructionOutcomeView[],
): string {
  return digestOf(views);
}
