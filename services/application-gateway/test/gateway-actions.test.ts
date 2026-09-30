// The gateway action path + idempotency + correlation: the Action
// Gateway is the EXECUTION authority (submit -> approve -> execute),
// every mutating call is idempotency-wrapped, correlation ids are
// recorded through gateway -> kernel calls, and authority rejections
// ride verbatim (never gateway-invented).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { ActionGateway } from '@epoch/action-gateway';
import { SessionManager } from '@epoch/authentication';
import { TenancyHierarchy } from '@epoch/tenancy';
import { WorldModel } from '@epoch/world-model';
import { EventLog } from '@epoch/event-log';
import { EvidenceStore } from '@epoch/evidence';
import { InMemoryObjectStore } from '@epoch/object-storage';
import { InMemoryPersistence } from '@epoch/persistence';
import { compileConstraint } from '@epoch/policy-contracts';
import { ApplicationGateway } from '../src/gateway';
import type { GatewayRequestEnvelope, GatewayOutcome, GatewayResult } from '@epoch/client-runtime';

const TENANT = 'tenant:nordstrand';
const PRINCIPAL = 'principal:delivery-lead';
const T1 = '2026-03-02T09:00:00.000Z';
const T2 = '2026-03-02T10:00:00.000Z';
const AUTH_RESULT = { resultId: 'gw-auth-actions', resultDigest: 'a'.repeat(64), principalId: PRINCIPAL, outcome: 'verified' as const };

const clock = () => T1;

/** A valid W003 proposal that requires human approval (quorum 1). */
function approvalProposal(): Record<string, unknown> {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'action.proposal',
    messageId: 'gw-msg-proposal-1',
    createdAt: T1,
    proposalId: 'gw-prop-0001',
    proposedBy: 'agent:gateway-test',
    actionType: { id: 'structural.element.reinforce', version: '1.0.0' },
    target: { kind: 'world-entity', ref: 'entity:beam-b-12' },
    parameters: { 'reinforcement-class': 'B' },
    preconditions: [],
    predictedEffects: [
      { description: 'Utilization drops below unity.', confidence: { kind: 'quantified', value: 0.9 } },
    ],
    sideEffects: [{ description: 'Crew rework scheduling.', reversible: false }],
    reversibility: { kind: 'partially-reversible', notes: 'Removable reinforcement; labor unrecoverable.' },
    authorityRequirements: {
      requiredScopes: ['world:write'],
      requiresHumanApproval: true,
      approvalQuorum: { approvals: 1, roles: ['senior-structural-engineer'] },
    },
    rationale: 'Gateway action-path fixture.',
    evidenceRefs: ['simrun:gateway-fixture-1'],
    expiresAt: '2026-04-02T09:00:00.000Z',
  };
}

/** Compiled hard constraint: violated iff `spend >= 100`. */
function compiledBudgetConstraint(): unknown {
  const outcome = compileConstraint({
    languageVersion: '1.0.0',
    id: 'gw-hard-budget',
    version: '1.0.0',
    inputs: [{ name: 'spend', type: 'number' }],
    class: 'hard',
    predicate: {
      node: 'lt',
      left: { node: 'input', name: 'spend' },
      right: { node: 'lit', type: 'number', value: 100 },
    },
  });
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
  return outcome.compiled;
}

/** The tenant policy set (W004 shapes) binding the budget constraint. */
function policySet(): unknown[] {
  return [
    {
      languageVersion: '1.0.0',
      id: 'gw-tenant-policy',
      version: '1.0.0',
      name: 'Gateway test policy',
      enabled: true,
      applicability: { tenantId: TENANT, actionKinds: ['structural.element.reinforce'] },
      bindings: [{ constraintId: 'gw-hard-budget' }],
      precedence: { tier: 'tenant', rank: 5 },
      composition: 'additive',
    },
  ];
}

function buildGateway(): ApplicationGateway {
  return new ApplicationGateway({
    clock,
    authorities: {
      sessions: new SessionManager(),
      tenancy: new TenancyHierarchy(),
      worlds: WorldModel.create({ clock: () => T1 }),
      evidence: EvidenceStore.create(),
      objects: new InMemoryObjectStore(),
      eventLog: new EventLog(),
      actionGateway: new ActionGateway(),
      actionConstraintResolver: () => compiledBudgetConstraint(),
      authorizationFacts: {
        contextFor: (r) => ({
          schemaVersion: 1,
          principals: [{ principalId: r.principalId, status: 'active', authenticated: true }],
          memberships: [{ principalId: r.principalId, tenantId: r.tenantId }],
          knownTenants: [TENANT],
        }),
      },
    },
    persistence: new InMemoryPersistence(),
  });
}

