/**
 * @epoch/billing-host — public API (service layer, Work Order W024).
 *
 * The thin typed HOST FACADE over the `@epoch/entitlements` kernel:
 * billing-account sessions, W023 grant/revocation adoption, W036 sealed
 * delivery registration (only VALIDATED actuals may bill), sealed usage
 * intake, seat assignment/release operations, invoice
 * draft -> issued -> settled | void sessions with kernel-derived lines,
 * settlement-port registration + check passthrough, tenant-scoped reads,
 * and health/liveness as typed data — every operation behind the W009
 * authorization gate.
 */
export { BillingHost } from './host';
export type { BillingHostOptions } from './types';

// Version constants.
export { BILLING_HOST_SERVICE_NAME, HOST_RECORD_VERSION, IDEMPOTENCY_KEY_PATTERN } from './version';

// Host input/output surface.
export type {
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
  IntakeUsageInput,
  InvoiceReceipt,
  InvoiceReadInput,
  InvoiceSummary,
  IssueInvoiceInput,
  LineSource,
  ListInvoicesInput,
  OpenAccountInput,
  PricingModel,
  PrincipalId,
  RegisterDeliveryInput,
  RegisterGrantInput,
  RegisterRevocationInput,
  ReleaseSeatInput,
  ResolveEntitlementInput,
  SeatAccountInput,
  SeatOperationReceipt,
  ServiceDescription,
  SettlementOutcomeProjection,
  SettleInvoiceInput,
  StreamReadInput,
  TenantId,
  UsageAccountInput,
  UsageIntakeReceipt,
  VoidInvoiceInput,
} from './types';
export type { AuthorizationContext } from './types';
