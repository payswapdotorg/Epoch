/**
 * The Billing HOST (service layer, W024): the thin typed runtime facade
 * over the @epoch/entitlements kernel.
 *
 * - **Billing-account sessions** — idempotent opening (the account id is
 *   derived from (idempotencyKey, tenant); one settlement currency per
 *   account).
 * - **W023 adoption** — entitlement grant/revocation records enter
 *   through the REAL marketplace validators (idempotent by entitlement
 *   id; same-id-different-content is the typed `idempotency-conflict`).
 * - **W036 registration** — sealed delivery records verified at
 *   admission (the REAL `verifySealedDeliveryRecord`); only VALIDATED
 *   actuals ever bill.
 * - **Usage intake** — sealed W023 usage events (verified, idempotent by
 *   (streamId, sequence), folded through the REAL marketplace fold at
 *   read/derivation time).
 * - **Seat operations** — kernel admission (capacity, duplicates,
 *   revocation) with events on the entitlement's stream.
 * - **Invoice sessions** — draft -> issued -> settled | void. Line
 *   amounts are NEVER caller-supplied: the kernel derives them from the
 *   W023 pricing models (validated through the REAL marketplace parser),
 *   the folded usage accounts, the folded seat accounts, and the
 *   registered W036 validated actuals. Settlement goes through the
 *   SettlementPort seam — the port outcome PROPOSES the transition; the
 *   invoice record is the authority (lock rule 11 applied to
 *   settlement).
 * - **Tenant isolation (R12)** — every read/write is tenant-scoped;
 *   cross-tenant access is the typed `cross-tenant-denied` rejection.
 * - **Health/liveness as typed data** — a pure state projection: no wall
 *   clock, no randomness, deterministic key order.
 *
 * The W009 authorization gate denies unauthorized operations BEFORE any
 * kernel admission (the W022/W037/W043 pattern).
 *
 * In-memory reference behavior only: NO persistence, NO network, NO real
 * processes (later Work Orders add those behind this seam).
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  AUTHORIZATION_RECORD_VERSION,
  evaluate,
  parseAuthorizationContext,
} from '@epoch/authorization';
import type { AuthorizationDecision } from '@epoch/authorization';
import {
  foldUsageEvents,
  parsePricingModel,
  usageStreamIdOf,
  verifySealedUsageEvent,
} from '@epoch/marketplace';
import { verifySealedDeliveryRecord } from '@epoch/solution-delivery';
import type { SealedDeliveryRecord } from '@epoch/solution-delivery';
import type { TenancyHierarchy } from '@epoch/tenancy';
import {
  admitSeatAssignment,
  admitSeatRelease,
  billingStreamIdOf,
  classifyPricingForBilling,
  deriveDeliveryActualLines,
  deriveOneTimeLine,
  deriveSeatLine,
  deriveSubscriptionLine,
  deriveUsageLine,
  entitlementsStreamIdOf,
  foldInvoiceTotals,
  foldSeatAssignments,
  issueInvoice,
  openInvoice,
  parseEntitlementGrantRecord,
  parseEntitlementRevokeRecord,
  resolveEntitlement,
  sealBillingAccount,
  sealEntitlementsEvent,
  settleInvoice as settleInvoiceKernel,
  voidInvoice as voidInvoiceKernel,
  INVOICE_LIFECYCLE_STATES,
  unsupportedPricingModelError,
} from '@epoch/entitlements';
import type {
  EntitlementGrantRecord,
  EntitlementRevokeRecord,
  MarketplaceError,
  SealedUsageEvent,
} from '@epoch/marketplace';
import type {
  InvoiceLine,
  SealedBillingAccount,
  SealedEntitlementsEvent,
  SealedInvoice,
  SealedSeatAssignment,
  SealedSeatRelease,
  SettlementPort,
} from '@epoch/entitlements';
import {
  BILLING_HOST_SERVICE_NAME,
  HOST_RECORD_VERSION,
  IDEMPOTENCY_KEY_PATTERN,
} from './version';
import type {
  AccountReceipt,
  AdoptionReceipt,
  AssignSeatInput,
  AuthorizationInput,
  BillingServiceError,
  BillingServiceResult,
  DraftInvoiceInput,
  HealthReport,
  HostResult,
  IdempotencyKey,
  InvoiceReceipt,
  InvoiceReadInput,
  InvoiceSummary,
  IntakeUsageInput,
  IssueInvoiceInput,
  LineSource,
  ListInvoicesInput,
  OpenAccountInput,
  RegisterDeliveryInput,
  RegisterGrantInput,
  RegisterRevocationInput,
  ReleaseSeatInput,
  ResolveEntitlementInput,
  SeatOperationReceipt,
  ServiceDescription,
  SettlementOutcomeProjection,
  StreamReadInput,
  SettleInvoiceInput,
  UsageAccountInput,
  UsageIntakeReceipt,
  VoidInvoiceInput,
  SeatAccountInput,
} from './types';

/** The contract version reported by the describe surface. */
const CONTRACT_VERSION = '1.0.0';

function ok<T>(value: T): HostResult<T> {
  return { ok: true, value };
}

function fail<T>(error: BillingServiceError): HostResult<T> {
  return { ok: false, error };
}

/**
 * Map a W009 authorization error onto the service union: `validation`
 * passes through (malformed contexts are typed validation failures);
 * every other authorization failure is the fail-closed
 * `authorization-rejected` service code.
 */
function mapAuthorizationError(error: {
  readonly code: string;
  readonly message: string;
  readonly issues?: readonly { path: string; message: string }[] | undefined;
}): BillingServiceError {
  if (error.code === 'validation') {
    return {
      code: 'validation',
      message: error.message,
      issues: error.issues ?? [],
    };
  }
  return {
    code: 'authorization-rejected',
    message: `the authorization decision point failed (${error.code}): ${error.message}`,
    denialCode: error.code,
    principalId: 'unknown',
    operation: 'authorization',
  };
}

/**
 * Map a W023 marketplace error onto the service union: the shared codes
 * (validation, vendor fields, tenant isolation, entitlement denials)
 * pass through with their payloads; marketplace-specific codes surface
 * as typed validation carriers (the marketplace stays the authority —
 * this is an adapter boundary, never a re-definition).
 */
function mapMarketplaceError(error: MarketplaceError): BillingServiceError {
  switch (error.code) {
    case 'validation':
      return { code: 'validation', message: error.message, issues: error.issues };
    case 'vendor-fields-rejected':
      return {
        code: 'vendor-fields-rejected',
        message: error.message,
        issues: error.issues,
        path: error.path,
      };
    case 'cross-tenant-denied':
      return {
        code: 'cross-tenant-denied',
        message: error.message,
        expectedTenantId: error.expectedTenantId,
        encounteredTenantId: error.encounteredTenantId,
      };
    case 'entitlement-denied':
      return {
        code: 'entitlement-denied',
        message: error.message,
        query: {
          listingId: error.query.listingId,
          tenantId: error.query.tenantId,
          workspaceId: error.query.workspaceId,
        },
      };
    case 'entitlement-revoked':
      return {
        code: 'entitlement-revoked',
        message: error.message,
        entitlementId: error.entitlementId,
        revokedAt: error.revokedAt,
      };
    case 'unknown-entitlement':
      return {
        code: 'unknown-entitlement',
        message: error.message,
        entitlementId: error.entitlementId,
      };
    default:
      return {
        code: 'validation',
        message: `the marketplace authority rejected the input (${error.code}): ${error.message}`,
        issues: [],
      };
  }
}

