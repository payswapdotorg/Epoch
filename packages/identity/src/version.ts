/**
 * Identity contract versions and the closed principal vocabularies.
 *
 * Identity is provider-NEUTRAL by architecture lock rule 13: this
 * package models principals, credential assertions, and authentication
 * RESULTS as typed data. ZERO concrete IdPs, OAuth vendors, or OIDC
 * clients ship here — those are future adapters behind the capability
 * fabric (W029+). No vendor, model, or API tokens appear anywhere in
 * these contracts.
 *
 * Versioning policy (v1, mirrors @epoch/capability-registry): a
 * serialized identity document is admitted only when its `schemaVersion`
 * equals {@link IDENTITY_RECORD_VERSION} exactly; skew surfaces as a
 * typed `validation` issue at path ["schemaVersion"] before any other
 * schema diagnostics. {@link IDENTITY_CONTRACT_VERSION} versions the
 * published contract surface (`schemas/` + the typed index export).
 */

/** Version of the published identity contract surface (schemas/ + types). */
export const IDENTITY_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized identity document. */
export const IDENTITY_RECORD_VERSION = 1 as const;

/**
 * Principal kinds (requirements R2 — "mixed human/AI/solver/robot
 * agents" — plus the service principals that run Epoch's own gateways
 * and runtimes). A kind names a CLASS of principal, never a vendor,
 * product, or model.
 */
export const PRINCIPAL_KINDS = [
  'human',
  'agent',
  'solver',
  'robot',
  'service',
] as const;

/** One principal kind. */
export type PrincipalKind = (typeof PRINCIPAL_KINDS)[number];

/**
 * Principal lifecycle states:
 *
 * - `active` — registered and eligible to authenticate.
 * - `suspended` — temporarily barred (a returning principal is
 *   re-activated, so suspension is reversible).
 * - `disabled` — barred; the record is retained for audit.
 *
 * Unlike the W007 capability lifecycle (versioned artifacts, strictly
 * forward-only), principals are long-lived actors: `suspended -> active`
 * (re-activation) is legal, and a disabled principal that must return
 * authenticates only after an explicit `activate` transition — never by
 * silently editing the record.
 */
export const PRINCIPAL_LIFECYCLE_STATES = ['active', 'suspended', 'disabled'] as const;

/** One principal lifecycle state. */
export type PrincipalLifecycleState = (typeof PRINCIPAL_LIFECYCLE_STATES)[number];

/**
 * The legal principal lifecycle transition table. `active -> suspended`,
 * `active -> disabled`, `suspended -> active` (re-activation),
 * `suspended -> disabled`; `disabled -> active` requires an explicit
 * re-activation (audit trail), so it is legal too — but there are no
 * self-transitions and no state outside the table.
 */
export const PRINCIPAL_LIFECYCLE_TRANSITIONS: Readonly<
  Record<PrincipalLifecycleState, readonly PrincipalLifecycleState[]>
> = {
  active: ['suspended', 'disabled'],
  suspended: ['active', 'disabled'],
  disabled: ['active'],
};

/**
 * Credential method classes — the provider-neutral factor taxonomy.
 * A method names WHAT KIND of credential was asserted, never which
 * vendor issued or verified it: knowledge the principal holds, a
 * possession factor, an inherence (biometric) factor, a cryptographic
 * signature, or a third-party attestation. The assertion record never
 * carries the credential material itself (no secrets, no tokens).
 */
export const CREDENTIAL_METHODS = [
  'knowledge',
  'possession',
  'inherence',
  'signature',
  'attestation',
] as const;

/** One credential method class. */
export type CredentialMethod = (typeof CREDENTIAL_METHODS)[number];

/**
 * Typed authentication reason codes. Failures carry at least one;
 * verified results may carry zero (a clean verification) or explanatory
 * entries. The vocabulary is closed and provider-neutral:
 *
 * - `credential-verified` — the asserted credential verified.
 * - `credential-invalid` — the asserted credential did not verify.
 * - `credential-expired` — the credential was valid but expired.
 * - `principal-unknown` — the principal is not registered.
 * - `principal-inactive` — the principal is registered but not active.
 */
export const AUTHENTICATION_REASON_CODES = [
  'credential-verified',
  'credential-invalid',
  'credential-expired',
  'principal-unknown',
  'principal-inactive',
] as const;

/** One typed authentication reason code. */
export type AuthenticationReasonCode = (typeof AUTHENTICATION_REASON_CODES)[number];
