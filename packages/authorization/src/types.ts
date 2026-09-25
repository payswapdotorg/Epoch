/**
 * @epoch/authorization — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators
 * in `src/schema.ts` infer exactly these types; `test/contract-drift.test.ts`
 * proves the committed JSON Schema files under `schemas/` are byte-identical
 * to the deterministic emission of those validators.
 *
 * Neutrality and separation (architecture lock rules 12/13): every id is
 * OPAQUE and provider-neutral; requests carry principal/tenant/resource
 * REFERENCES, never embedded principal or tenancy objects. Identity lives
 * in @epoch/identity, the hierarchy in @epoch/tenancy, policy semantics in
 * @epoch/policy-contracts — this package owns DECISIONS over references,
 * with all external knowledge supplied through the host-wired
 * {@link AuthorizationFacts} interface (zero @epoch runtime coupling
 * beyond @epoch/agent-protocol).
 */
import type { MessageId, Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type { AUTHORIZATION_RECORD_VERSION } from './version';
import type { DecisionOutcome, DecisionReasonCode } from './version';

/**
 * Opaque principal identity (`principal:` + slug) — the same id space as
 * `@epoch/identity`'s PrincipalId (pinned by devDependency parity tests)
 * and accepted by the W003 `PrincipalReference.id` field.
 */
export type PrincipalId = string;

/**
 * Opaque tenant identity (`tenant:` + slug) — the same id space as
 * `@epoch/tenancy`'s TenantId (pinned by devDependency parity tests).
 */
export type TenantId = string;

/** Opaque resource identity (e.g. a tenancy node id, an evidence id, a
 * proposal reference — the owning domain defines the space). */
export type ResourceId = string;

/** The class/kind of the referenced resource (e.g. `workspace`, `world`,
 * `evidence` — a lowercase slug, provider-neutral). */
export type ResourceType = string;

/** The action class being authorized, colon-namespaced like the W003
 * authority scopes (e.g. `world:write`, `evidence:append`). */
export type ActionKind = string;

/**
 * The resource a request targets: a typed (resourceType, resourceId)
 * reference pair. Provider-neutral: both fields are opaque to this
 * package; the owning domains define their spaces.
 */
export interface ResourceReference {
  readonly resourceType: ResourceType;
  readonly resourceId: ResourceId;
}

/**
 * Optional refinement of the tenant scope: the workspace/project the
 * request operates within, plus caller-supplied tags. These fields
 * exist to project onto the W004 policy-target shape (see
 * `projectPolicyTarget`); this package NEVER verifies tenancy
 * containment itself — that is host-wired (@epoch/tenancy via the
 * facts, or the future W022 gateway wiring).
 */
export interface AuthorizationContext {
  /** Workspace the request operates within (tenancy workspace id space). */
  readonly workspaceId?: string;
  /** Project the request operates within (tenancy project id space). */
  readonly projectId?: string;
  /** Caller-supplied tags (policy matching vocabulary, provider-neutral). */
  readonly tags?: readonly string[];
}

/**
 * An authorization REQUEST: principal + tenant scope + resource
 * reference + action. The exact-revision evidence anchor of a decision.
 */
export interface AuthorizationRequest {
  readonly schemaVersion: typeof AUTHORIZATION_RECORD_VERSION;
  /** Opaque request id (unique within the emitting scope). */
  readonly requestId: MessageId;
  /** The principal requesting authorization (opaque id reference). */
  readonly principalId: PrincipalId;
  /** The tenancy scope of the request (opaque tenant id reference). */
  readonly tenantId: TenantId;
  /** The resource targeted (typed reference pair). */
  readonly resource: ResourceReference;
  /** The action class requested (colon-namespaced). */
  readonly actionKind: ActionKind;
  /** Optional scope refinement + tags (W004 policy-target projection). */
  readonly context?: AuthorizationContext;
  /** Caller-supplied canonical UTC instant of the request. */
  readonly requestedAt?: Timestamp;
}

/**
 * The W004-compatible policy-target projection of a request: exactly
 * the shape `@epoch/policy-contracts`' `PolicyTarget` admits (pinned by
 * devDependency parity tests). The host wires this projection into the
 * policy evaluation behind {@link AuthorizationFacts}.
 */
export interface PolicyTargetProjection {
  readonly tenantId: TenantId;
  readonly workspaceId?: string;
  readonly projectId?: string;
  readonly actionKind: ActionKind;
  readonly resourceType: ResourceType;
  readonly tags?: readonly string[];
}

/**
 * An exact evidence path: the address of the artifact revision backing
 * a decision — opaque artifact id, revision label, and SHA-256 content
 * digest. Structurally compatible with `@epoch/evidence`'s
 * ExactRevisionRef (pinned by devDependency parity tests).
 */
export interface EvidencePath {
  readonly artifactId: string;
  readonly revision: string;
  readonly digest: Sha256Hex;
}

/** One typed decision reason (closed code vocabulary + bounded detail). */
export interface DecisionReason {
  readonly code: DecisionReasonCode;
  /** Optional bounded human-auditable detail (e.g. the policy-side reason text). */
  readonly detail?: string;
}

/**
 * A typed authorization DECISION over an exact request revision:
 * allow/deny/not-applicable, with typed reasons and exact evidence
 * paths. The decision document itself is content-addressed by
 * {@link AuthorizationRecord}.
 */
export interface AuthorizationDecision {
  readonly schemaVersion: typeof AUTHORIZATION_RECORD_VERSION;
  readonly outcome: DecisionOutcome;
  /** The request this decision answers (exact-revision anchor). */
  readonly requestId: MessageId;
  readonly principalId: PrincipalId;
  readonly tenantId: TenantId;
  readonly resource: ResourceReference;
  readonly actionKind: ActionKind;
  /** The decision point's typed reasoning steps (never empty). */
  readonly reasons: readonly DecisionReason[];
  /** Exact evidence paths backing the decision (may be empty). */
  readonly evidencePaths: readonly EvidencePath[];
  /** Caller-supplied canonical UTC instant of the decision. */
  readonly decidedAt?: Timestamp;
}

/**
 * The published decision RECORD: the decision plus the digest of its
 * canonical JSON — the exact-revision address of the decision (audit
 * evidence, R17). Parse verifies the digest and rejects mismatches.
 */
export interface AuthorizationRecord {
  readonly schemaVersion: typeof AUTHORIZATION_RECORD_VERSION;
  readonly decision: AuthorizationDecision;
  /** SHA-256 of the decision's canonical JSON — the content address. */
  readonly decisionDigest: Sha256Hex;
}

/**
 * Caller-supplied facts the decision point consults — the host wiring
 * seam (the W022 Action Gateway / W014 app shell wire @epoch/identity,
 * @epoch/tenancy, and @epoch/policy-contracts behind this interface).
 * Zero runtime coupling: the interface is owned HERE, implemented by
 * hosts; the devDependency parity tests prove the kernel shapes compose.
 */
export interface AuthorizationFacts {
  /**
   * Resolve a principal: unknown, or known with the tenants it is a
   * member of (host-wired membership — identity and tenancy own the
   * data, this package owns the decision). May carry the exact evidence
   * paths of the authentication results backing the resolution.
   */
  resolvePrincipal(principalId: string): PrincipalResolution;
  /** Resolve a tenant: known or unknown. */
  resolveTenant(tenantId: string): TenantResolution;
  /**
   * Evaluate policy for a validated request and its W004-compatible
   * target projection. OPTIONAL: a decision point wired without a
   * policy source fails every request closed with a typed
   * `not-applicable` error (no authorization granted) — never a guess.
   */
  evaluatePolicy?(
    request: AuthorizationRequest,
    target: PolicyTargetProjection,
  ): PolicyEvaluationOutcome;
}

/** Result of resolving a principal (unknown, or member tenants + evidence). */
export type PrincipalResolution =
  | { readonly known: false }
  | {
      readonly known: true;
      readonly memberTenants: readonly TenantId[];
      readonly evidencePaths?: readonly EvidencePath[];
    };

/** Result of resolving a tenant. */
export type TenantResolution = { readonly known: false } | { readonly known: true };

/**
 * The host-wired policy evaluation outcome for one request: the
 * decision point defers POLICY SEMANTICS to this (W004 owns them);
 * it composes the typed decision from the outcome.
 */
export type PolicyEvaluationOutcome =
  | {
      readonly outcome: 'allow';
      /** Policy-side reason texts (bounded, human-auditable). */
      readonly reasons: readonly string[];
      readonly evidencePaths?: readonly EvidencePath[];
    }
  | {
      readonly outcome: 'deny';
      readonly reasons: readonly string[];
      readonly evidencePaths?: readonly EvidencePath[];
    }
  | {
      /** Policies evaluated; none applied to the target. */
      readonly outcome: 'not-applicable';
      readonly reasons: readonly string[];
    }
  | {
      /** Evaluation attempted and FAILED (e.g. W004 resolution
       * returned ok:false) — fail closed, distinguishable from a
       * policy deny: the decision point surfaces a typed
       * `evaluation-failed` error, never a silent allow. */
      readonly outcome: 'failed';
      readonly reasons: readonly string[];
    };

/** Issue codes reported by the authorization package's total entry points. */
export type AuthorizationErrorCode =
  | 'validation'
  | 'unknown-principal'
  | 'unknown-tenant'
  | 'cross-tenant-denied'
  | 'not-applicable'
  | 'evaluation-failed'
  | 'digest-mismatch';

/** One flattened validation issue (dotted path + message). */
export type AuthorizationIssue = {
  readonly path: string;
  readonly message: string;
};

/**
 * The typed authorization error taxonomy (W009 Tech Lead pin; the
 * W006/W007 issue-code style). Every entry point is total — errors are
 * values, not exceptions. All four pinned codes are fail-closed
 * refusals to issue an authorization:
 *
 * - `unknown-principal` — the facts do not know the requesting
 *   principal (identity problem, not a policy deny).
 * - `unknown-tenant` — the facts do not know the tenant scope.
 * - `cross-tenant-denied` — the principal is not a member of the
 *   request's tenant scope: tenant isolation, DENIED by construction
 *   (R12 security boundary).
 * - `not-applicable` — no policy source is wired (or none covers the
 *   request): nothing applies, no authorization is granted.
 */
export type AuthorizationError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly AuthorizationIssue[];
    }
  | {
      readonly code: 'unknown-principal';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly principalId: PrincipalId;
    }
  | {
      readonly code: 'unknown-tenant';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly tenantId: TenantId;
    }
  | {
      readonly code: 'cross-tenant-denied';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly principalId: PrincipalId;
      readonly tenantId: TenantId;
      /** The tenants the principal IS a member of (audit). */
      readonly memberTenants: readonly TenantId[];
    }
  | {
      readonly code: 'not-applicable';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly principalId: PrincipalId;
      readonly tenantId: TenantId;
    }
  | {
      readonly code: 'evaluation-failed';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly reasons: readonly string[];
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly expected: Sha256Hex;
      readonly encountered: Sha256Hex;
    };

/** Result of an authorization operation: a value or a typed error. */
export type AuthorizationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AuthorizationError };
