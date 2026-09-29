// The gateway session path + gates: issue/validate/revoke, the
// auth-session-expired error class, cross-tenant denial, and the durable
// session mirror (PostgreSQL is authoritative when the SPI is bound).
import { describe, expect, it } from 'vitest';
import { ActionGateway } from '@epoch/action-gateway';
import { SessionManager } from '@epoch/authentication';
import { TenancyHierarchy } from '@epoch/tenancy';
import { WorldModel } from '@epoch/world-model';
import { EventLog } from '@epoch/event-log';
import { EvidenceStore } from '@epoch/evidence';
import { InMemoryObjectStore } from '@epoch/object-storage';
import { InMemoryPersistence } from '@epoch/persistence';
import { ApplicationGateway } from '../src/gateway';
import type { GatewayRequestEnvelope, GatewayResult, GatewayOutcome } from '@epoch/client-runtime';

const TENANT = 'tenant:nordstrand';
const OTHER_TENANT = 'tenant:initech';
const PRINCIPAL = 'principal:delivery-lead';
const AUTH_RESULT = { resultId: 'gw-auth-1', resultDigest: 'a'.repeat(64), principalId: PRINCIPAL, outcome: 'verified' as const };

let clockNow = Date.parse('2026-03-02T08:00:00.000Z');
const clock = () => new Date(clockNow).toISOString();
const advanceTo = (iso: string) => {
  clockNow = Date.parse(iso);
};

function buildGateway(): ApplicationGateway {
  return new ApplicationGateway({
    clock,
    authorities: {
      sessions: new SessionManager(),
      tenancy: new TenancyHierarchy(),
      worlds: WorldModel.create({ clock: () => '2026-03-02T08:00:00.000Z' }),
      evidence: EvidenceStore.create(),
      objects: new InMemoryObjectStore(),
      eventLog: new EventLog(),
      actionGateway: new ActionGateway(),
      actionConstraintResolver: () => undefined,
      authorizationFacts: {
        contextFor: (request) => ({
          schemaVersion: 1,
          principals: [{ principalId: request.principalId, status: 'active', authenticated: true }],
          memberships: [{ principalId: request.principalId, tenantId: request.tenantId }],
          knownTenants: [TENANT],
        }),
      },
    },
    persistence: new InMemoryPersistence(),
  });
}

function sessionIssueRequest(overrides: Record<string, unknown> = {}): GatewayRequestEnvelope {
  const { idempotencyKey = 'idem:session-test', ...payloadOverrides } = overrides as {
    idempotencyKey?: string;
  };
  return {
    schemaVersion: 1,
    contractVersion: '1.0.0',
    operation: 'session.issue',
    session: { schemaVersion: 1, sessionId: 'session:bootstrap' },
    correlation: { schemaVersion: 1, correlationId: 'corr:session-test', origin: 'web', issuedAt: clock() },
    tenant: { tenantId: TENANT },
    idempotencyKey: idempotencyKey as string,
    payload: {
      authentication: AUTH_RESULT,
      principalId: PRINCIPAL,
      tenantId: TENANT,
      ttlMs: 3_600_000,
      nonce: 'nonce:gw-session-1',
      ...payloadOverrides,
    } as never,
  };
}

async function issueSession(gateway: ApplicationGateway): Promise<string> {
  const result = await gateway.call(sessionIssueRequest());
  if (!result.ok) throw new Error(`session issue failed: ${JSON.stringify(result.error)}`);
  return (result.value.result as { sessionId: string }).sessionId;
}

function request(
  operation: GatewayRequestEnvelope['operation'],
  sessionId: string,
  payload: Record<string, unknown> = {},
  overrides: Partial<GatewayRequestEnvelope> = {},
): GatewayRequestEnvelope {
  const envelope: GatewayRequestEnvelope = {
    schemaVersion: 1,
    contractVersion: '1.0.0',
    operation,
    session: { schemaVersion: 1, sessionId },
    correlation: { schemaVersion: 1, correlationId: 'corr:session-test', origin: 'web', issuedAt: clock() },
    tenant: { tenantId: TENANT },
    ...(isMutating(operation) ? { idempotencyKey: `idem:${operation.replace('.', '-')}` } : {}),
    payload: payload as never,
  };
  return { ...envelope, ...overrides };
}

function isMutating(operation: string): boolean {
  return ['session.revoke', 'evidence.intake', 'action.submit', 'action.approve', 'action.execute', 'recovery.replay', 'delivery.observe', 'solution.sealVersion', 'solution.approveBaseline', 'program.build', 'delivery.open', 'delivery.close', 'procurement.quote', 'procurement.order', 'outcome.learn', 'alerts.raise', 'discovery.run', 'session.issue'].includes(operation);
}

async function unwrap(result: GatewayResult<GatewayOutcome>): Promise<JsonValue0> {
  if (!result.ok) throw new Error(`call failed: ${JSON.stringify(result.error)}`);
  return result.value.result;
}
type JsonValue0 = Record<string, unknown> | unknown[] | string | number | boolean | null;

