/**
 * The service-layer host-model types: option shapes, the typed
 * service-error union (kernel errors + the service-owned codes), the
 * intake admission outcomes (replayed intake returns the sealed prior
 * records — the typed `duplicate-observation` admission), and the
 * FieldCapturePort adapter seam (external field systems live BEHIND it;
 * the core never names a vendor).
 */
import type {
  CaptureResourceUsage,
  CaptureSubject,
  ExecutionError,
  ExecutionIntakeKey,
  ExecutionTrackingStore,
  FieldCapture,
  Measure,
  ObservationAdmission,
  ReconciliationApplicationResult,
  SealedExecutionEvent,
  SealedIssueRecord,
  SealedIssueResolution,
  SealedReconciliationProposal,
  SealedTrackingStateRecord,
  UncertaintyState,
} from '@epoch/execution-tracking';
import type {
  SealedDeliveryRecord,
  SealedDistinctionRecord,
  SealedProgramOfWork,
} from '@epoch/solution-delivery';
import type { AuthorizationContext } from '@epoch/authorization';

/** The sealed W036 program of work (the schedule authority input). */
export type { SealedProgramOfWork, SealedDeliveryRecord, SealedDistinctionRecord };

/** A sealed W036 distinction record (observations). */
export type { UncertaintyState, Measure, ExecutionTrackingStore };

/** The typed service-error union: kernel errors + service-owned codes. */
export type ExecutionServiceError =
  | ExecutionError
  | {
      readonly code: 'authorization-rejected';
      readonly message: string;
      readonly denialCode: string;
      readonly principalId: string;
      readonly operation: string;
    }
  | {
      readonly code: 'unknown-work-package';
      readonly message: string;
      readonly workPackageId: string;
    }
  | {
      readonly code: 'unknown-delivery';
      readonly message: string;
      readonly deliveryId: string;
    }
  | {
      readonly code: 'unknown-store';
      readonly message: string;
      readonly solutionId: string;
    }
  | {
      readonly code: 'proposal-not-applied';
      readonly message: string;
      readonly proposalId: string;
    };

/** Total-result wrapper of every service entry point. */
export type ExecutionServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ExecutionServiceError };

/** The caller-supplied authorization context (W009 decision facts). */
export type { AuthorizationContext };

/** The caller-supplied authorization input (principal + context + justification). */
export interface AuthorizationInput {
  readonly principalId: string;
  readonly context: AuthorizationContext;
  readonly justification?: string | undefined;
}

/** Options of the {@link ExecutionTrackingRuntime} constructor. */
export interface ExecutionTrackingRuntimeOptions {
  /**
   * Tenant this host is scoped to. When provided, ANY operation naming a
   * different tenant is rejected with `tenant-isolation-rejected` (R12 —
   * the single-tenant guard precedent).
   */
  readonly expectedTenantId?: string | undefined;
  /**
   * The FieldCapturePort adapter seam (external field systems — mobile
   * capture, IoT, scanners). Defaults to the in-memory reference adapter.
   * The core never names a vendor.
   */
  readonly fieldCapturePort?: FieldCapturePort | undefined;
}

// --------------------------------------------------------------------------------
// The FieldCapturePort adapter seam (provider-neutral).
// --------------------------------------------------------------------------------

/** The outbound capture poll the port carries to external field systems. */
export interface FieldCapturePollRequest {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly workPackageId?: string | undefined;
  readonly requestedAt: string;
  readonly requestedBy: string;
}

/** One field-capture submission the port returns (the kernel capture shape). */
export interface FieldCaptureSubmission {
  readonly captureKey: string;
  readonly tenantId: string;
  readonly solutionId: string;
  readonly deliveryId: string;
  readonly observedAt: string;
  readonly observedBy: string;
  readonly recordedAt?: string | undefined;
  readonly subjectRef: CaptureSubject;
  readonly measure: Measure;
  readonly resourceUsages?: readonly CaptureResourceUsage[] | undefined;
  readonly evidenceLinks?: FieldCapture['evidenceLinks'];
  readonly uncertainty: UncertaintyState;
}

/** The result shape of one port call (total; typed service errors). */
export type FieldCapturePortResult<T> = ExecutionServiceResult<T>;

