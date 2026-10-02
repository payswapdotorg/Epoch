/**
 * @epoch/web — the production journey suite (W052, ACR-006).
 *
 * The P01-P18 production journeys (spec/journey-validation.md) executed
 * against a REAL deployed Epoch web application through its public surface
 * only: the gateway envelope API (`POST /api/gateway`), the identity
 * boundary (`POST /api/product/authenticate`), the session-gated bootstrap
 * (`POST /api/product/bootstrap`) and the health/readiness probes. The
 * payload derivations are the client's own (`src/product/derivation.ts`) —
 * the harness sends exactly what the visible client sends.
 *
 * Gating (see harness.ts): the whole suite skips without
 * `EPOCH_PRODUCTION_BASE_URL`/`BASE_URL`; P17 additionally requires
 * `EPOCH_HARNESS_IP_BUDGET` (the deliberately tiny budget the target was
 * started with). Run: `BASE_URL=https://… npx vitest run qa/production`.
 *
 * NOT-RUNNABLE-at-boundary (honest): P09/P10 (browser offline queue +
 * cross-device handoff are client behaviors, not HTTP-surface behaviors —
 * covered by the W047 browser suite; the idempotent replay primitive they
 * depend on IS asserted here in P12/P14); P13 (release/update needs a real
 * deployment update); P16 (provider degradation needs the real providers).
 */
import { writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import {
  anchorsOf,
  asRecord,
  authenticate,
  bootstrap,
  callGateway,
  DOMAIN_TENANTS,
  envelopeOf,
  getEndpoint,
  harnessBaseUrl,
  harnessIpBudget,
  harnessTracePath,
  journal,
  leadPrincipalOf,
  postGatewayRaw,
  signIn,
  type HarnessSession,
} from './harness';
import {
  actionApprovePayload,
  actionSubmitPayload,
  alertRaisePayload,
  approveBaselinePayload,
  constraintEvaluationPayload,
  deliveryObservePayload,
  deliveryOpenPayload,
  discoveryRunPayload,
  evidenceIntakePayload,
  forecastPayload,
  procurementOrderPayload,
  procurementQuotePayload,
  programContentPayload,
  solutionAlternativeContents,
  supervisionCheckPayload,
  verificationChainPayload,
} from '../../src/product/derivation';

const BASE = harnessBaseUrl();
const ENABLED = BASE !== '';
const IP_BUDGET = harnessIpBudget();

/** The first program activity of each domain (the fixture observation anchor). */
const FIRST_ACTIVITY: Readonly<Record<string, string>> = {
  construction: 'activity:warehouse-excavation',
  software: 'activity:provision-repositories',
};

/** The observation measure unit of each domain. */
const MEASURE_UNIT: Readonly<Record<string, string>> = {
  construction: 'm3',
  software: 'points',
};

function recordOf(value: unknown): Record<string, unknown> {
  return asRecord(value);
}

function listValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

afterAll(() => {
  const target = harnessTracePath();
  if (target !== '' && ENABLED) {
    writeFileSync(target, `${JSON.stringify(journal.render(), null, 2)}\n`, 'utf8');
  }
});

/** The deployment health checks (the W051 liveness/readiness contract). */
describe.skipIf(!ENABLED)('deployment health over the public surface (W051 contract)', () => {
  it('GET /api/healthz returns the typed liveness payload', async () => {
    journal.enter('health');
    const response = await getEndpoint(BASE, '/api/healthz');
    expect(response.status).toBe(200);
    const body = recordOf(response.body);
    expect(body['ok']).toBe(true);
    expect(['development', 'preview', 'production']).toContain(body['profile']);
    expect(Number(body['uptimeMs'])).toBeGreaterThanOrEqual(0);
  }, 30_000);

  it('GET /api/readyz returns the secret-free readiness projection (bindings + degradation)', async () => {
    journal.enter('health');
    const response = await getEndpoint(BASE, '/api/readyz');
    expect(response.status).toBe(200);
    const body = recordOf(response.body);
    expect(body['ok']).toBe(true);
    expect(body['ready']).toBe(true);
    expect(['development', 'preview', 'production']).toContain(body['profile']);
    const bindings = recordOf(body['bindings']);
    const persistence = recordOf(bindings['persistence']);
    const objectStore = recordOf(bindings['objectStore']);
    const rateLimit = recordOf(bindings['rateLimit']);
    const acquisition = recordOf(bindings['acquisition']);
    expect(['in-memory', 'postgres']).toContain(persistence['kind']);
    expect(['in-memory', 's3']).toContain(objectStore['kind']);
    expect(['in-memory', 'upstash']).toContain(rateLimit['kind']);
    expect(['apify', 'disabled']).toContain(acquisition['kind']);
    // Readiness is honest about degradation: an in-memory binding is always
    // surfaced as a degraded capability, a real binding never is.
    const degraded = listValue(body['degraded']).map(String);
    expect(degraded.includes('persistence:in-memory')).toBe(persistence['kind'] === 'in-memory');
    expect(degraded.includes('object-store:in-memory')).toBe(objectStore['kind'] === 'in-memory');
    expect(degraded.includes('rate-limit:in-memory')).toBe(rateLimit['kind'] === 'in-memory');
    expect(listValue(body['criticalIssues'])).toHaveLength(0);
    // The secret-free invariant: no readiness value carries a secret shape.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(serialized).not.toMatch(/AKIA[0-9A-Z]{12,}/);
  }, 30_000);

  it('GET / serves the product entry surface over HTTP', async () => {
    journal.enter('health');
    const response = await getEndpoint(BASE, '/');
    expect(response.status).toBe(200);
  }, 30_000);
});

/** P01 — public onboarding: anonymous visitor → identity boundary → working session. */
describe.skipIf(!ENABLED)('P01 public onboarding', () => {
  it('an anonymous visitor selects a domain/persona, signs in and enters a working session', async () => {
    journal.enter('P01');
    const identity = await authenticate(BASE, 'construction', leadPrincipalOf('construction'));
    expect(identity.ok).toBe(true);
    expect(identity.tenantId).toBe(DOMAIN_TENANTS.construction);
    expect(recordOf(identity.authentication)['outcome']).toBe('verified');

    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');
    expect(session.sessionId).toMatch(/^session:/);
    expect(session.tenantId).toBe('tenant:nordstrand');
    expect(session.principalId).toBe('principal:delivery-lead');
    expect(session.expiresAt > session.issuedAt).toBe(true);

    // The session works: the first gateway read resolves the world.
    const world = await callGateway(
      BASE,
      envelopeOf('world.entities', session, {}),
    );
    expect(world.ok).toBe(true);
    if (world.ok) {
      expect(world.value.correlationId).toMatch(/^corr:/);
      expect(world.value.outcomeDigest).toMatch(/^[0-9a-f]{64}$/);
    }
  }, 60_000);
});

/** P02 — sign-in/session: issue, validity across requests, revoke (sign-out). */
describe.skipIf(!ENABLED)('P02 sign-in / session lifecycle', () => {
  it('a session validates across requests and revocation signs the user out (fail-closed afterwards)', async () => {
    journal.enter('P02');
    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');

    const first = await callGateway(BASE, envelopeOf('session.validate', session, {}));
    expect(first.ok).toBe(true);
    if (first.ok) {
      const validated = recordOf(first.value.result);
      expect(validated['tenantId']).toBe('tenant:nordstrand');
      expect(validated['state']).toBe('active');
    }

    // Valid across a second, unrelated request.
    const second = await callGateway(BASE, envelopeOf('session.validate', session, {}));
    expect(second.ok).toBe(true);

    // Sign-out: revoke, then the session is unusable (typed, reauth required).
    const revoked = await callGateway(BASE, envelopeOf('session.revoke', session, {}));
    expect(revoked.ok).toBe(true);
    const after = await callGateway(BASE, envelopeOf('session.validate', session, {}));
    expect(after.ok).toBe(false);
    if (!after.ok) {
      expect(after.error.class).toBe('auth-session-expired');
      expect(after.error.code).toBe('session-revoked');
      expect(recordOf(after.error.details)['reauthRequired']).toBe(true);
    }
  }, 60_000);
});

/** P03 — tenant/project selection (the demo tenants' projects; selection, not creation). */
describe.skipIf(!ENABLED)('P03 tenant / project selection', () => {
  it('both demo tenants resolve their committed workspace/project through the session-gated bootstrap', async () => {
    journal.enter('P03');
    const construction = await signIn(BASE, 'construction', 'principal:delivery-lead');
    const constructionConfig = await bootstrap(BASE, construction);
    expect(constructionConfig.tenantId).toBe('tenant:nordstrand');
    expect(constructionConfig.workspaceId).toBe('workspace:warehouse-extension');
    expect(constructionConfig.projectId).toBe('project:steel-warehouse-b');
    expect(constructionConfig.fixtureId).toBe('epoch-fixture-construction-v1.0.0');

    const software = await signIn(BASE, 'software', 'principal:tech-lead');
    const softwareConfig = await bootstrap(BASE, software);
    expect(softwareConfig.tenantId).toBe('tenant:lightspeed');
    expect(softwareConfig.projectId).toBe('project:checkout-v2');
    expect(softwareConfig.fixtureId).toBe('epoch-fixture-software-v1.0.0');

    // The tenancy authority resolves the selected project node.
    const resolved = await callGateway(
      BASE,
      envelopeOf('context.resolve', construction, { nodeId: constructionConfig.projectId }),
    );
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      const result = recordOf(resolved.value.result);
      const node = recordOf(result['node']);
      expect(node['nodeId']).toBe('project:steel-warehouse-b');
      expect(String(node['kind'])).toBe('project');
      expect(String(result['nodeDigest'])).toMatch(/^[0-9a-f]{64}$/);
    }
  }, 60_000);
});

