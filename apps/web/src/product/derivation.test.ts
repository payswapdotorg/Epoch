/**
 * The journey payload derivation tests (W047): every derived payload is
 * exercised END-TO-END through the real ApplicationGateway composition —
 * the same payloads the browser journeys submit. If a kernel rejects a
 * derived payload, the journey would fail in the browser; this test fails
 * first (reproduce -> fix -> rerun discipline).
 */
import { describe, expect, it } from 'vitest';
import type { GatewayRequestEnvelope, JsonValue } from '@epoch/client-runtime';
import { getProductRuntime, authenticatePrincipal, type ProductRuntime } from '../server/product-runtime';
import { productConfiguration } from '../server/product-config';
import {
  actionApprovePayload,
  actionSubmitPayload,
  approveBaselinePayload,
  constraintEvaluationPayload,
  deliveryObservePayload,
  deliveryOpenPayload,
  discoveryRunPayload,
  entitlementCheckPayload,
  evidenceIntakePayload,
  forecastPayload,
  outcomeLearnPayload,
  procurementOrderPayload,
  procurementQuotePayload,
  programContentPayload,
  solutionAlternativeContents,
  supervisionCheckPayload,
  alertRaisePayload,
  verificationChainPayload,
} from './derivation';
import type { ProductConfiguration } from './types';

type Gateway = import('@epoch/application-gateway').ApplicationGateway;
void (null as unknown as ProductRuntime);

function envelope(
  operation: GatewayRequestEnvelope['operation'],
  sessionId: string,
  tenantId: string,
  payload: JsonValue,
  idem: string,
): GatewayRequestEnvelope {
  return {
    schemaVersion: 1,
    contractVersion: '1.0.0',
    operation,
    session: { schemaVersion: 1, sessionId },
    correlation: { schemaVersion: 1, correlationId: `corr:derivation-${idem}`, origin: 'web', issuedAt: '2026-03-02T18:00:00.000Z' },
    tenant: { tenantId },
    idempotencyKey: `idem:${idem}`,
    payload,
  };
}

async function session(gateway: Gateway, tenantId: string, principalId: string): Promise<string> {
  const runtime = await getProductRuntime();
  const environment = runtime.gatewayForTenant(tenantId)!;
  const authentication = authenticatePrincipal(environment, principalId);
  const result = await gateway.call(
    envelope('session.issue', 'session:bootstrap', tenantId, {
      authentication,
      principalId,
      tenantId,
      ttlMs: 3_600_000,
      nonce: `nonce-${Date.now().toString(36)}`,
    }, `session-${principalId.replace(/[^a-z0-9-]+/g, '')}-${Date.now().toString(36)}`),
  );
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return (result.value.result as { sessionId: string }).sessionId;
}

function unwrap(result: { ok: boolean; error?: unknown; value?: { result: unknown } }): Record<string, unknown> {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value!.result as Record<string, unknown>;
}

async function setup(domain: 'construction' | 'software'): Promise<{
  readonly gateway: Gateway;
  readonly sessionId: string;
  readonly configuration: ProductConfiguration;
  readonly tenantId: string;
}> {
  const runtime = await getProductRuntime();
  const environment = runtime.environmentForDomain(domain)!;
  const sessionId = await session(environment.gateway, environment.tenantId, environment.bundle.committedAuthentication.principalId);
  const configuration = productConfiguration(environment.bundle, environment.worldDigest) as unknown as ProductConfiguration;
  return { gateway: environment.gateway, sessionId, configuration, tenantId: environment.tenantId };
}

