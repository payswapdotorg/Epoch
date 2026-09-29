// The auth/session seam: issue/validate/expire/revoke/restore + the
// fail-closed authorization propagation (W046 acceptance: tenant-safe
// authorization propagation; auth-session-expired error class source).
import { describe, expect, it } from 'vitest';
import {
  SessionManager,
  addMsToInstant,
  authorizationRequestFor,
  deriveSessionId,
  evaluateAuthorization,
  sealSession,
  sessionAuthorizationContext,
  verifySessionDigest,
} from '../src';

const TENANT = 'tenant:globex';
const OTHER_TENANT = 'tenant:initech';
const PRINCIPAL = 'principal:field-engineer';
const RESULT_ID = 'auth-result-1';
const RESULT_DIGEST = 'a'.repeat(64);
const ISSUED_AT = '2026-01-05T08:00:00.000Z';
const TTL_MS = 3_600_000; // one hour
const NONCE = 'nonce:fixture-1';

function auth(overrides: Record<string, unknown> = {}): {
  resultId: string;
  resultDigest: string;
  principalId: string;
  outcome: 'verified' | 'failed';
} {
  return { resultId: RESULT_ID, resultDigest: RESULT_DIGEST, principalId: PRINCIPAL, outcome: 'verified', ...overrides };
}

function issue(manager = new SessionManager({ expectedTenantId: TENANT })) {
  return manager.issueSession({
    authentication: auth(),
    principalId: PRINCIPAL,
    tenantId: TENANT,
    issuedAt: ISSUED_AT,
    ttlMs: TTL_MS,
    nonce: NONCE,
  });
}

