/**
 * @epoch/client-runtime — the client session reference model.
 *
 * The SESSION STATE (issue/expiry/revocation) is owned by
 * `@epoch/authentication` (the W046 auth/session seam over the W009
 * identity/tenancy kernels); this module publishes the CLIENT-FACING
 * session types and the pure lifecycle predicates the shared runtime and
 * all three clients switch on. A session is a projection of an
 * authentication result into a tenant-scoped acting context — never an
 * authorization (lock rule 12: authorization decisions are
 * @epoch/authorization's, always evaluated per call).
 */
import { z } from 'zod';
import { PrincipalIdSchema } from '@epoch/identity';
import { ProjectIdSchema, TenantIdSchema, WorkspaceIdSchema } from '@epoch/tenancy';
import { TimestampSchema } from '@epoch/agent-protocol';
import { CLIENT_RUNTIME_RECORD_VERSION, SESSION_ID_PATTERN } from './version';

/** Session lifecycle states (the session seam owns transitions). */
export const CLIENT_SESSION_STATES = ['active', 'expired', 'revoked'] as const;

/** One session lifecycle state. */
export type ClientSessionState = (typeof CLIENT_SESSION_STATES)[number];

export const ClientSessionStateSchema = z
  .enum(CLIENT_SESSION_STATES)
  .meta({ id: 'ClientSessionState', title: 'ClientSessionState' });

export const SessionIdSchema = z
  .string()
  .regex(SESSION_ID_PATTERN, 'must be a session id of the form "session:<slug>"')
  .meta({ id: 'SessionId', title: 'SessionId' });

/**
 * The client session record: WHO is acting (principal), in WHICH tenant
 * scope, since/until when, and in which state. Expiry is evaluated against
 * caller-supplied instants (determinism: no wall clocks).
 */
export interface ClientSession {
  readonly schemaVersion: typeof CLIENT_RUNTIME_RECORD_VERSION;
  readonly sessionId: string;
  readonly principalId: string;
  readonly tenantId: string;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly state: 'active' | 'expired' | 'revoked';
}

export const ClientSessionSchema = z
  .strictObject({
    schemaVersion: z.literal(CLIENT_RUNTIME_RECORD_VERSION),
    sessionId: SessionIdSchema,
    principalId: PrincipalIdSchema,
    tenantId: TenantIdSchema,
    workspaceId: WorkspaceIdSchema.optional(),
    projectId: ProjectIdSchema.optional(),
    issuedAt: TimestampSchema,
    expiresAt: TimestampSchema,
    state: ClientSessionStateSchema,
  })
  .readonly()
  .meta({ id: 'ClientSession', title: 'ClientSession' });

/** The minimal session reference carried by every gateway request. */
export interface SessionRef {
  readonly schemaVersion: typeof CLIENT_RUNTIME_RECORD_VERSION;
  readonly sessionId: string;
}

export const SessionRefSchema = z
  .strictObject({
    schemaVersion: z.literal(CLIENT_RUNTIME_RECORD_VERSION),
    sessionId: SessionIdSchema,
  })
  .readonly()
  .meta({ id: 'SessionRef', title: 'SessionRef' });

/**
 * Pure lifecycle predicate: a session is usable at `at` iff it is active
 * (not revoked, not past expiry). Callers supply the instant — zero
 * wall-clock reads.
 */
export function isSessionUsable(session: ClientSession, at: string): boolean {
  return session.state === 'active' && session.expiresAt > at;
}