/** P04 — understand/reconstruct: the world view over the deployed system. */
describe.skipIf(!ENABLED)('P04 understand / reconstruct (world view)', () => {
  it('world.snapshot resolves the committed world digest; entities and evidence project through the gateway', async () => {
    journal.enter('P04');
    const anchors = anchorsOf('construction');
    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');

    const snapshot = await callGateway(BASE, envelopeOf('world.snapshot', session, {}));
    expect(snapshot.ok).toBe(true);
    if (snapshot.ok) {
      const result = recordOf(snapshot.value.result);
      expect(result['digest']).toBe(anchors.worldDigest);
      expect(listValue(recordOf(result['snapshot'])['assertions']).length).toBeGreaterThan(0);
    }

    const entities = await callGateway(BASE, envelopeOf('world.entities', session, {}));
    expect(entities.ok).toBe(true);
    if (entities.ok) {
      const all = listValue(entities.value.result).map((entry) => recordOf(entry));
      expect(all).toHaveLength(8);
      expect(all.filter((entity) => entity['type'] === 'construct:boq-item')).toHaveLength(3);
    }

    const evidence = await callGateway(
      BASE,
      envelopeOf('evidence.get', session, { artifactId: 'construction-field-capture' }),
    );
    expect(evidence.ok).toBe(true);
    if (evidence.ok) {
      const records = listValue(evidence.value.result).map((entry) => recordOf(entry));
      expect(records.length).toBeGreaterThanOrEqual(1);
    }
  }, 60_000);
});

/** P05 — capability discovery through the deployed discovery surface. */
describe.skipIf(!ENABLED)('P05 capability discovery', () => {
  it('discovery.run synthesizes roles from capability demands (never model names) over the deployed surface', async () => {
    journal.enter('P05');
    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');
    const configuration = await bootstrap(BASE, session);

    const run = await callGateway(
      BASE,
      envelopeOf(
        'discovery.run',
        session,
        discoveryRunPayload(configuration, [
          'candidate:construction-delivery-team',
          'candidate:construction-delivery-copilot',
        ]),
      ),
    );
    expect(run.ok).toBe(true);
    if (run.ok) {
      const result = recordOf(run.value.result);
      const roles = listValue(result['roleProposals']).map((entry) => recordOf(entry));
      expect(roles.length).toBeGreaterThan(0);
      for (const role of roles) {
        // The authority's own shape: roleProposalId (content-addressed from
        // the demand set) + roleSlug + mission.
        expect(String(role['roleProposalId'])).toMatch(/^drole:/);
        expect(typeof role['mission']).toBe('string');
        expect(typeof role['roleSlug']).toBe('string');
        // Roles are synthesized from capability demands — never model names.
        expect(`${role['roleProposalId']} ${role['roleSlug']}`).not.toMatch(/gpt|claude|gemini|llm|model-name/i);
      }
      expect(listValue(result['organizations']).length).toBeGreaterThan(0);
    }
  }, 60_000);
});

