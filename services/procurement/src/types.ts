/**
 * The service-layer host-model types: option shapes, the typed
 * service-error union (kernel errors + the service-owned codes), and
 * the intake admission outcomes (replayed intake returns sealed prior
 * records — the typed `duplicate-intake-returned` admission).
 */
import type {
  ProcurementError,
  ProcurementIntakeKey,
  SealedAcquisitionPackage,
  SealedProcurementEvent,
  SealedPurchaseOrder,
  SealedQuote,
  SealedQuoteSelection,
  SealedSubstitutionDecision,
  SealedSubstitutionRequest,
  SealedSupplierDeliveryTransition,
  AcquisitionRequestRecord,
  SealedDistinctionRecord,
  UncertaintyState,
  SupplierDeliveryState,
} from '@epoch/procurement';
import type { AuthorizationContext } from '@epoch/authorization';

/** The W036 acquisition request admitted upstream. */
export type { AcquisitionRequestRecord };

/** A sealed W036 distinction record (commitments, observations). */
export type { SealedDistinctionRecord, UncertaintyState };

/** The typed service-error union: kernel errors + service-owned codes. */
export type ProcurementServiceError =
  | ProcurementError
  | {
      readonly code: 'authorization-rejected';
      readonly message: string;
      readonly denialCode: string;
      readonly principalId: string;
      readonly operation: string;
    }
  | {
      readonly code: 'unknown-package';
      readonly message: string;
      readonly packageId: string;
    }
  | {
      readonly code: 'unknown-purchase-order';
      readonly message: string;
      readonly poId: string;
    };

/** Total-result wrapper of every service entry point. */
export type ProcurementServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ProcurementServiceError };

/**
 * One intake admission outcome: a NEW record, or the REPLAYED intake
 * returning the SEALED PRIOR RECORD (same content-addressed
 * idempotency key — the state is unchanged; the duplicate is a typed
 * admission, not an error).
 */
export type IntakeOutcome<T> = {
  readonly kind: 'admitted';
  readonly record: T;
} | {
  readonly kind: 'duplicate-intake-returned';
  readonly record: T;
  readonly idempotencyKey: ProcurementIntakeKey;
};

/** The caller-supplied authorization context (W009 decision facts). */
export type { AuthorizationContext };

/** Options of the {@link ProcurementRuntime} constructor. */
export interface ProcurementRuntimeOptions {
  /**
   * Tenant this host is scoped to. When provided, ANY operation naming a
   * different tenant is rejected with `tenant-isolation-rejected` (R12 —
   * the single-tenant guard precedent).
   */
  readonly expectedTenantId?: string | undefined;
  /**
   * The SupplierPort adapter seam (external supplier systems). Defaults
   * to the in-memory reference adapter. The core never names a vendor.
   */
  readonly supplierPort?: SupplierPort | undefined;
}

// --------------------------------------------------------------------------------
// The SupplierPort adapter seam (provider-neutral).
// --------------------------------------------------------------------------------

/** The outbound quote request the port carries to supplier systems. */
export interface SupplierQuoteRequest {
  readonly tenantId: string;
  readonly packageId: string;
  readonly packageDigest: string;
  readonly lines: readonly {
    readonly description: string;
    readonly quantity: string;
    readonly unit: string;
    readonly solutionLineId?: string | undefined;
  }[];
  readonly requestedAt: string;
  readonly requestedBy: string;
}

/** One supplier quote submission the port returns (opaque supplier ids). */
export interface SupplierQuoteSubmission {
  readonly quoteId: string;
  readonly supplierId: string;
  readonly lines: readonly {
    readonly description: string;
    readonly quantity: string;
    readonly unit: string;
    readonly unitCost: { readonly amount: string; readonly currency: string };
    readonly allocation?: {
      readonly state: 'reserved' | 'allocated';
      readonly quantity: string;
      readonly allocatedAt: string;
    } | undefined;
  }[];
  readonly leadTimes: readonly {
    readonly semantics: 'prediction' | 'estimate';
    readonly recordId: string;
    readonly contentDigest: string;
    readonly uncertainty: UncertaintyState;
  }[];
  readonly validUntil?: string | undefined;
  readonly submittedAt: string;
  readonly submittedBy?: string | undefined;
}

/** The result shape of one port call (total; typed service errors). */
export type SupplierPortResult<T> = ProcurementServiceResult<T>;

/**
 * The SUPPLIER PORT: the adapter seam behind which external supplier
 * systems live (the architecture-lock rule-13 discipline — the core
 * never names a vendor; concrete integrations are adapters of this
 * interface). ONE in-memory reference adapter ships with this package.
 */
export interface SupplierPort {
  /** Request quotes for one acquisition package from supplier systems. */
  requestQuotes(request: SupplierQuoteRequest): SupplierPortResult<readonly SupplierQuoteSubmission[]>;
}

