/**
 * @epoch/authorization — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators
 * in `src/schema.ts` infer exactly these types; `test/contract-drift.test.ts`
 * proves the committed JSON Schema files under `schemas/` are
 * byte-identical to the deterministic emission of those validators.
 *
 * Authority split (lock rule 12): authorization owns DECISIONS over
 * opaque principal/tenant/resource ids. It is a decision point, not a
 * policy engine — policy semantics are @epoch/policy-contracts' (W004);
 * `test/w004-parity.test.ts` + `test/w004-parity.types.ts` pin the shape
 * compatibility (devDependencies only, no runtime coupling). Tenancy and
 * identity facts enter as CALLER-SUPPLIED typed inputs (the W004
 * caller-supplied-resolver precedent): this package never calls into
 * @epoch/tenancy or @epoch/identity at runtime.
 */
import type { Sha256Hex } from '@epoch/agent-protocol';
import type {
  ALLOW_REASONS,
  AUTHORIZATION_OUTCOMES,
  AUTHORIZATION_RECORD_VERSION,
  DENIAL_CODES,
  NOT_APPLICABLE_REASONS,
  PRINCIPAL_STATUSES,
} from './version';

/** One decision outcome (allow, deny, not-applicable). */
export type AuthorizationOutcome = (typeof AUTHORIZATION_OUTCOMES)[number];

/** One typed denial code (fail-closed taxonomy). */
export type DenialCode = (typeof DENIAL_CODES)[number];

/** One allow reason. */
export type AllowReason = (typeof ALLOW_REASONS)[number];

/** One not-applicable reason. */
export type NotApplicableReason = (typeof NOT_APPLICABLE_REASONS)[number];

/** One principal status (mirrors @epoch/identity as caller-supplied facts). */
export type PrincipalStatus = (typeof PRINCIPAL_STATUSES)[number];

/** Opaque principal id (`principal:<slug>`), mirroring @epoch/identity. */
export type PrincipalId = string;

/** Opaque tenant id (`tenant:<slug>`), mirroring @epoch/tenancy. */
export type TenantId = string;

/** Opaque workspace id (`workspace:<slug>`), mirroring @epoch/tenancy. */
export type WorkspaceId = string;

/** Opaque project id (`project:<slug>`), mirroring @epoch/tenancy. */
export type ProjectId = string;

/** Exact evidence path: a dotted pointer into the request/context. */
export type EvidencePath = string;

/**
 * The tenancy-scoped resource a request acts on. `resourceType` and
 * `resourceId` are opaque (bounded like the W004 policy-target strings:
 * 1-256 characters); the scope fields reference tenancy nodes by opaque
 * id. A resource WITHOUT a tenant id is platform-scoped — this decision
 * point is then NOT-APPLICABLE (platform-level authorization is a
 * different authority, not a tenant decision).
 */
export interface ResourceReference {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly tenantId?: TenantId | undefined;
  readonly workspaceId?: WorkspaceId | undefined;
  readonly projectId?: ProjectId | undefined;
}

/**
 * An authorization request: WHO wants to do WHAT to WHICH tenancy-scoped
 * resource. Fields align 1:1 with the W004 `PolicyTarget` projection
 * (`toPolicyTarget`) so the same request drives policy resolution without
 * translation drift.
 */
export interface AuthorizationRequest {
  readonly schemaVersion: typeof AUTHORIZATION_RECORD_VERSION;
  readonly principalId: PrincipalId;
  /** Opaque action kind (W003 owns action types; this names the class). */
  readonly actionKind: string;
  readonly resource: ResourceReference;
  /** Mandatory-free audit justification (R17; optional, bounded). */
  readonly justification?: string | undefined;
}

/**
 * A caller-supplied principal FACT: the principal's status and
 * authentication state, projected from @epoch/identity records by the
 * host (the Action Gateway, W022). Authorization never interprets
 * credentials — it consumes typed facts.
 */
export interface PrincipalFact {
  readonly principalId: PrincipalId;
  readonly status: PrincipalStatus;
  readonly authenticated: boolean;
}

