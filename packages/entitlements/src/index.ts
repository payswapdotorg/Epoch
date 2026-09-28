/**
 * @epoch/entitlements — public API (kernel layer, Work Order W024:
 * Billing + Entitlements).
 *
 * The typed domain model for entitlement RESOLUTION and BILLING records
 * (architecture.md, binding: "Epoch owns listings, trust metadata,
 * versions, entitlements, usage accounting, and developer revenue
 * records. Payment processors are adapters."; architecture lock rule 11:
 * "Marketplace entitlement is separate from payment processor state."):
 *
 * - **Entitlement resolution** rides the W009 tenancy containment seams
 *   and DELEGATES grant matching to the W023 `checkEntitlement`
 *   authority (grants/revocations are consumed, never redefined):
 *   `resolveEntitlement`.
 * - **Seat accounting** over W023 grants: sealed seat assignments +
 *   releases (append-only facts), pure admission with typed rejections
 *   (capacity, duplicates, revocation), deterministic folds:
 *   `admitSeatAssignment`, `admitSeatRelease`, `foldSeatAssignments`.
 * - **Billing accounts**: sealed, content-addressed, tenant-scoped, one
 *   settlement currency.
 * - **Invoices**: sealed, immutable lines, typed lifecycle
 *   draft -> issued -> settled | voided (`issueInvoice`, `settleInvoice`,
 *   `voidInvoice`), exact decimal totals (`foldInvoiceTotals`).
 * - **Pure line derivation** from the upstream authorities:
 *   `deriveOneTimeLine`, `deriveSubscriptionLine`, `deriveSeatLine`,
 *   `deriveUsageLine`, `deriveDeliveryActualLines` (ONLY VALIDATED W036
 *   actuals may bill — the sealed record is verified first), plus the
 *   pricing classifier `classifyPricingForBilling`.
 * - **SettlementPort**: the provider-neutral adapter seam expressing
 *   CHECKS and record-shaped outcomes ONLY (in-memory reference impl;
 *   no charge execution, no credentials, no network). The invoice
 *   record is the settlement authority, never the port state.
 * - **Events**: `entitlements:*` / `billing:*` append-only typed events
 *   over the W010 event shapes (`sealEntitlementsEvent`, one stream per
 *   account / per entitlement).
 *
 * Runtime dependency policy (W024): @epoch/agent-protocol (digests,
 * canonical JSON, timestamps), @epoch/marketplace (the W023
 * entitlement/pricing/usage authority), @epoch/solution-delivery (the
 * W036 delivery-record authority), and @epoch/tenancy (the W009 tenant
 * grammar + hierarchy) are the ONLY @epoch runtime dependencies.
 * Compatibility with @epoch/event-log, @epoch/identity, and
 * @epoch/authorization is pinned via devDependencies + compile-time
 * parity (src/kernel-parity.ts) and runtime parity tests — never runtime
 * deps.
 *
 * The published contract surface lives INSIDE the package (the W023
 * marketplace precedent — W024 owns no contracts/ tree): the typed index
 * export below, the runtime zod validators in the domain modules, and
 * the committed JSON Schema projection under `schemas/` pinned by
 * test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  BILLING_ACCOUNT_ID_PATTERN,
  BILLING_ACCOUNT_SCHEMA_NAME,
  BILLING_LINE_BASIS,
  BILLING_STREAM_ID_PATTERN,
  ENTITLEMENTS_CONTRACT_VERSION,
  ENTITLEMENTS_EVENT_DISCRIMINATORS,
  ENTITLEMENTS_EVENT_RECORD_VERSION,
  ENTITLEMENTS_PRINCIPAL_ID_PATTERN,
  ENTITLEMENTS_RECORD_VERSION,
  ENTITLEMENTS_STREAM_ID_PATTERN,
  INVOICE_ID_PATTERN,
  INVOICE_LIFECYCLE_STATES,
  INVOICE_LIFECYCLE_TRANSITIONS,
  INVOICE_SCHEMA_NAME,
  LINE_ITEM_ID_PATTERN,
  SEAT_ASSIGNMENT_ID_PATTERN,
  SEAT_ASSIGNMENT_SCHEMA_NAME,
  SEAT_RELEASE_ID_PATTERN,
  SEAT_RELEASE_SCHEMA_NAME,
  SETTLEMENT_ID_PATTERN,
  SETTLEMENT_PORT_ID_PATTERN,
  SETTLEMENT_RESULTS,
  billingStreamIdOf,
  entitlementsStreamIdOf,
  kindPrefixOf,
} from './version';
export type {
  BillingLineBasis,
  EntitlementsEventDiscriminator,
  InvoiceLifecycleState,
  SettlementResultKind,
} from './version';

// Published contract types.
export type {
  EntitlementResolution,
  EntitlementResolutionQuery,
} from './resolution';
export type {
  EntitlementResolutionEcho,
  EntitlementsError,
  EntitlementsErrorCode,
  EntitlementsIssue,
  EntitlementsResult,
} from './errors';
export type {
  SeatAssignmentContent,
  SeatReleaseContent,
  SealedSeatAssignment,
  SealedSeatRelease,
  SeatAccount,
} from './seats';
export type { BillingAccountContent, SealedBillingAccount } from './account';
export type {
  DeliveryActualReference,
  InvoiceContent,
  InvoiceLine,
  InvoiceTotals,
  IssueInvoiceInput,
  SealedInvoice,
  SettleInvoiceInput,
  VoidInvoiceInput,
} from './invoice';
export type {
  BillablePricingComponents,
  DeliveryActualLineOptions,
  DerivedLine,
  UnitRate,
  UnitRateCard,
} from './derive';
export type {
  SettlementOutcome,
  SettlementPort,
  SettlementPortStateEntry,
  SettlementRequest,
} from './settlement-port';
export type {
  EntitlementsCausalParent,
  EntitlementsEventContent,
  EntitlementsEventPayload,
  EntitlementsEventSequence,
  SealedEntitlementsEvent,
} from './events';
export type {
  AccountOpenedData,
  InvoiceDraftedData,
  InvoiceIssuedData,
  InvoiceSettledData,
  InvoiceVoidedData,
  SeatAssignedData,
  SeatReleasedData,
} from './events';

// Runtime validators (zod).
export {
  BillingAccountIdSchema,
  BillingStreamIdSchema,
  EntitlementsStreamIdSchema,
  InvoiceIdSchema,
  LineItemIdSchema,
  SeatAssignmentIdSchema,
  SeatReleaseIdSchema,
  SettlementIdSchema,
  SettlementPortIdSchema,
} from './primitives';
export {
  CurrencyCodeSchema,
  EntitlementIdSchema,
  ListingIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PaymentPortIdSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  TenantIdSchema,
  TimestampSchema,
} from './primitives';
export {
  SeatAssignmentContentSchema,
  SeatReleaseContentSchema,
  SealedSeatAssignmentSchema,
  SealedSeatReleaseSchema,
} from './seats';
export {
  BillingAccountContentSchema,
  SealedBillingAccountSchema,
  sealBillingAccount,
  verifySealedBillingAccount,
  computeBillingAccountDigest,
} from './account';
export {
  DeliveryActualReferenceSchema,
  InvoiceContentSchema,
  InvoiceLineSchema,
  SealedInvoiceSchema,
  foldInvoiceTotals,
  issueInvoice,
  openInvoice,
  settleInvoice,
  verifySealedInvoice,
  voidInvoice,
  computeInvoiceDigest,
} from './invoice';
export {
  admitSeatAssignment,
  admitSeatRelease,
  computeSeatAssignmentDigest,
  computeSeatReleaseDigest,
  foldSeatAssignments,
  parseEntitlementGrantRecord,
  parseEntitlementRevokeRecord,
  sealSeatAssignment,
  sealSeatRelease,
  verifySealedSeatAssignment,
  verifySealedSeatRelease,
} from './seats';
export { resolveEntitlement } from './resolution';
export {
  classifyPricingForBilling,
  deriveDeliveryActualLines,
  deriveOneTimeLine,
  deriveSeatLine,
  deriveSubscriptionLine,
  deriveUsageLine,
  sumLineAmounts,
  unsupportedPricingModelError,
  UnitRateSchema,
} from './derive';
export {
  InMemorySettlementPort,
  SettlementOutcomeSchema,
  SettlementRequestSchema,
} from './settlement-port';
export {
  ENTITLEMENTS_EVENT_DATA_SCHEMAS,
  EntitlementsCausalParentSchema,
  EntitlementsEventContentSchema,
  EntitlementsEventPayloadSchema,
  EntitlementsEventSequenceSchema,
  SealedEntitlementsEventSchema,
  computeEntitlementsEventDigest,
  isEntitlementsEventDiscriminator,
  parseEntitlementsEventData,
  sealEntitlementsEvent,
  verifySealedEntitlementsEvent,
} from './events';

// Exact decimal arithmetic.
export {
  addNonNegativeDecimals,
  compareNonNegativeDecimals,
  multiplyNonNegativeDecimals,
  subtractNonNegativeDecimalsClamped,
} from './decimal';

// Total parse surface (errors are values, never exceptions).
export {
  parseBillingAccountContent,
  parseEntitlementsEventContent,
  parseInvoiceContent,
  parseSeatAssignmentContent,
  parseSeatReleaseContent,
  parseSealedBillingAccount,
  parseSealedEntitlementsEvent,
  parseSealedInvoice,
  parseSealedSeatAssignment,
  parseSealedSeatRelease,
  parseSettlementOutcome,
  parseSettlementRequest,
} from './parse';

// Issue helpers (zod -> typed issues classification).
export {
  flattenZodIssues,
  hasUnrecognizedKeys,
  unrecognizedKeysPath,
  validationError,
  vendorFieldsError,
} from './issues';

// Published schema surface + deterministic contract emission.
export { ENTITLEMENTS_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  ENTITLEMENTS_CONTRACT_DIR,
  renderEntitlementsContractFiles,
  typeToKebabCase,
} from './contract-emission';
