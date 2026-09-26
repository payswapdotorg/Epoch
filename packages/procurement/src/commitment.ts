/**
 * Commitment records — created and LINKED through the W036 kernel,
 * never re-implemented here (the dispatch pin: "commitments are W036
 * Commitment-distinction records — procurement creates/links them,
 * NEVER re-implements them").
 *
 * - `procurementCommitmentContent` builds a W036
 *   `DistinctionRecordContent` of kind `commitment` for a selected
 *   quote: the committed cost measure (the exact fold of the selected
 *   quote's commercial lines), the committing principal/instant, and
 *   the acquisition-request link (W036 `CommitmentPayload`). Sealing
 *   happens through the REAL `sealDistinctionRecord` — the commitment
 *   IS a W036 record, byte-for-byte, admitted by the W036
 *   DistinctionLedger.
 * - `linkProcurementCommitment` verifies a sealed W036 commitment
 *   record against the procurement chain it grounds: kind must be
 *   `commitment` (anything else is a typed
 *   `distinction-collapse-rejected`), the tenant must match
 *   (`tenant-isolation-rejected`), the payload's acquisition link must
 *   match the package's acquisition request, and the committed measure
 *   must equal the selected quote's folded total (`validation`).
 * - `foldQuoteCost` is the EXACT decimal fold of a quote's commercial
 *   line unit costs (bigint-scaled, canonical output — input order
 *   never leaks; one consistent currency).
 */
import { z } from 'zod';
import { addNonNegativeDecimals } from '@epoch/solution-delivery';
import type {
  SealedDistinctionRecord,
  DistinctionRecordContent,
  DistinctionSubject,
  Measure,
  CostMeasure,
  UncertaintyState,
} from '@epoch/solution-delivery';
import { sealDistinctionRecord, verifySealedDistinctionRecord } from '@epoch/solution-delivery';
import { AcquisitionIdSchema, PrincipalIdSchema, Sha256HexSchema, TimestampSchema } from './primitives';
import type { ProcurementResult } from './errors';
import { adaptDeliveryResult } from './w036-adapter';
import type { SealedQuote } from './quote';

/** The commitment reference carried by purchase orders (exact revision). */
export const CommitmentReferenceSchema = z
  .strictObject({
    recordId: z.string().regex(/^commitment:[a-z0-9][a-z0-9-]{0,62}$/),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'CommitmentReference',
    title: 'CommitmentReference',
    description:
      'One W036 Commitment-distinction record reference: the kind-prefixed record id plus its exact content digest (procurement links commitments, it never re-implements them).',
  });

/** One commitment reference. */
export type CommitmentReference = z.infer<typeof CommitmentReferenceSchema>;

/**
 * The EXACT cost fold of one quote's commercial lines (the unit-cost
 * sum in the quote's single currency — the commitment grounding total).
 * Deterministic: canonical decimal addition is commutative, so input
 * order never leaks into the fold.
 */
export function foldQuoteCost(quote: SealedQuote): ProcurementResult<CostMeasure> {
  if (quote.lines.length === 0) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `quote "${quote.quoteId}" carries no commercial lines — there is nothing to commit`,
        issues: [{ path: 'lines', message: 'a committable quote carries at least one line' }],
      },
    };
  }
  const currency = quote.lines[0]!.unitCost.currency;
  let total = '0';
  for (const line of quote.lines) {
    if (line.unitCost.currency !== currency) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `quote "${quote.quoteId}" mixes currencies ("${line.unitCost.currency}" vs "${currency}") — a commitment measure carries exactly one currency`,
          issues: [{ path: 'lines', message: 'quote lines must share one currency' }],
        },
      };
    }
    total = addNonNegativeDecimals(total, line.unitCost.amount);
  }
  return { ok: true, value: { kind: 'cost', amount: total, currency } };
}

/** The input of the procurement-commitment builders. */
export interface ProcurementCommitmentInput {
  /** The commitment record id (`commitment:<slug>`). */
  readonly recordId: string;
  readonly tenantId: string;
  /** The W036 distinction subject the commitment attaches to. */
  readonly subject: DistinctionSubject;
  /** The selected quote whose fold the commitment grounds. */
  readonly quote: SealedQuote;
  /** The acquisition request the package grounds (`acquisition:<slug>`), optional link. */
  readonly acquisitionId?: string | undefined;
  readonly committedBy: string;
  readonly committedAt: string;
  readonly recordedAt: string;
  readonly uncertainty: UncertaintyState;
}

/**
 * Build the W036 Commitment-distinction RECORD CONTENT for one selected
 * quote (kind `commitment`, cost measure = the exact quote fold,
 * payload = the committing principal/instant + the acquisition-request
 * link). Seal it through the REAL W036 `sealDistinctionRecord` (or
 * {@link sealProcurementCommitment}) — the commitment record is a W036
 * record, never a procurement-native re-implementation.
 */
