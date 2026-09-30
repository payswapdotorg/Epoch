// Shared test helpers: a deterministic gateway construction + request
// envelope builders reused by the authority-map walk test and the
// composition suites.
import { ActionGateway } from '@epoch/action-gateway';
import { SessionManager } from '@epoch/authentication';
import { TenancyHierarchy } from '@epoch/tenancy';
import { WorldModel } from '@epoch/world-model';
import { EventLog } from '@epoch/event-log';
import { EvidenceStore } from '@epoch/evidence';
import { InMemoryObjectStore } from '@epoch/object-storage';
import { InMemoryPersistence } from '@epoch/persistence';
import { ApplicationGateway } from '../src/gateway';
import type { GatewayRequestEnvelope } from '@epoch/client-runtime';

export const TENANT = 'tenant:nordstrand';
export const PRINCIPAL = 'principal:delivery-lead';
export const T1 = '2026-03-02T09:00:00.000Z';
export const clock = () => T1;
export const AUTH_RESULT = {
  resultId: 'gw-auth-shared',
  resultDigest: 'a'.repeat(64),
  principalId: PRINCIPAL,
  outcome: 'verified' as const,
};

/** Build the gateway with an injectable tenancy hierarchy (fixture-seeded for composition tests). */
export function buildGateway(options: { readonly tenancy?: TenancyHierarchy | undefined } = {}): ApplicationGateway {
  return new ApplicationGateway({
    clock,
    authorities: {
      sessions: new SessionManager(),
      tenancy: options.tenancy ?? new TenancyHierarchy(),
      worlds: WorldModel.create({ clock: () => T1 }),
      evidence: EvidenceStore.create(),
      objects: new InMemoryObjectStore(),
      eventLog: new EventLog(),
      actionGateway: new ActionGateway(),
      actionConstraintResolver: () => undefined,
      authorizationFacts: {
        contextFor: (request: { principalId: string; tenantId: string }) => ({
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

export async function issueSession(gateway: ApplicationGateway): Promise<string> {
  const result = await gateway.call({
    schemaVersion: 1,
    contractVersion: '1.0.0',
    operation: 'session.issue',
    session: { schemaVersion: 1, sessionId: 'session:bootstrap' },
    correlation: { schemaVersion: 1, correlationId: 'corr:shared', origin: 'web', issuedAt: clock() },
    tenant: { tenantId: TENANT },
    idempotencyKey: 'idem:shared-session',
    payload: {
      authentication: AUTH_RESULT,
      principalId: PRINCIPAL,
      tenantId: TENANT,
      ttlMs: 86_400_000,
      nonce: 'nonce:shared',
    },
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return (result.value.result as { sessionId: string }).sessionId;
}

const MUTATING = new Set([
  'session.issue',
  'session.revoke',
  'evidence.intake',
  'discovery.run',
  'action.submit',
  'action.approve',
  'action.execute',
  'solution.sealVersion',
  'solution.approveBaseline',
  'program.build',
  'delivery.open',
  'delivery.observe',
  'delivery.close',
  'procurement.quote',
  'procurement.order',
  'outcome.learn',
  'alerts.raise',
  'recovery.replay',
]);

export function envelope(
  operation: GatewayRequestEnvelope['operation'],
  sessionId: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): GatewayRequestEnvelope {
  return {
    schemaVersion: 1,
    contractVersion: '1.0.0',
    operation,
    session: { schemaVersion: 1, sessionId },
    correlation: { schemaVersion: 1, correlationId: 'corr:shared', origin: 'web', issuedAt: clock() },
    tenant: { tenantId: TENANT },
        ...(MUTATING.has(operation) && idempotencyKey === undefined
      ? { idempotencyKey: `idem:${operation.replace(/[^a-z0-9]+/g, '-').toLowerCase()}` }
      : {}),
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    payload: payload as never,
  };
}

export function unwrapResult(result: { ok: true; value: { result: unknown } } | { ok: false; error: unknown }): Record<string, unknown> {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value.result as Record<string, unknown>;
}
