/**
 * The entitlements/billing primitive schemas — typed, opaque,
 * provider-neutral ids and value shapes.
 *
 * UPSTREAM CONTRACT CONSUMPTION (the W024 discipline: consume, never
 * redefine): entitlement/listing ids, principal ids, decimal amounts,
 * currency codes, SHA-256 digests, opaque references and usage-stream ids
 * are IMPORTED from @epoch/marketplace (which mirrors/publishes the
 * W009/W023 grammars) — the shared vocabularies stay one authority. Only
 * the ids this package NEWLY owns (seat assignments, releases, billing
 * accounts, invoices, lines, settlements, settlement ports, streams) are
 * declared here.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import {
  CurrencyCodeSchema,
  EntitlementIdSchema,
  ListingIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PaymentPortIdSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
} from '@epoch/marketplace';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  BILLING_ACCOUNT_ID_PATTERN,
  ENTITLEMENTS_PRINCIPAL_ID_PATTERN,
  ENTITLEMENTS_STREAM_ID_PATTERN,
  BILLING_STREAM_ID_PATTERN,
  INVOICE_ID_PATTERN,
  LINE_ITEM_ID_PATTERN,
  SEAT_ASSIGNMENT_ID_PATTERN,
  SEAT_RELEASE_ID_PATTERN,
  SETTLEMENT_ID_PATTERN,
  SETTLEMENT_PORT_ID_PATTERN,
} from './version';

// Re-exported shared primitives (one authority: the upstream contracts).
export {
  CurrencyCodeSchema,
  EntitlementIdSchema,
  ListingIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PaymentPortIdSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
};
export { TenantIdSchema };
export { TimestampSchema };

/** Seat-assignment identity (opaque, kind-prefixed). */
export const SeatAssignmentIdSchema = z
  .string()
  .regex(SEAT_ASSIGNMENT_ID_PATTERN, 'must be a seat assignment id of the form "seat:<slug>"')
  .meta({
    id: 'SeatAssignmentId',
    title: 'SeatAssignmentId',
    description: 'Opaque seat-assignment identity: "seat:" followed by a lowercase slug.',
  });

/** One seat-assignment id. */
export type SeatAssignmentId = z.infer<typeof SeatAssignmentIdSchema>;

/** Seat-release identity (opaque, kind-prefixed). */
export const SeatReleaseIdSchema = z
  .string()
  .regex(SEAT_RELEASE_ID_PATTERN, 'must be a seat release id of the form "seat-release:<slug>"')
  .meta({
    id: 'SeatReleaseId',
    title: 'SeatReleaseId',
    description: 'Opaque seat-release identity: "seat-release:" followed by a lowercase slug.',
  });

/** One seat-release id. */
export type SeatReleaseId = z.infer<typeof SeatReleaseIdSchema>;

/** Billing-account identity (opaque, kind-prefixed). */
export const BillingAccountIdSchema = z
  .string()
  .regex(BILLING_ACCOUNT_ID_PATTERN, 'must be a billing account id of the form "billing-account:<slug>"')
  .meta({
    id: 'BillingAccountId',
    title: 'BillingAccountId',
    description: 'Opaque billing-account identity: "billing-account:" followed by a lowercase slug.',
  });

/** One billing-account id. */
export type BillingAccountId = z.infer<typeof BillingAccountIdSchema>;

/** Invoice identity (opaque, kind-prefixed). */
export const InvoiceIdSchema = z
  .string()
  .regex(INVOICE_ID_PATTERN, 'must be an invoice id of the form "invoice:<slug>"')
  .meta({
    id: 'InvoiceId',
    title: 'InvoiceId',
    description: 'Opaque invoice identity: "invoice:" followed by a lowercase slug.',
  });

/** One invoice id. */
export type InvoiceId = z.infer<typeof InvoiceIdSchema>;

/** Invoice line identity (opaque, kind-prefixed). */
export const LineItemIdSchema = z
  .string()
  .regex(LINE_ITEM_ID_PATTERN, 'must be a line id of the form "line:<slug>"')
  .meta({
    id: 'LineItemId',
    title: 'LineItemId',
    description: 'Opaque invoice-line identity: "line:" followed by a lowercase slug.',
  });

/** One invoice line id. */
export type LineItemId = z.infer<typeof LineItemIdSchema>;

/** Settlement identity (opaque, kind-prefixed). */
export const SettlementIdSchema = z
  .string()
  .regex(SETTLEMENT_ID_PATTERN, 'must be a settlement id of the form "settlement:<slug>"')
  .meta({
    id: 'SettlementId',
    title: 'SettlementId',
    description: 'Opaque settlement identity: "settlement:" followed by a lowercase slug.',
  });

/** One settlement id. */
export type SettlementId = z.infer<typeof SettlementIdSchema>;

/**
 * Settlement-port identity — the opaque `port:<slug>` grammar (shared with
 * the W023 payment-port grammar; pinned pattern-identical by the runtime
 * parity test).
 */
export const SettlementPortIdSchema = z
  .string()
  .regex(SETTLEMENT_PORT_ID_PATTERN, 'must be a port id of the form "port:<slug>"')
  .meta({
    id: 'SettlementPortId',
    title: 'SettlementPortId',
    description:
      'Opaque settlement-port identity: "port:" followed by a lowercase slug (the shared port grammar; the settlement seam never names a provider).',
  });

/** One settlement-port id. */
export type SettlementPortId = z.infer<typeof SettlementPortIdSchema>;

/** Entitlements stream identity (one stream per entitlement). */
export const EntitlementsStreamIdSchema = z
  .string()
  .regex(ENTITLEMENTS_STREAM_ID_PATTERN, 'must be a stream id of the form "stream:entitlements-<slug>"')
  .meta({
    id: 'EntitlementsStreamId',
    title: 'EntitlementsStreamId',
    description:
      'Opaque entitlements-stream identity: "stream:entitlements-" followed by a lowercase slug (the W010 stream grammar; one stream per entitlement).',
  });

/** One entitlements stream id. */
export type EntitlementsStreamId = z.infer<typeof EntitlementsStreamIdSchema>;

/** Billing stream identity (one stream per billing account). */
export const BillingStreamIdSchema = z
  .string()
  .regex(BILLING_STREAM_ID_PATTERN, 'must be a stream id of the form "stream:billing-<slug>"')
  .meta({
    id: 'BillingStreamId',
    title: 'BillingStreamId',
    description:
      'Opaque billing-stream identity: "stream:billing-" followed by a lowercase slug (the W010 stream grammar; one stream per billing account).',
  });

/** One billing stream id. */
export type BillingStreamId = z.infer<typeof BillingStreamIdSchema>;

/** Mirrored principal-id grammar (the W009 identity grammar; parity-pinned). */
export const ENTITLEMENTS_PRINCIPAL_ID_PATTERN_REF = ENTITLEMENTS_PRINCIPAL_ID_PATTERN;

// Shared value types consumed from the upstream contracts (type aliases).
export type {
  CurrencyCode,
  EntitlementId,
  ListingId,
  NonNegativeDecimal,
  OpaqueReference,
  PaymentPortId,
  PrincipalId,
  Sha256Hex,
} from '@epoch/marketplace';
export type { TenantId, WorkspaceId, ProjectId } from '@epoch/tenancy';
export type { Timestamp } from '@epoch/agent-protocol';
