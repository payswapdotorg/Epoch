/**
 * The identity schema surface registry: every data type published at the
 * `@epoch/identity` ownership boundary, paired with its zod schema
 * (W009 publishes its versioned contract surface inside the package; see
 * src/contract-emission.ts and test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
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

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the identity contract v1. */
export const IDENTITY_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'AuthenticationFailureReason', schema: AuthenticationFailureReasonSchema },
  { type: 'AuthenticationResult', schema: AuthenticationResultSchema },
  { type: 'AuthenticationResultRecord', schema: AuthenticationResultRecordSchema },
  { type: 'CredentialAssertion', schema: CredentialAssertionSchema },
  { type: 'CredentialMechanism', schema: CredentialMechanismSchema },
  { type: 'IdentityRecordVersion', schema: IdentityRecordVersionSchema },
  { type: 'Principal', schema: PrincipalSchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'PrincipalKind', schema: PrincipalKindSchema },
  { type: 'PrincipalLifecycleState', schema: PrincipalLifecycleStateSchema },
  { type: 'PrincipalRecord', schema: PrincipalRecordSchema },
  { type: 'Sha256Digest', schema: Sha256DigestSchema },
];
