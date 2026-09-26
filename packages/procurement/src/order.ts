/**
 * The purchase order: a sealed, content-addressed, VERSION-CHAINED
 * commercial document (`poVersion` + `previousPOVersionDigest`, the W023
 * convention). One PO grounds one package's selection chain:
 *
 * - the PO references the SELECTION by exact digest (the recorded
 *   decision) and the W036 COMMITMENT record by exact digest (verified
 *   through the REAL W036 kernel at admission — procurement links
 *   commitments, never re-implements them);
 * - the supplier id must equal the selected quote's supplier (opaque
 *   ids — the core never names a vendor);
 * - the commercial lines MIRROR the selected quote's lines exactly (a
 *   silent commercial rewrite at order time is a typed `validation`
 *   rejection) and the folded total must equal the commitment's fold;
 * - amendments ship as NEW versions chained onto the current head;
 *   broken chains are typed `dangling-reference-rejected` /
 *   `version-conflict` / `digest-mismatch`.
 */
import { z } from 'zod';
import type { JsonValue } from '@epoch/agent-protocol';
import { addNonNegativeDecimals } from '@epoch/solution-delivery';
import type { SealedDistinctionRecord } from '@epoch/solution-delivery';
import { TenantIdSchema } from '@epoch/solution-delivery';
import {
  CurrencyCodeSchema,
  NonNegativeDecimalSchema,
  PackageIdSchema,
  PoIdSchema,
  PositiveIntegerSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  SupplierIdSchema,
  TimestampSchema,
  UnitLabelSchema,
  canonicalDigest,
} from './primitives';
import { PURCHASE_ORDER_SCHEMA_NAME, PROCUREMENT_RECORD_VERSION } from './version';
import { authorityViolationError, hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ProcurementResult } from './errors';
import type { AcquisitionPackageStore } from './package';
import type { QuoteStore, SealedQuote } from './quote';
import { foldQuoteCost } from './commitment';
import { CommitmentReferenceSchema } from './commitment';
import type { SelectionStore } from './selection';

/** One commercial line of a purchase order. */
export const PoLineSchema = z
  .strictObject({
    description: z.string().min(1).max(256),
    quantity: NonNegativeDecimalSchema,
    unit: UnitLabelSchema,
    unitCost: z
      .strictObject({
        amount: NonNegativeDecimalSchema,
        currency: CurrencyCodeSchema,
      })
      .readonly(),
  })
  .readonly()
  .meta({
    id: 'PoLine',
    title: 'PoLine',
    description:
      'One commercial line of a purchase order: description, quantity+unit, and the unit cost (amount + ISO 4217 currency) — an exact mirror of the selected quote line.',
  });

/** One purchase-order line. */
export type PoLine = z.infer<typeof PoLineSchema>;

/** The folded total cost of a purchase order. */
export const PoTotalSchema = z
  .strictObject({
    amount: NonNegativeDecimalSchema,
    currency: CurrencyCodeSchema,
  })
  .readonly()
  .meta({
    id: 'PoTotal',
    title: 'PoTotal',
    description: 'The folded total cost of a purchase order (canonical decimal + ISO 4217 currency).',
  });

/** One purchase-order total. */
export type PoTotal = z.infer<typeof PoTotalSchema>;

/** The selection reference of a purchase order (exact revision). */
export const SelectionReferenceSchema = z
  .strictObject({
    selectionId: z.string().regex(/^selection:[a-z0-9][a-z0-9-]{0,62}$/),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SelectionReference',
    title: 'SelectionReference',
    description:
      'One quote-selection reference: the selection id plus its exact content digest (the recorded decision the order grounds).',
  });

/** One selection reference. */
export type SelectionReference = z.infer<typeof SelectionReferenceSchema>;

/**
 * The immutable content of one purchase-order VERSION: the commercial
 * document grounded on one package's selection chain and commitment.
 */
const purchaseOrderShape = z.strictObject({
  schema: z.literal(PURCHASE_ORDER_SCHEMA_NAME),
  schemaVersion: z.literal(PROCUREMENT_RECORD_VERSION),
  poId: PoIdSchema,
  tenantId: TenantIdSchema,
  packageId: PackageIdSchema,
  packageDigest: Sha256HexSchema,
  selectionRef: SelectionReferenceSchema,
  commitmentRef: CommitmentReferenceSchema,
  supplierId: SupplierIdSchema,
  poVersion: PositiveIntegerSchema,
  previousPOVersionDigest: Sha256HexSchema.nullable(),
  lines: z.array(PoLineSchema).max(64),
  totalCost: PoTotalSchema,
  issuedAt: TimestampSchema,
  issuedBy: PrincipalIdSchema,
  amendmentNote: z.string().max(2048).optional(),
});

