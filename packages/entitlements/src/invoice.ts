/**
 * INVOICE records — the buyer-side billing document of W024.
 *
 * - An invoice is an IMMUTABLE, content-addressed record whose LINES are
 *   sealed at draft: quantity, unit amount, amount (exact decimal
 *   product), currency, basis, and full provenance references (the W023
 *   entitlement/listing, usage-event digests, or the W036 validated
 *   actual). Later lifecycle states are NEW sealed records — facts are
 *   append-only, never mutated in place (the W036 DeliveryRecord
 *   discipline).
 * - The lifecycle is the typed table draft -> issued -> settled | voided
 *   (`INVOICE_LIFECYCLE_TRANSITIONS`); `settled` records the Epoch-owned
 *   settlement fact with the settlement id and the opaque settlement-port
 *   reference — the port's state is NEVER the authority (lock rule 11
 *   applied to settlement: the invoice record is).
 * - There is no `overdue` state and no wall clock anywhere: due dates are
 *   caller-supplied instants; aging is a projection, never a transition.
 * - Determinism: lines sort by lineId (duplicate-free), amounts are exact
 *   canonical decimal strings, and {@link foldInvoiceTotals} is
 *   order-independent.
 */
import { z } from 'zod';
import { canonicalDigest, TimestampSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  BillingAccountIdSchema,
  CurrencyCodeSchema,
  EntitlementIdSchema,
  InvoiceIdSchema,
  LineItemIdSchema,
  ListingIdSchema,
  NonNegativeDecimalSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
} from './primitives';
import { SettlementIdSchema, SettlementPortIdSchema } from './primitives';
import { TenantIdSchema } from '@epoch/tenancy';
import { DeliveryIdSchema } from '@epoch/solution-delivery';
import {
  BILLING_LINE_BASIS,
  ENTITLEMENTS_RECORD_VERSION,
  INVOICE_LIFECYCLE_STATES,
  INVOICE_LIFECYCLE_TRANSITIONS,
  INVOICE_SCHEMA_NAME,
} from './version';
import type { InvoiceLifecycleState } from './version';
import {
  addNonNegativeDecimals,
  canonicalDecimalString,
  multiplyNonNegativeDecimals,
} from './decimal';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { EntitlementsResult } from './errors';

/** One invoice line's W036 validated-actual provenance (all-or-none). */
export const DeliveryActualReferenceSchema = z
  .strictObject({
    deliveryId: DeliveryIdSchema,
    actualRecordId: z.string().min(1).max(128),
    actualContentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'DeliveryActualReference',
    title: 'DeliveryActualReference',
    description:
      'The W036 validated-actual provenance of one delivery-actual invoice line: the delivery record, the actual record id, and the actual content digest (exact-revision addressing).',
  });

/** One delivery-actual reference. */
export type DeliveryActualReference = z.infer<typeof DeliveryActualReferenceSchema>;

