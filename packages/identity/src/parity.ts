/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W009 identity
 * contract guarantee; the JSON-Schema half is
 * test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type {
  AuthenticationReason,
  AuthenticationResult,
  CredentialAssertion,
  IdentityError,
  IdentityIssue,
  IdentityResult,
  Principal,
  PrincipalId,
  SealedAuthenticationResult,
  SealedCredentialAssertion,
  VerifiedPrincipal,
} from './types';
import type {
  AuthenticationReasonCodeSchema,
  AuthenticationReasonSchema,
  AuthenticationResultSchema,
  CredentialAssertionSchema,
  CredentialMethodSchema,
  IdentityRecordVersionSchema,
  PrincipalIdSchema,
  PrincipalKindSchema,
  PrincipalLifecycleStateSchema,
  PrincipalSchema,
  SealedAuthenticationResultSchema,
  SealedCredentialAssertionSchema,
} from './schema';
import type { IDENTITY_RECORD_VERSION } from './version';

export type IdentitySchemaSync = [
  Expect<
    Equals<z.infer<typeof IdentityRecordVersionSchema>, typeof IDENTITY_RECORD_VERSION>
  >,
  Expect<Equals<z.infer<typeof PrincipalIdSchema>, PrincipalId>>,
  Expect<Equals<z.infer<typeof PrincipalKindSchema>, Principal['kind']>>,
  Expect<Equals<z.infer<typeof PrincipalLifecycleStateSchema>, Principal['status']>>,
  Expect<Equals<z.infer<typeof PrincipalSchema>, Principal>>,
  Expect<Equals<z.infer<typeof CredentialMethodSchema>, CredentialAssertion['method']>>,
  Expect<Equals<z.infer<typeof CredentialAssertionSchema>, CredentialAssertion>>,
  Expect<Equals<z.infer<typeof AuthenticationReasonCodeSchema>, AuthenticationReason['code']>>,
  Expect<Equals<z.infer<typeof AuthenticationReasonSchema>, AuthenticationReason>>,
  Expect<Equals<z.infer<typeof AuthenticationResultSchema>, AuthenticationResult>>,
  Expect<Equals<z.infer<typeof SealedCredentialAssertionSchema>, SealedCredentialAssertion>>,
  Expect<
    Equals<z.infer<typeof SealedAuthenticationResultSchema>, SealedAuthenticationResult>
  >,
];

/** Result/error surface shape sanity. */
export type IdentityResultSync = [
  Expect<Equals<IdentityIssue, { readonly path: string; readonly message: string }>>,
  Expect<
    Equals<
      IdentityError['code'],
      | 'validation'
      | 'unknown-principal'
      | 'duplicate-principal'
      | 'lifecycle-conflict'
      | 'authentication-failed'
      | 'principal-inactive'
      | 'digest-mismatch'
    >
  >,
  Expect<
    Equals<
      IdentityResult<string>,
      | { readonly ok: true; readonly value: string }
      | { readonly ok: false; readonly error: IdentityError }
    >
  >,
  Expect<Equals<VerifiedPrincipal['principalId'], PrincipalId>>,
];
