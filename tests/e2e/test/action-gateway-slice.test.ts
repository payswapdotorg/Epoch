// W031 Reference E2E slice 4 — ACTION GATEWAY.
//
// The named E2E test for the action path (scenario definition:
// examples/e2e/scenarios/action-gateway.ts). Named invariants:
//
//   1. IDENTITY: the proposal digest is THE SAME at every surface —
//      the W029-built plan, the W020 work item + handoff, the W022
//      decision, the W010 action:lifecycle events
//   2. the OUTCOME record references the exact proposal digest (via
//      the authority's decision chain: outcome -> decisionDigest ->
//      proposalRef.canonicalDigest)
//   3. the full W022 decision vocabulary: requires-approval ->
//      approved -> executed; allow; deny (no-applicable-policy,
//      proposal-expired, constraint-blocked)
//   4. `gateway-bypass-rejected`: an execute-direct envelope is the
//      typed rejection and the AUTHORITY IS NEVER CALLED
//   5. the W022 decision chain verifies (append-only, hash-linked)
//   6. the W038 execution event + W010 action lifecycle events carry
//      canonical identities
//   7. determinism + round-trip
import { describe, expect, it } from 'vitest';
import { GithubActionAdapter, GithubAdapterHost } from '@epoch/adapter-github';
import { parseActionProposal } from '@epoch/action-protocol';
import { verifySealedDecision } from '@epoch/action-policy';
import { verifySealedExecutionEvent } from '@epoch/execution-tracking';
import { parseActionLifecycleEventData, verifyEventDigest } from '@epoch/event-log';
import {
  ACTION_ID,
  ACTION_STREAM_ID,
  ACTION_TENANT,
  NEVER_CALLED_PORT,
  bypassEnvelope,
  runActionGatewayScenario,
  actionGatewayDigestProjection,
} from '../../../examples/e2e/scenarios/action-gateway';
import { referenceSnapshot } from '../../../examples/e2e/scenarios/adapter-intake';
import {
  expectRoundTrip,
  expectScenarioDeterministic,
  unwrap,
} from './helpers';

