/**
 * The PaymentPort seam (architecture.md, binding: "Payment processors are
 * adapters"; architecture lock rule 11; extension-architecture.md,
 * binding: "Payment processor state is not entitlement authority").
 *
 * What the port IS:
 * - a provider-NEUTRAL adapter interface expressing CHECKS and
 *   record-shaped outcomes ONLY. `checkPayment` answers whether the payment
 *   requirements of acquiring one exact published listing version are met
 *   for a tenant, given the listing's typed pricing model;
 * - the reference implementation is an IN-MEMORY port whose own state is
 *   primed by its test API (`settle`, `decline`, `refund`) — no payment
 *   processing, no payment credentials, no network calls, no charge,
 *   capture, or payout execution anywhere.
 *
 * What the port is NOT:
 * - it is NOT an entitlement authority: its outcomes can at PROPOSE/SYNC an
 *   Epoch-owned grant record (see entitlement.ts provenance
 *   `payment-sync`); a settled outcome alone never authorizes anything
 *   (the pure `checkEntitlement` cannot even read it);
 * - it carries NO provider semantics: ids are opaque (`port:<slug>`),
 *   outcomes are record-shaped typed data, strict objects reject unknown
 *   (vendor) fields.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import {
  ListingIdSchema,
  PaymentPortIdSchema,
  Sha256HexSchema,
  TenantIdSchema,
} from './primitives';
import { PAYMENT_CHECK_RESULTS } from './version';
import { PricingModelSchema, type PricingModel } from './pricing';
import type { MarketplaceResult } from './errors';

/**
 * A payment check request: the exact published listing version a tenant is
 * acquiring, and that version's typed pricing model (record data in, check
 * out).
 */
export const PaymentCheckRequestSchema = z
  .strictObject({
    listingId: ListingIdSchema,
    listingVersionDigest: Sha256HexSchema,
    tenantId: TenantIdSchema,
    pricing: PricingModelSchema,
  })
  .readonly()
  .meta({
    id: 'PaymentCheckRequest',
    title: 'PaymentCheckRequest',
    description:
      'Payment check request: the exact published listing version being acquired, the acquiring tenant, and the version pricing model (typed data in, record-shaped check out).',
  });

/** One payment check request. */
export type PaymentCheckRequest = z.infer<typeof PaymentCheckRequestSchema>;

/**
 * A record-shaped payment check outcome: which closed result the port
 * reports, plus an optional opaque port-side record reference. NEVER an
 * entitlement decision.
 */
export const PaymentCheckOutcomeSchema = z
  .strictObject({
    portId: PaymentPortIdSchema,
    checkedAt: TimestampSchema,
    result: z.enum(PAYMENT_CHECK_RESULTS),
    portReference: z.string().min(1).max(256).optional(),
  })
  .readonly()
  .meta({
    id: 'PaymentCheckOutcome',
    title: 'PaymentCheckOutcome',
    description:
      'Record-shaped payment check outcome: not-required (free), settled, unpaid, declined, refunded, or unknown-charge, plus an optional opaque port-side record reference. Never an entitlement decision.',
  });

/** One payment check outcome. */
export type PaymentCheckOutcome = z.infer<typeof PaymentCheckOutcomeSchema>;

/**
 * The provider-neutral payment port adapter interface. Implementations are
 * adapters behind this seam; the reference implementation below is
 * in-memory.
 */
export interface PaymentPort {
  /** The opaque identity of this port. */
  readonly portId: string;
  /** Check the payment requirements for acquiring one listing version. */
  checkPayment(request: PaymentCheckRequest): MarketplaceResult<PaymentCheckOutcome>;
}

/** The in-memory settled/declined/refunded state entry of the reference port. */
export interface PaymentPortStateEntry {
  readonly listingVersionDigest: string;
  readonly tenantId: string;
  readonly portReference: string;
  readonly state: 'settled' | 'declined' | 'refunded';
}

/**
 * The IN-MEMORY reference payment port. Its own state is primed via the
 * test API (`settle`, `decline`, `refund`) — simulating an adapter-side
 * record of payment outcomes WITHOUT processing any payment:
 *
 * - pricing kind `free` → `not-required` (no port state consulted);
 * - a primed `settled` entry → `settled` (+ port reference);
 * - a primed `refunded` entry → `refunded`;
 * - a primed `declined` entry → `declined`;
 * - otherwise → `unpaid`.
 *
 * Deterministic: state lookup is by exact (listingVersionDigest, tenantId)
 * pin; NO clock reads (outcome instants are the fixed producer-supplied
 * `checkedAt` the port is constructed with — callers that need a live
 * instant re-stamp outcomes with their own producer-supplied one), no
 * randomness, no network. THIS IS THE ONLY PAYMENT STATE IN THE MODEL, and
 * it is never an entitlement authority.
 */
export class InMemoryPaymentPort implements PaymentPort {
  readonly portId: string;
  private readonly checkedAt: string;
  private readonly entries = new Map<string, PaymentPortStateEntry>();

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

  private keyOf(listingVersionDigest: string, tenantId: string): string {
    return `${listingVersionDigest} ${tenantId}`;
  }

  /** Prime a settled payment record (reference behavior; no charging). */
  settle(input: {
    listingVersionDigest: string;
    tenantId: string;
    portReference: string;
  }): void {
    this.entries.set(this.keyOf(input.listingVersionDigest, input.tenantId), {
      listingVersionDigest: input.listingVersionDigest,
      tenantId: input.tenantId,
      portReference: input.portReference,
      state: 'settled',
    });
  }

  /** Prime a declined payment record (reference behavior). */
  decline(input: { listingVersionDigest: string; tenantId: string; portReference: string }): void {
    this.entries.set(this.keyOf(input.listingVersionDigest, input.tenantId), {
      listingVersionDigest: input.listingVersionDigest,
      tenantId: input.tenantId,
      portReference: input.portReference,
      state: 'declined',
    });
  }

  /** Prime a refunded payment record (reference behavior). */
  refund(input: { listingVersionDigest: string; tenantId: string; portReference: string }): void {
    this.entries.set(this.keyOf(input.listingVersionDigest, input.tenantId), {
      listingVersionDigest: input.listingVersionDigest,
      tenantId: input.tenantId,
      portReference: input.portReference,
      state: 'refunded',
    });
  }

  /** Number of primed entries (deterministic test surface). */
  get size(): number {
    return this.entries.size;
  }

  checkPayment(request: PaymentCheckRequest): MarketplaceResult<PaymentCheckOutcome> {
    const parsed = PaymentCheckRequestSchema.safeParse(request);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'payment check request failed schema validation',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.map((segment) => String(segment)).join('.'),
            message: issue.message,
          })),
        },
      };
    }
    const outcome = this.outcomeFor(parsed.data.pricing, parsed.data.listingVersionDigest, parsed.data.tenantId);
    return { ok: true, value: outcome };
  }

  private outcomeFor(
    pricing: PricingModel,
    listingVersionDigest: string,
    tenantId: string,
  ): PaymentCheckOutcome {
    const free = pricing.kind === 'free';
    const entry = this.entries.get(this.keyOf(listingVersionDigest, tenantId));
    if (free && entry === undefined) {
      return {
        portId: this.portId,
        checkedAt: this.checkedAt,
        result: 'not-required',
      };
    }
    if (entry !== undefined) {
      return {
        portId: this.portId,
        checkedAt: this.checkedAt,
        result: entry.state,
        portReference: entry.portReference,
      };
    }
    return { portId: this.portId, checkedAt: this.checkedAt, result: 'unpaid' };
  }
}
