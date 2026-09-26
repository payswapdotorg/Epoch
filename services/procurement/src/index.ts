/**
 * @epoch/procurement-runtime — public API (service layer, Work Order W037).
 *
 * The thin typed HOST FACADE over the @epoch/procurement kernel: the
 * requirement-intake -> package-assembly -> quoting -> selection ->
 * commitment -> purchase-order -> delivery-tracking -> receipt ->
 * acceptance flow, the W009 authorization gate, tenant isolation (R12),
 * content-addressed idempotent intake (replays return the sealed prior
 * record — the typed `duplicate-intake-returned` admission), the
 * SupplierPort adapter seam (ONE in-memory reference adapter; the core
 * never names a vendor), and the procurement:* event streams (one
 * package = one stream `stream:procurement-<suffix>`).
 *
 * In-memory reference behavior: NO persistence, NO network, NO real
 * supplier systems; core logic stays pure (zero wall-clock, zero
 * randomness — every instant is caller-supplied). The typed
 * procurement contract and error taxonomy are @epoch/procurement's —
 * this service reuses them verbatim, it never forks authorities.
 *
 * Runtime dependency policy (W037): @epoch/procurement (the kernel),
 * @epoch/authorization (the W009 decision point),
 * @epoch/tenancy (tenant grammars) and zod are the runtime
 * dependencies. Compatibility with @epoch/solution-delivery (W036
 * fixtures), @epoch/event-log (REAL sealEvent/computeEventDigest
 * parity), @epoch/policy-contracts, @epoch/constraint-language,
 * @epoch/evidence and @epoch/verification is exercised via
 * devDependency parity tests — never runtime deps.
 */

// Version + vocabularies.
export {
  INTAKE_ADMISSION_KINDS,
  PROCUREMENT_RUNTIME_CONTRACT_VERSION,
  RUNTIME_HEALTH_STATUSES,
  RUNTIME_RECORD_VERSION,
} from './version';
export type { IntakeAdmissionKind, RuntimeHealthStatus } from './version';

// Host-model types.
export type {
  AuthorizationContext,
  AuthorizationInput,
  DecideSubstitutionOptions,
  IntakeOutcome,
  IntakeRequirementOptions,
  IssuePurchaseOrderOptions,
  LinkCommitmentOptions,
  OrderEntry,
  PackageEntry,
  ProcurementRuntimeOptions,
  ProcurementServiceError,
  ProcurementServiceResult,
  ProjectStatusOptions,
  RecordDeliveryTransitionOptions,
  RequestQuotesOptions,
  RuntimeHealth,
  RuntimeSnapshot,
  SelectQuoteOptions,
  StreamReadOptions,
  SupplierPort,
  SupplierPortResult,
  SupplierQuoteRequest,
  SupplierQuoteSubmission,
} from './types';
export type {
  AcquisitionRequestRecord,
  SealedDistinctionRecord,
  UncertaintyState,
} from './types';

// The SupplierPort seam + the in-memory reference adapter.
export { InMemorySupplierAdapter, type ReferenceSupplierSeed } from './supplier-port';

// The pure step driver (exported for direct, hostless use).
export {
  admitSupplierSubmission,
  assembleRequirementPackage,
  issueOrderVersion,
  projectStatus,
  recordDeliveryTransition,
  recordQuoteSelection,
  requestAndDecideSubstitution,
  sealCommitmentForSelection,
} from './driver';

// The reference host.
export { ProcurementRuntime } from './runtime';
