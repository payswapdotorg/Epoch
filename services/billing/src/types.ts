/**
 * The billing host's typed input/output surface (the W028/W043
 * host-pattern: plain JSON records, total results, zero clock reads —
 * every instant is caller-supplied payload data).
 */
import type { AuthorizationContext } from '@epoch/authorization';
import type { PricingModel } from '@epoch/marketplace';
import type {
  EntitlementResolution,
  EntitlementsError,
  InvoiceLine,
  InvoiceTotals,
  SealedBillingAccount,
  SealedInvoice,
  SealedSeatAssignment,
  SealedSeatRelease,
  SeatAccount,
  SettlementOutcome,
  SettlementPort,
  UnitRate,
} from '@epoch/entitlements';
import type {
  EntitlementGrantRecord,
  EntitlementRevokeRecord,
  SealedUsageEvent,
  UsageAccount,
} from '@epoch/marketplace';
import type { SealedDeliveryRecord } from '@epoch/solution-delivery';
import type { SealedEntitlementsEvent } from '@epoch/entitlements';
import type { InvoiceLifecycleState } from '@epoch/entitlements';

/** Idempotency key (opaque, bounded). */
export type IdempotencyKey = string;

/** Tenant id (the W009 grammar). */
export type TenantId = string;

/** Principal id (the W009 identity grammar). */
export type PrincipalId = string;

/** The typed host result: a value or a kernel/service-typed error. */
export type HostResult<T> = BillingServiceResult<T>;

/** The caller-supplied authorization context (W009 decision facts). */
export type { AuthorizationContext };

/** The caller-supplied authorization input (principal + context + justification). */
export interface AuthorizationInput {
  readonly principalId: string;
  readonly context: AuthorizationContext;
  readonly justification?: string | undefined;
}

/** The typed service-error union: kernel errors + the service-owned codes. */
export type BillingServiceError =
  | EntitlementsError
  | {
      readonly code: 'authorization-rejected';
      readonly message: string;
      readonly denialCode: string;
      readonly principalId: string;
      readonly operation: string;
    }
  | {
      readonly code: 'tenant-isolation-rejected';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
    }
  | {
      readonly code: 'unknown-account';
      readonly message: string;
      readonly accountId: string;
    }
  | {
      readonly code: 'unknown-invoice';
      readonly message: string;
      readonly invoiceId: string;
    }
  | {
      readonly code: 'unknown-entitlement-grant';
      readonly message: string;
      readonly entitlementId: string;
    }
  | {
      readonly code: 'unknown-delivery';
      readonly message: string;
      readonly deliveryId: string;
    }
  | {
      readonly code: 'unknown-pricing';
      readonly message: string;
      readonly entitlementId: string;
      readonly listingId: string;
    };

/** Total-result wrapper of every service entry point. */
export type BillingServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: BillingServiceError };

/** Options of the {@link import('./host').BillingHost} constructor. */
export interface BillingHostOptions {
  /**
   * Tenant this host is scoped to. When provided, ANY operation naming a
   * different tenant is rejected with `tenant-isolation-rejected` (R12 —
   * the single-tenant guard precedent).
   */
  readonly expectedTenantId?: string | undefined;
  /**
   * The W009 tenancy hierarchy the entitlement resolution rides on
   * (workspace/project scope containment). Optional: without it,
   * resolution delegates directly to the W023 check semantics.
   */
  readonly tenancy?: import('@epoch/tenancy').TenancyHierarchy | undefined;
  /**
   * The SettlementPort adapter seam (external settlement systems). No
   * default: settlement checks without a registered port are the typed
   * `settlement-port-unavailable` rejection — the seam is absent, never
   * guessed. Register through {@link import('./host').BillingHost.registerSettlementPort}.
   */
  readonly settlementPort?: SettlementPort | undefined;
}

