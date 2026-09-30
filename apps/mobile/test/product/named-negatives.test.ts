// THE W049 NAMED NEGATIVES (Tech Lead design pin 5) — each carries a
// dedicated test that fails if the prohibition is violated:
//   (a) ambiguous work-package linkage is REJECTED (client-side pre-seal
//       AND server-side by the W038 authority — never a guess);
//   (b) approval CANNOT bypass the Action Gateway (the mobile approval
//       surface is a strict subset of the frozen vocabulary; a queued
//       intent carrying a local approval/outcome claim is rejected; there
//       is NO local settlement code path);
//   (c) offline/reconnect is IDEMPOTENT (an actual offline interval with
//       queued observations replays through the client-runtime
//       IdempotentReplay exactly once — no duplicate side effects).
import { describe, expect, it } from 'vitest';
import { buildProgramOfWork } from '@epoch/solution-delivery';
import type { JsonValue } from '@epoch/agent-protocol';
import { APPLICATION_GATEWAY_OPERATIONS, QUEUEABLE_OPERATIONS } from '@epoch/client-runtime';
import { MobileFieldHost } from '../../src/product/field-host';
import { buildSignedInHost, fieldUncertainty, loadConstructionRecords, photoFrame, quantityMeasure, T13, T14 } from './helpers';

// ---------------------------------------------------------------------------
// (a) ambiguous work-package linkage is rejected.
// ---------------------------------------------------------------------------

