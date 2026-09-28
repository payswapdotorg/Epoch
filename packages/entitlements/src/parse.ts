/**
 * The total parse surface (errors are values, never exceptions). Each
 * parse validates one serialized entitlements/billing document through
 * the runtime zod validators and classifies strict-object
 * `unrecognized_keys` rejections as the typed `vendor-fields-rejected`
 * error (provider/vendor fields cannot enter records).
 */
import type { ZodError } from 'zod';
import {
  SeatAssignmentContentSchema,
  SeatReleaseContentSchema,
  verifySealedSeatAssignment,
  verifySealedSeatRelease,
} from './seats';
import type {
  SeatAssignmentContent,
  SeatReleaseContent,
  SealedSeatAssignment,
  SealedSeatRelease,
} from './seats';
import { BillingAccountContentSchema, verifySealedBillingAccount } from './account';
import type { BillingAccountContent, SealedBillingAccount } from './account';
import { InvoiceContentSchema, verifySealedInvoice } from './invoice';
import type { InvoiceContent, SealedInvoice } from './invoice';
import { SettlementOutcomeSchema, SettlementRequestSchema } from './settlement-port';
import type { SettlementOutcome, SettlementRequest } from './settlement-port';
import { EntitlementsEventContentSchema, verifySealedEntitlementsEvent } from './events';
import type { EntitlementsEventContent, SealedEntitlementsEvent } from './events';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { EntitlementsResult } from './errors';

/** Shared parser: content schemas accept unknown, classify vendor fields. */
function parseContent<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: ZodError } },
  value: unknown,
): EntitlementsResult<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Parse one seat-assignment content document. Total. */
export function parseSeatAssignmentContent(value: unknown): EntitlementsResult<SeatAssignmentContent> {
  return parseContent(SeatAssignmentContentSchema, value);
}

/** Parse one sealed seat-assignment record (schema + digest). Total. */
export function parseSealedSeatAssignment(value: unknown): EntitlementsResult<SealedSeatAssignment> {
  return verifySealedSeatAssignment(value);
}

/** Parse one seat-release content document. Total. */
export function parseSeatReleaseContent(value: unknown): EntitlementsResult<SeatReleaseContent> {
  return parseContent(SeatReleaseContentSchema, value);
}

/** Parse one sealed seat-release record (schema + digest). Total. */
export function parseSealedSeatRelease(value: unknown): EntitlementsResult<SealedSeatRelease> {
  return verifySealedSeatRelease(value);
}

/** Parse one billing-account content document. Total. */
export function parseBillingAccountContent(value: unknown): EntitlementsResult<BillingAccountContent> {
  return parseContent(BillingAccountContentSchema, value);
}

/** Parse one sealed billing-account record (schema + digest). Total. */
export function parseSealedBillingAccount(value: unknown): EntitlementsResult<SealedBillingAccount> {
  return verifySealedBillingAccount(value);
}

/** Parse one invoice content document. Total. */
export function parseInvoiceContent(value: unknown): EntitlementsResult<InvoiceContent> {
  return parseContent(InvoiceContentSchema, value);
}

/** Parse one sealed invoice record (schema + digest). Total. */
export function parseSealedInvoice(value: unknown): EntitlementsResult<SealedInvoice> {
  return verifySealedInvoice(value);
}

/** Parse one settlement request. Total. */
export function parseSettlementRequest(value: unknown): EntitlementsResult<SettlementRequest> {
  return parseContent(SettlementRequestSchema, value);
}

/** Parse one settlement outcome. Total. */
export function parseSettlementOutcome(value: unknown): EntitlementsResult<SettlementOutcome> {
  return parseContent(SettlementOutcomeSchema, value);
}

/** Parse one entitlements/billing event content. Total. */
export function parseEntitlementsEventContent(value: unknown): EntitlementsResult<EntitlementsEventContent> {
  return parseContent(EntitlementsEventContentSchema, value);
}

/** Parse one sealed entitlements/billing event record (schema + digest). Total. */
export function parseSealedEntitlementsEvent(value: unknown): EntitlementsResult<SealedEntitlementsEvent> {
  return verifySealedEntitlementsEvent(value);
}
