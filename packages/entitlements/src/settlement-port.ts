/**
 * The SettlementPort seam (W024; architecture.md, binding: "Payment
 * processors are adapters"; architecture lock rule 13).
 *
 * What the port IS:
 * - a provider-NEUTRAL adapter interface expressing CHECKS and
 *   record-shaped outcomes ONLY. `checkSettlement` answers whether the
 *   settlement requirements of one exact invoice are met for a tenant —
 *   the request carries the invoice identity and its exact decimal
 *   amount/currency (record data in, check out);
 * - the reference implementation is an IN-MEMORY port whose own state is
 *   primed by its test API (`markSettled`, `markUnpaid`, `markDeclined`)
 *   — no charge execution, no capture, no payout, no credentials, no
 *   network calls anywhere.
 *
 * What the port is NOT:
 * - it is NOT the billing authority: a settled outcome can at most
 *   PROPOSE the invoice's `settled` transition. The Epoch-owned invoice
 *   record (with the settlement id + port reference recorded ON it) is
 *   the settlement authority — the port's state is never read back
 *   (architecture lock rule 11 applied to settlement);
 * - it carries NO provider semantics: ids are opaque (`port:<slug>`),
 *   outcomes are record-shaped typed data, strict objects reject unknown
 *   (vendor) fields.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import { CurrencyCodeSchema, NonNegativeDecimalSchema } from './primitives';
import { InvoiceIdSchema, SettlementPortIdSchema } from './primitives';
import { SETTLEMENT_RESULTS } from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { EntitlementsResult } from './errors';

/**
 * A settlement check request: the exact invoice being settled, its
 * tenant, and its exact decimal amount + currency (typed data in, check
 * out).
 */
export const SettlementRequestSchema = z
  .strictObject({
    invoiceId: InvoiceIdSchema,
    tenantId: TenantIdSchema,
    amount: NonNegativeDecimalSchema,
    currency: CurrencyCodeSchema,
  })
  .readonly()
  .meta({
    id: 'SettlementRequest',
    title: 'SettlementRequest',
    description:
      'Settlement check request: the exact invoice being settled, the tenant, and the invoice amount and currency (typed data in, record-shaped check out).',
  });

/** One settlement check request. */
export type SettlementRequest = z.infer<typeof SettlementRequestSchema>;

/**
 * A record-shaped settlement check outcome: which closed result the port
 * reports, plus an optional opaque port-side record reference. NEVER a
 * billing decision — the invoice record is the authority.
 */
export const SettlementOutcomeSchema = z
  .strictObject({
    portId: SettlementPortIdSchema,
    checkedAt: TimestampSchema,
    result: z.enum(SETTLEMENT_RESULTS),
    portReference: z.string().min(1).max(256).optional(),
  })
  .readonly()
  .meta({
    id: 'SettlementOutcome',
    title: 'SettlementOutcome',
    description:
      'Record-shaped settlement check outcome: settled, unpaid, or declined, plus an optional opaque port-side record reference. Never a billing decision — the invoice record is the authority.',
  });

/** One settlement check outcome. */
export type SettlementOutcome = z.infer<typeof SettlementOutcomeSchema>;

/**
 * The provider-neutral settlement port adapter interface. Implementations
 * are adapters behind this seam; the reference implementation below is
 * in-memory.
 */
export interface SettlementPort {
  /** The opaque identity of this port. */
  readonly portId: string;
  /** Check the settlement requirements for one exact invoice. */
  checkSettlement(request: SettlementRequest): EntitlementsResult<SettlementOutcome>;
}

/** The in-memory settled/unpaid/declined state entry of the reference port. */
export interface SettlementPortStateEntry {
  readonly invoiceId: string;
  readonly tenantId: string;
  readonly portReference: string;
  readonly state: 'settled' | 'unpaid' | 'declined';
}

/**
 * The IN-MEMORY reference settlement port. Its own state is primed via
 * the test API (`markSettled`, `markUnpaid`, `markDeclined`) —
 * simulating an adapter-side record of settlement outcomes WITHOUT
 * processing any payment:
 *
 * - a primed `settled` entry -> `settled` (+ port reference);
 * - a primed `unpaid` entry -> `unpaid`;
 * - a primed `declined` entry -> `declined`;
 * - otherwise -> `unpaid` (fail-closed: an unprimed invoice is not
 *   settled).
 *
 * Deterministic: state lookup is by exact (invoiceId, tenantId) pin; NO
 * clock reads (outcome instants are the fixed producer-supplied
 * `checkedAt` the port is constructed with — callers that need a live
 * instant re-stamp outcomes with their own producer-supplied one), no
 * randomness, no network. THIS IS THE ONLY settlement state in the
 * model, and it is never the billing authority.
 */
export class InMemorySettlementPort implements SettlementPort {
  readonly portId: string;
  private readonly checkedAt: string;
  private readonly entries = new Map<string, SettlementPortStateEntry>();

  /**
   * @param portId opaque port identity (`port:<slug>`)
   * @param checkedAt the fixed producer-supplied instant stamped on every
   *   outcome (determinism: the port never reads a clock; default: the
   *   epoch instant)
   */
  constructor(portId: string, checkedAt: string = '1970-01-01T00:00:00.000Z') {
    this.portId = portId;
    this.checkedAt = checkedAt;
  }

  private keyOf(invoiceId: string, tenantId: string): string {
    return `${invoiceId} ${tenantId}`;
  }

  /** Prime a settled record (reference behavior; no charging). */
  markSettled(input: {
    invoiceId: string;
    tenantId: string;
    portReference: string;
  }): void {
    this.entries.set(this.keyOf(input.invoiceId, input.tenantId), {
      invoiceId: input.invoiceId,
      tenantId: input.tenantId,
      portReference: input.portReference,
      state: 'settled',
    });
  }

  /** Prime an unpaid record (reference behavior). */
  markUnpaid(input: { invoiceId: string; tenantId: string }): void {
    this.entries.set(this.keyOf(input.invoiceId, input.tenantId), {
      invoiceId: input.invoiceId,
      tenantId: input.tenantId,
      portReference: 'unpaid',
      state: 'unpaid',
    });
  }

  /** Prime a declined record (reference behavior). */
  markDeclined(input: { invoiceId: string; tenantId: string }): void {
    this.entries.set(this.keyOf(input.invoiceId, input.tenantId), {
      invoiceId: input.invoiceId,
      tenantId: input.tenantId,
      portReference: 'declined',
      state: 'declined',
    });
  }

  /** Number of primed entries (deterministic test surface). */
  get size(): number {
    return this.entries.size;
  }

  checkSettlement(request: SettlementRequest): EntitlementsResult<SettlementOutcome> {
    const parsed = SettlementRequestSchema.safeParse(request);
    if (!parsed.success) {
      if (hasUnrecognizedKeys(parsed.error)) {
        return { ok: false, error: vendorFieldsError(parsed.error) };
      }
      return { ok: false, error: validationError(parsed.error) };
    }
    const entry = this.entries.get(this.keyOf(parsed.data.invoiceId, parsed.data.tenantId));
    if (entry === undefined) {
      return {
        ok: true,
        value: {
          portId: this.portId,
          checkedAt: this.checkedAt,
          result: 'unpaid',
        },
      };
    }
    return {
      ok: true,
      value: {
        portId: this.portId,
        checkedAt: this.checkedAt,
        result: entry.state,
        portReference: entry.portReference,
      },
    };
  }
}
