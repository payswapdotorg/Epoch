/**
 * @epoch/authentication — the published session-record types.
 *
 * The digest discipline mirrors @epoch/identity's PrincipalRecord: the
 * SESSION CONTENT is immutable and content-addressed; lifecycle
 * transitions (active -> expired / revoked) update only the undigested
 * `lifecycle` field, so a record's content address stays byte-stable for
 * the lifetime of the session.
 */
import type {
  PrincipalId,
} from '@epoch/identity';
import type {
  ProjectId,
  TenantId,
  WorkspaceId,
} from '@epoch/tenancy';
import type {
  MessageId,
  Sha256Hex,
  Timestamp,
} from '@epoch/agent-protocol';
import type { SessionId, SessionLifecycleState } from './version';

/**
 * The immutable session content: WHO (principal, projected from a
 * VERIFIED W009 authentication result), in WHICH tenant scope, valid
 * from/until when, derived from which exact authentication-result
 * revision. `nonce` is CALLER-SUPPLIED entropy for session-id
 * derivation — the kernel contributes zero randomness.
 */
export interface SessionContent {
  readonly schemaVersion: 1;
  readonly sessionId: SessionId;
  readonly principalId: PrincipalId;
  readonly tenantId: TenantId;
  readonly workspaceId?: WorkspaceId | undefined;
  readonly projectId?: ProjectId | undefined;
  /** The W009 authentication-result id this session projects. */
  readonly authenticationResultId: MessageId;
  /** The exact-revision content address of that authentication result. */
  readonly authenticationResultDigest: Sha256Hex;
  readonly issuedAt: Timestamp;
  readonly expiresAt: Timestamp;
  /** Caller-supplied derivation entropy (audit-visible, never a secret). */
  readonly nonce: string;
}

/**
 * The published session record: the immutable content, its lifecycle
 * state, and the SHA-256 digest of the content (the exact-revision
 * address). Lifecycle transitions never rewrite the digest.
 */
export interface SessionRecord {
  readonly schemaVersion: 1;
  readonly session: SessionContent;
  readonly lifecycle: SessionLifecycleState;
  /** SHA-256 of the session content's canonical JSON. */
  readonly sessionDigest: Sha256Hex;
  /** When the lifecycle last changed (canonical UTC; null until a transition). */
  readonly lifecycleChangedAt: Timestamp | null;
}

/** A registration envelope: the content plus the digest CLAIMED for it. */
export interface SessionRegistration {
  readonly session: SessionContent;
  readonly digest: Sha256Hex;
}

/** The input of `issueSession` (the caller supplies every field incl. entropy). */
export interface SessionIssueInput {
  /** The VERIFIED W009 authentication-result record being projected. */
  readonly authentication: {
    readonly resultId: MessageId;
    readonly resultDigest: Sha256Hex;
    readonly principalId: PrincipalId;
    readonly outcome: 'verified' | 'failed';
  };
  readonly principalId: PrincipalId;
  readonly tenantId: TenantId;
  readonly workspaceId?: WorkspaceId | undefined;
  readonly projectId?: ProjectId | undefined;
  readonly issuedAt: Timestamp;
  /** Positive session lifetime in milliseconds (caller-supplied). */
  readonly ttlMs: number;
  /** Caller-supplied derivation entropy. */
  readonly nonce: string;
}
