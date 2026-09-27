/**
 * The service-layer host-model types: option shapes, the typed
 * service-error union (kernel errors + the service-owned codes), the
 * caller-supplied authorization input, and the projection outcomes.
 */
import type {
  AccessProjectionError,
  AccessProjectionStore,
  AccessStateProjection,
  CanonicalRecord,
  ProjectionEvaluation,
  ProjectionSubject,
  SealedAccessProjectionEvent,
  SealedProjectionAudit,
  TaskProjectionContext,
} from '@epoch/access-projection';
import type { AuthorizationContext } from '@epoch/authorization';

/** The typed service-error union: kernel errors + service-owned codes. */
export type AccessServiceError =
  | AccessProjectionError
  | {
      readonly code: 'authorization-rejected';
      readonly message: string;
      readonly denialCode: string;
      readonly principalId: string;
      readonly operation: string;
    }
  | {
      readonly code: 'unknown-record';
      readonly message: string;
      readonly objectClass: string;
      readonly objectId: string;
    }
  | {
      readonly code: 'unknown-policy';
      readonly message: string;
      readonly policyId: string;
      readonly revision: number;
    }
  | {
      readonly code: 'unknown-store';
      readonly message: string;
      readonly tenantId: string;
    };

/** Total-result wrapper of every service entry point. */
export type AccessServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AccessServiceError };

/** The caller-supplied authorization facts (W009 decision input). */
export interface AuthorizationInput {
  readonly principalId: string;
  readonly context: AuthorizationContext;
  readonly justification?: string | undefined;
}

/** Options of the {@link AccessProjectionRuntime} constructor. */
export interface AccessProjectionRuntimeOptions {
  /**
   * Tenant this host is scoped to. When provided, ANY operation naming a
   * different tenant is rejected with `tenant-isolation-rejected` (R12 —
   * the single-tenant guard precedent).
   */
  readonly expectedTenantId?: string | undefined;
}

/** One canonical-record reference (opaque, exact-revision). */
export interface CanonicalRecordReference {
  readonly objectClass: 'program-of-work' | 'delivery-record' | 'solution-version' | 'distinction-record';
  readonly objectId: string;
  readonly objectDigest: string;
}

/** One policy-revision reference (opaque, exact-revision). */
export interface PolicyRevisionReference {
  readonly policyId: string;
  readonly revision: number;
}

/** Options of `registerPolicy`. */
export interface RegisterPolicyOptions {
  readonly authorization: AuthorizationInput;
  /** The policy content (loose) or an already-sealed revision. */
  readonly policy: unknown;
  readonly registeredAt: string;
}

/** Options of `admitRecord`. */
export interface AdmitRecordOptions {
  readonly authorization: AuthorizationInput;
  /** The objectClass-tagged sealed W036 record (loose). */
  readonly record: unknown;
  readonly admittedAt: string;
}

/** Options of `project` (the two-stage evaluation pipeline). */
export interface ProjectOptions {
  readonly authorization: AuthorizationInput;
  readonly tenantId: string;
  /** The canonical object to project (must be admitted). */
  readonly recordRef: CanonicalRecordReference;
  /** The policy revision to evaluate under (must be admitted). */
  readonly policyRef: PolicyRevisionReference;
  /** The subject the projection is computed for. */
  readonly subject: ProjectionSubject;
  /** The action (view/export/share — its own policy row). */
  readonly action: 'view' | 'export' | 'share';
  /** The agent task context (narrows the projection; agents only). */
  readonly taskContext?: TaskProjectionContext | undefined;
  readonly projectedAt: string;
}

/** Options of `projectState`. */
export interface ProjectStateOptions {
  readonly authorization: AuthorizationInput;
  readonly tenantId: string;
  readonly projectedAt: string;
}

/** Options of `auditTrail` / `eventStream` reads. */
export interface ReadOptions {
  readonly tenantId: string;
}

/**
 * One completed service-level projection: the kernel evaluation (both
 * outcomes are audited) plus the replay flag — a duplicate evaluation
 * returns the SEALED PRIOR records with the state unchanged and emits
 * NO events.
 */
export interface ProjectionOutcome {
  readonly evaluation: ProjectionEvaluation;
  readonly replayed: boolean;
}

/** The typed snapshot of the host state (deterministic, sorted). */
export interface RuntimeSnapshot {
  readonly tenants: readonly string[];
  readonly stores: readonly {
    readonly tenantId: string;
    readonly policyCount: number;
    readonly recordCount: number;
    readonly projectionCount: number;
    readonly auditCount: number;
  }[];
  readonly eventCount: number;
  readonly streamCount: number;
}

/** The typed health of the host. */
export interface RuntimeHealth {
  readonly tenantCount: number;
  readonly policyRevisionCount: number;
  readonly recordCount: number;
  readonly projectionCount: number;
  readonly auditCount: number;
  readonly eventCount: number;
}

/** One tenant's hosted store entry. */
export interface StoreEntry {
  readonly tenantId: string;
  readonly store: AccessProjectionStore;
}

/** Re-exported host-facing types. */
export type {
  AccessStateProjection,
  CanonicalRecord,
  ProjectionEvaluation,
  ProjectionSubject,
  SealedAccessProjectionEvent,
  SealedProjectionAudit,
  TaskProjectionContext,
};
