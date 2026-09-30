/**
 * @epoch/authentication — the reference in-memory session manager.
 *
 * Owns session lifecycle ONLY: issue (from a VERIFIED W009
 * authentication result), validate (lifecycle evaluated against a
 * caller-supplied instant), revoke, bulk expiry, snapshot and
 * restore-from-durable-records. Authentication itself is
 * @epoch/identity's authority; authorization is @epoch/authorization's
 * (the propagation helper below NEVER decides).
 *
 * In-memory reference behavior: NO persistence (the service layer
 * mirrors records through the persistence SPI), NO network, NO clocks
 * (instants are caller-supplied), ZERO randomness (session ids are
 * content-addressed from caller-supplied entropy).
 */
import type { Timestamp } from '@epoch/agent-protocol';
import type { TenantId } from '@epoch/tenancy';
import type { SessionRecord, SessionIssueInput, SessionRegistration } from './types';
import { SessionRecordSchema } from './schema';
import {
  deriveSessionId,
  sealSession,
  sessionRecordFor,
  verifySessionDigest,
  verifySessionRecord,
} from './digest';
import { ok, fail, zodIssues } from './issues';
import type { SessionResult } from './version';

/** Options of the session manager. */
export interface SessionManagerOptions {
  /** Tenant this manager is scoped to; any other tenant is rejected (R12). */
  readonly expectedTenantId?: TenantId | undefined;
}

/** Add milliseconds to a canonical UTC instant (deterministic UTC math; toISOString always emits the canonical 3-digit-ms form). */
export function addMsToInstant(instant: string, ms: number): string {
  return new Date(new Date(instant).getTime() + ms).toISOString();
}

/** The reference session manager. */
export class SessionManager {
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(private readonly options: SessionManagerOptions = {}) {}

  /** Number of tracked sessions (all lifecycle states). */
  get size(): number {
    return this.sessions.size;
  }