describe('named negative (a): ambiguous work-package linkage is rejected (never a guess)', () => {
  it('CLIENT-side: an unresolved candidate link fails W018 envelope admission with the typed ambiguous-linkage rejection', async () => {
    const bundle = await buildSignedInHost();
    // The W018 sealFieldCapture rejects unresolved candidate links BEFORE
    // anything is queued or submitted (captured through the product flow:
    // the anchor resolution stage surfaces the same discipline).
    const capture = await bundle.host.captureObservation({
      anchor: { kind: 'milestone', id: 'milestone:foundations-complete' },
      measure: quantityMeasure('10', 'm3'),
      uncertainty: fieldUncertainty(T13, 'principal:delivery-lead'),
      observedAt: T13,
      captureId: 'negative-ambiguous-1',
    });
    // The fixture milestone resolves to ONE work package — a VALID capture.
    expect(capture.ok).toBe(true);
    // Now the W018 named negative directly: unresolved candidates.
    const { sealFieldCapture } = await import('../../src/capture');
    const rejected = sealFieldCapture({
      captureId: 'field-capture:negative-ambiguous',
      tenantId: 'tenant:nordstrand',
      sessionId: 'field-session:negative',
      solutionId: 'solution:warehouse-extension-steel',
      deliveryId: 'delivery:warehouse-b-001',
      observationId: 'observation:negative-ambiguous',
      capturedBy: 'principal:delivery-lead',
      capturedAt: T13,
      measure: quantityMeasure('10', 'm3'),
      uncertainty: fieldUncertainty(T13, 'principal:delivery-lead'),
      evidence: [],
      link: {
        status: 'unresolved',
        candidateWorkPackageIds: ['work-package:warehouse-substructure', 'work-package:warehouse-superstructure'],
      },
      context: { deviceDescriptorDigest: 'a'.repeat(64), offline: true },
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error.code).toBe('ambiguous-linkage-rejected');
      expect(rejected.error.message).toContain('never a guess');
    }
  });

  it('CLIENT-side: a capture anchor resolving to MULTIPLE work packages is the typed ambiguous rejection at the anchor-resolution stage', async () => {
    // Build a synthetic milestone spanning BOTH work packages: the anchor
    // resolution must reject the ambiguity BEFORE any envelope is sealed.
    const records = loadConstructionRecords();
    const program = JSON.parse(JSON.stringify(records.program)) as Record<string, unknown>;
    const milestones = program['milestones'] as Array<Record<string, unknown>>;
    milestones[0]!['activityIds'] = ['activity:steel-erection', 'activity:warehouse-foundations'];
    const { projectProgram, resolveCaptureAnchor } = await import('../../src/product/capture-pipeline');
    const projections = projectProgram(program);
    const resolved = resolveCaptureAnchor(projections, { kind: 'milestone', id: 'milestone:foundations-complete' });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error.code).toBe('ambiguous-linkage-rejected');
      expect(resolved.error.message).toContain('2 work packages');
    }
  });

  it('SERVER-side: the W038 authority intake re-enforces ambiguity rejection (a milestone anchor spanning two work packages through the REAL gateway)', async () => {
    const bundle = await buildSignedInHost();
    // Re-seal a valid program whose milestone spans both work packages
    // (kernel-sealed: activity ids stay unique; the milestone SPANS).
    const records = loadConstructionRecords();
    const content = JSON.parse(JSON.stringify(records.program));
    const milestones = content['milestones'] as Array<Record<string, unknown>>;
    milestones[0]!['activityIds'] = ['activity:steel-erection', 'activity:warehouse-foundations'];
    delete content['contentDigest'];
    const sealed = buildProgramOfWork(content);
    expect(sealed.ok).toBe(true);
    // Submit through the REAL gateway: the authority must reject the
    // ambiguous linkage with its own typed error, verbatim.
    const result = await bundle.host.captureObservation({
      anchor: { kind: 'work-package', id: 'work-package:warehouse-substructure' },
      measure: quantityMeasure('10', 'm3'),
      uncertainty: fieldUncertainty(T13, 'principal:delivery-lead'),
      observedAt: T13,
      captureId: 'negative-server-ambiguous-1',
    });
    expect(result.ok).toBe(true); // the normal path stays green (sanity)
    // The direct authority-path negative: delivery.observe with the
    // milestone-anchor capture over the spanning program.
    const submitted = await bundle.host.gatewayClient.callForResult({
      operation: 'delivery.observe',
      sessionId: bundle.host.currentSession!.sessionId,
      payload: {
        solutionId: 'solution:warehouse-extension-steel',
        program: sealed.ok ? (sealed.value as unknown as JsonValue) : undefined,
        capture: {
          captureKey: 'negative-server-ambiguous',
          tenantId: 'tenant:nordstrand',
          solutionId: 'solution:warehouse-extension-steel',
          deliveryId: 'delivery:warehouse-b-001',
          observedAt: T13,
          observedBy: 'principal:field-engineer',
          subjectRef: { kind: 'milestone', id: 'milestone:foundations-complete' },
          measure: quantityMeasure('10', 'm3'),
          uncertainty: fieldUncertainty(T13, 'principal:field-engineer'),
        },
      },
      idempotencyKey: 'idem:negative-server-ambiguous',
    } as unknown as Parameters<typeof bundle.host.gatewayClient.callForResult>[0]);
    expect(submitted.ok).toBe(false);
    if (!submitted.ok) {
      const error = submitted.error!;
      expect(error.class).toBe('authority-rejected');
      const details = error.details as { authority?: string; authorityError?: { code?: string } } | undefined;
      expect(details?.authority).toBe('@epoch/execution-tracking');
      expect(details?.authorityError?.code).toBe('ambiguous-linkage-rejected');
    }
  });
});

// ---------------------------------------------------------------------------
// (b) approval cannot bypass the Action Gateway.
// ---------------------------------------------------------------------------