/** Input of {@link import('./host').BillingHost.openAccount}. */
export interface OpenAccountInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly idempotencyKey: IdempotencyKey;
  readonly currency: string;
  readonly displayName: string;
  readonly openedAt: string;
  readonly openedBy: PrincipalId;
}

/** Receipt of account opening (idempotent). */
export interface AccountReceipt {
  readonly schemaVersion: 1;
  readonly account: SealedBillingAccount;
  readonly duplicate: boolean;
}

/** Input of {@link import('./host').BillingHost.registerGrant}. */
export interface RegisterGrantInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly grant: unknown;
}

/** Input of {@link import('./host').BillingHost.registerRevocation}. */
export interface RegisterRevocationInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly revocation: unknown;
}

/** Receipt of grant/revocation adoption (idempotent). */
export interface AdoptionReceipt {
  readonly schemaVersion: 1;
  readonly entitlementId: string;
  readonly duplicate: boolean;
}

/** Input of {@link import('./host').BillingHost.registerDelivery}. */
export interface RegisterDeliveryInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly delivery: unknown;
}

/** Input of {@link import('./host').BillingHost.intakeUsageEvents}. */
export interface IntakeUsageInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly events: readonly unknown[];
}

/** Receipt of usage intake (idempotent by (streamId, sequence)). */
export interface UsageIntakeReceipt {
  readonly schemaVersion: 1;
  readonly admitted: number;
  readonly duplicates: number;
}

/** Input of {@link import('./host').BillingHost.assignSeat}. */
export interface AssignSeatInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly idempotencyKey: IdempotencyKey;
  readonly entitlementId: string;
  readonly principalId: PrincipalId;
  readonly assignedAt: string;
  readonly assignedBy: PrincipalId;
}

/** Input of {@link import('./host').BillingHost.releaseSeat}. */
export interface ReleaseSeatInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly idempotencyKey: IdempotencyKey;
  readonly seatAssignmentId: string;
  readonly releasedAt: string;
  readonly releasedBy: PrincipalId;
}

/** Receipt of seat operations (idempotent). */
export interface SeatOperationReceipt {
  readonly schemaVersion: 1;
  readonly seatAssignment: SealedSeatAssignment | null;
  readonly seatRelease: SealedSeatRelease | null;
  readonly seatAccount: SeatAccount;
  readonly duplicate: boolean;
}

/** Input of {@link import('./host').BillingHost.resolveEntitlement}. */
export interface ResolveEntitlementInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly listingId: string;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
}

/** The positive entitlement resolution (kernel projection). */
export type EntitlementResolutionProjection = EntitlementResolution;

/** Input of {@link import('./host').BillingHost.usageAccountOf}. */
export interface UsageAccountInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly entitlementId: string;
}

/** Input of {@link import('./host').BillingHost.seatAccountOf}. */
export interface SeatAccountInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly entitlementId: string;
}

/**
 * One line source of a draft: the billing basis and its typed inputs.
 * Amounts are NEVER caller-supplied — the kernel derives them from the
 * upstream authorities. The W023 pricing model travels as TYPED DATA
 * (validated through the REAL marketplace parser at admission) because
 * listing-version content is the marketplace service's state, not this
 * host's; delivery-actual sources reference REGISTERED sealed W036
 * records.
 */
export type LineSource =
  | { readonly basis: 'one-time'; readonly entitlementId: string; readonly pricing: PricingModel }
  | {
      readonly basis: 'subscription';
      readonly entitlementId: string;
      readonly periodStart: string;
      readonly periodEnd: string;
      readonly pricing: PricingModel;
    }
  | { readonly basis: 'seat'; readonly entitlementId: string; readonly pricing: PricingModel }
  | { readonly basis: 'usage'; readonly entitlementId: string; readonly pricing: PricingModel }
  | {
      readonly basis: 'delivery-actual';
      readonly deliveryId: string;
      readonly actualRecordIds?: readonly string[] | undefined;
      readonly unitRates?: Readonly<Record<string, UnitRate>> | undefined;
    };