/** One billable invoice line. */
export const InvoiceLineSchema = z
  .strictObject({
    lineId: LineItemIdSchema,
    basis: z.enum(BILLING_LINE_BASIS),
    description: z.string().min(1).max(256),
    quantity: NonNegativeDecimalSchema,
    unitAmount: NonNegativeDecimalSchema,
    amount: NonNegativeDecimalSchema,
    currency: CurrencyCodeSchema,
    entitlementId: EntitlementIdSchema.optional(),
    listingId: ListingIdSchema.optional(),
    periodStart: TimestampSchema.optional(),
    periodEnd: TimestampSchema.optional(),
    usageEventDigests: z.array(Sha256HexSchema).max(4096).optional(),
    delivery: DeliveryActualReferenceSchema.optional(),
  })
  .readonly()
  .superRefine((line, ctx) => {
    if (canonicalDecimalString(line.amount) !== multiplyNonNegativeDecimals(line.quantity, line.unitAmount)) {
      ctx.addIssue({
        code: 'custom',
        message: 'amount must equal quantity x unitAmount (exact decimal arithmetic)',
        path: ['amount'],
      });
    }
    if (line.basis === 'usage' && (line.entitlementId === undefined || line.usageEventDigests === undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'a usage line must carry its entitlement id and the usage-event digests it bills',
        path: ['entitlementId'],
      });
    }
    if (line.basis === 'delivery-actual' && line.delivery === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a delivery-actual line must carry its W036 validated-actual reference',
        path: ['delivery'],
      });
    }
    if (
      (line.basis === 'subscription' || line.basis === 'seat' || line.basis === 'one-time') &&
      line.entitlementId === undefined
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'an entitlement-priced line must carry its entitlement id',
        path: ['entitlementId'],
      });
    }
    if (line.basis === 'subscription') {
      if (line.periodStart === undefined || line.periodEnd === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'a subscription line must carry its billing period bounds',
          path: ['periodStart'],
        });
      } else if (line.periodStart > line.periodEnd) {
        ctx.addIssue({
          code: 'custom',
          message: 'periodStart must not be after periodEnd',
          path: ['periodStart'],
        });
      }
    }
    if (line.usageEventDigests !== undefined) {
      for (let i = 1; i < line.usageEventDigests.length; i += 1) {
        if (line.usageEventDigests[i]! < line.usageEventDigests[i - 1]!) {
          ctx.addIssue({
            code: 'custom',
            message: 'usageEventDigests must be sorted ascending (deterministic serialization)',
            path: ['usageEventDigests'],
          });
          break;
        }
        if (line.usageEventDigests[i]! === line.usageEventDigests[i - 1]!) {
          ctx.addIssue({
            code: 'custom',
            message: 'usageEventDigests must be duplicate-free',
            path: ['usageEventDigests'],
          });
          break;
        }
      }
    }
  })
  .meta({
    id: 'InvoiceLine',
    title: 'InvoiceLine',
    description:
      'One billable invoice line: basis (one-time, subscription, seat, usage, or delivery-actual), quantity, unit amount, exact decimal amount, currency, and the full provenance references (entitlement/listing, usage-event digests, or W036 validated-actual reference).',
  });

/** One invoice line. */
export type InvoiceLine = z.infer<typeof InvoiceLineSchema>;

const InvoiceObjectSchema = z
  .strictObject({
    schema: z.literal(INVOICE_SCHEMA_NAME),
    schemaVersion: z.literal(ENTITLEMENTS_RECORD_VERSION),
    invoiceId: InvoiceIdSchema,
    tenantId: TenantIdSchema,
    accountId: BillingAccountIdSchema,
    currency: CurrencyCodeSchema,
    lines: z.array(InvoiceLineSchema).min(1).max(4096),
    status: z.enum(INVOICE_LIFECYCLE_STATES),
    createdAt: TimestampSchema,
    createdBy: PrincipalIdSchema,
    dueAt: TimestampSchema.optional(),
    issuedAt: TimestampSchema.optional(),
    issuedBy: PrincipalIdSchema.optional(),
    settledAt: TimestampSchema.optional(),
    settlementId: SettlementIdSchema.optional(),
    settlementPortId: SettlementPortIdSchema.optional(),
    voidedAt: TimestampSchema.optional(),
    voidedBy: PrincipalIdSchema.optional(),
  })
  .superRefine((invoice, ctx) => {
    for (let i = 1; i < invoice.lines.length; i += 1) {
      if (invoice.lines[i]!.lineId < invoice.lines[i - 1]!.lineId) {
        ctx.addIssue({
          code: 'custom',
          message: 'lines must be sorted by lineId ascending (deterministic serialization)',
          path: ['lines'],
        });
        break;
      }
      if (invoice.lines[i]!.lineId === invoice.lines[i - 1]!.lineId) {
        ctx.addIssue({
          code: 'custom',
          message: 'lines must be duplicate-free by lineId',
          path: ['lines'],
        });
        break;
      }
    }
    for (const line of invoice.lines) {
      if (line.currency !== invoice.currency) {
        ctx.addIssue({
          code: 'custom',
          message: `line "${line.lineId}" currency "${line.currency}" disagrees with the invoice currency "${invoice.currency}"`,
          path: ['lines'],
        });
        break;
      }
    }
    if (invoice.status === 'issued' || invoice.status === 'settled') {
      if (invoice.issuedAt === undefined || invoice.issuedBy === undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'an issued or settled invoice must carry issuedAt and issuedBy',
          path: ['issuedAt'],
        });
      }
    }
    if (invoice.status === 'settled') {
      if (
        invoice.settledAt === undefined ||
        invoice.settlementId === undefined ||
        invoice.settlementPortId === undefined
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'a settled invoice must carry settledAt, settlementId, and settlementPortId',
          path: ['settledAt'],
        });
      }
    }
    if (invoice.status === 'voided' && (invoice.voidedAt === undefined || invoice.voidedBy === undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'a voided invoice must carry voidedAt and voidedBy',
        path: ['voidedAt'],
      });
    }
    if (invoice.status === 'draft') {
      const forbidden: ReadonlyArray<keyof InvoiceContent> = [
        'issuedAt',
        'issuedBy',
        'settledAt',
        'settlementId',
        'settlementPortId',
        'voidedAt',
        'voidedBy',
      ];
      for (const field of forbidden) {
        if (invoice[field] !== undefined) {
          ctx.addIssue({
            code: 'custom',
            message: `a draft invoice cannot carry lifecycle fields ("${String(field)}" is set)`,
            path: [field],
          });
          break;
        }
      }
    }
  });