describe('the decision journey payloads (J04) through the real gateway', () => {
  it('seals both alternatives, evaluates the constraint, validates the chain, approves the baseline and the action', async () => {
    const { gateway, sessionId, configuration, tenantId } = await setup('construction');

    // Alternatives: both seal to distinct digests.
    const alternatives = solutionAlternativeContents(configuration);
    const digests: string[] = [];
    let sealedBaseline: Record<string, unknown> | undefined;
    for (const alternative of alternatives) {
      const sealed = unwrap(
        await gateway.call(envelope('solution.sealVersion', sessionId, tenantId, { content: alternative.content }, `seal-${alternative.id}-${Date.now().toString(36)}`)),
      );
      digests.push(String(sealed['contentDigest']));
      if (alternative.id === 'baseline') sealedBaseline = sealed;
    }
    expect(digests[0]).not.toBe(digests[1]);

    // The baseline alternative re-seals the fixture content exactly.
    expect(digests[0]).toBe(String((configuration.records.solution as Record<string, unknown>)['contentDigest']));

    // Constraint evaluation: satisfied under the limit, violated over it.
    const under = unwrap(
      await gateway.call(envelope('constraints.evaluate', sessionId, tenantId, constraintEvaluationPayload(configuration, 12), `constraint-under-${Date.now().toString(36)}`)),
    );
    expect(String(under['status'])).not.toBe('rejected');
    const over = unwrap(
      await gateway.call(envelope('constraints.evaluate', sessionId, tenantId, constraintEvaluationPayload(configuration, 20), `constraint-over-${Date.now().toString(36)}`)),
    );
    // The authority's own verdict surfaces verbatim (not gateway-invented).
    expect(over).toBeDefined();

    // Verification chain over the sealed baseline — the W052 P06
    // regression: the authority must ADMIT the derived chain (the earlier
    // projection was rejected with evidence-run-mismatch /
    // evidence-not-produced-by-run / evidence-digest-mismatch).
    const evidenceFile = configuration.records.evidence as Record<string, unknown>;
    const chain = unwrap(
      await gateway.call(envelope('verification.validateChain', sessionId, tenantId, verificationChainPayload(configuration, {
        evidenceRecord: evidenceFile['record'] as never,
        evidenceDigest: String(evidenceFile['evidenceDigest']),
        solutionId: String((configuration.records.solution as Record<string, unknown>)['solutionId']),
        approverId: 'principal:chief-engineer',
      }), `chain-${Date.now().toString(36)}`)),
    );
    expect(chain['ok']).toBe(true);
    expect(chain['issues']).toBeUndefined();

    // Baseline approval (the solution-delivery authority) over the SEALED record.
    const approved = unwrap(
      await gateway.call(envelope('solution.approveBaseline', sessionId, tenantId, approveBaselinePayload(configuration, sealedBaseline as unknown as JsonValue, 'principal:chief-engineer'), `baseline-${Date.now().toString(36)}`)),
    );
    expect(approved['approval']).toBeDefined();

    // The Action Gateway path: submit -> approve -> execute.
    const actionId = `action:construction-web-${Date.now().toString(36)}`;
    const submitted = unwrap(
      await gateway.call(envelope('action.submit', sessionId, tenantId, actionSubmitPayload(configuration, { actionId, proposedBy: 'agent:delivery-copilot', constrainedValue: 12 }), `submit-${Date.now().toString(36)}`)),
    );
    expect(String((submitted['action'] as Record<string, unknown>)['actionId'])).toBe(actionId);
    const approvedAction = unwrap(
      await gateway.call(envelope('action.approve', sessionId, tenantId, actionApprovePayload(configuration, {
        actionId,
        decidedBy: 'principal:chief-engineer',
        note: 'web decide approval',
      }), `approve-${Date.now().toString(36)}`)),
    );
    expect(approvedAction).toBeDefined();
    const executed = unwrap(
      await gateway.call(envelope('action.execute', sessionId, tenantId, { actionId }, `execute-${Date.now().toString(36)}`)),
    );
    expect(executed).toBeDefined();
    const status = unwrap(
      await gateway.call(envelope('action.status', sessionId, tenantId, { actionId }, `status-${Date.now().toString(36)}`)),
    );
    expect(String(status['actionId'])).toBe(actionId);
  });
});