  /**
   * Issue a session projected from a VERIFIED authentication result.
   * Fail-closed gates: the result must be `verified`; the principal must
   * match the result; the tenant scope must match the manager's
   * expectation; the expiry must be after issuance.
   */
  issueSession(input: SessionIssueInput): SessionResult<{ record: SessionRecord; registration: SessionRegistration }> {
    if (input.authentication.outcome !== 'verified') {
      return fail({
        code: 'authentication-not-verified',
        message: 'a session may only be issued from a VERIFIED authentication result',
      });
    }
    if (input.authentication.principalId !== input.principalId) {
      return fail({
        code: 'authentication-tenant-mismatch',
        message: 'the session principal must match the authenticated principal',
      });
    }
    if (this.options.expectedTenantId !== undefined && input.tenantId !== this.options.expectedTenantId) {
      return fail({
        code: 'tenant-isolation-rejected',
        message: `the session manager is scoped to tenant "${this.options.expectedTenantId}" (R12)`,
      });
    }
    if (!(input.ttlMs > 0) || !Number.isSafeInteger(input.ttlMs)) {
      return fail({
        code: 'validation',
        message: 'ttlMs must be a positive safe integer',
      });
    }
    const sessionId = deriveSessionId({
      principalId: input.principalId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      authenticationResultId: input.authentication.resultId,
      issuedAt: input.issuedAt,
      nonce: input.nonce,
    });
    const expiresAt = addMsToInstant(input.issuedAt, input.ttlMs);
    if (expiresAt <= input.issuedAt) {
      return fail({ code: 'expiry-before-issue', message: 'the derived expiry must be after issuance' });
    }
    const sealed = sealSession({
      schemaVersion: 1,
      sessionId,
      principalId: input.principalId,
      tenantId: input.tenantId,
      ...(input.workspaceId !== undefined ? { workspaceId: input.workspaceId } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      authenticationResultId: input.authentication.resultId,
      authenticationResultDigest: input.authentication.resultDigest,
      issuedAt: input.issuedAt,
      expiresAt,
      nonce: input.nonce,
    });
    if (!sealed.ok) return sealed;
    if (this.sessions.has(sessionId)) {
      return fail({
        code: 'duplicate-session',
        message: `session "${sessionId}" already exists — session ids are unique forever`,
        sessionId,
      });
    }
    const record = sessionRecordFor(sealed.value.session);
    this.sessions.set(sessionId, record);
    return ok({ record, registration: sealed.value });
  }

  /**
   * Validate a session id at a caller-supplied instant: returns the
   * record with its lifecycle EVALUATED (an active session past expiry
   * transitions to `expired`). Unknown ids are the typed
   * `session-unknown` error.
   */
  validateSession(sessionId: string, at: Timestamp): SessionResult<SessionRecord> {
    const record = this.sessions.get(sessionId);
    if (record === undefined) {
      return fail({ code: 'session-unknown', message: `session "${sessionId}" is unknown`, sessionId });
    }
    const evaluated = this.evaluateLifecycle(record, at);
    return ok(evaluated);
  }

  /** Pure usability predicate over a record at an instant. */
  isUsable(record: SessionRecord, at: Timestamp): boolean {
    return record.lifecycle === 'active' && record.session.expiresAt > at;
  }

  /** Revoke a session (idempotent; unknown ids fail typed). */
  revokeSession(sessionId: string, at: Timestamp): SessionResult<SessionRecord> {
    const record = this.sessions.get(sessionId);
    if (record === undefined) {
      return fail({ code: 'session-unknown', message: `session "${sessionId}" is unknown`, sessionId });
    }
    if (record.lifecycle === 'revoked') return ok(record);
    const revoked: SessionRecord = { ...record, lifecycle: 'revoked', lifecycleChangedAt: at };
    this.sessions.set(sessionId, revoked);
    return ok(revoked);
  }

  /** Expire every active session whose expiry has passed at `at` (bulk). */
  expireSessions(at: Timestamp): readonly SessionRecord[] {
    const expired: SessionRecord[] = [];
    for (const [sessionId, record] of this.sessions) {
      if (record.lifecycle === 'active' && record.session.expiresAt <= at) {
        const expiredRecord: SessionRecord = { ...record, lifecycle: 'expired', lifecycleChangedAt: at };
        this.sessions.set(sessionId, expiredRecord);
        expired.push(expiredRecord);
      }
    }
    return expired.sort((a, b) => (a.session.sessionId < b.session.sessionId ? -1 : 1));
  }

  /**
   * Restore sessions from durable records (the persistence mirror): each
   * record is schema-validated and digest-verified; an invalid record
   * fails typed (fail-closed). Existing ids are kept as-is (first write
   * wins — restore is idempotent).
   */
  restoreSessions(records: readonly unknown[]): SessionResult<number> {
    let restored = 0;
    for (const candidate of records) {
      const parsed = SessionRecordSchema.safeParse(candidate);
      if (!parsed.success) {
        return fail({
          code: 'validation',
          message: 'a durable session record failed schema validation',
          issues: zodIssues(parsed.error),
        });
      }
      const verified = verifySessionRecord(parsed.data);
      if (!verified.ok) return verified;
      if (!this.sessions.has(parsed.data.session.sessionId)) {
        this.sessions.set(parsed.data.session.sessionId, parsed.data);
        restored += 1;
      }
    }
    return ok(restored);
  }

  /** Admit a sealed registration directly (the durable mirror path). */
  admitRegistration(registration: SessionRegistration): SessionResult<SessionRecord> {
    const verified = verifySessionDigest(registration);
    if (!verified.ok) return verified;
    if (this.options.expectedTenantId !== undefined && verified.value.tenantId !== this.options.expectedTenantId) {
      return fail({
        code: 'tenant-isolation-rejected',
        message: `the session manager is scoped to tenant "${this.options.expectedTenantId}" (R12)`,
        sessionId: verified.value.sessionId,
      });
    }
    if (this.sessions.has(verified.value.sessionId)) {
      return fail({
        code: 'duplicate-session',
        message: `session "${verified.value.sessionId}" already exists — session ids are unique forever`,
        sessionId: verified.value.sessionId,
      });
    }
    const record = sessionRecordFor(verified.value);
    this.sessions.set(verified.value.sessionId, record);
    return ok(record);
  }

  /** Deterministic snapshot (sorted by sessionId). */
  snapshot(): readonly SessionRecord[] {
    return [...this.sessions.values()].sort((a, b) =>
      a.session.sessionId < b.session.sessionId ? -1 : 1,
    );
  }

  /** Evaluate + persist the lifecycle transition for an instant. */
  private evaluateLifecycle(record: SessionRecord, at: Timestamp): SessionRecord {
    if (record.lifecycle === 'active' && record.session.expiresAt <= at) {
      const expired: SessionRecord = { ...record, lifecycle: 'expired', lifecycleChangedAt: at };
      this.sessions.set(record.session.sessionId, expired);
      return expired;
    }
    return record;
  }
}