/** The immutable content of one invoice state (everything except the digest). */
export const InvoiceContentSchema = InvoiceObjectSchema.readonly().meta({
  id: 'InvoiceContent',
  title: 'InvoiceContent',
  description:
    'The immutable content of one invoice state: identity, tenant and billing-account scope, single settlement currency, sorted billable lines, the lifecycle status, and the status-specific provenance instants/actors.',
});

/** One invoice content. */
export type InvoiceContent = z.infer<typeof InvoiceContentSchema>;

/** The SEALED invoice: content plus its SHA-256 content digest. */
export const SealedInvoiceSchema = z
  .strictObject({ ...InvoiceObjectSchema.shape, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedInvoice',
    title: 'SealedInvoice',
    description:
      'The sealed invoice: immutable buyer-side billing document (sorted billable lines, single currency, typed lifecycle state) plus the SHA-256 content digest (the exact-revision content address).',
  });

/** One sealed invoice. */
export type SealedInvoice = z.infer<typeof SealedInvoiceSchema>;

/** Strip the content digest from a sealed state (the pure content). */
function contentOf(sealed: SealedInvoice): InvoiceContent {
  const content: Record<string, unknown> = { ...sealed };
  delete content['contentDigest'];
  return content as unknown as InvoiceContent;
}

/** Compute the content digest of one invoice state (canonical JSON). */
export function computeInvoiceDigest(content: InvoiceContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

function reseal(content: InvoiceContent): SealedInvoice {
  return { ...content, contentDigest: canonicalDigest(content as unknown as JsonValue) };
}

/** Open (validate + seal) one invoice state. Total. */
export function openInvoice(content: unknown): EntitlementsResult<SealedInvoice> {
  const parsed = InvoiceContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: reseal(parsed.data) };
}

/** Verify a sealed invoice: schema + digest recomputation (tamper detection). Total. */
export function verifySealedInvoice(sealed: unknown): EntitlementsResult<SealedInvoice> {
  const parsed = SealedInvoiceSchema.safeParse(sealed);
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
        message: 'sealed invoice digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
        subject: parsed.data.invoiceId,
      },
    };
  }
  // Re-validate the content through the FULL content schema (refinements
  // included) — a structurally-parseable but refinement-violating envelope
  // never verifies.
  return openInvoice(content);
}

/** Guard one lifecycle transition against the typed successor table. */
function requireTransition(
  invoice: SealedInvoice,
  to: InvoiceLifecycleState,
): EntitlementsResult<SealedInvoice> {
  const legal = INVOICE_LIFECYCLE_TRANSITIONS[invoice.status];
  if (!legal.includes(to)) {
    return {
      ok: false,
      error: {
        code: 'invoice-state-conflict',
        message: `invoice "${invoice.invoiceId}" cannot transition ${invoice.status} -> ${to} (legal successors: ${legal.join(', ') || 'none'})`,
        invoiceId: invoice.invoiceId,
        from: invoice.status,
        to,
      },
    };
  }
  return { ok: true, value: invoice };
}

/** Input of the ISSUE transition. */
export interface IssueInvoiceInput {
  readonly issuedAt: string;
  readonly issuedBy: string;
  readonly dueAt?: string | undefined;
}