describe('the gateway session path (W046)', () => {
  it('session.issue issues a session from a VERIFIED authentication result (bootstrap, no prior session)', async () => {
    const gateway = buildGateway();
    const result = await gateway.call(sessionIssueRequest());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const session = result.value.result as { sessionId: string; state: string; principalId: string };
      expect(session.sessionId).toMatch(/^session:[a-z0-9-]+$/);
      expect(session.state).toBe('active');
      expect(session.principalId).toBe(PRINCIPAL);
      expect(result.value.replayed).toBe(false);
      expect(result.value.correlationId).toBe('corr:session-test');
    }
  });

  it('the idempotency replay returns the RECORDED session issue outcome (never double-issue)', async () => {
    const gateway = buildGateway();
    const first = await gateway.call(sessionIssueRequest());
    const replay = await gateway.call(sessionIssueRequest());
    expect(first.ok && first.value.replayed).toBe(false);
    expect(replay.ok && replay.value.replayed).toBe(true);
    if (first.ok && replay.ok) {
      expect(replay.value.outcomeDigest).toBe(first.value.outcomeDigest);
    }
  });

  it('session.validate returns the session state; unknown sessions are the auth-session-expired class', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const validated = await unwrap(await gateway.call(request('session.validate', sessionId)));
    expect((validated as { state: string }).state).toBe('active');

    const unknown = await gateway.call(request('session.validate', 'session:nope'));
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error.class).toBe('auth-session-expired');
      expect(unknown.error.code).toBe('session-unknown');
      expect(unknown.error.details?.reauthRequired).toBe(true);
    }
  });

  it('an EXPIRED session fails every non-bootstrap call with the auth-session-expired class (J11 step 1)', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    advanceTo('2026-03-02T16:00:00.000Z'); // past the 1h TTL
    const result = await gateway.call(request('world.snapshot', sessionId));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.class).toBe('auth-session-expired');
      expect(result.error.code).toBe('session-expired');
    }
    // Re-authentication works (J11 step 2).
    const reAuth = await gateway.call(
      sessionIssueRequest({ nonce: 'nonce:gw-session-2', idempotencyKey: 'idem:session-reauth' }),
    );
    expect(reAuth.ok).toBe(true);
  });

  it('a REVOKED session fails with the typed revoked code (idempotent revoke)', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const revoked = await unwrap(await gateway.call(request('session.revoke', sessionId)));
    expect((revoked as { state: string }).state).toBe('revoked');
    const after = await gateway.call(request('world.snapshot', sessionId));
    expect(after.ok).toBe(false);
    if (!after.ok) {
      expect(after.error.class).toBe('auth-session-expired');
      expect(after.error.code).toBe('session-revoked');
    }
  });

  it('a request whose tenant differs from the session tenant is the typed R12 rejection', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const result = await gateway.call(request('world.snapshot', sessionId, {}, { tenant: { tenantId: OTHER_TENANT } }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.class).toBe('validation');
      expect(result.error.code).toBe('tenant-scope-mismatch');
    }
  });

  it('mutating operations without an idempotency key are rejected at the gate', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const result = await gateway.call(
      request('evidence.intake', sessionId, { record: {} }, { idempotencyKey: undefined }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.class).toBe('validation');
      expect(result.error.code).toBe('idempotency-key-required');
    }
  });

  it('mutating operations are DENIED fail-closed without authorization facts (W009 gate)', async () => {
    const gateway = new ApplicationGateway({
      clock,
      authorities: {
        sessions: new SessionManager(),
        tenancy: new TenancyHierarchy(),
        worlds: WorldModel.create({ clock: () => '2026-03-02T08:00:00.000Z' }),
        evidence: EvidenceStore.create(),
        objects: new InMemoryObjectStore(),
        eventLog: new EventLog(),
        actionGateway: new ActionGateway(),
        actionConstraintResolver: () => undefined,
        authorizationFacts: {
          // NO facts: fail-closed by the W009 evaluator.
          contextFor: () => ({ schemaVersion: 1, principals: [], memberships: [], knownTenants: [] }),
        },
      },
    });
    const sessionId = await issueSession(gateway);
    const result = await gateway.call(request('evidence.intake', sessionId, { record: {} }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.class).toBe('authority-rejected');
      expect(result.error.details?.authority).toBe('@epoch/authorization');
    }
  });

  it('the durable session mirror restores sessions into a fresh manager (PostgreSQL-is-authoritative seam)', async () => {
    const persistence = new InMemoryPersistence();
    const gatewayA = new ApplicationGateway({
      clock,
      authorities: {
        sessions: new SessionManager(),
        tenancy: new TenancyHierarchy(),
        worlds: WorldModel.create({ clock: () => '2026-03-02T08:00:00.000Z' }),
        evidence: EvidenceStore.create(),
        objects: new InMemoryObjectStore(),
        eventLog: new EventLog(),
        actionGateway: new ActionGateway(),
        actionConstraintResolver: () => undefined,
        authorizationFacts: {
          contextFor: (r) => ({
            schemaVersion: 1,
            principals: [{ principalId: r.principalId, status: 'active', authenticated: true }],
            memberships: [{ principalId: r.principalId, tenantId: r.tenantId }],
            knownTenants: [TENANT],
          }),
        },
      },
      persistence,
    });
    const sessionId = await issueSession(gatewayA);
    // A NEW process binds the SAME durable store: the session survives.
    const sessions = new SessionManager();
    const restored = await gatewayA.sessions.restoreInto(sessions);
    expect(restored).toBe(1);
    const validated = sessions.validateSession(sessionId, clock());
    expect(validated.ok && validated.value.lifecycle).toBe('active');
  });

  it('the gateway migration plan prepares the durable tables idempotently', async () => {
    const gateway = buildGateway();
    const first = await gateway.prepare();
    const second = await gateway.prepare();
    expect(first.ok && (first.value.applied as string[]).length).toBe(3);
    expect(second.ok && (second.value.applied as string[]).length).toBe(0);
  });
});
