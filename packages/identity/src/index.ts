/**
 * @epoch/identity — public API (kernel layer, Work Order W009).
 *
 * Provider-neutral principal modeling (architecture.md, binding):
 * "Identity != tenancy != authorization != policy" — identity owns
 * principals, credential-assertion descriptors, and authentication
 * RESULTS as typed data.
 *
 * - ZERO concrete IdPs/OAuth vendors/OIDC clients (lock rule 13): those
 *   are future adapters behind the Capability Fabric; the credential
 *   vocabulary names neutral MECHANISM CLASSES, never vendors.
 * - ZERO network, ZERO secrets storage: assertions are descriptors, not
 *   secret material; strict objects reject secret-shaped fields.
 * - Authentication is a RESULT, not a session and not an authorization:
 *   it says nothing about WHERE a principal may act (that is
 *   @epoch/authorization's decision point, fed by tenancy facts).
 * - Reference in-memory registry: NO persistence, NO event log, NO UI,
 *   NO clocks (timestamps are caller-supplied canonical UTC instants).
 *
 * Versioned contract surface: version constants + typed index export
 * (this file), runtime zod validators (src/schema.ts), compile-time
 * parity (src/parity.ts), and the committed JSON Schema projection under
 * schemas/ pinned by test/contract-drift.test.ts.
 */

// Version + vocabularies.
export {
  AUTHENTICATION_FAILURE_REASONS,
  CREDENTIAL_MECHANISMS,
  IDENTITY_CONTRACT_VERSION,
  IDENTITY_RECORD_VERSION,
  PRINCIPAL_ID_PATTERN,
  PRINCIPAL_KINDS,
  PRINCIPAL_LIFECYCLE_STATES,
  PRINCIPAL_LIFECYCLE_TRANSITIONS,
} from './version';

// Published contract types.
export type {
  AuthenticationFailureReason,
  AuthenticationResult,
  AuthenticationResultRecord,
  AuthenticationResultRegistration,
  CredentialAssertion,
  CredentialMechanism,
  IdentityError,
  IdentityErrorCode,
  IdentityIssue,
  IdentityResult,
  Principal,
  PrincipalId,
  PrincipalKind,
  PrincipalLifecycleState,
  PrincipalRecord,
  PrincipalRegistration,
} from './types';

// Runtime validators.
export {
  SHA256_HEX_PATTERN,
  AuthenticationFailureReasonSchema,
  AuthenticationResultRecordSchema,
  AuthenticationResultSchema,
  CredentialAssertionSchema,
  CredentialMechanismSchema,
  IdentityRecordVersionSchema,
  PrincipalIdSchema,
  PrincipalKindSchema,
  PrincipalLifecycleStateSchema,
  PrincipalRecordSchema,
  PrincipalSchema,
  Sha256DigestSchema,
} from './schema';

// Total parse surface.
export {
  parseAuthenticationResult,
  parseAuthenticationResultRecord,
  parseCredentialAssertion,
  parsePrincipal,
  parsePrincipalRecord,
} from './parse';

// Digest discipline (canonical SHA-256 content addressing + tamper detection).
export {
  authenticationResultRecordFor,
  computeAuthenticationResultDigest,
  computePrincipalDigest,
  sealAuthenticationResult,
  sealPrincipal,
  verifyAuthenticationResultDigest,
  verifyPrincipalDigest,
} from './digest';

// The reference in-memory identity registry.
export { IdentityRegistry, type ListPrincipalsFilter } from './registry';

// Compile-time contract parity (type-only).
export type { IdentityLiteralSync, IdentityResultSync, IdentitySchemaSync } from './parity';

// Published schema surface + contract emission.
export { IDENTITY_SCHEMA_SURFACE, type SchemaSurfaceEntry } from './surface';
export {
  IDENTITY_CONTRACT_DIR,
  renderIdentityContractFiles,
  typeToKebabCase,
} from './contract-emission';