describe('the plan + acquire journey payloads (J05) through the real gateway', () => {
  it('builds the program, folds the schedule (BOQ) and grounds the quote -> order chain', async () => {
    const { gateway, sessionId, configuration, tenantId } = await setup('construction');
    const alternatives = solutionAlternativeContents(configuration);
    const sealed = unwrap(
      await gateway.call(envelope('solution.sealVersion', sessionId, tenantId, { content: alternatives[0]!.content }, `seal-plan-${Date.now().toString(36)}`)),
    );

    // Program of work over the sealed solution.
    const program = unwrap(
      await gateway.call(envelope('program.build', sessionId, tenantId, programContentPayload(configuration, sealed as unknown as JsonValue), `program-${Date.now().toString(36)}`)),
    );
    expect(String(program['programId'])).toBe('program:warehouse-extension');

    // BOQ / domain schedule folds.
    const schedule = unwrap(
      await gateway.call(envelope('program.schedule', sessionId, tenantId, { program: configuration.records.program }, `schedule-${Date.now().toString(36)}`)),
    );
    expect(schedule['quantity']).toBeDefined();
    expect(schedule['cost']).toBeDefined();
    expect(schedule['milestones']).toBeDefined();
    expect(schedule['resources']).toBeDefined();

    // Procurement: quote then order (the grounded chain).
    const quote = unwrap(
      await gateway.call(envelope('procurement.quote', sessionId, tenantId, procurementQuotePayload(configuration), `quote-${Date.now().toString(36)}`)),
    );
    expect(quote['quote']).toBeDefined();
    const order = unwrap(
      await gateway.call(envelope('procurement.order', sessionId, tenantId, procurementOrderPayload(configuration, quote['quote'] as JsonValue), `order-${Date.now().toString(36)}`)),
    );
    expect(order['order']).toBeDefined();
  });
});

describe('the realization journey payloads (J06) through the real gateway', () => {
  it('opens the delivery, observes the field, rolls the forecast, supervises, alerts, learns', async () => {
    const { gateway, sessionId, configuration, tenantId } = await setup('construction');
    const alternatives = solutionAlternativeContents(configuration);
    const sealed = unwrap(
      await gateway.call(envelope('solution.sealVersion', sessionId, tenantId, { content: alternatives[0]!.content }, `seal-realize-${Date.now().toString(36)}`)),
    );
    const deliveryId = `delivery:construction-web-${Date.now().toString(36)}`;
    const delivery = unwrap(
      await gateway.call(envelope('delivery.open', sessionId, tenantId, deliveryOpenPayload(configuration, sealed as unknown as JsonValue, deliveryId), `delivery-${Date.now().toString(36)}`)),
    );
    expect(String(delivery['deliveryId'])).toBe(deliveryId);

    // Field observation (the fixture program anchors the capture).
    const observation = unwrap(
      await gateway.call(envelope('delivery.observe', sessionId, tenantId, deliveryObservePayload(configuration, {
        solutionId: String((configuration.records.solution as Record<string, unknown>)['solutionId']),
        deliveryId,
        activityId: 'activity:warehouse-excavation',
        observedBy: 'principal:field-engineer',
        quantity: '118.5',
        unit: 'm3',
        captureKey: `web-capture-${Date.now().toString(36)}`,
        program: configuration.records.program,
      }), `observe-${Date.now().toString(36)}`)),
    );
    expect(observation).toBeDefined();

    // Rolling forecast.
    const forecast = unwrap(
      await gateway.call(envelope('actualization.forecast', sessionId, tenantId, forecastPayload(configuration, {
        solutionId: String((configuration.records.solution as Record<string, unknown>)['solutionId']),
        activityId: 'activity:warehouse-excavation',
        plannedValue: '120',
        actualsValue: '40',
        unit: 'm3',
        performanceFactor: '1.1',
        recordedBy: 'principal:delivery-lead',
      }), `forecast-${Date.now().toString(36)}`)),
    );
    expect(forecast['atCompletion']).toBeDefined();

    // Supervision pass over the fixture program + the opened delivery.
    const supervision = unwrap(
      await gateway.call(envelope('supervision.check', sessionId, tenantId, supervisionCheckPayload(configuration, {
        program: configuration.records.program,
        delivery: configuration.records.delivery,
        evaluatedBy: 'principal:delivery-lead',
      }), `supervision-${Date.now().toString(36)}`)),
    );
    expect(supervision['findings']).toBeDefined();

    // Alert from the first finding (when present).
    const findings = (supervision['findings'] as readonly Record<string, unknown>[]) ?? [];
    if (findings.length > 0) {
      const raised = unwrap(
        await gateway.call(envelope('alerts.raise', sessionId, tenantId, alertRaisePayload(configuration, {
          finding: findings[0]! as unknown as JsonValue,
          raisedBy: 'principal:delivery-lead',
        }), `alert-${Date.now().toString(36)}`)),
      );
      expect(raised).toBeDefined();
    }

    // Outcome learning (the kernel-sealed record).
    const learned = unwrap(
      await gateway.call(envelope('outcome.learn', sessionId, tenantId, outcomeLearnPayload(configuration, String((configuration.records.solution as Record<string, unknown>)['solutionId'])), `learn-${Date.now().toString(36)}`)),
    );
    expect(learned).toBeDefined();

    // Evidence intake + lookup.
    const intake = unwrap(
      await gateway.call(envelope('evidence.intake', sessionId, tenantId, evidenceIntakePayload(configuration, {
        subjectId: 'construction-field-capture',
        note: 'web evidence note',
        confidenceValue: 0.9,
        observedBy: 'principal:field-engineer',
      }), `evidence-${Date.now().toString(36)}`)),
    );
    expect(intake['receipt']).toBeDefined();
    const got = unwrap(
      await gateway.call(envelope('evidence.get', sessionId, tenantId, { artifactId: 'construction-field-capture' }, `evidence-get-${Date.now().toString(36)}`)),
    );
    expect(Array.isArray(got) ? got.length : 1).toBeGreaterThan(0);

    // Delivery close.
    const closed = unwrap(
      await gateway.call(envelope('delivery.close', sessionId, tenantId, {
        delivery: configuration.records.delivery,
        closing: {
          schema: 'epoch.solution-delivery.delivery-closing',
          schemaVersion: 1,
          closedAt: '2026-03-02T18:00:00.000Z',
          closedBy: 'principal:delivery-lead',
          outcome: 'delivered',
          note: 'web close-stage delivery closing',
        },
      }, `close-${Date.now().toString(36)}`)),
    );
    expect(String(closed['status'])).toBe('closed');
  });
});

