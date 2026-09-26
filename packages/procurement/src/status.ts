/**
 * The acquisition-status projection (the W037 pin: "acquisition status
 * as a sealed projection derived from records (never mutated in
 * place)").
 *
 * `deriveAcquisitionStatus` FOLDS the admitted records (packages,
 * quotes, selections, commitments, orders, delivery transitions) into
 * one SEALED status record — there is NO in-place mutation API
 * anywhere; a tampered projection fails `verifySealedAcquisitionStatus`
 * with `digest-mismatch`. The derivation is deterministic: same inputs
 * (any order) → the same digest.
 */
import { z } from 'zod';
import type { JsonValue } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/solution-delivery';
import { PackageIdSchema, Sha256HexSchema, TimestampSchema, canonicalDigest } from './primitives';
import { ACQUISITION_STATUS_SCHEMA_NAME, PROCUREMENT_RECORD_VERSION } from './version';
import type { ProcurementStatusState } from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ProcurementResult } from './errors';
import type { AcquisitionPackageStore, SealedAcquisitionPackage } from './package';
import type { QuoteStore } from './quote';
import { isQuoteLive } from './quote';
import type { SelectionStore } from './selection';
import type { SealedDistinctionRecord } from '@epoch/solution-delivery';
import type { PurchaseOrderStore } from './order';
import type { SupplierDeliveryLog } from './delivery';
import { foldSupplierDelivery } from './delivery';

/** The derived status detail of one acquisition package. */
export const AcquisitionStatusDetailSchema = z
  .strictObject({
    liveQuoteCount: z.number().int().min(0),
    selectionCount: z.number().int().min(0),
    purchaseOrderCount: z.number().int().min(0),
    deliveryTransitionCount: z.number().int().min(0),
    receivedLineCount: z.number().int().min(0),
  })
  .readonly()
  .meta({
    id: 'AcquisitionStatusDetail',
    title: 'AcquisitionStatusDetail',
    description: 'The derived status detail of one acquisition package: record counts of the fold inputs.',
  });

/** One status detail. */
export type AcquisitionStatusDetail = z.infer<typeof AcquisitionStatusDetailSchema>;

/** The sealed acquisition-status projection record. */
export const SealedAcquisitionStatusSchema = z
  .strictObject({
    schema: z.literal(ACQUISITION_STATUS_SCHEMA_NAME),
    schemaVersion: z.literal(PROCUREMENT_RECORD_VERSION),
    packageId: PackageIdSchema,
    tenantId: TenantIdSchema,
    asOf: TimestampSchema,
    state: z.enum([
      'awaiting-quote',
      'quoted',
      'selected',
      'committed',
      'ordered',
      'confirmed',
      'shipped',
      'partial',
      'received',
      'accepted',
      'rejected',
      'disputed',
    ]),
    detail: AcquisitionStatusDetailSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedAcquisitionStatus',
    title: 'SealedAcquisitionStatus',
    description:
      'The sealed acquisition-status projection: a DERIVED-ONLY fold over the admitted records (never mutated in place) plus its SHA-256 content digest.',
  });

/** One sealed acquisition status. */
export type SealedAcquisitionStatus = z.infer<typeof SealedAcquisitionStatusSchema>;

/** The record inputs of {@link deriveAcquisitionStatus}. */
export interface AcquisitionStatusInputs {
  readonly packages: AcquisitionPackageStore;
  readonly quotes: QuoteStore;
  readonly selections: SelectionStore;
  /** W036 sealed distinction records (commitments). */
  readonly commitments: readonly SealedDistinctionRecord[];
  readonly orders: PurchaseOrderStore;
  readonly deliveryLog: SupplierDeliveryLog;
  readonly packageId: string;
  readonly asOf: string;
}

/**
 * Derive (fold) the sealed acquisition-status projection of one
 * acquisition package:
 *
 * - the package must exist (else `dangling-reference-rejected`);
 * - `awaiting-quote` — no LIVE quote for the package at `asOf`;
 * - `quoted` — at least one LIVE quote, no recorded selection;
 * - `selected` — a recorded selection (chain head), no linked
 *   commitment;
 * - `committed` — a linked commitment record, no purchase order;
 * - `ordered` — a purchase order, no delivery transitions;
 * - otherwise the DERIVED supplier-delivery state of the order's log
 *   (`confirmed` / `shipped` / `partial` / `received` / `accepted` /
 *   `rejected` / `disputed`).
 *
 * Deterministic: the fold sorts its inputs; the same records in any
 * order produce the same projection digest.
 */
export function deriveAcquisitionStatus(
  inputs: AcquisitionStatusInputs,
): ProcurementResult<SealedAcquisitionStatus> {
  const pkg = inputs.packages.packages.find(
    (candidate) => candidate.packageId === inputs.packageId,
  ) as SealedAcquisitionPackage | undefined;
  if (pkg === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `cannot project the acquisition status of package "${inputs.packageId}", which does not resolve`,
        referenceKind: 'acquisition-package',
        referenceId: inputs.packageId,
      },
    };
  }
  const liveQuotes = [...inputs.quotes.quotes]
    .filter((quote) => quote.packageId === inputs.packageId && isQuoteLive(inputs.quotes, quote, inputs.asOf))
    .sort((a, b) => (a.quoteId < b.quoteId ? -1 : 1));
  const selections = inputs.selections.selections
    .filter((selection) => selection.packageId === inputs.packageId)
    .sort((a, b) => (a.selectionId < b.selectionId ? -1 : 1));
  const orders = inputs.orders.orders
    .filter((order) => order.packageId === inputs.packageId)
    .sort((a, b) => (a.poId < b.poId ? -1 : 1));
  // Commitments link to this package through the W036 CommitmentPayload's
  // acquisition link (the acquisition request the package grounds).
  const commitments = [...inputs.commitments]
    .filter(
      (record) =>
        record.kind === 'commitment' &&
        (record.payload as { acquisitionId?: string | undefined }).acquisitionId ===
          pkg.acquisitionId,
    )
    .sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
  const projection = foldSupplierDelivery(inputs.deliveryLog);

  let state: ProcurementStatusState;
  if (orders.length > 0 && inputs.deliveryLog.transitions.length > 0) {
    state = projection.state;
  } else if (orders.length > 0) {
    state = 'ordered';
  } else if (commitments.length > 0) {
    state = 'committed';
  } else if (selections.length > 0) {
    state = 'selected';
  } else if (liveQuotes.length > 0) {
    state = 'quoted';
  } else {
    state = 'awaiting-quote';
  }

  const detail = {
    liveQuoteCount: liveQuotes.length,
    selectionCount: selections.length,
    purchaseOrderCount: orders.length,
    deliveryTransitionCount: projection.transitionCount,
    receivedLineCount: projection.receivedLines.length,
  };
  const content = {
    schema: ACQUISITION_STATUS_SCHEMA_NAME,
    schemaVersion: PROCUREMENT_RECORD_VERSION,
    packageId: inputs.packageId,
    tenantId: pkg.tenantId,
    asOf: inputs.asOf,
    state,
    detail,
  };
  const contentDigest = canonicalDigest(content as unknown as JsonValue);
  return { ok: true, value: { ...content, contentDigest } };
}

/** Verify a sealed acquisition-status projection (schema + digest recomputation). */
export function verifySealedAcquisitionStatus(
  sealed: unknown,
): ProcurementResult<SealedAcquisitionStatus> {
  const parsed = SealedAcquisitionStatusSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'sealed acquisition-status projection digest does not match its content (tampered or mismatched envelope — status is derived only, never mutated)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
