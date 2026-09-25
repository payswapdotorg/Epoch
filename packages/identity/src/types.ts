/**
 * @epoch/identity — published contract types (v1).
 *
 * Hand-written, exported from the package index as the versioned contract
 * surface. `src/parity.ts` proves at compile time that the zod validators
 * in `src/schema.ts` infer exactly these types; `test/contract-drift.test.ts`
 * proves the committed JSON Schema files under `schemas/` are byte-identical
 * to the deterministic emission of those validators.
 *
 * Neutrality (architecture lock rule 13): identity models PRINCIPALS,
 * CREDENTIAL ASSERTIONS (mechanism descriptors — never secrets), and
 * AUTHENTICATION RESULTS as typed data. There is no concrete
 * IdP/OAuth/OIDC client anywhere; providers are future adapters behind
 * the Capability Fabric. Identity != tenancy != authorization (lock rule
 * 12): a principal record carries NO tenant and NO membership —
 * memberships are caller-supplied facts at the authorization decision
 * point, and tenancy scopes are @epoch/tenancy's authority.
 */
import type { MessageId, Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type {
  AUTHENTICATION_FAILURE_REASONS,
  CREDENTIAL_MECHANISMS,
  IDENTITY_RECORD_VERSION,
  PRINCIPAL_KINDS,
  PRINCIPAL_LIFECYCLE_STATES,
} from './version';

/** One principal kind (human, agent, service). */
export type PrincipalKind = (typeof PRINCIPAL_KINDS)[number];

/** Opaque, prefixed principal identity (`principal:ada`). */
export type PrincipalId = string;

/** One principal lifecycle state. */
export type PrincipalLifecycleState = (typeof PRINCIPAL_LIFECYCLE_STATES)[number];

/** One credential mechanism class. */
export type CredentialMechanism = (typeof CREDENTIAL_MECHANISMS)[number];

/** One typed authentication-failure reason. */
export type AuthenticationFailureReason = (typeof AUTHENTICATION_FAILURE_REASONS)[number];

/**
 * A principal: the immutable, digested content of an identity record.
 * The record deliberately carries NO tenant, NO membership, and NO
 * credential material — identity owns the principal identity itself;
 * where a principal may act is the authorization decision point's
 * concern, fed by tenancy facts.
 */
export interface Principal {
  readonly schemaVersion: typeof IDENTITY_RECORD_VERSION;
  readonly principalId: PrincipalId;
  readonly kind: PrincipalKind;
  readonly displayName: string;
  readonly description?: string | undefined;
}

/**
 * The published principal record: the immutable principal content, its
 * lifecycle state, and the SHA-256 digest of the content's canonical
 * JSON (the exact-revision address). Lifecycle transitions never rewrite
 * the digest — the digested document stays byte-stable for the lifetime
 * of the principal (the W007 capability-manifest discipline).
 */
export interface PrincipalRecord {
  readonly schemaVersion: typeof IDENTITY_RECORD_VERSION;
  readonly principal: Principal;
  readonly lifecycle: PrincipalLifecycleState;
  /** SHA-256 of the principal content's canonical JSON. */
  readonly principalDigest: Sha256Hex;
}

/**
 * A registration envelope: the principal plus the digest CLAIMED for its
 * content. The registry recomputes the digest and rejects a mismatch
 * (`digest-mismatch` — tamper detection).
 */
export interface PrincipalRegistration {
  readonly principal: Principal;
  readonly digest: Sha256Hex;
}

/**
 * A credential-assertion DESCRIPTOR: what a presenter claimed to hold,
 * typed and provider-neutral. It records the mechanism CLASS and the
 * assertion moment for audit — it NEVER carries a secret, a token value,
 * a key, or any vendor field (strict objects reject them).
 */
export interface CredentialAssertion {
  readonly schemaVersion: typeof IDENTITY_RECORD_VERSION;
  /** Opaque assertion identifier (for evidence addressing). */
  readonly assertionId: MessageId;
  readonly principalId: PrincipalId;
  /** The neutral mechanism class claimed (shared-secret, asymmetric-key, ...). */
  readonly mechanism: CredentialMechanism;
  /** When the assertion was made (canonical UTC form, caller-supplied). */
  readonly assertedAt: Timestamp;
  /** Audit note (never a secret). */
  readonly note?: string | undefined;
}

/**
 * An authentication-result record: the typed outcome of judging one
 * credential assertion — `verified` (no reason) or `failed` (exactly one
 * typed reason). Authentication is a RESULT, not a session and not an
 * authorization: it says nothing about WHERE the principal may act.
 */
export interface AuthenticationResult {
  readonly schemaVersion: typeof IDENTITY_RECORD_VERSION;
  /** Opaque result identifier (for evidence addressing). */
  readonly resultId: MessageId;
  /** The judged credential assertion. */
  readonly assertionId: MessageId;
  readonly principalId: PrincipalId;
  readonly outcome: 'verified' | 'failed';
  /** Exactly one typed reason when failed; forbidden when verified. */
  readonly reason?: AuthenticationFailureReason | undefined;
  /** When the outcome was decided (canonical UTC form, caller-supplied). */
  readonly decidedAt: Timestamp;
  /** Optional SHA-256 digest of supporting evidence (e.g. an audit trail). */
  readonly evidenceDigest?: Sha256Hex | undefined;
}

/**
 * The published authentication-result record: the result content plus the
 * SHA-256 digest of that content (the exact-revision address —
 * authentication results are evidence, R5/R17).
 */
export interface AuthenticationResultRecord {
  readonly schemaVersion: typeof IDENTITY_RECORD_VERSION;
  readonly result: AuthenticationResult;
  readonly resultDigest: Sha256Hex;
}

/**
 * An authentication envelope: the result plus the digest CLAIMED for its
 * content. The registry recomputes and rejects mismatches
 * (`digest-mismatch`).
 */
export interface AuthenticationResultRegistration {
  readonly result: AuthenticationResult;
  readonly digest: Sha256Hex;
}

/** Issue codes reported by the identity total entry points. */
export interface IdentityIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * The typed identity error taxonomy. Every entry point is total — errors
 * are values, never thrown.
 */
export type IdentityErrorCode =
  | 'validation'
  | 'unknown-principal'
  | 'duplicate-principal'
  | 'lifecycle-conflict'
  | 'digest-mismatch';

/** The typed identity error taxonomy (values, never thrown). */
export type IdentityError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly IdentityIssue[];
    }
  | {
      readonly code: 'unknown-principal';
      readonly message: string;
      readonly principalId: PrincipalId;
    }
  | {
      readonly code: 'duplicate-principal';
      readonly message: string;
      readonly principalId: PrincipalId;
    }
  | {
      readonly code: 'lifecycle-conflict';
      readonly message: string;
      readonly principalId: PrincipalId;
      readonly from: PrincipalLifecycleState;
      readonly to: PrincipalLifecycleState;
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: Sha256Hex;
      readonly encountered: Sha256Hex;
    };

/** Result of an identity operation: a value or a typed error. */
export type IdentityResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: IdentityError };