/** P06 — decide/approve: alternatives, constraints, verification, Action Gateway. */
describe.skipIf(!ENABLED)('P06 decide / approve (Action Gateway)', () => {
  it('alternatives seal, constraints answer, the chain validates, the baseline is approved and the action executes', async () => {
    journal.enter('P06');
    const anchors = anchorsOf('construction');
    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');
    const configuration = await bootstrap(BASE, session);

    // Alternatives: the baseline seals byte-exact to the committed fixture.
    const alternatives = solutionAlternativeContents(configuration);
    const baselineSeal = await callGateway(
      BASE,
      envelopeOf('solution.sealVersion', session, { content: alternatives[0]!.content }),
    );
    expect(baselineSeal.ok).toBe(true);
    let baselineDigest = '';
    if (baselineSeal.ok) {
      baselineDigest = String(recordOf(baselineSeal.value.result)['contentDigest']);
      expect(baselineDigest).toBe(anchors.solutionContentDigest);
    }
    const alternativeSeal = await callGateway(
      BASE,
      envelopeOf('solution.sealVersion', session, { content: alternatives[1]!.content }),
    );
    expect(alternativeSeal.ok).toBe(true);
    if (alternativeSeal.ok) {
      expect(String(recordOf(alternativeSeal.value.result)['contentDigest'])).not.toBe(baselineDigest);
    }

    // Constraints: under the limit passes, over the limit is violated (the
    // constraint engine's own outcome vocabulary, surfaced verbatim).
    const underLimit = await callGateway(
      BASE,
      envelopeOf('constraints.evaluate', session, constraintEvaluationPayload(configuration, 12)),
    );
    expect(underLimit.ok).toBe(true);
    if (underLimit.ok) {
      const outcome = recordOf(underLimit.value.result);
      expect(outcome['ok']).toBe(true);
      expect(recordOf(outcome['result'])['outcome']).toBe('satisfied');
    }
    const overLimit = await callGateway(
      BASE,
      envelopeOf('constraints.evaluate', session, constraintEvaluationPayload(configuration, 20)),
    );
    expect(overLimit.ok).toBe(true);
    if (overLimit.ok) {
      const outcome = recordOf(overLimit.value.result);
      expect(outcome['ok']).toBe(true);
      expect(recordOf(outcome['result'])['outcome']).toBe('violated');
      expect(recordOf(outcome['result'])['violated']).toBe(true);
    }

    // Verification chain over the committed field evidence (the harness
    // asserts the authority ADMITS it — the P06 regression).
    const evidenceFile = recordOf(configuration.records.evidence);
    const solutionFile = recordOf(configuration.records.solution);
    const chain = await callGateway(
      BASE,
      envelopeOf(
        'verification.validateChain',
        session,
        verificationChainPayload(configuration, {
          evidenceRecord: evidenceFile['record'] as never,
          evidenceDigest: String(evidenceFile['evidenceDigest']),
          solutionId: String(solutionFile['solutionId']),
          approverId: configuration.templates.action.approverPrincipal,
        }),
      ),
    );
    expect(chain.ok).toBe(true);
    if (chain.ok) {
      // The verification authority's own verdict: the admitted chain (or
      // the typed issue list — never a client-invented 'valid' flag).
      const outcome = recordOf(chain.value.result);
      expect(outcome['ok']).toBe(true);
      expect(listValue(recordOf(outcome['chain'])['requirements'])).toHaveLength(2);
    }

    // The human baseline decision through the solution authority.
    const sealedRecord = { ...solutionFile, contentDigest: baselineDigest };
    const approved = await callGateway(
      BASE,
      envelopeOf(
        'solution.approveBaseline',
        session,
        approveBaselinePayload(configuration, sealedRecord as never, configuration.templates.action.approverPrincipal),
      ),
    );
    expect(approved.ok).toBe(true);

    // The Action Gateway approval path with the authority's own statuses.
    const actionId = `action:construction-web-${Date.now().toString(36)}`;
    const submitted = await callGateway(
      BASE,
      envelopeOf(
        'action.submit',
        session,
        actionSubmitPayload(configuration, {
          actionId,
          proposedBy: 'agent:delivery-copilot',
          constrainedValue: 12,
        }),
      ),
    );
    expect(submitted.ok).toBe(true);
    if (submitted.ok) {
      expect(recordOf(recordOf(submitted.value.result)['action'])['status']).toBe('awaiting-approval');
    }
    const actionApproved = await callGateway(
      BASE,
      envelopeOf(
        'action.approve',
        session,
        actionApprovePayload(configuration, {
          actionId,
          decidedBy: configuration.templates.action.approverPrincipal,
          note: 'production journey approval (P06)',
        }),
      ),
    );
    expect(actionApproved.ok).toBe(true);
    if (actionApproved.ok) {
      expect(recordOf(recordOf(actionApproved.value.result)['action'])['status']).toBe('authorized');
    }
    const executed = await callGateway(
      BASE,
      envelopeOf('action.execute', session, { actionId }),
    );
    expect(executed.ok).toBe(true);
    if (executed.ok) {
      expect(recordOf(recordOf(executed.value.result)['action'])['status']).toBe('executed');
    }

    // The authoritative action stream carries the executed action (P11's surface).
    const status = await callGateway(BASE, envelopeOf('action.status', session, {}));
    expect(status.ok).toBe(true);
    if (status.ok) {
      const stream = listValue(status.value.result).map((entry) => recordOf(entry));
      expect(stream.some((entry) => entry['actionId'] === actionId && entry['status'] === 'executed')).toBe(true);
    }
  }, 120_000);
});

/** P07 — plan/acquire: Program of Work/BOQ + the procurement chain. */
describe.skipIf(!ENABLED)('P07 plan / acquire', () => {
  it('program.build + program.schedule fold the plan; procurement.quote → procurement.order ground the acquisition', async () => {
    journal.enter('P07');
    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');
    const configuration = await bootstrap(BASE, session);

    const program = await callGateway(
      BASE,
      envelopeOf('program.build', session, programContentPayload(configuration, configuration.records.solution)),
    );
    expect(program.ok).toBe(true);
    if (program.ok) {
      const result = recordOf(program.value.result);
      expect(result['programId']).toBe('program:warehouse-extension');
      expect(String(result['contentDigest'])).toMatch(/^[0-9a-f]{64}$/);
    }

    const schedule = await callGateway(
      BASE,
      envelopeOf('program.schedule', session, {
        program: program.ok ? program.value.result : configuration.records.program,
      }),
    );
    expect(schedule.ok).toBe(true);
    if (schedule.ok) {
      const quantity = recordOf(recordOf(schedule.value.result)['quantity']);
      expect(listValue(quantity['rows']).length).toBeGreaterThan(0);
    }

    const quoted = await callGateway(
      BASE,
      envelopeOf('procurement.quote', session, procurementQuotePayload(configuration)),
    );
    expect(quoted.ok).toBe(true);
    let runtimeQuote: unknown = null;
    if (quoted.ok) {
      runtimeQuote = recordOf(quoted.value.result)['quote'];
      expect(String(recordOf(runtimeQuote as never)['contentDigest'])).toMatch(/^[0-9a-f]{64}$/);
    }

    const ordered = await callGateway(
      BASE,
      envelopeOf('procurement.order', session, procurementOrderPayload(configuration, runtimeQuote as never)),
    );
    expect(ordered.ok).toBe(true);
    if (ordered.ok) {
      expect(String(recordOf(recordOf(ordered.value.result)['order'])['poId'])).toMatch(/^po:/);
    }
  }, 120_000);
});

