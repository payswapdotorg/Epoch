/**
 * The entitlements kernel schema-surface registry: every data type
 * published at the `@epoch/entitlements` ownership boundary, paired with
 * its zod schema.
 *
 * W024 owns no top-level `contracts/` directory (the Work Order's owned
 * write surfaces are services/billing/** and packages/entitlements/**
 * ONLY), so the versioned contract surface is published INSIDE the
 * package — the W023 marketplace precedent: this ordered surface plus
 * the emitted JSON Schema files under `schemas/` (see
 * src/contract-emission.ts) plus the typed index export. Invariants
 * enforced by test/contract-drift.test.ts: every committed schema file
 * is byte-identical to the deterministic emission of its surface entry.
 */
import { z, type ZodType } from 'zod';
import {
  BillingAccountIdSchema,
  EntitlementsStreamIdSchema,
  BillingStreamIdSchema,
  InvoiceIdSchema,
  LineItemIdSchema,
  SeatAssignmentIdSchema,
  SeatReleaseIdSchema,
  SettlementIdSchema,
  SettlementPortIdSchema,
} from './primitives';
import { DeliveryActualReferenceSchema, InvoiceLineSchema, InvoiceContentSchema, SealedInvoiceSchema } from './invoice';
import { BillingAccountContentSchema, SealedBillingAccountSchema } from './account';
import {
  SeatAssignmentContentSchema,
  SeatReleaseContentSchema,
  SealedSeatAssignmentSchema,
  SealedSeatReleaseSchema,
} from './seats';
import { SettlementOutcomeSchema, SettlementRequestSchema } from './settlement-port';
import { UnitRateSchema } from './derive';
import {
  EntitlementsCausalParentSchema,
  EntitlementsEventPayloadSchema,
  EntitlementsEventSequenceSchema,
  SealedEntitlementsEventSchema,
  EntitlementsEventContentSchema,
} from './events';
import {
  BILLING_LINE_BASIS,
  ENTITLEMENTS_EVENT_DISCRIMINATORS,
  INVOICE_LIFECYCLE_STATES,
  SETTLEMENT_RESULTS,
} from './version';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

const InvoiceLifecycleStateSchema = z.enum(INVOICE_LIFECYCLE_STATES).meta({
  id: 'InvoiceLifecycleState',
  title: 'InvoiceLifecycleState',
  description: 'Invoice lifecycle state: draft, issued, settled, or voided.',
});

const BillingLineBasisSchema = z.enum(BILLING_LINE_BASIS).meta({
  id: 'BillingLineBasis',
  title: 'BillingLineBasis',
  description:
    'Billable-line basis: one-time, subscription, seat, usage (the W023 revenue-basis vocabulary), or delivery-actual (a W036 validated actual).',
});

const SettlementResultSchema = z.enum(SETTLEMENT_RESULTS).meta({
  id: 'SettlementResult',
  title: 'SettlementResult',
  description: 'Closed settlement check result vocabulary: settled, unpaid, or declined.',
});

const EntitlementsEventDiscriminatorSchema = z.enum(ENTITLEMENTS_EVENT_DISCRIMINATORS).meta({
  id: 'EntitlementsEventDiscriminator',
  title: 'EntitlementsEventDiscriminator',
  description:
    'Closed discriminator vocabulary of the entitlements/billing events: seat-assigned, seat-released, account-opened, invoice-drafted, invoice-issued, invoice-settled, invoice-voided.',
});

/** The complete, ordered data-type surface of the entitlements contract v1. */
export const ENTITLEMENTS_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  // Primitives (newly owned ids).
  { type: 'SeatAssignmentId', schema: SeatAssignmentIdSchema },
  { type: 'SeatReleaseId', schema: SeatReleaseIdSchema },
  { type: 'BillingAccountId', schema: BillingAccountIdSchema },
  { type: 'InvoiceId', schema: InvoiceIdSchema },
  { type: 'LineItemId', schema: LineItemIdSchema },
  { type: 'SettlementId', schema: SettlementIdSchema },
  { type: 'SettlementPortId', schema: SettlementPortIdSchema },
  { type: 'EntitlementsStreamId', schema: EntitlementsStreamIdSchema },
  { type: 'BillingStreamId', schema: BillingStreamIdSchema },
  // Seat accounting.
  { type: 'SeatAssignmentContent', schema: SeatAssignmentContentSchema },
  { type: 'SealedSeatAssignment', schema: SealedSeatAssignmentSchema },
  { type: 'SeatReleaseContent', schema: SeatReleaseContentSchema },
  { type: 'SealedSeatRelease', schema: SealedSeatReleaseSchema },
  // Billing accounts.
  { type: 'BillingAccountContent', schema: BillingAccountContentSchema },
  { type: 'SealedBillingAccount', schema: SealedBillingAccountSchema },
  // Invoices.
  { type: 'InvoiceLifecycleState', schema: InvoiceLifecycleStateSchema },
  { type: 'BillingLineBasis', schema: BillingLineBasisSchema },
  { type: 'DeliveryActualReference', schema: DeliveryActualReferenceSchema },
  { type: 'InvoiceLine', schema: InvoiceLineSchema },
  { type: 'InvoiceContent', schema: InvoiceContentSchema },
  { type: 'SealedInvoice', schema: SealedInvoiceSchema },
  // Settlement seam.
  { type: 'SettlementResult', schema: SettlementResultSchema },
  { type: 'SettlementRequest', schema: SettlementRequestSchema },
  { type: 'SettlementOutcome', schema: SettlementOutcomeSchema },
  { type: 'UnitRate', schema: UnitRateSchema },
  // Events (W010 shapes).
  { type: 'EntitlementsEventSequence', schema: EntitlementsEventSequenceSchema },
  { type: 'EntitlementsCausalParent', schema: EntitlementsCausalParentSchema },
  { type: 'EntitlementsEventDiscriminator', schema: EntitlementsEventDiscriminatorSchema },
  { type: 'EntitlementsEventPayload', schema: EntitlementsEventPayloadSchema },
  { type: 'EntitlementsEventContent', schema: EntitlementsEventContentSchema },
  { type: 'SealedEntitlementsEvent', schema: SealedEntitlementsEventSchema },
];
