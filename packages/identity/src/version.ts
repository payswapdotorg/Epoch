/**
 * Identity contract versions and closed vocabularies.
 *
 * architecture lock rule 13 + the W009 Tech Lead pins: identity is
 * PROVIDER-NEUTRAL by construction — principals, credential assertions,
 * and authentication results are typed data. ZERO concrete
 * IdPs/OAuth vendors/OIDC clients (those are future adapters behind the
 * Capability Fabric); no vendor/model/API tokens anywhere in contracts;
 * zero network; zero secrets storage.
 *
 * Versioning policy (v1, mirrors @epoch/capability-registry): a
 * serialized identity record is admitted only when its `schemaVersion`
 * equals {@link IDENTITY_RECORD_VERSION} exactly; {@link
 * IDENTITY_CONTRACT_VERSION} versions the published contract surface
 * (`schemas/` + the typed index export).
 */

/** Version of the published identity contract surface (schemas/ + types). */
export const IDENTITY_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized identity record. */
export const IDENTITY_RECORD_VERSION = 1 as const;

/**
 * Principal kinds: who can be an authenticated principal. `agent` covers
 * the registered autonomous participants of R2 (AI, solver, robot — the
 * agent-protocol registration distinguishes further); `service` covers
 * machine clients. The vocabulary names participant CLASSES, never
 * vendors or products.
 */
export const PRINCIPAL_KINDS = ['human', 'agent', 'service'] as const;

/** One principal kind. */
export type PrincipalKind = (typeof PRINCIPAL_KINDS)[number];

/**
 * Principal lifecycle states (typed transitions; the W007 capability
 * lifecycle discipline):
 *
 * - `active` — admitted; may authenticate and act.
 * - `suspended` — ADVISORY hold: authentication attempts fail with the
 *   typed `inactive-principal` reason while suspended.
 * - `deactivated` — terminal: the principal no longer exists operationally.
 *
 * No revival (`* -> active` is illegal): a deactivated principal that must
 * return does so as a NEW principal with a NEW id.
 */
export const PRINCIPAL_LIFECYCLE_STATES = ['active', 'suspended', 'deactivated'] as const;

/** One principal lifecycle state. */
export type PrincipalLifecycleState = (typeof PRINCIPAL_LIFECYCLE_STATES)[number];

/** The legal principal lifecycle transition table (forward-only). */
export const PRINCIPAL_LIFECYCLE_TRANSITIONS: Readonly<
  Record<PrincipalLifecycleState, readonly PrincipalLifecycleState[]>
> = {
  active: ['suspended', 'deactivated'],
  suspended: ['deactivated'],
  deactivated: [],
};

/**
 * Credential MECHANISM classes: what kind of credential a presenter
 * claimed to hold. The vocabulary names neutral mechanism classes — a
 * future OIDC/OAuth/SAML adapter maps its vendor flow onto
 * `signed-assertion` or `one-time-token`; the vendor never enters the
 * contract. No secret values are ever stored — only the mechanism class.
 */
export const CREDENTIAL_MECHANISMS = [
  'shared-secret',
  'asymmetric-key',
  'signed-assertion',
  'one-time-token',
  'biometric',
] as const;

/** One credential mechanism class. */
export type CredentialMechanism = (typeof CREDENTIAL_MECHANISMS)[number];

/**
 * Typed authentication-failure reasons. A FAILED result carries exactly
 * one of these; a VERIFIED result carries none (the mechanism lives on
 * the credential assertion, not the outcome).
 */
export const AUTHENTICATION_FAILURE_REASONS = [
  'invalid-credential',
  'expired-credential',
  'revoked-credential',
  'malformed-assertion',
  'challenge-mismatch',
  'unknown-principal',
  'inactive-principal',
] as const;

/** One typed authentication-failure reason. */
export type AuthenticationFailureReason = (typeof AUTHENTICATION_FAILURE_REASONS)[number];

/**
 * Principal ids are opaque, prefixed slugs (`principal:ada`), mirroring
 * the agent-protocol `agent:<slug>` discipline: the id names the
 * principal without embedding anything about providers, tenants, or
 * credentials. Identity != tenancy (lock rule 12): a principal id never
 * encodes a tenant.
 */
export const PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;
