/**
 * @epoch/identity — public API (kernel layer, Work Order W009).
 *
 * Provider-neutral principal modeling (architecture.md, "Tenancy" /
 * lock rule 12: identity != tenancy != authorization != policy):
 * typed principals across the five principal kinds (human, agent,
 * solver, robot, service — R2 plus Epoch's own service principals),
 * typed principal ids, credential-assertion DESCRIPTORS over the
 * factor-class taxonomy (knowledge/possession/inherence/signature/
 * attestation), and authentication-RESULT records (verified/failed +
 * typed reasons).
 *
 * - ZERO concrete identity providers, OAuth vendors, or OIDC clients
 *   (lock rule 13 — those are future adapters behind the capability
 *   fabric); ZERO network; ZERO secrets storage — assertion records
 *   never carry credential material, only typed descriptors.
 * - Principals carry NO tenancy membership (identity != tenancy):
 *   membership facts are host-wired into @epoch/authorization's
 *   decision point — pinned by devDependency parity tests, never a
 *   runtime dependency.
 * - Security boundary: suspended and disabled principals NEVER
 *   authenticate (`PrincipalDirectory.verifyAuthentication` rejects
 *   them with typed `principal-inactive`, even on a verified result).
 * - Content addressing: credential assertions and authentication
 *   results are audit-grade evidence, sealed with the SHA-256 of their
 *   canonical JSON; admission REJECTS digest mismatches (tamper
 *   detection).
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/schema.ts), compile-time
 * parity (src/parity.ts), and the committed JSON Schema projection under
 * schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  AUTHENTICATION_REASON_CODES,
  CREDENTIAL_METHODS,
  IDENTITY_CONTRACT_VERSION,
  IDENTITY_RECORD_VERSION,
  PRINCIPAL_KINDS,
  PRINCIPAL_LIFECYCLE_STATES,
  PRINCIPAL_LIFECYCLE_TRANSITIONS,
} from './version';
export type {
  AuthenticationReasonCode,
  CredentialMethod,
  PrincipalKind,
  PrincipalLifecycleState,
} from './version';

// Published contract types.
export type {
  AuthenticationReason,
  AuthenticationResult,
  CredentialAssertion,
  IdentityError,
  IdentityErrorCode,
  IdentityIssue,
  IdentityResult,
  Principal,
  PrincipalId,
  SealedAuthenticationResult,
  SealedCredentialAssertion,
  VerifiedPrincipal,
} from './types';

// Runtime validators.
export {
  AuthenticationReasonCodeSchema,
  AuthenticationReasonSchema,
  AuthenticationResultSchema,
  CredentialAssertionSchema,
  CredentialMethodSchema,
  IdentityRecordVersionSchema,
  PRINCIPAL_ID_PATTERN,
  PrincipalIdSchema,
  PrincipalKindSchema,
  PrincipalLifecycleStateSchema,
  PrincipalSchema,
  SealedAuthenticationResultSchema,
  SealedCredentialAssertionSchema,
  SHA256_HEX_PATTERN,
  Sha256DigestSchema,
} from './schema';

// Total parse surface.
export {
  parseAuthenticationResult,
  parseCredentialAssertion,
  parsePrincipal,
  parseSealedAuthenticationResult,
  parseSealedCredentialAssertion,
} from './parse';

// Digest discipline (canonical SHA-256 content addressing + tamper detection).
export {
  computeAuthenticationResultDigest,
  computeCredentialAssertionDigest,
  sealAuthenticationResult,
  sealCredentialAssertion,
  verifyAuthenticationResultDigest,
  verifyCredentialAssertionDigest,
} from './digest';

// The reference in-memory principal directory.
export {
  PrincipalDirectory,
  type RegisterPrincipalInput,
} from './principal';

// Compile-time contract parity (type-only).
export type { IdentityResultSync, IdentitySchemaSync } from './parity';

// Published schema surface + contract emission.
export { IDENTITY_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  IDENTITY_CONTRACT_DIR,
  renderIdentityContractFiles,
  typeToKebabCase,
} from './contract-emission';
