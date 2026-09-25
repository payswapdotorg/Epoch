/**
 * The identity schema surface registry: every data type published at the
 * `@epoch/identity` ownership boundary, paired with its zod schema (W009
 * publishes its versioned contract surface inside the package, following
 * the W007/W008 conventions; see src/contract-emission.ts and
 * test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
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
  Sha256DigestSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the identity contract v1. */
export const IDENTITY_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'AuthenticationReason', schema: AuthenticationReasonSchema },
  { type: 'AuthenticationReasonCode', schema: AuthenticationReasonCodeSchema },
  { type: 'AuthenticationResult', schema: AuthenticationResultSchema },
  { type: 'CredentialAssertion', schema: CredentialAssertionSchema },
  { type: 'CredentialMethod', schema: CredentialMethodSchema },
  { type: 'IdentityRecordVersion', schema: IdentityRecordVersionSchema },
  { type: 'Principal', schema: PrincipalSchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'PrincipalKind', schema: PrincipalKindSchema },
  { type: 'PrincipalLifecycleState', schema: PrincipalLifecycleStateSchema },
  { type: 'SealedAuthenticationResult', schema: SealedAuthenticationResultSchema },
  { type: 'SealedCredentialAssertion', schema: SealedCredentialAssertionSchema },
  { type: 'Sha256Digest', schema: Sha256DigestSchema },
];