/** P08 — realize/observe/verify: realization + observation + verification + forecast. */
describe.skipIf(!ENABLED)('P08 realize / observe / verify', () => {
  it('delivery.open + delivery.observe + verification chain + the rolling forecast all ground through the gateway', async () => {
    journal.enter('P08');
    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');
    const configuration = await bootstrap(BASE, session);
    const solutionFile = recordOf(configuration.records.solution);

    const deliveryId = `delivery:construction-web-${Date.now().toString(36)}`;
    const opened = await callGateway(
      BASE,
      envelopeOf(
        'delivery.open',
        session,
        deliveryOpenPayload(configuration, configuration.records.solution, deliveryId),
      ),
    );
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      const result = recordOf(opened.value.result);
      expect(result['deliveryId']).toBe(deliveryId);
      expect(String(result['contentDigest'])).toMatch(/^[0-9a-f]{64}$/);
    }

    const observed = await callGateway(
      BASE,
      envelopeOf(
        'delivery.observe',
        session,
        deliveryObservePayload(configuration, {
          solutionId: String(solutionFile['solutionId']),
          deliveryId,
          activityId: FIRST_ACTIVITY.construction!,
          observedBy: session.principalId,
          quantity: '118.5',
          unit: MEASURE_UNIT.construction!,
          captureKey: `p08-capture-${Date.now().toString(36)}`,
          program: configuration.records.program,
        }),
      ),
    );
    expect(observed.ok).toBe(true);
    if (observed.ok) {
      // The observation lands in the execution-tracking store; the
      // authority's digest-verified outcome is the outcome digest (the
      // UI's own fallback semantics).
      const digest = recordOf(observed.value.result)['contentDigest'] ?? observed.value.outcomeDigest;
      expect(String(digest)).toMatch(/^[0-9a-f]{64}$/);
    }

    const evidenceFile = recordOf(configuration.records.evidence);
    const verified = await callGateway(
      BASE,
      envelopeOf(
        'verification.validateChain',
        session,
        verificationChainPayload(configuration, {
          evidenceRecord: evidenceFile['record'] as never,
          evidenceDigest: String(evidenceFile['evidenceDigest']),
          solutionId: String(solutionFile['solutionId']),
          approverId: configuration.templates.action.approverPrincipal,
        }),
      ),
    );
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      // The verification authority's own verdict (admitted chain or issues).
      const outcome = recordOf(verified.value.result);
      expect(outcome['ok']).toBe(true);
      expect(listValue(recordOf(outcome['chain'])['results'])).toHaveLength(1);
    }

    const forecast = await callGateway(
      BASE,
      envelopeOf(
        'actualization.forecast',
        session,
        forecastPayload(configuration, {
          solutionId: String(solutionFile['solutionId']),
          activityId: FIRST_ACTIVITY.construction!,
          plannedValue: '120',
          actualsValue: '40',
          unit: MEASURE_UNIT.construction!,
          performanceFactor: '1.1',
          recordedBy: session.principalId,
        }),
      ),
    );
    expect(forecast.ok).toBe(true);
    if (forecast.ok) {
      const result = recordOf(forecast.value.result);
      expect(Number(result['remaining'])).toBe(80);
      expect(Number(result['atCompletion'])).toBe(128);
    }
  }, 120_000);
});

/** P11 — agent supervision: the supervision pass + alerts + the action stream. */
describe.skipIf(!ENABLED)('P11 agent supervision / intervention', () => {
  it('supervision.check evaluates the delivery; findings raise alerts; the action stream exposes pending agent actions', async () => {
    journal.enter('P11');
    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');
    const configuration = await bootstrap(BASE, session);

    const supervised = await callGateway(
      BASE,
      envelopeOf(
        'supervision.check',
        session,
        supervisionCheckPayload(configuration, {
          program: configuration.records.program,
          delivery: configuration.records.delivery,
          evaluatedBy: session.principalId,
        }),
      ),
    );
    expect(supervised.ok).toBe(true);
    let findings: Record<string, unknown>[] = [];
    if (supervised.ok) {
      findings = listValue(recordOf(supervised.value.result)['findings']).map((entry) => recordOf(entry));
      for (const finding of findings) {
        expect(typeof finding['findingId']).toBe('string');
      }
    }

    if (findings.length > 0) {
      const raised = await callGateway(
        BASE,
        envelopeOf(
          'alerts.raise',
          session,
          alertRaisePayload(configuration, { finding: findings[0] as never, raisedBy: session.principalId }),
        ),
      );
      expect(raised.ok).toBe(true);
    }

    // The supervision intervention surface: the authoritative action stream.
    const stream = await callGateway(BASE, envelopeOf('action.status', session, {}));
    expect(stream.ok).toBe(true);
    if (stream.ok) {
      expect(Array.isArray(stream.value.result)).toBe(true);
    }
  }, 120_000);
});

