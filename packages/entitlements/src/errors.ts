/**
 * The typed entitlements/billing error taxonomy (the W024 pin; mirrors the
 * issue-code style of W006/W007/W009/W010/W023). Every entry point is
 * total — errors are values, never thrown.
 *
 * Named codes:
 * - `validation` — malformed records (strict objects reject unknown
 *   vendor/provider fields; malformed ids rejected);
 * - `vendor-fields-rejected` — strict-object rejection of unknown
 *   (provider/vendor) structural fields;
 * - `digest-mismatch` — a claimed content digest that does not match the
 *   recomputed canonical SHA-256 (tamper detection);
 * - `entitlement-denied` — no Epoch-owned grant satisfies the query
 *   (ECHOED from the W023 checkEntitlement authority: payment state is
 *   never entitlement authority — lock rule 11);
 * - `entitlement-revoked` — a matching grant is flipped by a W023
 *   revocation record (immediate; no grace semantics);
 * - `cross-tenant-denied` — tenant-isolation violation (R12; the shared
 *   W004/W009/W023 denial grammar);
 * - `tenant-scope-rejected` — a tenancy scope that does not resolve in
 *   the W009 hierarchy (unknown workspace/project, or a project outside
 *   the queried workspace);
 * - `unknown-entitlement` — an entitlement id with no grant record;
 * - `seat-capacity-undefined` — a seat operation against a grant that
 *   defines no seat capacity;
 * - `seat-limit-exceeded` — active seat assignments already reach the
 *   grant's seat capacity;
 * - `duplicate-seat-assignment` — the principal already holds an active
 *   seat on the entitlement;
 * - `unknown-seat-assignment` — a seat-assignment id that does not
 *   resolve;
 * - `seat-release-conflict` — releasing an assignment that is not active
 *   (already released);
 * - `unknown-billing-account` — a billing-account id that does not
 *   resolve;
 * - `unknown-invoice` — an invoice id that does not resolve;
 * - `invoice-state-conflict` — an illegal invoice-lifecycle transition;
 * - `empty-invoice-rejected` — an invoice admission with no billable
 *   lines;
 * - `currency-mismatch` — line currencies (or an account's currency)
 *   disagree with the invoice currency;
 * - `unsupported-pricing-model` — a pricing model that derives no
 *   billable lines (free, enterprise-private);
 * - `delivery-actual-rejected` — a W036 delivery reference that fails
 *   verification, tenant scoping, actual resolution, or rate coverage
 *   (only VALIDATED actuals may bill);
 * - `settlement-port-unavailable` — a settlement check with no
 *   registered port (or an unknown port id) — the adapter seam is
 *   absent, never guessed;
 * - `settlement-rejected` — the settlement port's check outcome is not
 *   `settled` (unpaid or declined) — the invoice stays `issued`;
 * - `idempotency-conflict` — the same idempotency key re-used with
 *   DIFFERENT content (duplicate suppression).
 */
import type { InvoiceLifecycleState } from './version';

/** One flattened validation issue (dotted path + message; "$" = root). */
export interface EntitlementsIssue {
  readonly path: string;
  readonly message: string;
}

/** The complete entitlements/billing error-code vocabulary. */
export type EntitlementsErrorCode =
  | 'validation'
  | 'vendor-fields-rejected'
  | 'digest-mismatch'
  | 'entitlement-denied'
  | 'entitlement-revoked'
  | 'cross-tenant-denied'
  | 'tenant-scope-rejected'
  | 'unknown-entitlement'
  | 'seat-capacity-undefined'
  | 'seat-limit-exceeded'
  | 'duplicate-seat-assignment'
  | 'unknown-seat-assignment'
  | 'seat-release-conflict'
  | 'unknown-billing-account'
  | 'unknown-invoice'
  | 'invoice-state-conflict'
  | 'empty-invoice-rejected'
  | 'currency-mismatch'
  | 'unsupported-pricing-model'
  | 'delivery-actual-rejected'
  | 'settlement-port-unavailable'
  | 'settlement-rejected'
  | 'idempotency-conflict';

/** The query echo carried by entitlement denials (never a payment echo). */
export interface EntitlementResolutionEcho {
  readonly listingId: string;
  readonly tenantId: string;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
}

/** The typed entitlements/billing error taxonomy (values, never thrown). */
export type EntitlementsError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly EntitlementsIssue[];
    }
  | {
      readonly code: 'vendor-fields-rejected';
      readonly message: string;
      readonly issues: readonly EntitlementsIssue[];
      readonly path: readonly (string | number)[];
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
      readonly subject: string;
    }
  | {
      readonly code: 'entitlement-denied';
      readonly message: string;
      readonly query: EntitlementResolutionEcho;
    }
  | {
      readonly code: 'entitlement-revoked';
      readonly message: string;
      readonly entitlementId: string;
      readonly revokedAt: string;
    }
  | {
      readonly code: 'cross-tenant-denied';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
    }
  | {
      readonly code: 'tenant-scope-rejected';
      readonly message: string;
      readonly tenantId: string;
      readonly nodeId: string;
    }
  | {
      readonly code: 'unknown-entitlement';
      readonly message: string;
      readonly entitlementId: string;
    }
  | {
      readonly code: 'seat-capacity-undefined';
      readonly message: string;
      readonly entitlementId: string;
    }
  | {
      readonly code: 'seat-limit-exceeded';
      readonly message: string;
      readonly entitlementId: string;
      readonly seats: number;
      readonly activeCount: number;
    }
  | {
      readonly code: 'duplicate-seat-assignment';
      readonly message: string;
      readonly entitlementId: string;
      readonly principalId: string;
    }
  | {
      readonly code: 'unknown-seat-assignment';
      readonly message: string;
      readonly seatAssignmentId: string;
    }
  | {
      readonly code: 'seat-release-conflict';
      readonly message: string;
      readonly seatAssignmentId: string;
    }
  | {
      readonly code: 'unknown-billing-account';
      readonly message: string;
      readonly accountId: string;
    }
  | {
      readonly code: 'unknown-invoice';
      readonly message: string;
      readonly invoiceId: string;
    }
  | {
      readonly code: 'invoice-state-conflict';
      readonly message: string;
      readonly invoiceId: string;
      readonly from: InvoiceLifecycleState;
      readonly to: InvoiceLifecycleState;
    }
  | {
      readonly code: 'empty-invoice-rejected';
      readonly message: string;
      readonly invoiceId?: string | undefined;
    }
  | {
      readonly code: 'currency-mismatch';
      readonly message: string;
      readonly expectedCurrency: string;
      readonly encounteredCurrency: string;
    }
  | {
      readonly code: 'unsupported-pricing-model';
      readonly message: string;
      readonly pricingKind: string;
    }
  | {
      readonly code: 'delivery-actual-rejected';
      readonly message: string;
      readonly deliveryId?: string | undefined;
      readonly actualRecordId?: string | undefined;
    }
  | {
      readonly code: 'settlement-port-unavailable';
      readonly message: string;
      readonly portId?: string | undefined;
    }
  | {
      readonly code: 'settlement-rejected';
      readonly message: string;
      readonly invoiceId: string;
      readonly result: string;
    }
  | {
      readonly code: 'idempotency-conflict';
      readonly message: string;
      readonly idempotencyKey: string;
      readonly boundDigest: string;
      readonly encounteredDigest: string;
    };

/** Result of an entitlements/billing operation: a value or a typed error. */
export type EntitlementsResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: EntitlementsError };
