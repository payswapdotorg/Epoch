/**
 * @epoch/identity — runtime zod validators for the published contract
 * types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics (vendor, issuer, endpoint, token fields)
 * cannot enter kernel types through the identity door. The credential
 * assertion carries a factor-class method ONLY — no credential material.
 */
import { z } from 'zod';
import { MessageIdSchema, TimestampSchema } from '@epoch/agent-protocol';
import {
  AUTHENTICATION_REASON_CODES,
  CREDENTIAL_METHODS,
  IDENTITY_RECORD_VERSION,
  PRINCIPAL_KINDS,
  PRINCIPAL_LIFECYCLE_STATES,
} from './version';

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Opaque principal identity: `principal:` + lowercase slug. */
export const PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/** SHA-256 digest as lowercase hex. */
export const Sha256DigestSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'Sha256Digest',
    title: 'Sha256Digest',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/** Version discriminator on serialized identity documents (v1). */
export const IdentityRecordVersionSchema = z
  .literal(IDENTITY_RECORD_VERSION)
  .meta({
    id: 'IdentityRecordVersion',
    title: 'IdentityRecordVersion',
    description: 'Version discriminator carried by every serialized identity document (currently 1).',
  });

/** Opaque principal identity. */
export const PrincipalIdSchema = z
  .string()
  .regex(PRINCIPAL_ID_PATTERN, 'must be a principal id: "principal:" + lowercase slug')
  .meta({
    id: 'PrincipalId',
    title: 'PrincipalId',
    description:
      'Opaque principal identity: "principal:" followed by a lowercase slug; the single source of principal identity.',
  });

/** Principal kinds (R2 vocabulary + service principals). */
export const PrincipalKindSchema = z.enum(PRINCIPAL_KINDS).meta({
  id: 'PrincipalKind',
  title: 'PrincipalKind',
  description:
    'Principal class: human, agent, solver, robot, or service — never a vendor, product, or model.',
});

/** Principal lifecycle states. */
export const PrincipalLifecycleStateSchema = z
  .enum(PRINCIPAL_LIFECYCLE_STATES)
  .meta({
    id: 'PrincipalLifecycleState',
    title: 'PrincipalLifecycleState',
    description:
      'Principal lifecycle: active (eligible to authenticate), suspended (temporarily barred, reversible), or disabled (barred, retained for audit).',
  });

/** Credential method classes (the provider-neutral factor taxonomy). */
export const CredentialMethodSchema = z.enum(CREDENTIAL_METHODS).meta({
  id: 'CredentialMethod',
  title: 'CredentialMethod',
  description:
    'Credential method class: knowledge, possession, inherence, signature, or attestation — names the factor kind, never the vendor that issued or verified it.',
});

/** One typed authentication reason code. */
export const AuthenticationReasonCodeSchema = z
  .enum(AUTHENTICATION_REASON_CODES)
  .meta({
    id: 'AuthenticationReasonCode',
    title: 'AuthenticationReasonCode',
    description:
      'Typed authentication reason: credential-verified, credential-invalid, credential-expired, principal-unknown, or principal-inactive.',
  });

/**
 * A registered principal. Runtime refinement (not representable in the
 * structural JSON Schema projection): a `disabled` or `suspended`
 * principal never authenticates — enforced by
 * `PrincipalDirectory.verifyAuthentication`, not by the document shape.
 */
export const PrincipalSchema = z
  .strictObject({
    schemaVersion: IdentityRecordVersionSchema,
    principalId: PrincipalIdSchema,
    kind: PrincipalKindSchema,
    status: PrincipalLifecycleStateSchema,
    displayName: z.string().min(1).max(256),
    description: z.string().max(4000).optional(),
  })
  .readonly()
  .meta({
    id: 'Principal',
    title: 'Principal',
    description:
      'A registered principal: typed id, class, lifecycle status, display label — no credential material, no tenancy membership, no provider fields.',
  });

/** One typed authentication reason (closed code + bounded detail). */
export const AuthenticationReasonSchema = z
  .strictObject({
    code: AuthenticationReasonCodeSchema,
    detail: z.string().min(1).max(2000).optional(),
  })
  .readonly()
  .meta({
    id: 'AuthenticationReason',
    title: 'AuthenticationReason',
    description: 'Typed authentication reason: a closed code plus optional bounded auditable detail.',
  });

/** A credential-assertion descriptor (NO credential material). */
export const CredentialAssertionSchema = z
  .strictObject({
    schemaVersion: IdentityRecordVersionSchema,
    assertionId: MessageIdSchema,
    principalId: PrincipalIdSchema,
    method: CredentialMethodSchema,
    assertedAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'CredentialAssertion',
    title: 'CredentialAssertion',
    description:
      'Descriptor of a credential assertion: which principal asserted which factor-class method, when — carries no secret, token, or proof value.',
  });

/**
 * A typed authentication result. Runtime refinement (reported at path
 * ["reasons"]): a `failed` outcome must carry at least one reason
 * (auditability — R17).
 */
export const AuthenticationResultSchema = z
  .strictObject({
    schemaVersion: IdentityRecordVersionSchema,
    resultId: MessageIdSchema,
    assertionId: MessageIdSchema,
    principalId: PrincipalIdSchema,
    outcome: z.enum(['verified', 'failed']),
    verifiedAt: TimestampSchema,
    reasons: z.array(AuthenticationReasonSchema).readonly(),
  })
  .readonly()
  .refine(
    (result) => result.outcome === 'verified' || result.reasons.length >= 1,
    {
      error: 'a failed authentication result must carry at least one typed reason',
      path: ['reasons'],
    },
  )
  .meta({
    id: 'AuthenticationResult',
    title: 'AuthenticationResult',
    description:
      'Typed verification outcome for one credential assertion: verified or failed, with typed reasons (at least one on failure).',
  });

/** A sealed credential assertion (assertion + claimed digest). */
export const SealedCredentialAssertionSchema = z
  .strictObject({
    assertion: CredentialAssertionSchema,
    digest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'SealedCredentialAssertion',
    title: 'SealedCredentialAssertion',
    description:
      'A credential-assertion descriptor plus the SHA-256 digest claimed for its canonical JSON content; admission recomputes and rejects mismatches (tamper detection).',
  });

/** A sealed authentication result (result + claimed digest). */
export const SealedAuthenticationResultSchema = z
  .strictObject({
    result: AuthenticationResultSchema,
    digest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'SealedAuthenticationResult',
    title: 'SealedAuthenticationResult',
    description:
      'An authentication-result record plus the SHA-256 digest claimed for its canonical JSON content; authentication results are audit-grade, exact-revision evidence.',
  });