/**
 * ISSUE TRANSITION: draft -> issued (the buyer-facing document). The
 * invoice must verify (tamper check); the transition must be legal; the
 * result is a NEW sealed record (the draft remains an addressable fact).
 */
export function issueInvoice(
  invoice: SealedInvoice,
  input: IssueInvoiceInput,
): EntitlementsResult<SealedInvoice> {
  const verified = verifySealedInvoice(invoice);
  if (!verified.ok) {
    return verified;
  }
  const guarded = requireTransition(verified.value, 'issued');
  if (!guarded.ok) {
    return guarded;
  }
  const current = contentOf(guarded.value);
  const content: InvoiceContent = {
    ...current,
    status: 'issued',
    issuedAt: input.issuedAt,
    issuedBy: input.issuedBy,
    ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
  };
  return { ok: true, value: reseal(content) };
}

/** Input of the SETTLE transition. */
export interface SettleInvoiceInput {
  readonly settledAt: string;
  readonly settlementId: string;
  readonly settlementPortId: string;
}

/**
 * SETTLE TRANSITION: issued -> settled (the Epoch-owned settlement fact).
 * The settlement id and the opaque settlement-port reference are recorded
 * ON the invoice — the port's own state is never the authority (lock
 * rule 11 applied to settlement). Terminal.
 */
export function settleInvoice(
  invoice: SealedInvoice,
  input: SettleInvoiceInput,
): EntitlementsResult<SealedInvoice> {
  const verified = verifySealedInvoice(invoice);
  if (!verified.ok) {
    return verified;
  }
  const guarded = requireTransition(verified.value, 'settled');
  if (!guarded.ok) {
    return guarded;
  }
  const current = contentOf(guarded.value);
  const content: InvoiceContent = {
    ...current,
    status: 'settled',
    settledAt: input.settledAt,
    settlementId: input.settlementId,
    settlementPortId: input.settlementPortId,
  };
  return { ok: true, value: reseal(content) };
}

/** Input of the VOID transition. */
export interface VoidInvoiceInput {
  readonly voidedAt: string;
  readonly voidedBy: string;
}

/** VOID TRANSITION: draft|issued -> voided (terminal withdrawal). */
export function voidInvoice(
  invoice: SealedInvoice,
  input: VoidInvoiceInput,
): EntitlementsResult<SealedInvoice> {
  const verified = verifySealedInvoice(invoice);
  if (!verified.ok) {
    return verified;
  }
  const guarded = requireTransition(verified.value, 'voided');
  if (!guarded.ok) {
    return guarded;
  }
  const current = contentOf(guarded.value);
  const content: InvoiceContent = {
    ...current,
    status: 'voided',
    voidedAt: input.voidedAt,
    voidedBy: input.voidedBy,
  };
  return { ok: true, value: reseal(content) };
}

/** The deterministic totals of one invoice (the fold projection). */
export interface InvoiceTotals {
  readonly schemaVersion: 1;
  readonly invoiceId: string;
  readonly currency: string;
  readonly lineCount: number;
  /** The exact decimal sum of all line amounts. */
  readonly totalAmount: string;
  /** Line counts per basis (every basis key present, zero when absent). */
  readonly linesByBasis: Readonly<Record<string, number>>;
}

/**
 * Fold one invoice's lines into deterministic totals: exact decimal sum,
 * per-basis counts, currency echo. Pure function of the sealed record
 * (verified first — tampered input never folds).
 */
export function foldInvoiceTotals(invoice: SealedInvoice): EntitlementsResult<InvoiceTotals> {
  const verified = verifySealedInvoice(invoice);
  if (!verified.ok) {
    return verified;
  }
  let total = '0';
  const linesByBasis: Record<string, number> = {};
  for (const basis of BILLING_LINE_BASIS) {
    linesByBasis[basis] = 0;
  }
  for (const line of verified.value.lines) {
    total = addNonNegativeDecimals(total, line.amount);
    linesByBasis[line.basis] = (linesByBasis[line.basis] ?? 0) + 1;
  }
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      invoiceId: verified.value.invoiceId,
      currency: verified.value.currency,
      lineCount: verified.value.lines.length,
      totalAmount: total,
      linesByBasis,
    },
  };
}