export const PurchaseOrderContentSchema = purchaseOrderShape
  .readonly()
  .superRefine((po, ctx) => {
    for (let i = 1; i < po.lines.length; i += 1) {
      if (po.lines[i]!.description < po.lines[i - 1]!.description) {
        ctx.addIssue({
          code: 'custom',
          message: 'lines must be sorted by description ascending (deterministic serialization)',
          path: ['lines'],
        });
        break;
      }
      if (po.lines[i]!.description === po.lines[i - 1]!.description) {
        ctx.addIssue({
          code: 'custom',
          message: 'lines must be duplicate-free by description within the order',
          path: ['lines'],
        });
        break;
      }
    }
    if (po.poVersion > 1 && po.previousPOVersionDigest === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'purchase-order versions beyond the first must chain the previous version digest',
        path: ['previousPOVersionDigest'],
      });
    }
    if (po.poVersion === 1 && po.previousPOVersionDigest !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'the first purchase-order version has no previous version digest',
        path: ['previousPOVersionDigest'],
      });
    }
  })
  .meta({
    id: 'PurchaseOrderContent',
    title: 'PurchaseOrderContent',
    description:
      'The immutable content of one purchase-order version: the package, selection and commitment references (exact digests), the opaque supplier id, the version-chain link, sorted commercial lines, the folded total, and issuing provenance.',
  });

/** One purchase-order content. */
export type PurchaseOrderContent = z.infer<typeof PurchaseOrderContentSchema>;