/** Input of {@link import('./host').BillingHost.draftInvoice}. */
export interface DraftInvoiceInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly idempotencyKey: IdempotencyKey;
  readonly accountId: string;
  readonly sources: readonly LineSource[];
  readonly createdAt: string;
  readonly createdBy: PrincipalId;
}

/** Receipt of invoice drafting (idempotent). */
export interface InvoiceReceipt {
  readonly schemaVersion: 1;
  readonly invoice: SealedInvoice;
  readonly totals: InvoiceTotals;
  readonly duplicate: boolean;
}

/** Input of {@link import('./host').BillingHost.issueInvoice}. */
export interface IssueInvoiceInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly invoiceId: string;
  readonly issuedAt: string;
  readonly issuedBy: PrincipalId;
  readonly dueAt?: string | undefined;
}

/** Input of {@link import('./host').BillingHost.settleInvoice}. */
export interface SettleInvoiceInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly invoiceId: string;
  readonly idempotencyKey: IdempotencyKey;
  /** Optional explicit settlement id (default: derived from the idempotency key). */
  readonly settlementId?: string | undefined;
  /** Optional explicit settlement port (default: the single registered port). */
  readonly portId?: string | undefined;
  readonly settledAt: string;
}

/** Input of {@link import('./host').BillingHost.voidInvoice}. */
export interface VoidInvoiceInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly invoiceId: string;
  readonly voidedAt: string;
  readonly voidedBy: PrincipalId;
  readonly reason?: string | undefined;
}

/** The settlement outcome of a settle operation (record-shaped). */
export interface SettlementOutcomeProjection {
  readonly outcome: SettlementOutcome | null;
  readonly invoice: SealedInvoice;
}

/** Input of the invoice read. */
export interface InvoiceReadInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly invoiceId: string;
}

/** Input of the invoice listing read. */
export interface ListInvoicesInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly accountId?: string | undefined;
  readonly status?: InvoiceLifecycleState | undefined;
}

/** One invoice listing entry (deterministic projection). */
export interface InvoiceSummary {
  readonly invoiceId: string;
  readonly accountId: string;
  readonly status: InvoiceLifecycleState;
  readonly currency: string;
  readonly lineCount: number;
  readonly totalAmount: string;
  readonly createdAt: string;
}

/** Input of the stream read. */
export interface StreamReadInput {
  readonly asTenant: TenantId;
  readonly authorization: AuthorizationInput;
  readonly streamId: string;
}

/** Health/liveness as typed data (pure state projection). */
export interface HealthReport {
  readonly schemaVersion: 1;
  readonly service: string;
  readonly status: 'ready';
  readonly accountCount: number;
  readonly grantCount: number;
  readonly revokedEntitlementCount: number;
  readonly registeredDeliveryCount: number;
  readonly usageEventCount: number;
  readonly seatAssignmentCount: number;
  readonly activeSeatCount: number;
  readonly invoiceCount: number;
  readonly invoicesByStatus: Readonly<Record<InvoiceLifecycleState, number>>;
  readonly registeredPortCount: number;
  readonly eventCount: number;
}

/** The typed service surface description. */
export interface ServiceDescription {
  readonly schemaVersion: 1;
  readonly service: string;
  readonly contractVersion: string;
  readonly operations: readonly string[];
  readonly invariants: readonly string[];
}

/** Re-exported kernel/upstream types consumed by host callers. */
export type {
  EntitlementGrantRecord,
  EntitlementRevokeRecord,
  InvoiceLine,
  InvoiceTotals,
  SealedBillingAccount,
  SealedDeliveryRecord,
  SealedEntitlementsEvent,
  SealedInvoice,
  SealedSeatAssignment,
  SealedSeatRelease,
  SealedUsageEvent,
  SeatAccount,
  SettlementOutcome,
  SettlementPort,
  UsageAccount,
  UnitRate,
  PricingModel,
};