describe('action-gateway-slice', () => {
  const { first: scenario } = expectScenarioDeterministic(
    runActionGatewayScenario,
    actionGatewayDigestProjection,
    'action-gateway',
  );

  it('the proposal digest is THE SAME at every surface (W029 -> W020 -> W022 -> W010)', () => {
    const admission = parseActionProposal(scenario.plan.proposal);
    expect(admission.ok).toBe(true);
    if (!admission.ok) throw new Error('unreachable');
    // The W003 admission digest...
    const w003Digest = admission.digest;
    // ...is the W029 plan's reference...
    expect(scenario.proposalRef.canonicalDigest).toBe(w003Digest);
    // ...is the W020 work item's + handoff's reference...
    expect(scenario.compiledPlan.steps[0]?.proposal.canonicalDigest).toBe(w003Digest);
    expect(scenario.handoff.proposal.canonicalDigest).toBe(w003Digest);
    // ...is the W022 decision's reference (both routings)...
    const pendingDecision = unwrap(
      scenario.authority.policyRegistry.getDecision(scenario.pendingDispatch.decision.decisionDigest),
      'pending decision lookup',
    );
    const executedDecision = unwrap(
      scenario.authority.policyRegistry.getDecision(scenario.executedDispatch.decision.decisionDigest),
      'executed decision lookup',
    );
    expect(pendingDecision.proposalRef.canonicalDigest).toBe(w003Digest);
    expect(executedDecision.proposalRef.canonicalDigest).toBe(w003Digest);
    // ...and every W010 action:lifecycle event carries it verbatim.
    for (const record of scenario.actionEvents) {
      const data = unwrap(parseActionLifecycleEventData(record.event.payload), 'action lifecycle data');
      expect(data.action.canonicalDigest).toBe(w003Digest);
      expect(data.action.proposalId).toBe(scenario.plan.proposal.proposalId);
    }
  });

  it('the OUTCOME record references the exact proposal digest (decision-chain traceable)', () => {
    const outcome = scenario.executedDispatch.outcome;
    expect(outcome).toBeDefined();
    if (outcome === undefined) throw new Error('the executed dispatch carries no outcome');
    expect(outcome.kind).toBe('succeeded');
    expect(outcome.actionId).toBe(ACTION_ID);
    // outcome -> the dispatch's decision -> the registry's sealed decision
    // -> the exact proposal reference.
    const decision = unwrap(
      scenario.authority.policyRegistry.getDecision(scenario.executedDispatch.decision.decisionDigest),
      'decision of the outcome',
    );
    expect(decision.proposalRef.canonicalDigest).toBe(scenario.proposalRef.canonicalDigest);
    // The dispatch record carries the plan digest (the content address of
    // the proposal plan) as the outcome's evidence reference.
    expect(outcome.evidenceRefs).toContain(`plan:${scenario.plan.planDigest}`);
  });

  it('the W022 decision vocabulary: requires-approval -> approved -> executed (the reference path)', () => {
    expect(scenario.pendingDispatch.decision.outcome).toBe('requires-approval');
    expect(scenario.pendingDispatch.disposition).toBe('authority-pending-approval');
    // The human approval settled the request...
    expect(scenario.approvalRequest.status).toBe('approved');
    // ...and the re-route dispatched through the authority.
    expect(scenario.executedDispatch.decision.outcome).toBe('requires-approval');
    expect(scenario.executedDispatch.decision.actionStatus).toBe('authorized');
    expect(scenario.executedDispatch.disposition).toBe('executed');
  });

  it('the W022 decision vocabulary: allow (no human approval required)', () => {
    expect(scenario.allowDecision.outcome).toBe('allow');
    // Through the authority port: the decision mirror is authorized and
    // the execution outcome succeeds.
    expect(scenario.allowExecution.decision.outcome).toBe('allow');
    expect(scenario.allowExecution.decision.actionStatus).toBe('authorized');
    expect(scenario.allowExecution.outcome.kind).toBe('succeeded');
    expect(scenario.allowExecution.outcome.evidenceRefs[0]).toMatch(/^proposal:[0-9a-f]{64}$/);
  });

  it('the W022 decision vocabulary: deny — no-applicable-policy (fail-closed)', () => {
    expect(scenario.noPolicyDenial.outcome).toBe('deny');
    if (scenario.noPolicyDenial.outcome !== 'deny') throw new Error('unreachable');
    expect(scenario.noPolicyDenial.denial?.code).toBe('no-applicable-policy');
  });

  it('the W022 decision vocabulary: deny — proposal-expired', () => {
    expect(scenario.expiredDenial.outcome).toBe('deny');
    if (scenario.expiredDenial.outcome !== 'deny') throw new Error('unreachable');
    expect(scenario.expiredDenial.denial?.code).toBe('proposal-expired');
  });

  it('the W022 decision vocabulary: deny — constraint-blocked (violated hard constraint)', () => {
    expect(scenario.blockedDenial.outcome).toBe('deny');
    if (scenario.blockedDenial.outcome !== 'deny') throw new Error('unreachable');
    expect(scenario.blockedDenial.denial?.code).toBe('constraint-blocked');
  });

  it('the W022 decision chain verifies (append-only, hash-linked, tamper-evident)', () => {
    const chain = unwrap(
      scenario.authority.policyRegistry.decisionChainFor(ACTION_TENANT, scenario.plan.proposal.proposalId),
      'decision chain read',
    );
    // Two decisions for the base proposal: the approval-path decision,
    // then the empty-policy-set denial — linked by digest.
    expect(chain.length).toBe(2);
    expect(chain[1]?.previousDecisionDigest).toBe(chain[0]?.contentDigest);
    expect(chain[0]?.previousDecisionDigest).toBeNull();
    for (const decision of chain) {
      unwrap(verifySealedDecision(decision), 'sealed decision verification');
    }
  });

  it('`gateway-bypass-rejected`: an execute-direct envelope is the typed rejection AND the authority is never called', () => {
    const host = new GithubAdapterHost({ expectedTenantId: ACTION_TENANT });
    unwrap(
      host.ingestSnapshot({
        tenantId: ACTION_TENANT,
        payload: referenceSnapshot(),
        ingestedAt: '2026-05-04T11:00:00.000Z',
      }),
      'ingest snapshot for the bypass adapter',
    );
    // The STRICT port: any call throws (the assertion is that it is
    // never reached).
    const adapter = new GithubActionAdapter({ host, authority: NEVER_CALLED_PORT, expectedTenantId: ACTION_TENANT });
    const result = adapter.invokeTotal(bypassEnvelope());
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== 'gateway-bypass-rejected') {
      throw new Error(`unexpected bypass outcome: ${JSON.stringify(result.ok ? 'ok' : result.error)}`);
    }
    expect(result.error.attemptedMode).toBe('execute-direct');
    // The port object itself never recorded a call (it would have thrown).
  });

  it('the W038 execution event + W010 action lifecycle events carry canonical identities', () => {
    // The W038 execution event: the realized tracking record of the
    // authority-authorized change.
    const executionEvent = scenario.executionEvent;
    expect(executionEvent.payload.discriminator).toBe('execution:tracking-recorded');
    const data = executionEvent.payload.data as Record<string, unknown>;
    expect(data.workPackageId).toBe('work-package:workspace-integration');
    unwrap(verifySealedExecutionEvent(executionEvent), 'execution event verification');
    // The W010 action lifecycle stream: proposed -> authorized -> executed,
    // causally chained, digests verified.
    expect(scenario.actionEvents.length).toBe(3);
    const phases = scenario.actionEvents.map(
      (record) => unwrap(parseActionLifecycleEventData(record.event.payload), 'lifecycle data').phase,
    );
    expect(phases).toEqual(['proposed', 'authorized', 'executed']);
    for (const [index, record] of scenario.actionEvents.entries()) {
      expect(record.event.streamId).toBe(ACTION_STREAM_ID);
      expect(record.event.sequence).toBe(index + 1);
      expect(record.event.causalParent?.sequence ?? null).toBe(index === 0 ? null : index);
      unwrap(verifyEventDigest({ event: record.event, digest: record.contentDigest }), 'event digest verification');
    }
  });

  it('the scenario projection round-trips (serializes + digest-verifies)', () => {
    const projection = actionGatewayDigestProjection(scenario);
    const digest = expectRoundTrip(projection, 'action-gateway projection');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