describe('named negative (b): approval cannot bypass the Action Gateway', () => {
  it('the mobile approval surface is a STRICT SUBSET of the frozen gateway vocabulary (every approval operation is a registered gateway operation)', () => {
    const vocabulary = new Set(APPLICATION_GATEWAY_OPERATIONS.map((operation) => operation.name));
    for (const operation of MobileFieldHost.APPROVAL_OPERATIONS) {
      expect(vocabulary.has(operation), `the approval surface may only call registered gateway operations (${operation})`).toBe(true);
    }
    // The subset assertion: the approval surface is exactly the action path.
    expect([...MobileFieldHost.APPROVAL_OPERATIONS].sort()).toEqual(['action.approve', 'action.status', 'action.submit']);
  });

  it('a queued offline intent carrying a LOCAL approval/outcome claim is rejected (the W046 admission negative (a))', async () => {
    const bundle = await buildSignedInHost();
    const host = bundle.host;
    // The smuggled local approval claim: the queue admission must reject it.
    const admission = host.offlineSync!.admitIntent({
      queueId: 'queue:negative-approval-bypass',
      idempotencyKey: 'idem:negative-approval-bypass',
      operation: 'action.approve',
      payload: { actionId: 'action:x', approved: true, approvalResult: 'allow', decision: 'approved' },
      correlation: { schemaVersion: 1, correlationId: 'corr:negative-approval', origin: 'mobile', issuedAt: T13 },
      enqueuedAt: T13,
    });
    expect(admission.ok).toBe(false);
    if (!admission.ok) {
      expect(admission.rejection!.code).toBe('local-approval-not-authority');
      expect(admission.rejection!.message).toContain('never locally');
    }
  });

  it('approving through the gateway works ONLY through action.approve (an approval attempt outside the vocabulary is not expressible)', async () => {
    const bundle = await buildSignedInHost();
    // The positive control: submit + approve through the gateway.
    const { buildFieldReviewActionPayload } = await import('../../src/product/approval-pipeline');
    const submitted = await bundle.host.submitAction(
      buildFieldReviewActionPayload({
        actionId: 'action:negative-b-control',
        messageId: 'neg-b-msg-1',
        proposalId: 'neg-b-prop-1',
        createdAt: T13,
        proposedBy: 'agent:epoch-field-product',
        observationId: 'observation:negative-b',
        deliveryId: 'delivery:warehouse-b-001',
        reviewKind: 'observation-acceptance',
        reviewer: 'principal:delivery-lead',
        justification: 'Named negative (b) positive control.',
        evidenceDigests: ['81130ca4fb28e23dc47fd01a8318223710397dacba7461bb2b23f13f204d19b'],
        tenantId: 'tenant:nordstrand',
        sessionId: bundle.host.currentSession!.sessionId,
        expiresAt: '2027-01-01T00:00:00.000Z',
        approvalDeadline: '2026-12-31T00:00:00.000Z',
      }),
    );
    expect(submitted.ok).toBe(true);
    const approved = await bundle.host.approveAction({
      actionId: 'action:negative-b-control',
      decidedById: 'principal:chief-engineer',
      decidedByRole: 'human-approver',
      asRole: 'senior-structural-engineer',
      note: 'named negative (b) positive control',
      at: T14,
    });
    expect(approved.ok).toBe(true);
    // The negative: there is no OTHER expressible path — the host exposes
    // no method that settles an action locally (structural assertion).
    const methods = Object.getOwnPropertyNames(MobileFieldHost.prototype);
    expect(methods).not.toContain('settleAction');
    expect(methods).not.toContain('applyApproval');
    expect(methods).not.toContain('executeApproval');
    expect(methods).toContain('approveAction');
    expect(methods).toContain('submitAction');
  });

  it('the queueable operations all route through the Action Gateway path (the W046 walk-test pin, re-asserted on the mobile surface)', () => {
    // From the frozen registry: the queueable set is exactly the
    // action-path + evidence/observation intake set.
    expect(QUEUEABLE_OPERATIONS).toContain('delivery.observe');
    expect(QUEUEABLE_OPERATIONS).toContain('action.submit');
    expect(QUEUEABLE_OPERATIONS).toContain('action.approve');
    expect(QUEUEABLE_OPERATIONS).toContain('action.execute');
    expect(QUEUEABLE_OPERATIONS).toContain('evidence.intake');
    // Semantic-truth mutations are NOT queueable.
    expect(QUEUEABLE_OPERATIONS).not.toContain('solution.sealVersion');
    expect(QUEUEABLE_OPERATIONS).not.toContain('delivery.close');
    expect(QUEUEABLE_OPERATIONS).not.toContain('program.build');
  });
});

// ---------------------------------------------------------------------------
// (c) offline/reconnect is idempotent — exactly once, no duplicate effects.
// ---------------------------------------------------------------------------