function request(
  operation: GatewayRequestEnvelope['operation'],
  sessionId: string,
  idempotencyKey: string | undefined,
  payload: Record<string, unknown>,
): GatewayRequestEnvelope {
  return {
    schemaVersion: 1,
    contractVersion: '1.0.0',
    operation,
    session: { schemaVersion: 1, sessionId },
    correlation: { schemaVersion: 1, correlationId: 'corr:action-test', origin: 'web', issuedAt: clock() },
    tenant: { tenantId: TENANT },
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    payload: payload as never,
  };
}

async function issueSession(gateway: ApplicationGateway): Promise<string> {
  const result = await gateway.call({
    schemaVersion: 1,
    contractVersion: '1.0.0',
    operation: 'session.issue',
    session: { schemaVersion: 1, sessionId: 'session:bootstrap' },
    correlation: { schemaVersion: 1, correlationId: 'corr:action-test', origin: 'web', issuedAt: clock() },
    tenant: { tenantId: TENANT },
    idempotencyKey: 'idem:action-session',
    payload: { authentication: AUTH_RESULT, principalId: PRINCIPAL, tenantId: TENANT, ttlMs: 3_600_000, nonce: 'nonce:actions' },
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return (result.value.result as { sessionId: string }).sessionId;
}

function unwrap(result: GatewayResult<GatewayOutcome>): Promise<Record<string, unknown>> {
  if (!result.ok) return Promise.reject(new Error(JSON.stringify(result.error)));
  return Promise.resolve(result.value.result as Record<string, unknown>);
}

describe('the gateway action path (W046: the Action Gateway is the execution authority)', () => {
  it('action.submit delegates to the Action Gateway (intake + policy decision + events)', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const intake = await unwrap(
      await gateway.call(request('action.submit', sessionId, 'idem:submit-1', {
        actionId: 'action:gateway-beam-b12',
        proposal: approvalProposal(),
        policies: policySet(),
        evaluationContext: { inputs: { spend: 10 } },
        approval: { deadline: '2026-04-01T09:00:00.000Z', maxDelegationDepth: 1 },
      })),
    );
    expect(intake['action']).toBeDefined();
    const action = intake['action'] as { actionId: string; status: string };
    expect(action.actionId).toBe('action:gateway-beam-b12');
  });

  it('action.approve -> action.execute complete the authoritative lifecycle through the SAME gateway', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    await unwrap(
      await gateway.call(request('action.submit', sessionId, 'idem:submit-2', {
        actionId: 'action:gateway-lifecycle',
        proposal: approvalProposal(),
        policies: policySet(),
        evaluationContext: { inputs: { spend: 10 } },
        approval: { deadline: '2026-04-01T09:00:00.000Z', maxDelegationDepth: 1 },
      })),
    );
    const approved = await unwrap(
      await gateway.call(request('action.approve', sessionId, 'idem:approve-2', {
        actionId: 'action:gateway-lifecycle',
        decidedBy: { id: 'principal:chief-engineer', role: 'human-approver' },
        asRole: 'senior-structural-engineer',
        note: 'gateway fixture approval',
        at: T2,
      })),
    );
    expect(approved).toBeDefined();
    const executed = await unwrap(
      await gateway.call(request('action.execute', sessionId, 'idem:execute-2', {
        actionId: 'action:gateway-lifecycle',
        at: T2,
      })),
    );
    expect(executed).toBeDefined();
    const status = await unwrap(await gateway.call(request('action.status', sessionId, undefined, { actionId: 'action:gateway-lifecycle' })));
    expect(status['actionId']).toBe('action:gateway-lifecycle');
  });

  it('an invalid proposal surfaces as authority-rejected with the Action Gateway error VERBATIM', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const result = await gateway.call(
      request('action.submit', sessionId, 'idem:submit-bad', {
        actionId: 'action:gateway-bad',
        proposal: { not: 'a-proposal' },
        policies: [],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.class).toBe('authority-rejected');
      expect(result.error.details?.authority).toBe('@epoch/action-gateway');
      const authorityError = result.error.details?.authorityError as { code: string };
      expect(typeof authorityError.code).toBe('string');
    }
  });

  it('a replayed action.submit returns the RECORDED outcome (idempotent — never double-submit)', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const payload = {
      actionId: 'action:gateway-idem',
      proposal: approvalProposal(),
      policies: policySet(),
      evaluationContext: { inputs: { spend: 10 } },
      approval: { deadline: '2026-04-01T09:00:00.000Z', maxDelegationDepth: 1 },
    };
    const first = await gateway.call(request('action.submit', sessionId, 'idem:submit-idem', payload));
    const replay = await gateway.call(request('action.submit', sessionId, 'idem:submit-idem', payload));
    expect(first.ok && first.value.replayed).toBe(false);
    expect(replay.ok && replay.value.replayed).toBe(true);
    if (first.ok && replay.ok) {
      expect(replay.value.outcomeDigest).toBe(first.value.outcomeDigest);
    }
  });

  it('the same idempotency key with a DIFFERENT payload is the typed fingerprint conflict', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const payload = { actionId: 'action:gateway-conflict', proposal: approvalProposal(), policies: [] };
    await gateway.call(request('action.submit', sessionId, 'idem:conflict', payload));
    const conflicting = await gateway.call(
      request('action.submit', sessionId, 'idem:conflict', { ...payload, actionId: 'action:DIFFERENT' }),
    );
    expect(conflicting.ok).toBe(false);
    if (!conflicting.ok) {
      expect(conflicting.error.class).toBe('conflict');
      expect(conflicting.error.code).toBe('idempotency-fingerprint-mismatch');
    }
  });

  it('correlation ids are recorded through gateway -> kernel calls (the ledger)', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    await gateway.call(request('action.status', sessionId, undefined, { actionId: 'action:none' }));
    const entries = await gateway.correlations.entriesFor('corr:action-test');
    expect(entries.length).toBeGreaterThan(1);
    const statusEntry = entries.find((entry) => entry.operation === 'action.status');
    expect(statusEntry?.authority).toBe('@epoch/action-gateway');
    // Every response echoes the correlation id.
    const outcome = await gateway.call(request('action.status', sessionId, undefined, { actionId: 'action:none' }));
    if (outcome.ok) {
      expect(outcome.value.correlationId).toBe('corr:action-test');
    }
  });

  it('recovery.replay drains a queued intent THROUGH the gateway with idempotency keys (J07 semantics)', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    // The committed construction fixture provides the governing program
    // (the REAL artifact W047+ will use).
    const fixtureProgram = JSON.parse(
      readFileSync(path.resolve(__dirname, '../../../qa/fixtures/construction/program-of-work.json'), 'utf8'),
    ) as Record<string, unknown>;
    const intent = {
      queueId: 'queue:recovery-1',
      idempotencyKey: 'idem:recovery-observe-1',
      operation: 'delivery.observe',
      payload: {
        solutionId: 'solution:warehouse-extension-steel',
        program: fixtureProgram,
        capture: {
          captureKey: 'j07-capture-1',
          tenantId: 'tenant:nordstrand',
          solutionId: 'solution:warehouse-extension-steel',
          deliveryId: 'delivery:warehouse-b-001',
          observedAt: T1,
          observedBy: PRINCIPAL,
          subjectRef: { kind: 'activity', id: 'activity:warehouse-excavation' },
          measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
          uncertainty: uncertainty(),
        },
      },
    };
    const first = await unwrap(
      await gateway.call(request('recovery.replay', sessionId, 'idem:recovery-call-1', { intents: [intent] })),
    );
    const outcomes = first['outcomes'] as Array<Record<string, unknown>>;
    expect(outcomes).toHaveLength(1);
    // The intent drained THROUGH delivery.observe -> execution-tracking
    // (the authority's own intake admission).
    expect(outcomes[0]?.['status']).toBe('drained');
    expect(typeof outcomes[0]?.['outcomeDigest']).toBe('string');

    // The same intent idempotency key replays identically (J07: never double-apply).
    const replay = await unwrap(
      await gateway.call(request('recovery.replay', sessionId, 'idem:recovery-call-2', { intents: [intent] })),
    );
    const replayOutcomes = replay['outcomes'] as Array<Record<string, unknown>>;
    expect(replayOutcomes[0]?.['status']).toBe('drained');
    expect(replayOutcomes[0]?.['replayed']).toBe(true);
    expect(replayOutcomes[0]?.['outcomeDigest']).toBe(outcomes[0]?.['outcomeDigest']);
  });
});

function uncertainty(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:gateway-fixture', actor: PRINCIPAL },
    freshness: { state: 'fresh', assessedAt: T1 },
    confidence: { method: 'measured', value: 0.95, rationale: 'direct field measurement' },
  };
}