/** The SEALED purchase-order version: content plus its content digest. */
export const SealedPurchaseOrderSchema = z
  .strictObject({
    ...purchaseOrderShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedPurchaseOrder',
    title: 'SealedPurchaseOrder',
    description:
      'The sealed purchase-order version: immutable version-chained commercial document plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed purchase order. */
export type SealedPurchaseOrder = z.infer<typeof SealedPurchaseOrderSchema>;

/** Compute the content digest of purchase-order content (canonical JSON). */
export function computePurchaseOrderDigest(content: PurchaseOrderContent): string {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid purchase-order content into its published record. */
export function sealPurchaseOrder(content: unknown): ProcurementResult<SealedPurchaseOrder> {
  const pre = authorityViolationError(content);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = PurchaseOrderContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed purchase-order version (schema + digest recomputation). */
export function verifySealedPurchaseOrder(
  sealed: unknown,
): ProcurementResult<SealedPurchaseOrder> {
  const pre = authorityViolationError(sealed);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = SealedPurchaseOrderSchema.safeParse(sealed);
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
          'sealed purchase-order digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** The append-only purchase-order store (all versions, reference in-memory). */
export interface PurchaseOrderStore {
  readonly orders: readonly SealedPurchaseOrder[];
}

/** An empty purchase-order store. */
export function emptyPurchaseOrderStore(): PurchaseOrderStore {
  return { orders: [] };
}

/** The current (latest) sealed version of one po id, if any. */
export function purchaseOrderHead(
  store: PurchaseOrderStore,
  poId: string,
): SealedPurchaseOrder | undefined {
  const versions = store.orders.filter((order) => order.poId === poId);
  return versions.length === 0 ? undefined : versions[versions.length - 1];
}

/** The exact decimal fold of purchase-order line unit costs. */
function foldPoLines(lines: readonly PoLine[]): { amount: string; currency: string } | null {
  if (lines.length === 0) {
    return null;
  }
  const currency = lines[0]!.unitCost.currency;
  let total = '0';
  for (const line of lines) {
    if (line.unitCost.currency !== currency) {
      return null;
    }
    total = addNonNegativeDecimals(total, line.unitCost.amount);
  }
  return { amount: total, currency };
}

/** Whether purchase-order lines mirror the selected quote's lines exactly. */
function mirrorsQuoteLines(lines: readonly PoLine[], quote: SealedQuote): boolean {
  if (lines.length !== quote.lines.length) {
    return false;
  }
  return lines.every((line, index) => {
    const quoteLine = quote.lines[index]!;
    return (
      line.description === quoteLine.description &&
      line.quantity === quoteLine.quantity &&
      line.unit === quoteLine.unit &&
      line.unitCost.amount === quoteLine.unitCost.amount &&
      line.unitCost.currency === quoteLine.unitCost.currency
    );
  });
}

/**
 * Admit a sealed purchase-order version:
 *
 * - the version verifies (tamper detection);
 * - the package exists and the order is tenant-consistent with it
 *   (`tenant-isolation-rejected`); the order's `packageDigest` must
 *   equal the package's content digest (`digest-mismatch`);
 * - the selection exists (kind `selection`), its digest matches
 *   (`digest-mismatch`), and it belongs to the SAME package and tenant;
 * - the commitment record exists among the supplied W036 sealed
 *   distinction records (kind `commitment-record`), its digest matches
 *   (`digest-mismatch`), and it is a `commitment` kind record — any
 *   other distinction kind grounding an order is a typed
 *   `distinction-collapse-rejected`;
 * - the selected quote resolves (latest revision) with the selection's
 *   recorded digest, the order's supplier matches the quote's supplier,
 *   the order's lines MIRROR the quote's lines, and the order's
 *   `totalCost` equals the exact fold (`validation`);
 * - the version chain is sound: version 1 admits onto an empty chain
 *   for the po id; version N chains `previousPOVersionDigest` to the
 *   current head (broken chains are typed
 *   `dangling-reference-rejected` / `version-conflict` /
 *   `digest-mismatch`);
 * - an exact re-admission is idempotent.
 */
export function admitPurchaseOrder(
  packages: AcquisitionPackageStore,
  quotes: QuoteStore,
  selections: SelectionStore,
  commitments: readonly SealedDistinctionRecord[],
  store: PurchaseOrderStore,
  order: unknown,
): ProcurementResult<PurchaseOrderStore> {
  const verified = verifySealedPurchaseOrder(order);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  const pkg = packages.packages.find((candidate) => candidate.packageId === admitted.packageId);
  if (pkg === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `purchase order "${admitted.poId}" references acquisition package "${admitted.packageId}", which does not resolve`,
        referenceKind: 'acquisition-package',
        referenceId: admitted.packageId,
      },
    };
  }
  if (admitted.tenantId !== pkg.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `purchase order "${admitted.poId}" belongs to tenant "${admitted.tenantId}" but the acquisition package is scoped to "${pkg.tenantId}" (R12)`,
        expectedTenantId: pkg.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.poId,
      },
    };
  }
  if (admitted.packageDigest !== pkg.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `purchase order "${admitted.poId}" grounds package digest "${admitted.packageDigest}" but the admitted package's exact digest is "${pkg.contentDigest}"`,
        expected: pkg.contentDigest,
        encountered: admitted.packageDigest,
      },
    };
  }
  const selection = selections.selections.find(
    (record) => record.selectionId === admitted.selectionRef.selectionId,
  );
  if (selection === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `purchase order "${admitted.poId}" references quote selection "${admitted.selectionRef.selectionId}", which does not resolve`,
        referenceKind: 'selection',
        referenceId: admitted.selectionRef.selectionId,
      },
    };
  }
  if (selection.contentDigest !== admitted.selectionRef.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `purchase order "${admitted.poId}" references selection digest "${admitted.selectionRef.contentDigest}" but the selection's exact digest is "${selection.contentDigest}"`,
        expected: selection.contentDigest,
        encountered: admitted.selectionRef.contentDigest,
      },
    };
  }
  if (selection.packageId !== admitted.packageId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `purchase order "${admitted.poId}" grounds selection "${selection.selectionId}" of package "${selection.packageId}" but the order subjects "${admitted.packageId}"`,
        issues: [{ path: 'selectionRef', message: 'the order must ground the same package the selection decided' }],
      },
    };
  }
  const commitment = commitments.find(
    (record) => record.recordId === admitted.commitmentRef.recordId,
  );
  if (commitment === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `purchase order "${admitted.poId}" references commitment record "${admitted.commitmentRef.recordId}", which does not resolve`,
        referenceKind: 'commitment-record',
        referenceId: admitted.commitmentRef.recordId,
      },
    };
  }
  if (commitment.contentDigest !== admitted.commitmentRef.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `purchase order "${admitted.poId}" references commitment digest "${admitted.commitmentRef.contentDigest}" but the record's exact digest is "${commitment.contentDigest}"`,
        expected: commitment.contentDigest,
        encountered: admitted.commitmentRef.contentDigest,
      },
    };
  }
  if (commitment.kind !== 'commitment') {
    return {
      ok: false,
      error: {
        code: 'distinction-collapse-rejected',
        message: `purchase order "${admitted.poId}" is grounded by a "${commitment.kind}" distinction record — an order is grounded by a W036 COMMITMENT record only (the distinctions are separate immutable records)`,
        recordId: commitment.recordId,
        expectedKind: 'commitment',
        encounteredKind: commitment.kind,
      },
    };
  }
  if (commitment.tenantId !== admitted.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `commitment record "${commitment.recordId}" belongs to tenant "${commitment.tenantId}" but the purchase order is scoped to "${admitted.tenantId}" (R12)`,
        expectedTenantId: admitted.tenantId,
        encounteredTenantId: commitment.tenantId,
        subject: commitment.recordId,
      },
    };
  }
  const selectedQuote = [...quotes.quotes]
    .filter((quote) => quote.quoteId === selection.selectedQuoteId)
    .sort((a, b) => a.revision - b.revision)
    .pop();
  if (selectedQuote === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-quote-rejected',
        message: `purchase order "${admitted.poId}" grounds selection "${selection.selectionId}" whose quote "${selection.selectedQuoteId}" does not resolve`,
        selectionId: selection.selectionId,
        quoteId: selection.selectedQuoteId,
        reason: 'missing',
      },
    };
  }
  if (selectedQuote.contentDigest !== selection.selectedQuoteDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `the selection's quote digest has drifted from the quote store — the order cannot ground a stale selection`,
        expected: selectedQuote.contentDigest,
        encountered: selection.selectedQuoteDigest,
      },
    };
  }
  if (admitted.supplierId !== selectedQuote.supplierId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `purchase order "${admitted.poId}" names supplier "${admitted.supplierId}" but the selected quote's supplier is "${selectedQuote.supplierId}" — the order's supplier IS the selected quote's supplier`,
        issues: [{ path: 'supplierId', message: 'supplierId must equal the selected quote supplier' }],
      },
    };
  }
  if (!mirrorsQuoteLines(admitted.lines, selectedQuote)) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `purchase order "${admitted.poId}" commercial lines do not mirror the selected quote's lines — a silent commercial rewrite at order time is rejected`,
        issues: [{ path: 'lines', message: 'lines must mirror the selected quote lines exactly' }],
      },
    };
  }
  const folded = foldQuoteCost(selectedQuote);
  if (!folded.ok) {
    return folded;
  }
  const poFold = foldPoLines(admitted.lines);
  if (
    poFold === null ||
    poFold.amount !== admitted.totalCost.amount ||
    poFold.currency !== admitted.totalCost.currency ||
    folded.value.amount !== admitted.totalCost.amount
  ) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `purchase order "${admitted.poId}" total ${admitted.totalCost.amount} ${admitted.totalCost.currency} does not equal the exact line fold ${poFold === null ? '(empty)' : `${poFold.amount} ${poFold.currency}`} / the selected quote fold ${folded.value.amount} ${folded.value.currency}`,
        issues: [{ path: 'totalCost', message: 'totalCost must equal the exact fold of the mirrored lines' }],
      },
    };
  }
  const exact = store.orders.find(
    (existing) => existing.poId === admitted.poId && existing.contentDigest === admitted.contentDigest,
  );
  if (exact !== undefined) {
    return { ok: true, value: store };
  }
  const head = purchaseOrderHead(store, admitted.poId);
  if (admitted.poVersion === 1) {
    if (head !== undefined) {
      return {
        ok: false,
        error: {
          code: 'version-conflict',
          message: `purchase order "${admitted.poId}" already has versions (head version ${head.poVersion}) — version 1 admits only onto an empty chain`,
          subject: 'purchase-order-version',
          subjectId: admitted.poId,
          publishedDigest: head.contentDigest,
        },
      };
    }
    return { ok: true, value: { orders: [...store.orders, admitted] } };
  }
  if (head === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `purchase order "${admitted.poId}" version ${admitted.poVersion} chains digest "${admitted.previousPOVersionDigest}" but the order has no admitted versions`,
        referenceKind: 'purchase-order',
        referenceId: admitted.poId,
      },
    };
  }
  if (admitted.poVersion !== head.poVersion + 1) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `purchase order "${admitted.poId}" version ${admitted.poVersion} must follow the head version ${head.poVersion} contiguously`,
        subject: 'purchase-order-version',
        subjectId: admitted.poId,
        publishedDigest: head.contentDigest,
      },
    };
  }
  if (admitted.previousPOVersionDigest !== head.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `purchase order "${admitted.poId}" version ${admitted.poVersion} chains digest "${admitted.previousPOVersionDigest}" but the head version's exact digest is "${head.contentDigest}" (broken version chain — the W023 convention)`,
        expected: head.contentDigest,
        encountered: admitted.previousPOVersionDigest!,
      },
    };
  }
  return { ok: true, value: { orders: [...store.orders, admitted] } };
}

/** The purchase-order-store fold: head versions sorted by poId (deterministic). */
export function foldPurchaseOrders(
  store: PurchaseOrderStore,
): readonly SealedPurchaseOrder[] {
  const heads = new Map<string, SealedPurchaseOrder>();
  for (const order of store.orders) {
    heads.set(order.poId, order);
  }
  return [...heads.values()].sort((a, b) => (a.poId < b.poId ? -1 : 1));
}