export function procurementCommitmentContent(
  input: ProcurementCommitmentInput,
): ProcurementResult<DistinctionRecordContent> {
  const folded = foldQuoteCost(input.quote);
  if (!folded.ok) {
    return folded;
  }
  if (input.acquisitionId !== undefined) {
    const parsed = AcquisitionIdSchema.safeParse(input.acquisitionId);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'the commitment acquisition link must be a W036 acquisition id ("acquisition:<slug>")',
          issues: [
            {
              path: 'acquisitionId',
              message: parsed.error.issues[0]?.message ?? 'invalid acquisition id',
            },
          ],
        },
      };
    }
  }
  const payload: Record<string, unknown> = {
    committedBy: input.committedBy,
    committedAt: input.committedAt,
    ...(input.acquisitionId !== undefined ? { acquisitionId: input.acquisitionId } : {}),
  };
  const content = {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'commitment',
    recordId: input.recordId,
    tenantId: input.tenantId,
    subject: input.subject,
    measure: folded.value,
    payload,
    recordedAt: input.recordedAt,
    recordedBy: input.committedBy,
    uncertainty: input.uncertainty,
  } as unknown as DistinctionRecordContent;
  return { ok: true, value: content };
}

/**
 * Seal a procurement commitment through the REAL W036 kernel sealing
 * path: the returned record is a `SealedDistinctionRecord` of kind
 * `commitment` — byte-for-byte a W036 record, admitted by the W036
 * DistinctionLedger.
 */
export function sealProcurementCommitment(
  input: ProcurementCommitmentInput,
): ProcurementResult<SealedDistinctionRecord> {
  const content = procurementCommitmentContent(input);
  if (!content.ok) {
    return content;
  }
  const sealed = sealDistinctionRecord(content.value);
  return adaptDeliveryResult(sealed, input.recordId);
}

/** The linkage provenance returned by {@link linkProcurementCommitment}. */
export interface CommitmentLinkage {
  readonly reference: CommitmentReference;
  readonly committedBy: string;
  readonly committedAt: string;
  readonly committedMeasure: Measure;
}

/**
 * LINK one sealed W036 commitment record to the procurement chain it
 * grounds (the selected quote of one package):
 *
 * - the record verifies through the REAL W036
 *   `verifySealedDistinctionRecord` (tamper detection);
 * - its kind must be `commitment` — any other distinction kind is the
 *   typed `distinction-collapse-rejected` (a purchase order is grounded
 *   by a commitment record, never by a prediction, estimate, baseline,
 *   observation, actual, forecast, outcome or learning record);
 * - the commitment's tenant must match the quote's tenant
 *   (`tenant-isolation-rejected`);
 * - when the commitment payload carries an acquisition link, it must
 *   equal the acquisition request the package grounds (`validation`);
 * - the commitment's cost measure must equal the exact fold of the
 *   selected quote (`validation` — the committed amount IS the selected
 *   quote total).
 */
export function linkProcurementCommitment(
  commitment: unknown,
  quote: SealedQuote,
  packageAcquisitionId: string,
): ProcurementResult<CommitmentLinkage> {
  const verified = verifySealedDistinctionRecord(commitment);
  if (!verified.ok) {
    return adaptDeliveryResult(verified, 'commitment-record');
  }
  const record = verified.value;
  if (record.kind !== 'commitment') {
    return {
      ok: false,
      error: {
        code: 'distinction-collapse-rejected',
        message: `record "${record.recordId}" is a "${record.kind}" distinction record — a purchase order is grounded by a W036 COMMITMENT record only (the distinctions are separate immutable records; collapsing them is rejected)`,
        recordId: record.recordId,
        expectedKind: 'commitment',
        encounteredKind: record.kind,
      },
    };
  }
  if (record.tenantId !== quote.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `commitment record "${record.recordId}" belongs to tenant "${record.tenantId}" but the selected quote is scoped to "${quote.tenantId}" (R12)`,
        expectedTenantId: quote.tenantId,
        encounteredTenantId: record.tenantId,
        subject: record.recordId,
      },
    };
  }
  const payload = record.payload as { acquisitionId?: string | undefined };
  if (payload.acquisitionId !== undefined && payload.acquisitionId !== packageAcquisitionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `commitment record "${record.recordId}" links acquisition request "${payload.acquisitionId}" but the package grounds "${packageAcquisitionId}"`,
        issues: [
          {
            path: 'payload.acquisitionId',
            message: 'the commitment must ground the package acquisition request',
          },
        ],
      },
    };
  }
  const folded = foldQuoteCost(quote);
  if (!folded.ok) {
    return folded;
  }
  const measure = (record as { measure?: Measure }).measure;
  if (
    measure === undefined ||
    measure.kind !== 'cost' ||
    (measure as CostMeasure).amount !== folded.value.amount ||
    (measure as CostMeasure).currency !== folded.value.currency
  ) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `commitment record "${record.recordId}" commits ${JSON.stringify(measure ?? 'no measure')} but the selected quote's exact fold is ${folded.value.amount} ${folded.value.currency} — the committed amount IS the selected quote total`,
        issues: [{ path: 'measure', message: 'the commitment measure must equal the selected quote fold' }],
      },
    };
  }
  const commitmentPayload = record.payload as { committedBy: string; committedAt: string };
  return {
    ok: true,
    value: {
      reference: { recordId: record.recordId, contentDigest: record.contentDigest },
      committedBy: commitmentPayload.committedBy,
      committedAt: commitmentPayload.committedAt,
      committedMeasure: measure,
    },
  };
}

/** Re-exported for callers building commitment provenance instants. */
export { PrincipalIdSchema, TimestampSchema };