/** P12 — recovery: typed error envelopes + safe retry. */
describe.skipIf(!ENABLED)('P12 recovery (typed errors + retry)', () => {
  it('malformed input, unknown operations and tenantless envelopes return typed validation errors', async () => {
    journal.enter('P12');
    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');

    // (a) Malformed JSON body → the transport-level typed envelope (400).
    const malformed = await postGatewayRaw(BASE, null, {
      surface: 'POST /api/gateway (malformed JSON)',
      rawBody: '{"schemaVersion": 1, "operation":',
    });
    expect(malformed.status).toBe(400);
    const malformedError = recordOf(recordOf(malformed.body)['error']);
    expect(malformedError['class']).toBe('validation');
    expect(malformedError['code']).toBe('request-envelope-malformed');

    // (b) An invented operation is rejected before dispatch (the envelope
    // vocabulary is closed — the UI cannot invent operations).
    const bogus = await postGatewayRaw(BASE, {
      schemaVersion: 1,
      contractVersion: '1.0.0',
      operation: 'kernel.world.mutate-directly',
      session: { schemaVersion: 1, sessionId: session.sessionId },
      correlation: { schemaVersion: 1, correlationId: 'corr:p12-unknown-op', origin: 'web', issuedAt: new Date().toISOString() },
      tenant: { tenantId: session.tenantId },
      payload: {},
    });
    const bogusError = recordOf(recordOf(bogus.body)['error']);
    expect(bogusError['class']).toBe('validation');
    expect(bogusError['code']).toBe('request-envelope-malformed');

    // (c) A tenantless envelope is refused at the transport (400).
    const tenantless = await postGatewayRaw(BASE, { schemaVersion: 1, operation: 'world.entities' });
    expect(tenantless.status).toBe(400);
    const tenantlessError = recordOf(recordOf(tenantless.body)['error']);
    expect(tenantlessError['class']).toBe('validation');
  }, 60_000);

  it('an expired session fails closed with the re-authenticate recovery action and re-authentication recovers', async () => {
    journal.enter('P12');
    // 1ms TTL — expires immediately.
    const expiring = await signIn(BASE, 'construction', 'principal:delivery-lead', { ttlMs: 1 });
    await new Promise((resolve) => setTimeout(resolve, 25));

    const denied = await callGateway(BASE, envelopeOf('world.entities', expiring, {}));
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.class).toBe('auth-session-expired');
      expect(recordOf(denied.error.details)['reauthRequired']).toBe(true);
    }

    // Recovery: re-authentication issues a fresh usable session.
    const fresh = await signIn(BASE, 'construction', 'principal:delivery-lead');
    const recovered = await callGateway(BASE, envelopeOf('world.entities', fresh, {}));
    expect(recovered.ok).toBe(true);
  }, 60_000);

  it('an idempotent retry with the SAME correlation + idempotency key replays the recorded outcome exactly', async () => {
    journal.enter('P12');
    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');
    const configuration = await bootstrap(BASE, session);
    const correlation = `corr:p12-retry-${Date.now().toString(36)}`;
    const idempotency = `idem:p12-retry-${Date.now().toString(36)}`;
    const payload = evidenceIntakePayload(configuration, {
      subjectId: 'construction-field-capture',
      note: 'p12 idempotent retry evidence',
      confidenceValue: 0.9,
      observedBy: session.principalId,
    });

    const first = await callGateway(
      BASE,
      envelopeOf('evidence.intake', session, payload, { correlation, idempotencyKey: idempotency }),
    );
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.value.replayed).toBe(false);
      expect(first.value.correlationId).toBe(correlation);
    }

    // The retry after an interruption replays the SAME outcome (digest + all).
    const retry = await callGateway(
      BASE,
      envelopeOf('evidence.intake', session, payload, { correlation, idempotencyKey: idempotency }),
    );
    expect(retry.ok).toBe(true);
    if (retry.ok && first.ok) {
      expect(retry.value.replayed).toBe(true);
      expect(retry.value.outcomeDigest).toBe(first.value.outcomeDigest);
      expect(retry.value.result).toEqual(first.value.result);
    }
  }, 60_000);
});

/** P14 — production persistence (durable within the bound store; honest about bindings). */
describe.skipIf(!ENABLED)('P14 production persistence', () => {
  it('sessions persist across requests and idempotency records replay exactly; readiness reports the durable-binding truth', async () => {
    journal.enter('P14');
    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');
    const configuration = await bootstrap(BASE, session);

    // The session record persists across requests (through the bound
    // persistence port — Neon in the production profile).
    const early = await callGateway(BASE, envelopeOf('session.validate', session, {}));
    expect(early.ok).toBe(true);
    const mid = await callGateway(
      BASE,
      envelopeOf('world.snapshot', session, {}),
    );
    expect(mid.ok).toBe(true);
    const late = await callGateway(BASE, envelopeOf('session.validate', session, {}));
    expect(late.ok).toBe(true);

    // Idempotent replay: the recorded outcome survives and replays exactly.
    const correlation = `corr:p14-persist-${Date.now().toString(36)}`;
    const idempotency = `idem:p14-persist-${Date.now().toString(36)}`;
    const payload = evidenceIntakePayload(configuration, {
      subjectId: 'construction-field-capture',
      note: 'p14 persistence evidence',
      confidenceValue: 0.88,
      observedBy: session.principalId,
    });
    const first = await callGateway(
      BASE,
      envelopeOf('evidence.intake', session, payload, { correlation, idempotencyKey: idempotency }),
    );
    expect(first.ok).toBe(true);
    const replay = await callGateway(
      BASE,
      envelopeOf('evidence.intake', session, payload, { correlation, idempotencyKey: idempotency }),
    );
    expect(replay.ok).toBe(true);
    if (replay.ok && first.ok) {
      expect(replay.value.replayed).toBe(true);
      expect(replay.value.outcomeDigest).toBe(first.value.outcomeDigest);
    }

    // The readiness projection states the durable-binding truth: whichever
    // binding kind is active, the degradation flags agree with it (the
    // journey record reports the OBSERVED kind; restart-durability of
    // Neon-backed state is W053/W055 live verification).
    const readyz = await getEndpoint(BASE, '/api/readyz');
    expect(readyz.status).toBe(200);
    const body = recordOf(readyz.body);
    const persistenceKind = String(recordOf(recordOf(body['bindings'])['persistence'])['kind']);
    expect(['in-memory', 'postgres']).toContain(persistenceKind);
    const degraded = listValue(body['degraded']).map(String);
    expect(degraded.includes('persistence:in-memory')).toBe(persistenceKind === 'in-memory');
  }, 90_000);
});

