/**
 * Software outcome schemas (DP1.0 "outcome schemas"): release outcomes and
 * SLO attainment as typed PROJECTIONS over the universal outcome shapes —
 * each software outcome type binds onto one of the W036 `OUTCOME_KINDS`
 * (delivered/accepted/handover/residual/rejected/abandoned). The outcome
 * records stay universal distinction records; the pack folds them into
 * software outcome views carrying its vocabulary.
 */
import { z } from 'zod';
import {
  QualifiedNameSchema,
  Sha256HexSchema,
  type SealedDistinctionRecord,
} from '@epoch/solution-delivery';
import {
  OUTCOME_TYPE_SCHEMA_NAME,
  OUTCOME_VIEW_SCHEMA_NAME,
  SOFTWARE_PACK_RECORD_VERSION,
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

/** One software outcome-type descriptor: a projection binding onto a universal kind. */
export const SoftwareOutcomeTypeSchema = z
  .strictObject({
    schema: z.literal(OUTCOME_TYPE_SCHEMA_NAME),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    outcomeTypeId: QualifiedNameSchema,
    universalOutcomeKind: z.enum(UNIVERSAL_OUTCOME_KINDS),
    title: z.string().min(1).max(256),
    description: z.string().max(2048),
  })
  .readonly()
  .meta({
    id: 'SoftwareOutcomeType',
    title: 'SoftwareOutcomeType',
    description:
      'One software outcome type: release delivered/accepted, SLO attainment or service handover bound onto one universal W036 outcome kind — a projection, never a second outcome authority.',
  });

/** One software outcome-type descriptor. */
export type SoftwareOutcomeType = z.infer<typeof SoftwareOutcomeTypeSchema>;

/**
 * The software outcome types: typed vocabulary data binding release
 * delivery / acceptance / SLO attainment / SLO-breach residual / service
 * handover onto the universal outcome kinds, sorted by outcomeTypeId
 * ascending.
 */
export const SOFTWARE_OUTCOME_TYPES: readonly SoftwareOutcomeType[] = [
  {
    schema: 'epoch.pack-software.outcome-type',
    schemaVersion: 1,
    outcomeTypeId: 'software.outcome.release-accepted',
    universalOutcomeKind: 'accepted',
    title: 'Release accepted',
    description:
      'Release acceptance: the delivered release unit verified and accepted into the target environment, carrying the software acceptance vocabulary and verification references.',
  },
  {
    schema: 'epoch.pack-software.outcome-type',
    schemaVersion: 1,
    outcomeTypeId: 'software.outcome.release-delivered',
    universalOutcomeKind: 'delivered',
    title: 'Release delivered',
    description:
      'Release delivery: the release unit rolled out to its environments — the universal delivered outcome kind carrying the software release vocabulary.',
  },
  {
    schema: 'epoch.pack-software.outcome-type',
    schemaVersion: 1,
    outcomeTypeId: 'software.outcome.service-handover',
    universalOutcomeKind: 'handover',
    title: 'Service handover',
    description:
      'Service handover: the operated service handed to the run organization with runbooks and on-call ownership — the universal handover outcome kind with the software handover vocabulary.',
  },
  {
    schema: 'epoch.pack-software.outcome-type',
    schemaVersion: 1,
    outcomeTypeId: 'software.outcome.slo-attainment',
    universalOutcomeKind: 'accepted',
    title: 'SLO attainment',
    description:
      'Service-level-objective attainment: the measured objective met over its attestation window, recorded as an accepted outcome with the evaluation evidence.',
  },
  {
    schema: 'epoch.pack-software.outcome-type',
    schemaVersion: 1,
    outcomeTypeId: 'software.outcome.slo-breach-residual',
    universalOutcomeKind: 'residual',
    title: 'SLO breach residual',
    description:
      'Service-level-objective breach: an unmet objective carried as a universal residual outcome record until remediated and re-attested.',
  },
];

// --------------------------------------------------------------------------------
// The outcome projection (a pure fold over universal outcome records).
// --------------------------------------------------------------------------------

/** The zod validator of one projected software outcome view (round-trip evidence). */
export const SoftwareOutcomeViewSchema = z
  .strictObject({
    schema: z.literal(OUTCOME_VIEW_SCHEMA_NAME),
    schemaVersion: z.literal(SOFTWARE_PACK_RECORD_VERSION),
    recordId: z.string().regex(/^(prediction|estimate|baseline|commitment|observation|actual|forecast|outcome|learning):[a-z0-9][a-z0-9-]{0,62}$/),
    tenantId: z.string().regex(/^tenant:[a-z0-9][a-z0-9-]{0,62}$/),
    subjectId: z.string().min(1).max(256),
    universalOutcomeKind: z.enum(UNIVERSAL_OUTCOME_KINDS),
    softwareOutcomeTypeIds: z.array(QualifiedNameSchema).max(16),
    softwareTitles: z.array(z.string().min(1).max(256)).max(16),
    note: z.string().max(2048).optional(),
    verificationRefs: z.array(Sha256HexSchema).max(64),
  })
  .readonly()
  .meta({
    id: 'SoftwareOutcomeView',
    title: 'SoftwareOutcomeView',
    description:
      'One projected software outcome view: the canonical outcome record id, its universal outcome kind (unchanged), and the matched software outcome-type vocabulary (sorted; empty when none binds).',
  });

/** One projected software outcome view: the universal record plus software vocabulary. */
export interface SoftwareOutcomeView {
  readonly schema: typeof OUTCOME_VIEW_SCHEMA_NAME;
  readonly schemaVersion: typeof SOFTWARE_PACK_RECORD_VERSION;
  /** The canonical distinction-record id of the universal outcome record. */
  readonly recordId: string;
  readonly tenantId: string;
  readonly subjectId: string;
  /** The universal outcome kind of the record (unchanged). */
  readonly universalOutcomeKind: string;
  /** The matched software outcome-type ids (sorted; empty when none binds). */
  readonly softwareOutcomeTypeIds: readonly string[];
  /** The matched software outcome-type titles (sorted by outcomeTypeId). */
  readonly softwareTitles: readonly string[];
  readonly note: string | undefined;
  readonly verificationRefs: readonly string[];
}

/**
 * Project the software outcome views over universal outcome records: a
 * pure fold filtering kind `outcome` distinction records and binding each
 * onto the software outcome-type vocabulary (a record may bind MULTIPLE
 * software types when several bind the same universal kind — all matches
 * list, sorted by outcomeTypeId). Records with no binding still project
 * (SN1.0 partial data), with empty software terms.
 *
 * Deterministic: sorted by recordId; input order never leaks.
 */
export function projectSoftwareOutcomes(
  records: readonly SealedDistinctionRecord[],
  types: readonly SoftwareOutcomeType[],
): readonly SoftwareOutcomeView[] {
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
        schemaVersion: SOFTWARE_PACK_RECORD_VERSION,
        recordId: record.recordId,
        tenantId: record.tenantId,
        subjectId: record.subject.subjectId,
        universalOutcomeKind: universal.outcomeKind,
        softwareOutcomeTypeIds: matched.map((type) => type.outcomeTypeId),
        softwareTitles: matched.map((type) => type.title),
        note: universal.note,
        verificationRefs: [...universal.verificationRefs].sort(),
      } satisfies SoftwareOutcomeView;
    })
    .sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
  return views;
}

/** The canonical SHA-256 digest of the outcome-view fold (determinism evidence). */
export function digestOutcomeViews(views: readonly SoftwareOutcomeView[]): string {
  return digestOf(views);
}