/**
 * The FIELD CAPTURE PORT: the adapter seam behind which external field
 * systems live (mobile capture, IoT, scanners — architecture lock rule
 * 13; the core never names a vendor; concrete integrations are adapters
 * of this interface). ONE in-memory reference adapter ships with this
 * package.
 */
export interface FieldCapturePort {
  /**
   * Poll external field systems for captures. The submissions return in
   * the kernel's low-friction capture shape; the host runs the single-
   * call intake over each (linkage inference, uncertainty, idempotency).
   */
  pollCaptures(request: FieldCapturePollRequest): FieldCapturePortResult<readonly FieldCaptureSubmission[]>;
}

// --------------------------------------------------------------------------------
// Operation option shapes (authorization + tenant scope + payloads).
// --------------------------------------------------------------------------------

/** Options of `registerProgram`. */
export interface RegisterProgramOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  /** The sealed W036 ProgramOfWork (the schedule authority input). */
  readonly program: SealedProgramOfWork;
}

/** Options of `registerDeliveryRecord`. */
export interface RegisterDeliveryOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly delivery: SealedDeliveryRecord;
}

/** Options of `pollFieldCaptures`. */
export interface PollFieldCapturesOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly workPackageId?: string | undefined;
  readonly requestedAt: string;
}

/** Options of `intakeFieldCapture` (a direct single-call intake). */
export interface IntakeFieldCaptureOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly capture: FieldCaptureSubmission;
}

/** Options of `recordTrackingState`. */
export interface RecordTrackingStateOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly record: unknown;
}

/** Options of `raiseIssue`. */
export interface RaiseIssueOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly record: unknown;
}

/** Options of `resolveIssue`. */
export interface ResolveIssueOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly resolution: unknown;
}

/** Options of `proposeReconciliation`. */
export interface ProposeReconciliationOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly proposal: unknown;
}

/** Options of `applyReconciliation`. */
export interface ApplyReconciliationOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly proposalId: string;
  readonly application: {
    readonly acceptedBy: string;
    readonly acceptedAt: string;
    readonly actualizedBy: string;
    readonly actualizedAt: string;
  };
}

/** Options of `projectState` (asOf is the caller-supplied projection instant). */
export interface ProjectStateOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly solutionId: string;
  readonly asOf: string;
}

/** Options of `eventStream`. */
export interface StreamReadOptions {
  readonly tenantId: string;
  readonly authorization: AuthorizationInput;
  readonly workPackageId: string;
}

// --------------------------------------------------------------------------------
// Read models and health.
// --------------------------------------------------------------------------------

/** The derived health/liveness of the host (typed data, no clocks). */
export interface RuntimeHealth {
  readonly schemaVersion: number;
  readonly status: 'healthy';
  readonly storeCount: number;
  readonly observationCount: number;
  readonly trackingRecordCount: number;
  readonly resourceObservationCount: number;
  readonly evidenceLinkCount: number;
  readonly issueCount: number;
  readonly proposalCount: number;
  readonly deliveryCount: number;
  readonly eventStreamCount: number;
  readonly eventCount: number;
}

/** One hosted tracking store entry (the kernel store + host metadata). */
export interface StoreEntry {
  readonly store: ExecutionTrackingStore;
}

/** One hosted delivery record entry. */
export interface DeliveryEntry {
  readonly delivery: SealedDeliveryRecord;
}

/** One hosted proposal entry (the proposal + its application result). */
export interface ProposalEntry {
  readonly proposal: SealedReconciliationProposal;
  readonly application: ReconciliationApplicationResult | null;
}

/** The deterministic whole-host snapshot. */
export interface RuntimeSnapshot {
  readonly schemaVersion: number;
  readonly stores: readonly StoreEntry[];
  readonly deliveries: readonly DeliveryEntry[];
  readonly proposals: readonly ProposalEntry[];
  readonly events: readonly SealedExecutionEvent[];
  readonly tracking: readonly SealedTrackingStateRecord[];
  readonly issues: readonly SealedIssueRecord[];
  readonly resolutions: readonly SealedIssueResolution[];
}

/** The outcome of the field-capture intake at the service layer. */
export interface FieldIntakeServiceOutcome {
  readonly linkedWorkPackageId: string;
  readonly observation: ObservationAdmission['outcome'];
  readonly resourceObservationCount: number;
  readonly evidenceLinkCount: number;
  readonly idempotencyKey?: ExecutionIntakeKey | undefined;
}
