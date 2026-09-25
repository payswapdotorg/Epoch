/**
 * @epoch/identity — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators
 * in `src/schema.ts` infer exactly these types; `test/contract-drift.test.ts`
 * proves the committed JSON Schema files under `schemas/` are byte-identical
 * to the deterministic emission of those validators.
 *
 * Neutrality (architecture lock rule 13): every identifier is opaque and
 * provider-neutral — `principal:slug` ids, factor-class methods, closed
 * reason vocabularies. ZERO concrete IdPs/OAuth vendors/OIDC clients, ZERO
 * network, ZERO secrets storage: assertion descriptors record THAT a
 * credential of a class was asserted and WHAT the verification result
 * was — the credential material itself never enters kernel types.
 *
 * Identity != tenancy (architecture lock rule 12): principals carry NO
 * tenancy membership. Principal-to-tenant membership is host-wired
 * knowledge (see @epoch/authorization's caller-supplied facts), so this
 * package stays structurally decoupled from @epoch/tenancy.
 */
import type { MessageId, Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type { IDENTITY_RECORD_VERSION } from './version';
import type {
  AuthenticationReasonCode,
  CredentialMethod,
  PrincipalKind,
  PrincipalLifecycleState,
} from './version';

/**
 * Opaque principal identity: `principal:` + lowercase slug. The id is the
 * single source of principal identity — display names are labels, never
 * identity. Fits the W003 `PrincipalReference.id` field (min 1, max 128)
 * — pinned by devDependency parity tests.
 */
export type PrincipalId = string;

/**
 * A registered principal. The record is plain serialization-friendly
 * JSON with NO credential material, NO tenant membership (identity !=
 * tenancy), and NO provider fields.
 */
export interface Principal {
  readonly schemaVersion: typeof IDENTITY_RECORD_VERSION;
  /** Typed principal id (`principal:` + slug). */
  readonly principalId: PrincipalId;
  /** The principal's class (human/agent/solver/robot/service). */
  readonly kind: PrincipalKind;
  /** Lifecycle state (see src/version.ts). */
  readonly status: PrincipalLifecycleState;
  /** Human-readable label; never identity, never authority. */
  readonly displayName: string;
  /** Optional longer description. */
  readonly description?: string | undefined;
}

/**
 * A credential-assertion DESCRIPTOR: the typed record that a principal
 * asserted a credential of a given method class at a given time. It
 * carries NO credential material — no secret, no token, no proof value
 * (secrets storage is explicitly out of scope for this kernel).
 */
export interface CredentialAssertion {
  readonly schemaVersion: typeof IDENTITY_RECORD_VERSION;
  /** Opaque assertion id (unique within the emitting scope). */
  readonly assertionId: MessageId;
  /** The principal that asserted the credential. */
  readonly principalId: PrincipalId;
  /** The credential method class (knowledge/possession/inherence/signature/attestation). */
  readonly method: CredentialMethod;
  /** Caller-supplied canonical UTC instant of the assertion. */
  readonly assertedAt: Timestamp;
}

/**
 * A typed authentication RESULT: the outcome of verifying one credential
 * assertion. `verified` results may carry zero reasons (clean
 * verification) or explanatory entries; `failed` results carry at least
 * one typed failure reason.
 */
export interface AuthenticationResult {
  readonly schemaVersion: typeof IDENTITY_RECORD_VERSION;
  /** Opaque result id (unique within the emitting scope). */
  readonly resultId: MessageId;
  /** The assertion this result addresses. */
  readonly assertionId: MessageId;
  /** The principal the assertion was made for. */
  readonly principalId: PrincipalId;
  /** verified | failed. */
  readonly outcome: 'verified' | 'failed';
  /** Caller-supplied canonical UTC instant of the verification. */
  readonly verifiedAt: Timestamp;
  /** Typed reasons (at least one when the outcome is failed). */
  readonly reasons: readonly AuthenticationReason[];
}

/** One typed authentication reason (closed code vocabulary + detail). */
export interface AuthenticationReason {
  readonly code: AuthenticationReasonCode;
  /** Optional bounded human-auditable detail. */
  readonly detail?: string | undefined;
}

/**
 * A sealed credential assertion: the assertion plus the digest CLAIMED
 * for its content. Admission recomputes the digest and rejects a
 * mismatch (`digest-mismatch` — tamper detection).
 */
export interface SealedCredentialAssertion {
  readonly assertion: CredentialAssertion;
  readonly digest: Sha256Hex;
}

/**
 * A sealed authentication result: the result plus the digest CLAIMED for
 * its content. Authentication results are audit-grade evidence — the
 * exact-revision discipline — so they are content-addressed by default.
 */
export interface SealedAuthenticationResult {
  readonly result: AuthenticationResult;
  readonly digest: Sha256Hex;
}

/** Issue codes reported by the identity package's total entry points. */
export type IdentityErrorCode =
  | 'validation'
  | 'unknown-principal'
  | 'duplicate-principal'
  | 'lifecycle-conflict'
  | 'authentication-failed'
  | 'principal-inactive'
  | 'digest-mismatch';

/** One flattened validation issue (dotted path + message). */
export type IdentityIssue = {
  readonly path: string;
  readonly message: string;
};

/**
 * The typed identity error taxonomy (W009 Tech Lead pin; the W006/W007
 * issue-code style). Every entry point is total — errors are values, not
 * exceptions:
 *
 * - `unknown-principal` — lookup/verification of an unregistered principal.
 * - `duplicate-principal` — registering an existing principal id.
 * - `lifecycle-conflict` — an illegal principal lifecycle transition.
 * - `authentication-failed` — the authentication result is `failed`
 *   (typed reasons carried from the record).
 * - `principal-inactive` — the principal exists but is not active: a
 *   security boundary — suspended and disabled principals NEVER
 *   authenticate, even on a verified credential.
 * - `digest-mismatch` — a sealed record whose claimed digest does not
 *   match its content (tamper detection).
 */
export type IdentityError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly IdentityIssue[];
    }
  | {
      readonly code: 'unknown-principal';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly principalId: PrincipalId;
    }
  | {
      readonly code: 'duplicate-principal';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly principalId: PrincipalId;
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly from: PrincipalLifecycleState;
      readonly to: PrincipalLifecycleState;
    }
  | {
      readonly code: 'authentication-failed';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly principalId: PrincipalId;
      readonly reasons: readonly AuthenticationReason[];
    }
  | {
      readonly code: 'principal-inactive';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly principalId: PrincipalId;
      readonly status: PrincipalLifecycleState;
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly path: readonly (string | number)[];
      readonly expected: Sha256Hex;
      readonly encountered: Sha256Hex;
    };

/** Result of an identity operation: a value or a typed error. */
export type IdentityResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: IdentityError };

/**
 * The verified-principal record returned by
 * `PrincipalDirectory.verifyAuthentication`: the exact evidence ids of a
 * successful authentication (for audit and downstream authorization
 * wiring).
 */
export interface VerifiedPrincipal {
  readonly principalId: PrincipalId;
  readonly principal: Principal;
  readonly assertionId: MessageId;
  readonly resultId: MessageId;
  readonly verifiedAt: Timestamp;
  readonly reasons: readonly AuthenticationReason[];
}