/** P15 — object/evidence upload + retrieval (digest-verified round trip). */
describe.skipIf(!ENABLED)('P15 object / evidence upload + retrieval', () => {
  it('evidence.intake admits a digest-anchored capture and evidence.get returns it digest-verified', async () => {
    journal.enter('P15');
    const anchors = anchorsOf('construction');
    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');
    const configuration = await bootstrap(BASE, session);

    const intake = await callGateway(
      BASE,
      envelopeOf(
        'evidence.intake',
        session,
        evidenceIntakePayload(configuration, {
          subjectId: 'construction-field-capture',
          note: 'p15 digest-verified capture',
          confidenceValue: 0.95,
          observedBy: session.principalId,
        }),
      ),
    );
    expect(intake.ok).toBe(true);
    if (intake.ok) {
      const receipt = recordOf(recordOf(intake.value.result)['receipt']);
      const admittedDigest = String(receipt['digest']);
      expect(admittedDigest).toMatch(/^[0-9a-f]{64}$/);
    }

    // The lookup returns the captured record, digest-verified: the record
    // carries the committed object-bytes anchor (the digest-addressed
    // object the deployment restored at boot) and the intake receipt's
    // digest is stable across an idempotent replay (P12/P14 semantics).
    const lookup = await callGateway(
      BASE,
      envelopeOf('evidence.get', session, { artifactId: 'construction-field-capture' }),
    );
    expect(lookup.ok).toBe(true);
    if (lookup.ok) {
      const records = listValue(lookup.value.result).map((entry) => recordOf(entry));
      const captured = records.find((record) => {
        const content = recordOf(record['content'] ?? {});
        const data = recordOf(content['data'] ?? {});
        return data['note'] === 'p15 digest-verified capture';
      });
      expect(captured).toBeDefined();
      if (captured !== undefined) {
        const subject = recordOf(captured['subject']);
        expect(subject['digest']).toBe(anchors.objectBytesDigest);
        expect(subject['artifactId']).toBe('construction-field-capture');
      }
    }
  }, 90_000);
});

/** P17 — rate-limit behavior: exceed the configured budget → typed 429, no crash. */
describe.skipIf(!ENABLED || IP_BUDGET === 0)('P17 rate-limit behavior', () => {
  it(`exceeding the configured IP budget (${IP_BUDGET}/window) returns the typed transient envelope with HTTP 429`, async () => {
    journal.enter('P17');
    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');

    // Hammer the public gateway past the configured budget. Each POST
    // consumes the IP-guard budget (the guard runs before validation), so
    // even cheap invalid-session probes count; a healthy deployment must
    // answer with the typed transient/gateway-overloaded envelope + 429,
    // and keep serving (no crash).
    let limited: { status: number; body: unknown; headers: Headers } | null = null;
    for (let attempt = 0; attempt < IP_BUDGET + 10; attempt += 1) {
      const response = await postGatewayRaw(BASE, {
        schemaVersion: 1,
        contractVersion: '1.0.0',
        operation: 'session.validate',
        session: { schemaVersion: 1, sessionId: session.sessionId },
        correlation: { schemaVersion: 1, correlationId: `corr:p17-probe-${attempt}`, origin: 'web', issuedAt: new Date().toISOString() },
        tenant: { tenantId: session.tenantId },
        payload: {},
      });
      if (response.status === 429) {
        limited = response;
        break;
      }
    }
    expect(limited).not.toBeNull();
    if (limited !== null) {
      const error = recordOf(recordOf(limited.body)['error']);
      expect(error['class']).toBe('transient');
      expect(error['code']).toBe('gateway-overloaded');
      const rateLimit = recordOf(recordOf(error['details'])['rateLimit']);
      expect(Number(rateLimit['limit'])).toBe(IP_BUDGET);
      expect(Number(rateLimit['retryAfterMs'])).toBeGreaterThan(0);
      const retryAfter = Number(limited.headers.get('retry-after'));
      expect(Number.isFinite(retryAfter)).toBe(true);
      expect(retryAfter).toBeGreaterThanOrEqual(1);
    }

    // No crash: the liveness probe still answers.
    const health = await getEndpoint(BASE, '/api/healthz');
    expect(health.status).toBe(200);
    expect(recordOf(health.body)['ok']).toBe(true);
  }, 120_000);
});