// --------------------------------------------------------------------------------
// Operation option shapes (authorization + tenant scope + payloads).
// --------------------------------------------------------------------------------

/** The shared authorization gate input of every operation. */
export interface AuthorizationInput {
  readonly principalId: string;
  readonly context: AuthorizationContext;
  readonly justification?: string | undefined;
}

/** Options of requirement intake (lineage + package assembly). */
export interface IntakeRequirementOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  /** The REAL W036 acquisition request the package grounds. */
  readonly request: AcquisitionRequestRecord;
  readonly packageId: string;
  /** The opaque ProgramOfWork requirement ids this package serves. */
  readonly requirements: readonly string[];
  /** The requirement reference of the primary lineage binding. */
  readonly requirementRef: { readonly kind: 'work-package' | 'solution-line'; readonly id: string };
  readonly assembledAt: string;
  readonly lineageId: string;
}

/** Options of quoting through the SupplierPort seam. */
export interface RequestQuotesOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly packageId: string;
  readonly requestedAt: string;
}

/** Options of quote selection. */
export interface SelectQuoteOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly packageId: string;
  readonly selectionId: string;
  readonly selectedQuoteId: string;
  readonly rationale: string;
  readonly decidedAt: string;
}

/** Options of commitment linkage. */
export interface LinkCommitmentOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly packageId: string;
  readonly commitmentRecordId: string;
  readonly committedAt: string;
}

/** Options of purchase-order issue. */
export interface IssuePurchaseOrderOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly packageId: string;
  readonly poId: string;
  readonly issuedAt: string;
  readonly amendmentNote?: string | undefined;
}

/** Options of a supplier-delivery transition recording. */
export interface RecordDeliveryTransitionOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly poId: string;
  readonly to: SupplierDeliveryState;
  readonly occurredAt: string;
  readonly transitionId: string;
  /** The receipt payload (mandatory for partial/received). */
  readonly receipt?: {
    readonly observationRef: { readonly recordId: string; readonly contentDigest: string };
    readonly lines: readonly { readonly description: string; readonly quantity: string; readonly unit: string }[];
    readonly receivedAt: string;
    readonly receivedBy: string;
  } | undefined;
  readonly note?: string | undefined;
}

/** Options of substitution decision (the constraint-evaluation gate). */
export interface DecideSubstitutionOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly poId: string;
  readonly substitutionId: string;
  readonly originalLines: readonly { readonly description: string; readonly quantity: string; readonly unit: string }[];
  readonly substituteLines: readonly { readonly description: string; readonly quantity: string; readonly unit: string }[];
  readonly requestedAt: string;
  readonly decision: 'accepted' | 'rejected';
  readonly decidedAt: string;
  /** The constraint-evaluation reference — MANDATORY (the gate). */
  readonly constraintEvaluation?: { readonly evaluationDigest: string; readonly policyShapeRef?: string | undefined } | undefined;
}

/** Options of the status projection. */
export interface ProjectStatusOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly packageId: string;
  readonly asOf: string;
}

/** The read options of one package's event stream. */
export interface StreamReadOptions {
  readonly tenantId: string;
  readonly packageId: string;
}

/** Health/liveness as typed data. */
export interface RuntimeHealth {
  readonly schemaVersion: number;
  readonly status: 'healthy' | 'degraded';
  readonly packageCount: number;
  readonly quoteCount: number;
  readonly selectionCount: number;
  readonly purchaseOrderCount: number;
  readonly deliveryLogCount: number;
  readonly eventStreamCount: number;
  readonly eventCount: number;
}

/** One hosted acquisition package entry (tenant-scoped). */
export interface PackageEntry {
  readonly pkg: SealedAcquisitionPackage;
  readonly request: AcquisitionRequestRecord;
  readonly requirements: readonly string[];
}

/** One hosted purchase order entry (tenant-scoped). */
export interface OrderEntry {
  readonly orders: readonly SealedPurchaseOrder[];
  readonly log: readonly SealedSupplierDeliveryTransition[];
  readonly packageId: string;
}

/** A deterministic whole-host snapshot (sorted). */
export interface RuntimeSnapshot {
  readonly schemaVersion: number;
  readonly packages: readonly PackageEntry[];
  readonly quotes: readonly SealedQuote[];
  readonly selections: readonly SealedQuoteSelection[];
  readonly commitments: readonly SealedDistinctionRecord[];
  readonly orders: readonly OrderEntry[];
  readonly substitutions: readonly {
    readonly request: SealedSubstitutionRequest;
    readonly decision: SealedSubstitutionDecision | null;
  }[];
  readonly events: readonly SealedProcurementEvent[];
}