describe('the session seam (W046)', () => {
  it('issues a session from a VERIFIED authentication result with a deterministic content-addressed id', () => {
    const manager = new SessionManager({ expectedTenantId: TENANT });
    const result = issue(manager);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const { record, registration } = result.value;
      expect(record.session.sessionId).toMatch(/^session:[a-z0-9-]+$/);
      expect(record.lifecycle).toBe('active');
      expect(record.session.expiresAt).toBe(addMsToInstant(ISSUED_AT, TTL_MS));
      expect(record.sessionDigest).toBe(registration.digest);
      // Determinism: the same seed derives the same id.
      expect(
        deriveSessionId({
          principalId: PRINCIPAL,
          tenantId: TENANT,
          authenticationResultId: RESULT_ID,
          issuedAt: ISSUED_AT,
          nonce: NONCE,
        }),
      ).toBe(record.session.sessionId);
    }
  });

  it('identical inputs issue identical sessions (zero randomness)', () => {
    const a = issue();
    const b = issue();
    expect(a.ok && a.value.record.sessionDigest).toBe(b.ok && b.value.record.sessionDigest);
    expect(a.ok && a.value.record.session.sessionId).toBe(b.ok && b.value.record.session.sessionId);
  });

  it('fails closed: a FAILED authentication result cannot issue a session', () => {
    const manager = new SessionManager();
    const result = manager.issueSession({
      authentication: auth({ outcome: 'failed' }),
      principalId: PRINCIPAL,
      tenantId: TENANT,
      issuedAt: ISSUED_AT,
      ttlMs: TTL_MS,
      nonce: NONCE,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('authentication-not-verified');
  });

  it('fails closed: the session principal must match the authenticated principal', () => {
    const manager = new SessionManager();
    const result = manager.issueSession({
      authentication: auth(),
      principalId: 'principal:someone-else',
      tenantId: TENANT,
      issuedAt: ISSUED_AT,
      ttlMs: TTL_MS,
      nonce: NONCE,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('authentication-tenant-mismatch');
  });

  it('fails closed: cross-tenant issuance against a scoped manager is the typed R12 rejection', () => {
    const manager = new SessionManager({ expectedTenantId: TENANT });
    const result = manager.issueSession({
      authentication: auth({ principalId: 'principal:initeach-eng' }),
      principalId: 'principal:initeach-eng',
      tenantId: OTHER_TENANT,
      issuedAt: ISSUED_AT,
      ttlMs: TTL_MS,
      nonce: NONCE,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('tenant-isolation-rejected');
  });

  it('validateSession transitions an active session past expiry to expired (caller-supplied instants)', () => {
    const manager = new SessionManager();
    const issued = issue(manager);
    const sessionId = issued.ok ? issued.value.record.session.sessionId : '';
    const before = manager.validateSession(sessionId, '2026-01-05T08:30:00.000Z');
    expect(before.ok && before.value.lifecycle).toBe('active');
    const after = manager.validateSession(sessionId, '2026-01-05T09:00:00.000Z');
    expect(after.ok && after.value.lifecycle).toBe('expired');
    expect(after.ok && after.value.lifecycleChangedAt).toBe('2026-01-05T09:00:00.000Z');
    // And the digest did NOT change (lifecycle transitions never rewrite it).
    expect(after.ok && after.value.sessionDigest).toBe(issued.ok ? issued.value.record.sessionDigest : '');
  });

  it('unknown sessions fail typed; revoked sessions stay revoked (idempotent)', () => {
    const manager = new SessionManager();
    const unknown = manager.validateSession('session:nope', ISSUED_AT);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe('session-unknown');

    const issued = issue(manager);
    const sessionId = issued.ok ? issued.value.record.session.sessionId : '';
    const revoked = manager.revokeSession(sessionId, '2026-01-05T08:10:00.000Z');
    expect(revoked.ok && revoked.value.lifecycle).toBe('revoked');
    const again = manager.revokeSession(sessionId, '2026-01-05T08:20:00.000Z');
    expect(again.ok && again.value.lifecycle).toBe('revoked');
    expect(again.ok && again.value.lifecycleChangedAt).toBe('2026-01-05T08:10:00.000Z');
  });

  it('digest discipline: a tampered registration is rejected (tamper detection)', () => {
    const sealed = sealSession({
      schemaVersion: 1,
      sessionId: 'session:tamper-test',
      principalId: PRINCIPAL,
      tenantId: TENANT,
      authenticationResultId: RESULT_ID,
      authenticationResultDigest: RESULT_DIGEST,
      issuedAt: ISSUED_AT,
      expiresAt: addMsToInstant(ISSUED_AT, TTL_MS),
      nonce: NONCE,
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const tampered = verifySessionDigest({
      session: { ...sealed.value.session, expiresAt: addMsToInstant(ISSUED_AT, 86_400_000) },
      digest: sealed.value.digest,
    });
    expect(tampered.ok).toBe(false);
    if (!tampered.ok) expect(tampered.error.code).toBe('digest-mismatch');
  });

  it('restore-from-durable-records: validated records restore; tampered records fail closed', () => {
    const manager = new SessionManager();
    const issued = issue(manager);
    const record = issued.ok ? issued.value.record : null;
    expect(record).not.toBeNull();
    if (record === null) return;
    const fresh = new SessionManager();
    const restored = fresh.restoreSessions([record]);
    expect(restored.ok && restored.value).toBe(1);
    const validated = fresh.validateSession(record.session.sessionId, '2026-01-05T08:30:00.000Z');
    expect(validated.ok && validated.value.lifecycle).toBe('active');

    const tampered = new SessionManager();
    const bad = tampered.restoreSessions([{ ...record, sessionDigest: 'b'.repeat(64) }]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('digest-mismatch');
  });

  it('the deterministic snapshot is sorted by session id', () => {
    const manager = new SessionManager();
    issue(manager);
    manager.issueSession({
      authentication: auth({ resultId: 'auth-result-2', resultDigest: 'c'.repeat(64) }),
      principalId: PRINCIPAL,
      tenantId: TENANT,
      issuedAt: ISSUED_AT,
      ttlMs: TTL_MS,
      nonce: 'nonce:fixture-2',
    });
    const ids = manager.snapshot().map((record) => record.session.sessionId);
    expect(ids).toEqual([...ids].sort());
  });
});

describe('tenant-safe authorization propagation (W046)', () => {
  it('builds the W009 request from the session scope (tenant rides the resource)', () => {
    const manager = new SessionManager();
    const issued = issue(manager);
    if (!issued.ok) throw new Error('issue failed');
    const request = authorizationRequestFor(issued.value.record, 'gateway.operation', {
      resourceType: 'application-gateway',
      resourceId: 'action.submit',
    });
    expect(request.principalId).toBe(PRINCIPAL);
    expect(request.resource.tenantId).toBe(TENANT);
    expect(request.actionKind).toBe('gateway.operation');
  });

  it('propagation NEVER decides: the W009 evaluator denies fail-closed without facts', () => {
    const manager = new SessionManager();
    const issued = issue(manager);
    if (!issued.ok) throw new Error('issue failed');
    const request = authorizationRequestFor(issued.value.record, 'gateway.operation', {
      resourceType: 'application-gateway',
      resourceId: 'action.submit',
    });
    // No membership facts, tenant not known: fail-closed DENY by the kernel.
    const denied = evaluateAuthorization(request, {
      schemaVersion: 1,
      principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
      memberships: [],
      knownTenants: [],
    });
    expect(denied.ok).toBe(true);
    if (denied.ok) expect(denied.value.outcome).not.toBe('allow');
  });

  it('propagation allows through the REAL W009 evaluator with proper facts', () => {
    const manager = new SessionManager();
    const issued = issue(manager);
    if (!issued.ok) throw new Error('issue failed');
    const request = authorizationRequestFor(issued.value.record, 'gateway.operation', {
      resourceType: 'application-gateway',
      resourceId: 'action.submit',
    });
    const allowed = evaluateAuthorization(
      request,
      sessionAuthorizationContext(PRINCIPAL, TENANT, [TENANT]),
    );
    expect(allowed.ok).toBe(true);
    if (allowed.ok) expect(allowed.value.outcome).toBe('allow');
  });
});