/** P18 — tenant isolation: cross-tenant attempts fail closed over the public endpoint. */
describe.skipIf(!ENABLED)('P18 tenant isolation (fail-closed negatives)', () => {
  it('a nordstrand session is refused in the lightspeed tenant scope (unknown there — fail closed)', async () => {
    journal.enter('P18');
    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');
    const crossTenant = await callGateway(
      BASE,
      envelopeOf('world.entities', { sessionId: session.sessionId, tenantId: DOMAIN_TENANTS.software }, {}),
    );
    expect(crossTenant.ok).toBe(false);
    if (!crossTenant.ok) {
      expect(crossTenant.error.class).toBe('auth-session-expired');
      expect(crossTenant.error.code).toBe('session-unknown');
    }
  }, 60_000);

  it('the session-gated bootstrap refuses a session from another tenant', async () => {
    journal.enter('P18');
    const session = await signIn(BASE, 'construction', 'principal:delivery-lead');
    const response = await fetch(`${BASE}/api/product/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'software', sessionId: session.sessionId }),
    });
    journal.record({
      surface: 'POST /api/product/bootstrap (cross-tenant)',
      status: response.status,
      ok: false,
      correlationId: '—',
      replayed: null,
      errorCode: response.status === 401 ? 'auth-session-expired' : `http-${response.status}`,
    });
    expect(response.status).toBe(401);
    const body = recordOf(await response.json());
    expect(body['error']).toBe('auth-session-expired');
  }, 60_000);

  it('an unknown tenant is refused at the transport (no environment is bound)', async () => {
    journal.enter('P18');
    const response = await postGatewayRaw(BASE, {
      schemaVersion: 1,
      contractVersion: '1.0.0',
      operation: 'world.entities',
      session: { schemaVersion: 1, sessionId: 'session:nothing' },
      correlation: { schemaVersion: 1, correlationId: 'corr:p18-unknown-tenant', origin: 'web', issuedAt: new Date().toISOString() },
      tenant: { tenantId: 'tenant:attacker' },
      payload: {},
    });
    expect(response.status).toBe(400);
    const error = recordOf(recordOf(response.body)['error']);
    expect(error['class']).toBe('validation');
    expect(error['code']).toBe('request-validation');
  }, 60_000);

  it('cross-tenant session ISSUANCE probe: a foreign-domain authentication result is recorded (defense-in-depth finding)', async () => {
    journal.enter('P18');
    // The required isolation probe above proves a construction SESSION is
    // unknown in lightspeed. This deeper probe documents what the fixture
    // identity boundary does when a construction-minted authentication
    // result is presented for session ISSUANCE in the lightspeed tenant
    // scope (a W047/W051-frozen composition — product-runtime.ts + the
    // authenticate route are read-only for W052). Whatever the outcome, the
    // compensating control must hold: MUTATIONS in the foreign tenant fail
    // closed through the W009 authorization gate (unknown principal).
    const identity = await authenticate(BASE, 'construction', leadPrincipalOf('construction'));
    expect(identity.ok).toBe(true);
    const issuance = await callGateway(
      BASE,
      envelopeOf('session.issue', { sessionId: 'session:bootstrap', tenantId: DOMAIN_TENANTS.software }, {
        authentication: identity.authentication as never,
        principalId: 'principal:delivery-lead',
        tenantId: DOMAIN_TENANTS.software,
        ttlMs: 3_600_000,
        nonce: `nonce-p18-cross-${Date.now().toString(36)}`,
      }),
    );
    if (issuance.ok) {
      // The composition gap exists: the fixture identity boundary minted a
      // session in the foreign tenant. Assert the compensating control.
      const foreignSession: HarnessSession = {
        domain: 'software',
        tenantId: DOMAIN_TENANTS.software,
        principalId: 'principal:delivery-lead',
        sessionId: String(recordOf(issuance.value.result)['sessionId']),
        issuedAt: '',
        expiresAt: '',
      };
      const mutation = await callGateway(
        BASE,
        envelopeOf(
          'evidence.intake',
          foreignSession,
          {
            record: {
              schemaVersion: 1,
              kind: 'observation',
              subject: { artifactId: 'software-field-capture', revision: 'r1', digest: '0'.repeat(64) },
              producedBy: { runId: 'p18-cross-tenant-probe', actorId: foreignSession.principalId },
              observedAt: new Date().toISOString(),
              content: { mediaType: 'application/json', data: { note: 'cross-tenant mutation probe' } },
              confidence: { distribution: { kind: 'point', value: 0.5 }, method: 'stated', rationale: 'probe' },
            },
          },
        ),
      );
      expect(mutation.ok).toBe(false);
      if (!mutation.ok) {
        expect(['authority-rejected', 'validation', 'auth-session-expired']).toContain(mutation.error.class);
      }
    } else {
      // Fail-closed issuance: the composition holds at the boundary.
      expect(['auth-session-expired', 'validation', 'authority-rejected']).toContain(issuance.error.class);
    }
  }, 90_000);
});