/** Deterministic composite key: `<tenantId>#<id>`. */
function tenantKey(tenantId: string, id: string): string {
  return `${tenantId}#${id}`;
}

/** Derive a deterministic kind-prefixed slug id from digest input. */
function deriveSlugId(prefix: string, input: Record<string, unknown>): string {
  return `${prefix}:${canonicalDigest(input as unknown as JsonValue).slice(0, 16)}`;
}

/** The closed key set of the account-opening input (strict-object discipline). */
const ACCOUNT_KEYS = new Set(['asTenant', 'authorization', 'idempotencyKey', 'currency', 'displayName', 'openedAt', 'openedBy']);

/** Reject an input carrying unknown structural fields (vendor discipline). */
function vendorFields(code: string, path: string): BillingServiceError {
  return {
    code: 'vendor-fields-rejected',
    message: `input carries unknown structural fields — provider/vendor fields cannot enter billing host inputs (strict objects; adapterize provider semantics behind the SettlementPort seam instead)`,
    issues: [{ path, message: `unrecognized key: "${code}"` }],
    path: [],
  };
}

/**
 * The in-memory billing host. Construct with `new BillingHost(options)`.
 */
export class BillingHost {
  /** tenantId#accountId -> the sealed account. Maps iterate in insertion order; every read path sorts. */
  private readonly accounts = new Map<string, SealedBillingAccount>();

  /** idempotencyKey -> { inputDigest, storeKey } (account opening dedup). */
  private readonly accountByKey = new Map<IdempotencyKey, { inputDigest: string; storeKey: string }>();

  /** tenantId#entitlementId -> the adopted W023 grant. */
  private readonly grants = new Map<string, EntitlementGrantRecord>();

  /** entitlementId -> the adopted W023 revocation (latest wins for reads; all kept). */
  private readonly revocations = new Map<string, EntitlementRevokeRecord[]>();

  /** tenantId#deliveryId -> the verified sealed W036 delivery record. */
  private readonly deliveries = new Map<string, SealedDeliveryRecord>();

  /** streamId -> sealed usage events (append-only, deduped by (streamId, sequence)). */
  private readonly usageEvents = new Map<string, SealedUsageEvent[]>();

  /** tenantId#entitlementId -> seat assignments (append-only). */
  private readonly seatAssignments = new Map<string, SealedSeatAssignment[]>();

  /** tenantId#entitlementId -> seat releases (append-only). */
  private readonly seatReleases = new Map<string, SealedSeatRelease[]>();

  /** seatAssignmentId -> the derived idempotency key digest (seat dedup). */
  private readonly seatByKey = new Map<string, { inputDigest: string; assignment: SealedSeatAssignment }>();

  /** seatAssignmentId -> release receipts (release dedup). */
  private readonly releaseByKey = new Map<string, { inputDigest: string; release: SealedSeatRelease }>();

  /** tenantId#invoiceId -> the CURRENT sealed invoice state. */
  private readonly invoices = new Map<string, SealedInvoice>();

  /** invoiceId -> the CURRENT sealed invoice state (globally unique ids). */
  private readonly invoicesById = new Map<string, SealedInvoice>();

  /** tenantId#invoiceId -> every sealed state, append-only (facts). */
  private readonly invoiceHistory = new Map<string, SealedInvoice[]>();

  /** idempotencyKey -> { inputDigest, invoiceId } (draft dedup). */
  private readonly invoiceByKey = new Map<IdempotencyKey, { inputDigest: string; invoiceId: string }>();

  /** idempotencyKey -> { inputDigest, settlementId } (settle dedup). */
  private readonly settlementByKey = new Map<IdempotencyKey, { inputDigest: string; settlementId: string }>();

  /** portId -> the registered settlement port adapter. */
  private readonly ports = new Map<string, SettlementPort>();

  /** streamId -> events (append-only). */
  private readonly streams = new Map<string, SealedEntitlementsEvent[]>();

  private readonly expectedTenantId: string | undefined;

  private readonly tenancy: TenancyHierarchy | undefined;

  private readonly defaultPort: SettlementPort | undefined;

  constructor(options: import('./types').BillingHostOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
    this.tenancy = options.tenancy;
    this.defaultPort = options.settlementPort;
    if (this.defaultPort !== undefined) {
      this.ports.set(this.defaultPort.portId, this.defaultPort);
    }
  }

  // --------------------------------------------------------------------------------
  // The authorization gate (W009 — the W022/W037/W043 pattern).
  // --------------------------------------------------------------------------------

