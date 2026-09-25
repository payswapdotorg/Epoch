/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W009 identity
 * contract guarantee; the JSON-Schema half is test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type {
  AuthenticationFailureReason,
  AuthenticationResult,
  AuthenticationResultRecord,
  CredentialAssertion,
  CredentialMechanism,
  IdentityIssue,
  Principal,
  PrincipalKind,
  PrincipalLifecycleState,
  PrincipalRecord,
} from './types';
import type {
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
import type { MessageId, Sha256Hex, Timestamp } from '@epoch/agent-protocol';

export type IdentitySchemaSync = [
  Expect<Equals<z.infer<typeof IdentityRecordVersionSchema>, 1>>,
  Expect<Equals<z.infer<typeof PrincipalKindSchema>, PrincipalKind>>,
  Expect<Equals<z.infer<typeof PrincipalLifecycleStateSchema>, PrincipalLifecycleState>>,
  Expect<Equals<z.infer<typeof CredentialMechanismSchema>, CredentialMechanism>>,
  Expect<Equals<z.infer<typeof AuthenticationFailureReasonSchema>, AuthenticationFailureReason>>,
  Expect<Equals<z.infer<typeof PrincipalIdSchema>, string>>,
  Expect<Equals<z.infer<typeof PrincipalSchema>, Principal>>,
  Expect<Equals<z.infer<typeof PrincipalRecordSchema>, PrincipalRecord>>,
  Expect<Equals<z.infer<typeof CredentialAssertionSchema>, CredentialAssertion>>,
  Expect<Equals<z.infer<typeof AuthenticationResultSchema>, AuthenticationResult>>,
  Expect<Equals<z.infer<typeof AuthenticationResultRecordSchema>, AuthenticationResultRecord>>,
  Expect<Equals<z.infer<typeof Sha256DigestSchema>, Sha256Hex>>,
];

/** String-literal unions are additionally pinned member-for-member. */
export type IdentityLiteralSync = [
  Expect<Equals<PrincipalKind, 'human' | 'agent' | 'service'>>,
  Expect<Equals<PrincipalLifecycleState, 'active' | 'suspended' | 'deactivated'>>,
  Expect<
    Equals<
      CredentialMechanism,
      'shared-secret' | 'asymmetric-key' | 'signed-assertion' | 'one-time-token' | 'biometric'
    >
  >,
  Expect<
    Equals<
      AuthenticationFailureReason,
      | 'invalid-credential'
      | 'expired-credential'
      | 'revoked-credential'
      | 'malformed-assertion'
      | 'challenge-mismatch'
      | 'unknown-principal'
      | 'inactive-principal'
    >
  >,
];

/** Shared-primitive + result/error surface shape sanity. */
export type IdentityResultSync = [
  Expect<Equals<CredentialAssertion['assertionId'], MessageId>>,
  Expect<Equals<CredentialAssertion['assertedAt'], Timestamp>>,
  Expect<Equals<AuthenticationResult['resultId'], MessageId>>,
  Expect<Equals<IdentityIssue, { readonly path: string; readonly message: string }>>,
  Expect<Equals<PrincipalRecord['principalDigest'], Sha256Hex>>,
  Expect<Equals<AuthenticationResultRecord['resultDigest'], Sha256Hex>>,
];