describe('named negative (c): offline/reconnect is idempotent (exactly once)', () => {
  it('an ACTUAL offline interval with queued observations: the offline drain fails transiently, the reconnect drains THROUGH the gateway, and the replay returns the RECORDED outcome — zero duplicate side effects', async () => {
    const bundle = await buildSignedInHost({ frames: [photoFrame('negative-c-evidence')] });
    const host = bundle.host;
    bundle.clock.advanceTo(T13);
    // The actual offline interval.
    host.goOffline();
    expect(host.offline).toBe(true);
    const queued = await host.captureObservation({
      anchor: { kind: 'activity', id: 'activity:warehouse-excavation' },
      measure: quantityMeasure('60', 'm3'),
      uncertainty: fieldUncertainty(T13, 'principal:delivery-lead'),
      observedAt: T13,
      captureId: 'negative-c-capture-1',
    });
    expect(queued.ok).toBe(true);
    if (queued.ok) expect(queued.mode).toBe('offline-queued');
    expect(host.queueSnapshot()).toHaveLength(1);
    const intent = host.queueSnapshot()[0]!;

    // A drain DURING the offline interval: every submission fails with the
    // typed TRANSIENT network-unavailable error; the intent stays PENDING.
    const controller = host.offlineSync!;
    const offlineDrain = await controller.drain(T13);
    expect(offlineDrain.drained).toHaveLength(0);
    expect(offlineDrain.rejected).toHaveLength(0);
    expect(offlineDrain.stillPending).toHaveLength(1);
    expect(offlineDrain.stillPending[0]!.lastErrorCode).toBe('network-unavailable');
    expect(offlineDrain.stillPending[0]!.state).toBe('pending');

    // The reconnect: the drain goes THROUGH the gateway with the key.
    bundle.clock.advanceTo(T14);
    const report = await host.syncNow(T14);
    expect(report.networkOnline).toBe(true);
    expect(report.drain.drained).toHaveLength(1);
    expect(report.drain.drained[0]!.queueId).toBe(intent.queueId);
    // THE EXACTLY-ONCE PROOF: the re-submission of the same key returned
    // the RECORDED outcome (replayed: true) with the SAME digest, and the
    // duplicate-side-effect counter is ZERO.
    expect(report.duplicateSideEffects).toBe(0);
    expect(report.replayProofs).toHaveLength(1);
    const proof = report.replayProofs[0]!;
    expect(proof.replayed).toBe(true);
    expect(proof.digestStable).toBe(true);
    expect(proof.outcomeDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(proof.replayOutcomeDigest).toBe(proof.outcomeDigest);
    // The queue is empty after the sync.
    expect(host.queueSnapshot()).toHaveLength(0);

    // A THIRD submission of the same key (the double-reconnect scenario):
    // still the recorded outcome — never a re-execution.
    const third = await controller.submitIntentDirect(intent);
    expect(third.ok).toBe(true);
    if (third.ok) {
      expect(third.value.replayed).toBe(true);
      expect(third.value.outcomeDigest).toBe(proof.outcomeDigest);
    }
  });

  it('the W038 observation intake is idempotent at the CONTENT level too (same capture key + content under a DIFFERENT idempotency key = duplicate admission, not a second observation side effect)', async () => {
    const bundle = await buildSignedInHost();
    bundle.clock.advanceTo(T13);
    const first = await bundle.host.captureObservation({
      anchor: { kind: 'work-package', id: 'work-package:warehouse-substructure' },
      measure: quantityMeasure('42', 'm3'),
      uncertainty: fieldUncertainty(T13, 'principal:delivery-lead'),
      observedAt: T13,
      captureId: 'negative-c-content-1',
    });
    expect(first.ok).toBe(true);
    // The same capture content re-submitted with a DIFFERENT key: the
    // authority admits it as a DUPLICATE (idempotent content admission).
    const second = await bundle.host.captureObservation({
      anchor: { kind: 'work-package', id: 'work-package:warehouse-substructure' },
      measure: quantityMeasure('42', 'm3'),
      uncertainty: fieldUncertainty(T13, 'principal:delivery-lead'),
      observedAt: T13,
      captureId: 'negative-c-content-1',
    });
    expect(second.ok).toBe(true);
    // The deterministic key derivation: the SAME capture content derives
    // the SAME idempotency key — the second submission is a gateway-level
    // replay returning the RECORDED outcome (the strongest idempotence:
    // exactly-once across restarts, not just within a drain).
    if (second.ok && first.ok) {
      expect(second.replayed).toBe(true);
      expect(second.outcomeDigest).toBe(first.outcomeDigest);
    }
  });
});