  private authorizationGate(
    operation: string,
    tenantId: string,
    authorization: AuthorizationInput,
    resourceId: string,
    resourceType: string,
  ): BillingServiceResult<{ principalId: string }> {
    const context = parseAuthorizationContext(authorization.context);
    if (!context.ok) {
      return { ok: false, error: mapAuthorizationError(context.error) };
    }
    const request = {
      schemaVersion: AUTHORIZATION_RECORD_VERSION,
      principalId: authorization.principalId,
      actionKind: `billing.${operation}`,
      resource: { resourceType, resourceId, tenantId },
      ...(authorization.justification !== undefined
        ? { justification: authorization.justification }
        : {}),
    };
    const decision = evaluate(request, context.value);
    if (!decision.ok) {
      return { ok: false, error: mapAuthorizationError(decision.error) };
    }
    const value: AuthorizationDecision = decision.value;
    if (value.outcome === 'deny') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `principal "${authorization.principalId}" is not authorized for billing.${operation} (${value.denial.code}): ${value.denial.message}`,
          denialCode: value.denial.code,
          principalId: authorization.principalId,
          operation,
        },
      };
    }
    if (value.outcome === 'not-applicable') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `principal "${authorization.principalId}" received no authorization decision for billing.${operation} (${value.reason}) — fail-closed`,
          denialCode: 'not-applicable',
          principalId: authorization.principalId,
          operation,
        },
      };
    }
    return { ok: true, value: { principalId: authorization.principalId } };
  }

  /** The single-tenant guard (R12) + the shared gate wrapper. */
  private guard(
    operation: string,
    input: { readonly asTenant: string; readonly authorization: AuthorizationInput },
    resourceId: string,
    resourceType: string,
  ): BillingServiceResult<{ principalId: string }> {
    if (this.expectedTenantId !== undefined && input.asTenant !== this.expectedTenantId) {
      return fail({
        code: 'tenant-isolation-rejected',
        message: `this billing host is scoped to tenant "${this.expectedTenantId}" but the operation names "${input.asTenant}" (R12 single-tenant guard)`,
        expectedTenantId: this.expectedTenantId,
        encounteredTenantId: input.asTenant,
      });
    }
    return this.authorizationGate(operation, input.asTenant, input.authorization, resourceId, resourceType);
  }

  /** Validate one idempotency key against the typed grammar. */
  private requireKey(key: string): BillingServiceResult<IdempotencyKey> {
    if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
      return fail({
        code: 'validation',
        message: `idempotency key "${key}" does not match the typed key grammar`,
        issues: [
          {
            path: 'idempotencyKey',
            message: 'must match /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/',
          },
        ],
      });
    }
    return ok(key);
  }

  // --------------------------------------------------------------------------------
  // Event emission (sealed by the kernel; contiguous sequences).
  // --------------------------------------------------------------------------------

  private emit(
    streamId: string,
    tenantId: string,
    actor: string,
    discriminator: string,
    data: Record<string, unknown>,
    occurredAt: string,
  ): void {
    const events = this.streams.get(streamId) ?? [];
    const previous = events.length > 0 ? events[events.length - 1]! : null;
    const sealed = sealEntitlementsEvent({
      schemaVersion: 1,
      streamId,
      sequence: events.length + 1,
      tenantId,
      actor,
      causalParent: previous === null ? null : { streamId, sequence: previous.sequence },
      payload: { discriminator, data: data as never },
      occurredAt,
    });
    if (sealed.ok) {
      this.streams.set(streamId, [...events, sealed.value]);
    }
  }

  // --------------------------------------------------------------------------------
  // Billing accounts.
  // --------------------------------------------------------------------------------

  /** Open a billing account (idempotent by key; one currency per account). */
  openAccount(input: OpenAccountInput): HostResult<AccountReceipt> {
    for (const key of Object.keys(input)) {
      if (!ACCOUNT_KEYS.has(key)) {
        return fail(vendorFields(key, key));
      }
    }
    const key = this.requireKey(input.idempotencyKey);
    if (!key.ok) {
      return key;
    }
    const gate = this.guard('open-account', input, input.idempotencyKey, 'billing-account');
    if (!gate.ok) {
      return gate;
    }
    const inputDigest = canonicalDigest({
      currency: input.currency,
      displayName: input.displayName,
      openedAt: input.openedAt,
      openedBy: input.openedBy,
    } as unknown as JsonValue);
    const accountId = deriveSlugId('billing-account', {
      idempotencyKey: input.idempotencyKey,
      tenantId: input.asTenant,
    });
    const storeKey = tenantKey(input.asTenant, accountId);
    const bound = this.accountByKey.get(input.idempotencyKey);
    if (bound !== undefined) {
      const existing = this.accounts.get(bound.storeKey);
      if (existing === undefined || bound.inputDigest !== inputDigest) {
        return fail({
          code: 'idempotency-conflict',
          message: `idempotency key "${input.idempotencyKey}" is bound to different account content`,
          idempotencyKey: input.idempotencyKey,
          boundDigest: bound.inputDigest,
          encounteredDigest: inputDigest,
        });
      }
      return ok({ schemaVersion: HOST_RECORD_VERSION, account: existing, duplicate: true });
    }
    if (this.accounts.has(storeKey)) {
      return fail({
        code: 'idempotency-conflict',
        message: `billing account "${accountId}" already exists (derived from a different idempotency key)`,
        idempotencyKey: input.idempotencyKey,
        boundDigest: this.accounts.get(storeKey)!.contentDigest,
        encounteredDigest: inputDigest,
      });
    }
    const sealed = sealBillingAccount({
      schema: 'epoch.billing.account',
      schemaVersion: 1,
      accountId,
      tenantId: input.asTenant,
      currency: input.currency,
      displayName: input.displayName,
      openedAt: input.openedAt,
      openedBy: input.openedBy,
    });
    if (!sealed.ok) {
      return fail(sealed.error);
    }
    this.accounts.set(storeKey, sealed.value);
    this.accountByKey.set(input.idempotencyKey, { inputDigest, storeKey });
    this.emit(
      billingStreamIdOf(accountId),
      input.asTenant,
      input.openedBy,
      'billing:account-opened',
      {
        accountId,
        accountDigest: sealed.value.contentDigest,
        currency: sealed.value.currency,
        openedAt: sealed.value.openedAt,
      },
      input.openedAt,
    );
    return ok({ schemaVersion: HOST_RECORD_VERSION, account: sealed.value, duplicate: false });
  }

  // --------------------------------------------------------------------------------
  // W023 grant/revocation adoption + W036 delivery registration + usage intake.
  // --------------------------------------------------------------------------------

  /** Adopt one W023 entitlement grant record (verified; idempotent). */
  registerGrant(input: RegisterGrantInput): HostResult<AdoptionReceipt> {
    const gate = this.guard('register-grant', input, 'grants', 'entitlement-grant');
    if (!gate.ok) {
      return gate;
    }
    const parsed = parseEntitlementGrantRecord(input.grant);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    const grant = parsed.value;
    if (grant.tenantId !== input.asTenant) {
      return fail({
        code: 'cross-tenant-denied',
        message: `grant "${grant.entitlementId}" belongs to tenant "${grant.tenantId}" but the adoption is scoped to "${input.asTenant}" (R12)`,
        expectedTenantId: input.asTenant,
        encounteredTenantId: grant.tenantId,
      });
    }
    const storeKey = tenantKey(input.asTenant, grant.entitlementId);
    const existing = this.grants.get(storeKey);
    if (existing !== undefined) {
      if (existing.listingVersionDigest === grant.listingVersionDigest && existing.grantedAt === grant.grantedAt) {
        return ok({ schemaVersion: HOST_RECORD_VERSION, entitlementId: grant.entitlementId, duplicate: true });
      }
      return fail({
        code: 'idempotency-conflict',
        message: `entitlement "${grant.entitlementId}" is already adopted with different content (same id, different grant record)`,
        idempotencyKey: grant.entitlementId,
        boundDigest: existing.listingVersionDigest,
        encounteredDigest: grant.listingVersionDigest,
      });
    }
    this.grants.set(storeKey, grant);
    return ok({ schemaVersion: HOST_RECORD_VERSION, entitlementId: grant.entitlementId, duplicate: false });
  }

  /** Adopt one W023 entitlement revocation record (verified; idempotent). */
  registerRevocation(input: RegisterRevocationInput): HostResult<AdoptionReceipt> {
    const gate = this.guard('register-revocation', input, 'revocations', 'entitlement-revocation');
    if (!gate.ok) {
      return gate;
    }
    const parsed = parseEntitlementRevokeRecord(input.revocation);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    const revocation = parsed.value;
    if (revocation.tenantId !== input.asTenant) {
      return fail({
        code: 'cross-tenant-denied',
        message: `revocation of "${revocation.entitlementId}" belongs to tenant "${revocation.tenantId}" but the adoption is scoped to "${input.asTenant}" (R12)`,
        expectedTenantId: input.asTenant,
        encounteredTenantId: revocation.tenantId,
      });
    }
    const existing = this.revocations.get(revocation.entitlementId) ?? [];
    if (existing.some((prior) => prior.revocationId === revocation.revocationId)) {
      return ok({ schemaVersion: HOST_RECORD_VERSION, entitlementId: revocation.entitlementId, duplicate: true });
    }
    this.revocations.set(revocation.entitlementId, [...existing, revocation]);
    return ok({ schemaVersion: HOST_RECORD_VERSION, entitlementId: revocation.entitlementId, duplicate: false });
  }

  /** Register one sealed W036 delivery record (verified at admission; idempotent). */
  registerDelivery(input: RegisterDeliveryInput): HostResult<AdoptionReceipt> {
    const gate = this.guard('register-delivery', input, 'deliveries', 'delivery-record');
    if (!gate.ok) {
      return gate;
    }
    const verified = verifySealedDeliveryRecord(input.delivery);
    if (!verified.ok) {
      const error = verified.error as { code: string; message: string; expected?: string; encountered?: string };
      if (error.code === 'digest-mismatch') {
        return fail({
          code: 'digest-mismatch',
          message: `the W036 delivery record failed digest verification — only VALIDATED actuals may bill (${error.message})`,
          expected: error.expected ?? '',
          encountered: error.encountered ?? '',
          subject: (input.delivery as { deliveryId?: string }).deliveryId ?? '',
        });
      }
      return fail({
        code: 'delivery-actual-rejected',
        message: `the W036 delivery record failed verification — only VALIDATED actuals may bill (${error.message})`,
      });
    }
    const delivery = verified.value;
    if (delivery.tenantId !== input.asTenant) {
      return fail({
        code: 'cross-tenant-denied',
        message: `delivery "${delivery.deliveryId}" belongs to tenant "${delivery.tenantId}" but the registration is scoped to "${input.asTenant}" (R12)`,
        expectedTenantId: input.asTenant,
        encounteredTenantId: delivery.tenantId,
      });
    }
    const storeKey = tenantKey(input.asTenant, delivery.deliveryId);
    const existing = this.deliveries.get(storeKey);
    if (existing !== undefined) {
      if (existing.contentDigest === delivery.contentDigest) {
        return ok({ schemaVersion: HOST_RECORD_VERSION, entitlementId: delivery.deliveryId, duplicate: true });
      }
      return fail({
        code: 'idempotency-conflict',
        message: `delivery "${delivery.deliveryId}" is already registered with different content (same id, different sealed state)`,
        idempotencyKey: delivery.deliveryId,
        boundDigest: existing.contentDigest,
        encounteredDigest: delivery.contentDigest,
      });
    }
    this.deliveries.set(storeKey, delivery);
    return ok({ schemaVersion: HOST_RECORD_VERSION, entitlementId: delivery.deliveryId, duplicate: false });
  }

  /** Intake sealed W023 usage events (verified; idempotent by (streamId, sequence)). */
  intakeUsageEvents(input: IntakeUsageInput): HostResult<UsageIntakeReceipt> {
    const gate = this.guard('intake-usage', input, 'usage-events', 'usage-event');
    if (!gate.ok) {
      return gate;
    }
    let admitted = 0;
    let duplicates = 0;
    for (const event of input.events) {
      const verified = verifySealedUsageEvent(event);
      if (!verified.ok) {
        return fail(mapMarketplaceError(verified.error));
      }
      const usage = verified.value;
      if (usage.tenantId !== input.asTenant) {
        return fail({
          code: 'cross-tenant-denied',
          message: `usage event ${usage.streamId}#${usage.sequence} belongs to tenant "${usage.tenantId}" but the intake is scoped to "${input.asTenant}" (R12)`,
          expectedTenantId: input.asTenant,
          encounteredTenantId: usage.tenantId,
        });
      }
      const stream = this.usageEvents.get(usage.streamId) ?? [];
      const existing = stream.find((candidate) => candidate.sequence === usage.sequence);
      if (existing !== undefined) {
        if (existing.contentDigest === usage.contentDigest) {
          duplicates += 1;
          continue;
        }
        return fail({
          code: 'idempotency-conflict',
          message: `usage event ${usage.streamId}#${usage.sequence} is already recorded with different content`,
          idempotencyKey: `${usage.streamId}#${usage.sequence}`,
          boundDigest: existing.contentDigest,
          encounteredDigest: usage.contentDigest,
        });
      }
      this.usageEvents.set(usage.streamId, [...stream, usage]);
      admitted += 1;
    }
    return ok({ schemaVersion: HOST_RECORD_VERSION, admitted, duplicates });
  }

  // --------------------------------------------------------------------------------
  // Seats.
  // --------------------------------------------------------------------------------

  /** Assign one seat of one entitlement (kernel admission; idempotent). */
  assignSeat(input: AssignSeatInput): HostResult<SeatOperationReceipt> {
    const key = this.requireKey(input.idempotencyKey);
    if (!key.ok) {
      return key;
    }
    const gate = this.guard('assign-seat', input, input.entitlementId, 'seat-assignment');
    if (!gate.ok) {
      return gate;
    }
    const seatAssignmentId = deriveSlugId('seat', {
      idempotencyKey: input.idempotencyKey,
      tenantId: input.asTenant,
    });
    const inputDigest = canonicalDigest({
      entitlementId: input.entitlementId,
      principalId: input.principalId,
      assignedAt: input.assignedAt,
      assignedBy: input.assignedBy,
    } as unknown as JsonValue);
    const bound = this.seatByKey.get(seatAssignmentId);
    if (bound !== undefined) {
      if (bound.inputDigest !== inputDigest) {
        return fail({
          code: 'idempotency-conflict',
          message: `idempotency key "${input.idempotencyKey}" is bound to different seat-assignment content`,
          idempotencyKey: input.idempotencyKey,
          boundDigest: bound.inputDigest,
          encounteredDigest: inputDigest,
        });
      }
      const account = this.foldSeats(input.asTenant, input.entitlementId);
      if (!account.ok) {
        return account;
      }
      return ok({
        schemaVersion: HOST_RECORD_VERSION,
        seatAssignment: bound.assignment,
        seatRelease: null,
        seatAccount: account.value,
        duplicate: true,
      });
    }
    const admitted = admitSeatAssignment({
      assignments: this.seatAssignments.get(tenantKey(input.asTenant, input.entitlementId)) ?? [],
      releases: this.seatReleases.get(tenantKey(input.asTenant, input.entitlementId)) ?? [],
      grants: this.tenantGrants(input.asTenant),
      revocations: this.tenantRevocations(),
      candidate: {
        schema: 'epoch.entitlements.seat-assignment',
        schemaVersion: 1,
        seatAssignmentId,
        entitlementId: input.entitlementId,
        tenantId: input.asTenant,
        principalId: input.principalId,
        assignedAt: input.assignedAt,
        assignedBy: input.assignedBy,
      },
    });
    if (!admitted.ok) {
      return fail(admitted.error);
    }
    const assignment = admitted.value;
    const storeKey = tenantKey(input.asTenant, input.entitlementId);
    this.seatAssignments.set(storeKey, [
      ...(this.seatAssignments.get(storeKey) ?? []),
      assignment,
    ]);
    this.seatByKey.set(seatAssignmentId, { inputDigest, assignment });
    this.emit(
      entitlementsStreamIdOf(input.entitlementId),
      input.asTenant,
      input.assignedBy,
      'entitlements:seat-assigned',
      {
        seatAssignmentId: assignment.seatAssignmentId,
        seatAssignmentDigest: assignment.contentDigest,
        entitlementId: assignment.entitlementId,
        principalId: assignment.principalId,
        assignedAt: assignment.assignedAt,
      },
      input.assignedAt,
    );
    const account = this.foldSeats(input.asTenant, input.entitlementId);
    if (!account.ok) {
      return account;
    }
    return ok({
      schemaVersion: HOST_RECORD_VERSION,
      seatAssignment: assignment,
      seatRelease: null,
      seatAccount: account.value,
      duplicate: false,
    });
  }

  /** Release one seat assignment (kernel admission; idempotent). */
  releaseSeat(input: ReleaseSeatInput): HostResult<SeatOperationReceipt> {
    const key = this.requireKey(input.idempotencyKey);
    if (!key.ok) {
      return key;
    }
    const gate = this.guard('release-seat', input, input.seatAssignmentId, 'seat-release');
    if (!gate.ok) {
      return gate;
    }
    const releaseId = deriveSlugId('seat-release', {
      idempotencyKey: input.idempotencyKey,
      tenantId: input.asTenant,
    });
    const inputDigest = canonicalDigest({
      seatAssignmentId: input.seatAssignmentId,
      releasedAt: input.releasedAt,
      releasedBy: input.releasedBy,
    } as unknown as JsonValue);
    const bound = this.releaseByKey.get(input.seatAssignmentId);
    if (bound !== undefined) {
      if (bound.inputDigest !== inputDigest) {
        return fail({
          code: 'idempotency-conflict',
          message: `idempotency key "${input.idempotencyKey}" is bound to different seat-release content`,
          idempotencyKey: input.idempotencyKey,
          boundDigest: bound.inputDigest,
          encounteredDigest: inputDigest,
        });
      }
      const account = this.foldSeats(input.asTenant, bound.release.entitlementId);
      if (!account.ok) {
        return account;
      }
      return ok({
        schemaVersion: HOST_RECORD_VERSION,
        seatAssignment: null,
        seatRelease: bound.release,
        seatAccount: account.value,
        duplicate: true,
      });
    }
    const assignmentsAll: SealedSeatAssignment[] = [];
    for (const [storeKey, assignments] of this.seatAssignments) {
      if (storeKey.startsWith(`${input.asTenant}#`)) {
        assignmentsAll.push(...assignments);
      }
    }
    const assignmentEntitlement = this.entitlementOfSeat(input.seatAssignmentId);
    if (assignmentEntitlement === undefined) {
      return fail({
        code: 'unknown-seat-assignment',
        message: `seat assignment "${input.seatAssignmentId}" does not resolve — a release can only flip a recorded assignment`,
        seatAssignmentId: input.seatAssignmentId,
      });
    }
    const admitted = admitSeatRelease({
      assignments: assignmentsAll,
      releases: [...this.releaseByKey.values()].map((entry) => entry.release),
      candidate: {
        schema: 'epoch.entitlements.seat-release',
        schemaVersion: 1,
        releaseId,
        seatAssignmentId: input.seatAssignmentId,
        entitlementId: assignmentEntitlement,
        tenantId: input.asTenant,
        releasedAt: input.releasedAt,
        releasedBy: input.releasedBy,
      },
    });
    if (!admitted.ok) {
      return fail(admitted.error);
    }
    const release = admitted.value;
    this.releaseByKey.set(input.seatAssignmentId, { inputDigest, release });
    const storeKey = tenantKey(input.asTenant, release.entitlementId);
    this.seatReleases.set(storeKey, [
      ...(this.seatReleases.get(storeKey) ?? []),
      release,
    ]);
    this.emit(
      entitlementsStreamIdOf(release.entitlementId),
      input.asTenant,
      input.releasedBy,
      'entitlements:seat-released',
      {
        releaseId: release.releaseId,
        releaseDigest: release.contentDigest,
        seatAssignmentId: release.seatAssignmentId,
        entitlementId: release.entitlementId,
        releasedAt: release.releasedAt,
      },
      input.releasedAt,
    );
    const account = this.foldSeats(input.asTenant, release.entitlementId);
    if (!account.ok) {
      return account;
    }
    return ok({
      schemaVersion: HOST_RECORD_VERSION,
      seatAssignment: null,
      seatRelease: release,
      seatAccount: account.value,
      duplicate: false,
    });
  }

  /** The entitlement id of one seat assignment (host bookkeeping). */
  private entitlementOfSeat(seatAssignmentId: string): string | undefined {
    return this.seatByKey.get(seatAssignmentId)?.assignment.entitlementId;
  }

  /** Fold the seat account of one entitlement (tenant-scoped). */
  private foldSeats(tenantId: string, entitlementId: string): HostResult<import('@epoch/entitlements').SeatAccount> {
    return foldSeatAssignments(
      this.seatAssignments.get(tenantKey(tenantId, entitlementId)) ?? [],
      this.seatReleases.get(tenantKey(tenantId, entitlementId)) ?? [],
      { entitlementId, tenantId },
    );
  }

  /** Read the seat account of one entitlement. */
  seatAccountOf(input: SeatAccountInput): HostResult<import('@epoch/entitlements').SeatAccount> {
    const gate = this.guard('read-seat-account', input, input.entitlementId, 'seat-account');
    if (!gate.ok) {
      return gate;
    }
    return this.foldSeats(input.asTenant, input.entitlementId);
  }

  // --------------------------------------------------------------------------------
  // Entitlement resolution + usage folds.
  // --------------------------------------------------------------------------------

  /** Resolve the effective entitlement for one scope query (the kernel seam). */
  resolveEntitlement(input: ResolveEntitlementInput): HostResult<import('@epoch/entitlements').EntitlementResolution> {
    const gate = this.guard('resolve-entitlement', input, input.listingId, 'entitlement');
    if (!gate.ok) {
      return gate;
    }
    return resolveEntitlement({
      grants: this.tenantGrants(input.asTenant),
      revocations: this.tenantRevocations(),
      tenancy: this.tenancy,
      query: {
        tenantId: input.asTenant,
        listingId: input.listingId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
      },
    });
  }

  /** The grants adopted for one tenant. */
  private tenantGrants(tenantId: string): EntitlementGrantRecord[] {
    const grants: EntitlementGrantRecord[] = [];
    for (const [storeKey, grant] of this.grants) {
      if (storeKey.startsWith(`${tenantId}#`)) {
        grants.push(grant);
      }
    }
    return grants;
  }

  /** Every adopted revocation (latest-first determinism irrelevant: all are facts). */
  private tenantRevocations(): EntitlementRevokeRecord[] {
    const revocations: EntitlementRevokeRecord[] = [];
    for (const list of this.revocations.values()) {
      revocations.push(...list);
    }
    return revocations;
  }

  /** Read the folded usage account of one entitlement (the REAL marketplace fold). */
  usageAccountOf(input: UsageAccountInput): HostResult<import('@epoch/marketplace').UsageAccount> {
    const gate = this.guard('read-usage-account', input, input.entitlementId, 'usage-account');
    if (!gate.ok) {
      return gate;
    }
    const streamId = usageStreamIdOf(input.entitlementId);
    const events = this.usageEvents.get(streamId) ?? [];
    const folded = foldUsageEvents(events, {
      entitlementId: input.entitlementId,
      tenantId: input.asTenant,
    });
    if (!folded.ok) {
      return fail(mapMarketplaceError(folded.error));
    }
    return ok(folded.value);
  }

  // --------------------------------------------------------------------------------
  // Invoice sessions.
  // --------------------------------------------------------------------------------

  /** Draft an invoice from typed line sources (kernel-derived amounts; idempotent). */
  draftInvoice(input: DraftInvoiceInput): HostResult<InvoiceReceipt> {
    const key = this.requireKey(input.idempotencyKey);
    if (!key.ok) {
      return key;
    }
    const gate = this.guard('draft-invoice', input, input.accountId, 'invoice');
    if (!gate.ok) {
      return gate;
    }
    const account = this.accounts.get(tenantKey(input.asTenant, input.accountId));
    if (account === undefined) {
      return fail({
        code: 'unknown-account',
        message: `billing account "${input.accountId}" is not open for tenant "${input.asTenant}"`,
        accountId: input.accountId,
      });
    }
    const inputDigest = canonicalDigest({
      accountId: input.accountId,
      sources: input.sources,
      createdAt: input.createdAt,
      createdBy: input.createdBy,
    } as unknown as JsonValue);
    const invoiceId = deriveSlugId('invoice', {
      idempotencyKey: input.idempotencyKey,
      tenantId: input.asTenant,
      accountId: input.accountId,
    });
    const bound = this.invoiceByKey.get(input.idempotencyKey);
    if (bound !== undefined) {
      if (bound.inputDigest !== inputDigest) {
        return fail({
          code: 'idempotency-conflict',
          message: `idempotency key "${input.idempotencyKey}" is bound to different invoice content`,
          idempotencyKey: input.idempotencyKey,
          boundDigest: bound.inputDigest,
          encounteredDigest: inputDigest,
        });
      }
      const invoice = this.resolveInvoice(input.asTenant, bound.invoiceId);
      if (!invoice.ok) {
        return invoice;
      }
      const totals = foldInvoiceTotals(invoice.value);
      if (!totals.ok) {
        return fail(totals.error);
      }
      return ok({ schemaVersion: HOST_RECORD_VERSION, invoice: invoice.value, totals: totals.value, duplicate: true });
    }
    if (input.sources.length === 0) {
      return fail({
        code: 'empty-invoice-rejected',
        message: `invoice "${invoiceId}" has no billable line sources`,
        invoiceId,
      });
    }

    const invoiceSlug = invoiceId.slice('invoice:'.length);
    const lines: InvoiceLine[] = [];
    for (let index = 0; index < input.sources.length; index += 1) {
      const source = input.sources[index]!;
      const lineId = `line:${invoiceSlug}-s${index + 1}`;
      const line = this.deriveLine(input.asTenant, input.authorization, source, lineId, account.currency);
      if (!line.ok) {
        return line;
      }
      lines.push(...line.value);
    }
    if (lines.length === 0) {
      return fail({
        code: 'empty-invoice-rejected',
        message: `invoice "${invoiceId}" derived no billable lines (nothing to bill)`,
        invoiceId,
      });
    }
    const opened = openInvoice({
      schema: 'epoch.billing.invoice',
      schemaVersion: 1,
      invoiceId,
      tenantId: input.asTenant,
      accountId: input.accountId,
      currency: account.currency,
      lines: [...lines].sort((a, b) => (a.lineId < b.lineId ? -1 : 1)),
      status: 'draft',
      createdAt: input.createdAt,
      createdBy: input.createdBy,
    });
    if (!opened.ok) {
      return fail(opened.error);
    }
    const invoice = opened.value;
    const totals = foldInvoiceTotals(invoice);
    if (!totals.ok) {
      return fail(totals.error);
    }
    this.storeInvoiceState(invoice);
    this.invoiceByKey.set(input.idempotencyKey, { inputDigest, invoiceId });
    this.emit(
      billingStreamIdOf(input.accountId),
      input.asTenant,
      input.createdBy,
      'billing:invoice-drafted',
      {
        invoiceId,
        invoiceDigest: invoice.contentDigest,
        accountId: input.accountId,
        lineCount: invoice.lines.length,
        totalAmount: totals.value.totalAmount,
        currency: invoice.currency,
        draftedAt: input.createdAt,
      },
      input.createdAt,
    );
    return ok({ schemaVersion: HOST_RECORD_VERSION, invoice, totals: totals.value, duplicate: false });
  }

  /** Derive the lines of one source through the kernel (amounts are never caller-supplied). */
  private deriveLine(
    tenantId: string,
    authorization: AuthorizationInput,
    source: LineSource,
    lineId: string,
    accountCurrency: string,
  ): HostResult<readonly InvoiceLine[]> {
    if (source.basis === 'delivery-actual') {
      const delivery = this.deliveries.get(tenantKey(tenantId, source.deliveryId));
      if (delivery === undefined) {
        return fail({
          code: 'unknown-delivery',
          message: `delivery "${source.deliveryId}" is not registered for tenant "${tenantId}" — only VALIDATED actuals may bill`,
          deliveryId: source.deliveryId,
        });
      }
      // The line-id prefix is the delivery's own suffix: a delivery-actual
      // line's NATURAL key is (delivery, actual) — re-derivation is
      // byte-identical regardless of the invoice key, and billing the same
      // actual twice in one invoice collides into the duplicate-line
      // rejection (no double-billing within an invoice).
      const lines = deriveDeliveryActualLines({
        delivery,
        options: {
          lineIdPrefix: source.deliveryId.slice(source.deliveryId.indexOf(':') + 1),
          ...(source.actualRecordIds !== undefined ? { actualRecordIds: source.actualRecordIds } : {}),
          ...(source.unitRates !== undefined ? { unitRates: source.unitRates } : {}),
        },
      });
      if (!lines.ok) {
        return fail(lines.error);
      }
      for (const line of lines.value) {
        if (line.currency !== accountCurrency) {
          return fail({
            code: 'currency-mismatch',
            message: `derived line "${line.lineId}" currency "${line.currency}" disagrees with the account currency "${accountCurrency}"`,
            expectedCurrency: accountCurrency,
            encounteredCurrency: line.currency,
          });
        }
      }
      return ok(lines.value);
    }
    // Entitlement-priced bases: the W023 pricing model arrives as typed
    // data and is validated through the REAL marketplace parser.
    const pricingParse = parsePricingModel((source as { pricing?: unknown }).pricing);
    if (!pricingParse.ok) {
      return fail(mapMarketplaceError(pricingParse.error));
    }
    const pricing = pricingParse.value;
    const components = classifyPricingForBilling(pricing);
    if (source.basis === 'one-time') {
      if (components.oneTime === undefined) {
        return fail(unsupportedPricingModelError(pricing.kind));
      }
      const line = deriveOneTimeLine({
        pricing: components.oneTime,
        entitlementId: source.entitlementId,
        lineId,
      });
      return this.settleDerived(line, accountCurrency);
    }
    if (source.basis === 'subscription') {
      if (components.subscription === undefined) {
        return fail(unsupportedPricingModelError(pricing.kind));
      }
      const line = deriveSubscriptionLine({
        pricing: components.subscription,
        entitlementId: source.entitlementId,
        periodStart: source.periodStart,
        periodEnd: source.periodEnd,
        lineId,
      });
      return this.settleDerived(line, accountCurrency);
    }
    if (source.basis === 'seat') {
      if (components.seat === undefined) {
        return fail(unsupportedPricingModelError(pricing.kind));
      }
      const account = this.foldSeats(tenantId, source.entitlementId);
      if (!account.ok) {
        return account;
      }
      const line = deriveSeatLine({
        pricing: components.seat,
        entitlementId: source.entitlementId,
        activeSeatCount: account.value.activeCount,
        lineId,
      });
      return this.settleDerived(line, accountCurrency);
    }
    // usage
    if (components.usage === undefined) {
      return fail(unsupportedPricingModelError(pricing.kind));
    }
    const usageAccount = this.usageAccountOf({
      asTenant: tenantId,
      authorization,
      entitlementId: source.entitlementId,
    });
    if (!usageAccount.ok) {
      return fail(usageAccount.error);
    }
    const line = deriveUsageLine({
      pricing: components.usage,
      account: usageAccount.value,
      lineId,
    });
    return this.settleDerived(line, accountCurrency);
  }

  /** Validate one derived line's currency and wrap it as the single-line result. */
  private settleDerived(
    line: HostResult<InvoiceLine>,
    accountCurrency: string,
  ): HostResult<readonly InvoiceLine[]> {
    if (!line.ok) {
      return line;
    }
    if (line.value.currency !== accountCurrency) {
      return fail({
        code: 'currency-mismatch',
        message: `derived line "${line.value.lineId}" currency "${line.value.currency}" disagrees with the account currency "${accountCurrency}"`,
        expectedCurrency: accountCurrency,
        encounteredCurrency: line.value.currency,
      });
    }
    return ok([line.value]);
  }

  /** Issue one invoice (kernel transition; event on the account stream). */
  issueInvoice(input: IssueInvoiceInput): HostResult<InvoiceReceipt> {
    const gate = this.guard('issue-invoice', input, input.invoiceId, 'invoice');
    if (!gate.ok) {
      return gate;
    }
    const current = this.resolveInvoice(input.asTenant, input.invoiceId);
    if (!current.ok) {
      return current;
    }
    const issued = issueInvoice(current.value, {
      issuedAt: input.issuedAt,
      issuedBy: input.issuedBy,
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
    });
    if (!issued.ok) {
      return fail(issued.error);
    }
    this.storeInvoiceState(issued.value);
    const totals = foldInvoiceTotals(issued.value);
    if (!totals.ok) {
      return fail(totals.error);
    }
    this.emit(
      billingStreamIdOf(issued.value.accountId),
      input.asTenant,
      input.issuedBy,
      'billing:invoice-issued',
      {
        invoiceId: issued.value.invoiceId,
        invoiceDigest: issued.value.contentDigest,
        accountId: issued.value.accountId,
        totalAmount: totals.value.totalAmount,
        currency: issued.value.currency,
        issuedAt: input.issuedAt,
      },
      input.issuedAt,
    );
    return ok({ schemaVersion: HOST_RECORD_VERSION, invoice: issued.value, totals: totals.value, duplicate: false });
  }

  /** Settle one invoice through the SettlementPort seam (idempotent). */
  settleInvoice(input: SettleInvoiceInput): HostResult<SettlementOutcomeProjection> {
    const key = this.requireKey(input.idempotencyKey);
    if (!key.ok) {
      return key;
    }
    const gate = this.guard('settle-invoice', input, input.invoiceId, 'invoice');
    if (!gate.ok) {
      return gate;
    }
    const current = this.resolveInvoice(input.asTenant, input.invoiceId);
    if (!current.ok) {
      return current;
    }
    const totals = foldInvoiceTotals(current.value);
    if (!totals.ok) {
      return fail(totals.error);
    }
    const settlementId =
      input.settlementId ??
      deriveSlugId('settlement', { idempotencyKey: input.idempotencyKey, invoiceId: input.invoiceId });
    const bound = this.settlementByKey.get(input.idempotencyKey);
    if (bound !== undefined) {
      if (current.value.status === 'settled' && current.value.settlementId === bound.settlementId) {
        return ok({ outcome: null, invoice: current.value });
      }
      return fail({
        code: 'idempotency-conflict',
        message: `idempotency key "${input.idempotencyKey}" is bound to a different settlement`,
        idempotencyKey: input.idempotencyKey,
        boundDigest: bound.settlementId,
        encounteredDigest: settlementId,
      });
    }
    const port = this.selectPort(input.portId);
    if (!port.ok) {
      return port;
    }
    // The port outcome PROPOSES the transition; the invoice record is the
    // settlement authority (lock rule 11 applied to settlement).
    const outcome = port.value.checkSettlement({
      invoiceId: input.invoiceId,
      tenantId: input.asTenant,
      amount: totals.value.totalAmount,
      currency: current.value.currency,
    });
    if (!outcome.ok) {
      return fail(outcome.error);
    }
    if (outcome.value.result !== 'settled') {
      return fail({
        code: 'settlement-rejected',
        message: `the settlement port "${outcome.value.portId}" reports invoice "${input.invoiceId}" as ${outcome.value.result} — the invoice stays issued`,
        invoiceId: input.invoiceId,
        result: outcome.value.result,
      });
    }
    const settled = settleInvoiceKernel(current.value, {
      settledAt: input.settledAt,
      settlementId,
      settlementPortId: outcome.value.portId,
    });
    if (!settled.ok) {
      return fail(settled.error);
    }
    this.storeInvoiceState(settled.value);
    this.settlementByKey.set(input.idempotencyKey, { inputDigest: settlementId, settlementId });
    this.emit(
      billingStreamIdOf(settled.value.accountId),
      input.asTenant,
      gate.value.principalId,
      'billing:invoice-settled',
      {
        invoiceId: settled.value.invoiceId,
        invoiceDigest: settled.value.contentDigest,
        accountId: settled.value.accountId,
        settlementId,
        settlementPortId: outcome.value.portId,
        totalAmount: totals.value.totalAmount,
        currency: settled.value.currency,
        settledAt: input.settledAt,
      },
      input.settledAt,
    );
    return ok({ outcome: outcome.value, invoice: settled.value });
  }

  /** Void one invoice (kernel transition; event on the account stream). */
  voidInvoice(input: VoidInvoiceInput): HostResult<InvoiceReceipt> {
    const gate = this.guard('void-invoice', input, input.invoiceId, 'invoice');
    if (!gate.ok) {
      return gate;
    }
    const current = this.resolveInvoice(input.asTenant, input.invoiceId);
    if (!current.ok) {
      return current;
    }
    const voided = voidInvoiceKernel(current.value, {
      voidedAt: input.voidedAt,
      voidedBy: input.voidedBy,
    });
    if (!voided.ok) {
      return fail(voided.error);
    }
    this.storeInvoiceState(voided.value);
    const totals = foldInvoiceTotals(voided.value);
    if (!totals.ok) {
      return fail(totals.error);
    }
    this.emit(
      billingStreamIdOf(voided.value.accountId),
      input.asTenant,
      input.voidedBy,
      'billing:invoice-voided',
      {
        invoiceId: voided.value.invoiceId,
        invoiceDigest: voided.value.contentDigest,
        accountId: voided.value.accountId,
        voidedAt: input.voidedAt,
      },
      input.voidedAt,
    );
    return ok({ schemaVersion: HOST_RECORD_VERSION, invoice: voided.value, totals: totals.value, duplicate: false });
  }

  /** Store one invoice state (current + append-only history). */
  private storeInvoiceState(invoice: SealedInvoice): void {
    const storeKey = tenantKey(invoice.tenantId, invoice.invoiceId);
    this.invoices.set(storeKey, invoice);
    this.invoicesById.set(invoice.invoiceId, invoice);
    const history = this.invoiceHistory.get(storeKey) ?? [];
    this.invoiceHistory.set(storeKey, [...history, invoice]);
  }

  /**
   * Resolve one invoice by id with typed tenant isolation: an invoice of
   * ANOTHER tenant is the typed `cross-tenant-denied` rejection (R12 —
   * host-level reads of another tenant's records); an unknown id is the
   * typed `unknown-invoice`.
   */
  private resolveInvoice(tenantId: string, invoiceId: string): HostResult<SealedInvoice> {
    const invoice = this.invoicesById.get(invoiceId);
    if (invoice === undefined) {
      return fail({
        code: 'unknown-invoice',
        message: `invoice "${invoiceId}" is not registered`,
        invoiceId,
      });
    }
    if (invoice.tenantId !== tenantId) {
      return fail({
        code: 'cross-tenant-denied',
        message: `invoice "${invoiceId}" belongs to tenant "${invoice.tenantId}" but the caller acts for "${tenantId}" (R12 multi-tenant isolation)`,
        expectedTenantId: tenantId,
        encounteredTenantId: invoice.tenantId,
      });
    }
    return ok(invoice);
  }

  /** Select the settlement port (explicit id, or the single registered port). */
  private selectPort(portId: string | undefined): HostResult<SettlementPort> {
    if (this.ports.size === 0) {
      return fail({
        code: 'settlement-port-unavailable',
        message: 'no settlement port is registered — the adapter seam is absent, never guessed',
      });
    }
    if (portId !== undefined) {
      const port = this.ports.get(portId);
      if (port === undefined) {
        return fail({
          code: 'settlement-port-unavailable',
          message: `settlement port "${portId}" is not registered`,
          portId,
        });
      }
      return ok(port);
    }
    if (this.ports.size > 1) {
      return fail({
        code: 'settlement-port-unavailable',
        message: `multiple settlement ports are registered (${this.ports.size}) — name the port explicitly`,
      });
    }
    return ok([...this.ports.values()][0]!);
  }

  /** Register one settlement port adapter (idempotent by port id). */
  registerSettlementPort(port: SettlementPort): HostResult<{ portId: string; duplicate: boolean }> {
    const existing = this.ports.get(port.portId);
    this.ports.set(port.portId, port);
    return ok({ portId: port.portId, duplicate: existing !== undefined });
  }

  // --------------------------------------------------------------------------------
  // Reads.
  // --------------------------------------------------------------------------------

  /** Read one invoice (tenant-scoped; cross-tenant reads are typed denials). */
  getInvoice(input: InvoiceReadInput): HostResult<SealedInvoice> {
    const gate = this.guard('read-invoice', input, input.invoiceId, 'invoice');
    if (!gate.ok) {
      return gate;
    }
    return this.resolveInvoice(input.asTenant, input.invoiceId);
  }

  /** List invoices (deterministic projection; tenant-scoped). */
  listInvoices(input: ListInvoicesInput): HostResult<readonly InvoiceSummary[]> {
    const gate = this.guard('list-invoices', input, 'invoices', 'invoice-listing');
    if (!gate.ok) {
      return gate;
    }
    const summaries: InvoiceSummary[] = [];
    for (const [storeKey, invoice] of this.invoices) {
      if (!storeKey.startsWith(`${input.asTenant}#`)) continue;
      if (input.accountId !== undefined && invoice.accountId !== input.accountId) continue;
      if (input.status !== undefined && invoice.status !== input.status) continue;
      const totals = foldInvoiceTotals(invoice);
      if (!totals.ok) {
        return fail(totals.error);
      }
      summaries.push({
        invoiceId: invoice.invoiceId,
        accountId: invoice.accountId,
        status: invoice.status,
        currency: invoice.currency,
        lineCount: invoice.lines.length,
        totalAmount: totals.value.totalAmount,
        createdAt: invoice.createdAt,
      });
    }
    summaries.sort((a, b) => (a.invoiceId < b.invoiceId ? -1 : 1));
    return ok(summaries);
  }

  /** Read one event stream (tenant-scoped, chronological). */
  readStream(input: StreamReadInput): HostResult<readonly SealedEntitlementsEvent[]> {
    const gate = this.guard('read-stream', input, input.streamId, 'event-stream');
    if (!gate.ok) {
      return gate;
    }
    const events = this.streams.get(input.streamId) ?? [];
    const scoped = events.filter((event) => event.tenantId === input.asTenant);
    return ok(scoped);
  }

  // --------------------------------------------------------------------------------
  // Health + describe.
  // --------------------------------------------------------------------------------

  /** Health/liveness as typed data (pure state projection). */
  health(): HealthReport {
    const invoicesByStatus: Record<string, number> = {};
    for (const status of INVOICE_LIFECYCLE_STATES) {
      invoicesByStatus[status] = 0;
    }
    for (const invoice of this.invoices.values()) {
      invoicesByStatus[invoice.status] = (invoicesByStatus[invoice.status] ?? 0) + 1;
    }
    let activeSeatCount = 0;
    for (const [storeKey, assignments] of this.seatAssignments) {
      const entitlementId = storeKey.slice(storeKey.indexOf('#') + 1);
      const tenantId = storeKey.slice(0, storeKey.indexOf('#'));
      const account = foldSeatAssignments(
        assignments,
        this.seatReleases.get(storeKey) ?? [],
        { entitlementId, tenantId },
      );
      if (account.ok) {
        activeSeatCount += account.value.activeCount;
      }
    }
    let usageEventCount = 0;
    for (const events of this.usageEvents.values()) {
      usageEventCount += events.length;
    }
    let eventCount = 0;
    for (const events of this.streams.values()) {
      eventCount += events.length;
    }
    return {
      schemaVersion: HOST_RECORD_VERSION,
      service: BILLING_HOST_SERVICE_NAME,
      status: 'ready',
      accountCount: this.accounts.size,
      grantCount: this.grants.size,
      revokedEntitlementCount: this.revocations.size,
      registeredDeliveryCount: this.deliveries.size,
      usageEventCount,
      seatAssignmentCount: this.seatByKey.size,
      activeSeatCount,
      invoiceCount: this.invoices.size,
      invoicesByStatus: invoicesByStatus as HealthReport['invoicesByStatus'],
      registeredPortCount: this.ports.size,
      eventCount,
    };
  }

  /** The typed service surface description. */
  describe(): ServiceDescription {
    return {
      schemaVersion: HOST_RECORD_VERSION,
      service: BILLING_HOST_SERVICE_NAME,
      contractVersion: CONTRACT_VERSION,
      operations: [
        'openAccount',
        'registerGrant',
        'registerRevocation',
        'registerDelivery',
        'intakeUsageEvents',
        'assignSeat',
        'releaseSeat',
        'seatAccountOf',
        'resolveEntitlement',
        'usageAccountOf',
        'draftInvoice',
        'issueInvoice',
        'settleInvoice',
        'voidInvoice',
        'registerSettlementPort',
        'getInvoice',
        'listInvoices',
        'readStream',
      ],
      invariants: [
        'the W009 authorization gate denies unauthorized operations before any kernel admission',
        'tenant isolation (R12): every record is tenant-scoped; cross-tenant access is a typed rejection',
        'entitlement grants/revocations are W023 records consumed through the real validators — never redefined',
        'only VALIDATED W036 actuals may bill (sealed delivery records verified at admission)',
        'line amounts are kernel-derived from typed inputs — never caller-supplied',
        'the settlement port outcome proposes the settled transition; the invoice record is the authority',
        'zero wall-clock reads and zero randomness — every instant is caller-supplied',
      ],
    };
  }
}
