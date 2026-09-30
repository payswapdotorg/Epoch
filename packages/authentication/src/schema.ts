/**
 * @epoch/authentication — runtime zod validators (the published session
 * surface; strict objects reject unknown/vendor fields, so secret-shaped
 * fields can never enter a stored session).
 */
import { z } from 'zod';
import { MessageIdSchema, TimestampSchema } from '@epoch/agent-protocol';
import { PrincipalIdSchema } from '@epoch/identity';
import { ProjectIdSchema, TenantIdSchema, WorkspaceIdSchema } from '@epoch/tenancy';
import {
  AUTHENTICATION_SEAM_RECORD_VERSION,
  SESSION_ERROR_CODES,
  SESSION_ID_PATTERN,
  SESSION_LIFECYCLE_STATES,
  SHA256_HEX_PATTERN,
} from './version';

export const SeamRecordVersionSchema = z
  .literal(AUTHENTICATION_SEAM_RECORD_VERSION)
  .meta({
    id: 'AuthenticationSeamRecordVersion',
    title: 'AuthenticationSeamRecordVersion',
    description: 'Version discriminator on serialized session records (currently 1).',
  });

export const SessionIdSchema = z
  .string()
  .regex(SESSION_ID_PATTERN, 'must be a session id of the form "session:<slug>"')
  .meta({ id: 'SessionId', title: 'SessionId' });

export const SeamSha256HexSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase-hex SHA-256 digest (64 chars)')
  .meta({ id: 'SeamSha256Hex', title: 'SeamSha256Hex' });

export const SessionLifecycleStateSchema = z
  .enum(SESSION_LIFECYCLE_STATES)
  .meta({ id: 'SessionLifecycleState', title: 'SessionLifecycleState' });

export const SessionErrorCodeSchema = z
  .enum(SESSION_ERROR_CODES)
  .meta({ id: 'SessionErrorCode', title: 'SessionErrorCode' });

export const SessionContentSchema = z
  .strictObject({
    schemaVersion: SeamRecordVersionSchema,
    sessionId: SessionIdSchema,
    principalId: PrincipalIdSchema,
    tenantId: TenantIdSchema,
    workspaceId: WorkspaceIdSchema.optional(),
    projectId: ProjectIdSchema.optional(),
    authenticationResultId: MessageIdSchema,
    authenticationResultDigest: SeamSha256HexSchema,
    issuedAt: TimestampSchema,
    expiresAt: TimestampSchema,
    nonce: z.string().min(1).max(128),
  })
  .readonly()
  .meta({
    id: 'SessionContent',
    title: 'SessionContent',
    description:
      'Immutable session content: principal + tenant scope projected from a verified W009 authentication result, validity window, caller-supplied derivation entropy.',
  });

export const SessionRecordSchema = z
  .strictObject({
    schemaVersion: SeamRecordVersionSchema,
    session: SessionContentSchema,
    lifecycle: SessionLifecycleStateSchema,
    sessionDigest: SeamSha256HexSchema,
    lifecycleChangedAt: TimestampSchema.nullable(),
  })
  .readonly()
  .meta({
    id: 'SessionRecord',
    title: 'SessionRecord',
    description:
      'Published session record: immutable content + lifecycle state + the content address (digest). Lifecycle transitions never rewrite the digest.',
  });

export const SessionRegistrationSchema = z
  .strictObject({
    session: SessionContentSchema,
    digest: SeamSha256HexSchema,
  })
  .readonly()
  .meta({ id: 'SessionRegistration', title: 'SessionRegistration' });