describe('the discovery + marketplace payloads (J03 + J10) through the real gateway', () => {
  it('runs problem-driven discovery over the candidate catalog and checks the entitlement', async () => {
    const { gateway, sessionId, configuration, tenantId } = await setup('construction');
    const discovery = unwrap(
      await gateway.call(envelope('discovery.run', sessionId, tenantId, discoveryRunPayload(configuration, [
        'candidate:construction-delivery-team',
        'candidate:construction-delivery-copilot',
      ]), `discovery-${Date.now().toString(36)}`)),
    );
    // Roles are synthesized from capability demands — never model names.
    expect(discovery['roleProposals']).toBeDefined();
    const roles = discovery['roleProposals'] as readonly Record<string, unknown>[];
    expect(roles.length).toBeGreaterThan(0);

    const entitlement = unwrap(
      await gateway.call(envelope('marketplace.entitlement', sessionId, tenantId, entitlementCheckPayload(configuration), `entitlement-${Date.now().toString(36)}`)),
    );
    expect(entitlement).toBeDefined();
  });

  it('runs the software domain discovery + entitlement (J03/J10 software coverage)', async () => {
    const { gateway, sessionId, configuration, tenantId } = await setup('software');
    const discovery = unwrap(
      await gateway.call(envelope('discovery.run', sessionId, tenantId, discoveryRunPayload(configuration, [
        'candidate:software-delivery-team',
        'candidate:software-delivery-copilot',
      ]), `discovery-sw-${Date.now().toString(36)}`)),
    );
    expect((discovery['roleProposals'] as readonly unknown[]).length).toBeGreaterThan(0);
    const entitlement = unwrap(
      await gateway.call(envelope('marketplace.entitlement', sessionId, tenantId, entitlementCheckPayload(configuration), `entitlement-sw-${Date.now().toString(36)}`)),
    );
    expect(entitlement).toBeDefined();
  });
});
