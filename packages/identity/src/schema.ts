/**
 * @epoch/identity — runtime zod validators for the published contract
 * types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * vendor/provider semantics AND secret material (token values, keys,
 * passwords) cannot enter kernel identity types through the contract
 * door (same policy as the W002-W008 validators). Every exported schema
 * is part of the published surface emitted under `schemas/`.
 */
import { z } from 'zod';
import { MessageIdSchema, TimestampSchema } from '@epoch/agent-protocol';
import {
  AUTHENTICATION_FAILURE_REASONS,
  CREDENTIAL_MECHANISMS,
  IDENTITY_RECORD_VERSION,
  PRINCIPAL_KINDS,
  PRINCIPAL_LIFECYCLE_STATES,
  PRINCIPAL_ID_PATTERN,
} from './version';

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Version discriminator on serialized identity records (v1). */
export const IdentityRecordVersionSchema = z.literal(IDENTITY_RECORD_VERSION).meta({
  id: 'IdentityRecordVersion',
  title: 'IdentityRecordVersion',
  description:
    'Version discriminator carried by every serialized identity record (currently 1).',
});

/** Principal kinds (participant classes, never vendors). */
export const PrincipalKindSchema = z.enum(PRINCIPAL_KINDS).meta({
  id: 'PrincipalKind',
  title: 'PrincipalKind',
  description: 'Principal kind: human, agent (registered autonomous participant), or service (machine client).',
});

/** Principal lifecycle states. */
export const PrincipalLifecycleStateSchema = z
  .enum(PRINCIPAL_LIFECYCLE_STATES)
  .meta({
    id: 'PrincipalLifecycleState',
    title: 'PrincipalLifecycleState',
    description:
      'Principal lifecycle: active, suspended (advisory hold — authentication fails inactive-principal), or deactivated (terminal).',
  });

/** Credential mechanism classes (neutral; vendors are future adapters). */
export const CredentialMechanismSchema = z.enum(CREDENTIAL_MECHANISMS).meta({
  id: 'CredentialMechanism',
  title: 'CredentialMechanism',
  description:
    'Neutral credential mechanism class: shared-secret, asymmetric-key, signed-assertion, one-time-token, or biometric. Never a vendor and never a secret value.',
});

/** Typed authentication-failure reasons. */
export const AuthenticationFailureReasonSchema = z
  .enum(AUTHENTICATION_FAILURE_REASONS)
  .meta({
    id: 'AuthenticationFailureReason',
    title: 'AuthenticationFailureReason',
    description:
      'Typed failure reason carried by failed authentication results: invalid/expired/revoked credential, malformed assertion, challenge mismatch, unknown principal, or inactive principal.',
  });

/** Opaque, prefixed principal identity. */
export const PrincipalIdSchema = z
  .string()
  .regex(PRINCIPAL_ID_PATTERN, 'must be a principal id of the form "principal:<slug>"')
  .meta({
    id: 'PrincipalId',
    title: 'PrincipalId',
    description:
      'Opaque, prefixed principal identity: "principal:" followed by a lowercase slug. Never encodes a tenant, provider, or credential.',
  });

/** SHA-256 digest as lowercase hex. */
export const Sha256DigestSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'Sha256Digest',
    title: 'Sha256Digest',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/** A principal (the digested identity content). */
export const PrincipalSchema = z
  .strictObject({
    schemaVersion: IdentityRecordVersionSchema,
    principalId: PrincipalIdSchema,
    kind: PrincipalKindSchema,
    displayName: z.string().min(1).max(200),
    description: z.string().min(1).max(4000).optional(),
  })
  .readonly()
  .meta({
    id: 'Principal',
    title: 'Principal',
    description:
      'Immutable, content-addressed principal: opaque id, participant kind, display name. Carries no tenant, no membership, and no credential material.',
  });

/** The published principal record: principal + lifecycle + content address. */
export const PrincipalRecordSchema = z
  .strictObject({
    schemaVersion: IdentityRecordVersionSchema,
    principal: PrincipalSchema,
    lifecycle: PrincipalLifecycleStateSchema,
    principalDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'PrincipalRecord',
    title: 'PrincipalRecord',
    description:
      'Published principal record: the immutable principal content, its lifecycle state, and the SHA-256 digest of the content.',
  });

/**
 * A credential-assertion descriptor. Strict objects reject unknown
 * fields, so secret material (token values, keys, passwords) can never
 * enter a stored assertion.
 */
export const CredentialAssertionSchema = z
  .strictObject({
    schemaVersion: IdentityRecordVersionSchema,
    assertionId: MessageIdSchema,
    principalId: PrincipalIdSchema,
    mechanism: CredentialMechanismSchema,
    assertedAt: TimestampSchema,
    note: z.string().min(1).max(2000).optional(),
  })
  .readonly()
  .meta({
    id: 'CredentialAssertion',
    title: 'CredentialAssertion',
    description:
      'Provider-neutral credential-assertion descriptor: what a presenter claimed to hold (mechanism class, moment, audit note). Never a secret, never a vendor.',
  });

/**
 * An authentication result. Runtime refinement (not representable in the
 * structural JSON Schema projection): a failed result carries exactly one
 * typed reason; a verified result carries none.
 */
export const AuthenticationResultSchema = z
  .strictObject({
    schemaVersion: IdentityRecordVersionSchema,
    resultId: MessageIdSchema,
    assertionId: MessageIdSchema,
    principalId: PrincipalIdSchema,
    outcome: z.enum(['verified', 'failed']),
    reason: AuthenticationFailureReasonSchema.optional(),
    decidedAt: TimestampSchema,
    evidenceDigest: Sha256DigestSchema.optional(),
  })
  .readonly()
  .refine(
    (result) =>
      result.outcome === 'failed'
        ? result.reason !== undefined
        : result.reason === undefined,
    'failed authentication results carry exactly one typed reason; verified results carry none',
  )
  .meta({
    id: 'AuthenticationResult',
    title: 'AuthenticationResult',
    description:
      'Typed authentication outcome for one credential assertion: verified (no reason) or failed (exactly one typed reason). A result, not a session and not an authorization.',
  });

/** The published authentication-result record: result + content address. */
export const AuthenticationResultRecordSchema = z
  .strictObject({
    schemaVersion: IdentityRecordVersionSchema,
    result: AuthenticationResultSchema,
    resultDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'AuthenticationResultRecord',
    title: 'AuthenticationResultRecord',
    description:
      'Published authentication-result record: the typed outcome plus the SHA-256 digest of its content (the exact-revision address — authentication results are evidence).',
  });