/**
 * A caller-supplied tenancy MEMBERSHIP fact: the principal is a member
 * of this tenancy scope. Scope semantics mirror @epoch/tenancy
 * containment: `{tenantId}` covers the whole tenant; `{tenantId,
 * workspaceId}` covers the workspace and everything under it
 * (projects/worlds/scenarios/evidence); `{tenantId, workspaceId,
 * projectId}` covers only that project.
 */
export interface MembershipFact {
  readonly principalId: PrincipalId;
  readonly tenantId: TenantId;
  readonly workspaceId?: WorkspaceId | undefined;
  readonly projectId?: ProjectId | undefined;
}

/**
 * The caller-supplied decision context: principal facts, membership
 * facts, and the known tenants (projected from @epoch/tenancy by the
 * host). The evaluator canonicalizes all three lists before matching,
 * so two contexts that differ only in ARRAY ORDER produce byte-identical
 * decisions.
 */
export interface AuthorizationContext {
  readonly schemaVersion: typeof AUTHORIZATION_RECORD_VERSION;
  readonly principals: readonly PrincipalFact[];
  readonly memberships: readonly MembershipFact[];
  readonly knownTenants: readonly TenantId[];
}

/** A machine-readable denial (exactly one typed code + audit message). */
export interface Denial {
  readonly code: DenialCode;
  readonly message: string;
}

/** An allow decision: typed reasons + exact evidence paths. */
export interface AllowDecision {
  readonly schemaVersion: typeof AUTHORIZATION_RECORD_VERSION;
  /** Canonical digest of the exact request revision this decision answers. */
  readonly requestDigest: Sha256Hex;
  readonly outcome: 'allow';
  readonly reasons: readonly AllowReason[];
  readonly evidence: readonly EvidencePath[];
}

/** A deny decision: exactly one typed denial + exact evidence paths. */
export interface DenyDecision {
  readonly schemaVersion: typeof AUTHORIZATION_RECORD_VERSION;
  readonly requestDigest: Sha256Hex;
  readonly outcome: 'deny';
  readonly denial: Denial;
  readonly evidence: readonly EvidencePath[];
}

/**
 * A not-applicable decision: this decision point has nothing to say
 * (e.g. a platform-scoped resource with no tenant) — the outcome is
 * neither allow nor deny; the caller routes to the responsible authority.
 */
export interface NotApplicableDecision {
  readonly schemaVersion: typeof AUTHORIZATION_RECORD_VERSION;
  readonly requestDigest: Sha256Hex;
  readonly outcome: 'not-applicable';
  readonly reason: NotApplicableReason;
  readonly message: string;
  readonly evidence: readonly EvidencePath[];
}

/** The exhaustive decision union. */
export type AuthorizationDecision =
  | AllowDecision
  | DenyDecision
  | NotApplicableDecision;

/**
 * The W004 policy-target projection of a request. Deliberately NOT
 * readonly: this shape must be compile-time EQUALS to @epoch/policy-
 * contracts' `PolicyTarget` (inferred from the frozen W004 validator
 * without readonly modifiers) — pinned by test/w004-parity.types.ts.
 */
export interface AuthorizationPolicyTarget {
  tenantId?: string | undefined;
  workspaceId?: string | undefined;
  projectId?: string | undefined;
  actionKind?: string | undefined;
  resourceType?: string | undefined;
  tags?: string[] | undefined;
}

/** Issue codes reported by the authorization total entry points. */
export interface AuthorizationIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * The typed authorization error taxonomy. Evaluation is TOTAL: an
 * admissible request over an admissible context always yields a decision
 * (fail-closed denials carry the typed codes). Errors are reserved for
 * malformed inputs (values, never thrown).
 */
export type AuthorizationErrorCode = 'validation' | 'digest-mismatch';

/** The typed authorization error taxonomy (values, never thrown). */
export type AuthorizationError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly AuthorizationIssue[];
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: Sha256Hex;
      readonly encountered: Sha256Hex;
    };

/** Result of an authorization operation: a value or a typed error. */
export type AuthorizationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AuthorizationError };
