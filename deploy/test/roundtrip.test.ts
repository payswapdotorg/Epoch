/**
 * W033 evidence — ROUND-TRIP + DIGEST VERIFICATION for every public type:
 * topologies, gate policies, plans, steps, outcomes, runs, receipts,
 * rollback receipts, environment states, runbooks, incident traces,
 * recovery proofs, checklists. Each record serializes to canonical JSON,
 * re-parses, digest-verifies and re-serializes byte-identically.
 */
import { describe, expect, it } from 'vitest';
import {
  admitDeployPlan,
  admitDeployRun,
  deserializeDeployPlan,
  deserializeDeployReceipt,
  deserializeDeployRun,
  deserializeEnvironmentState,
  deserializeGatePolicy,
  deserializeTopologyRevision,
  environmentStateFromTopology,
  renderDeployReceipt,
  serializeDeployPlan,
  serializeDeployReceipt,
  serializeDeployRun,
  serializeEnvironmentState,
  serializeGatePolicy,
  serializeTopologyRevision,
  verifyDeployReceiptDigest,
  verifyRollbackReceiptDigest,
  unwrapOrThrow,
} from '@epoch/deploy-model';
import {
  admitRecoveryProof,
  deserializeChecklist,
  deserializeIncidentTrace,
  deserializeRunbook,
  opsUnwrap,
  releaseChecklistFor,
  runbookCatalog,
  sealIncidentTrace,
  serializeChecklist,
  serializeIncidentTrace,
  serializeRecoveryProof,
  serializeRunbook,
  simulateIncidentRunbook,
} from '@epoch/ops-kit';
import {
  ON_CALL,
  REV_A,
  TENANT_LABS,
  T2,
  T3,
  T6,
  deployToProd,
  probesWithFailure,
  prodState,
  provenanceOf,
  referenceGatePolicy,
  referenceTopology,
} from './helpers';
import type { IncidentTraceContent } from '@epoch/ops-kit';

describe('round-trip + digest verification (deploy tree)', () => {
  const topology = referenceTopology();
  const policy = referenceGatePolicy();
  const { plan, run } = deployToProd({ componentIds: ['cmp:web-app'] });
  const runValue = unwrapOrThrow(run);
  const receipt = renderDeployReceipt(runValue);
  const state = prodState();

  // The rolled-back run + its rollback receipt.
  const rollbackRun = unwrapOrThrow(
    deployToProd({ componentIds: ['cmp:web-app'], healthProbes: probesWithFailure(plan, 'cmp:web-app', 'readiness probe timeout after 5000ms') }).run,
  );

  it('round-trip-digest-verified:topology-revision', () => {
    const text = serializeTopologyRevision(topology);
    const restored = unwrapOrThrow(deserializeTopologyRevision(text));
    expect(restored.digest).toBe(topology.digest);
    expect(serializeTopologyRevision(restored)).toBe(text);
  });

  it('round-trip-digest-verified:gate-policy', () => {
    const text = serializeGatePolicy(policy);
    const restored = unwrapOrThrow(deserializeGatePolicy(text));
    expect(restored.digest).toBe(policy.digest);
    expect(serializeGatePolicy(restored)).toBe(text);
  });

  it('round-trip-digest-verified:deploy-plan', () => {
    const text = serializeDeployPlan(plan);
    const restored = unwrapOrThrow(deserializeDeployPlan(text));
    expect(restored.digest).toBe(plan.digest);
    expect(serializeDeployPlan(restored)).toBe(text);
    // Every step round-trips through the plan's own digest chain.
    expect(unwrapOrThrow(admitDeployPlan(JSON.parse(text))).planId).toBe(plan.planId);
  });

  it('round-trip-digest-verified:environment-state', () => {
    const text = serializeEnvironmentState(state);
    const restored = unwrapOrThrow(deserializeEnvironmentState(text));
    expect(restored.digest).toBe(state.digest);
    expect(serializeEnvironmentState(restored)).toBe(text);
  });

  it('round-trip-digest-verified:deploy-run (outcomes + rollback receipt)', () => {
    const text = serializeDeployRun(rollbackRun);
    const restored = unwrapOrThrow(deserializeDeployRun(text));
    expect(restored.digest).toBe(rollbackRun.digest);
    expect(serializeDeployRun(restored)).toBe(text);
    expect(unwrapOrThrow(admitDeployRun(JSON.parse(text))).runId).toBe(rollbackRun.runId);
    // The rollback receipt inside the run verifies on its own.
    if (restored.rollback !== null) {
      expect(unwrapOrThrow(verifyRollbackReceiptDigest(restored.rollback)).digest).toBe(restored.rollback.digest);
    }
  });

  it('round-trip-digest-verified:deploy-receipt', () => {
    const text = serializeDeployReceipt(receipt);
    const restored = unwrapOrThrow(deserializeDeployReceipt(text));
    expect(unwrapOrThrow(verifyDeployReceiptDigest(restored)).digest).toBe(receipt.digest);
    expect(serializeDeployReceipt(restored)).toBe(text);
  });
});

describe('round-trip + digest verification (ops tree)', () => {
  const topology = referenceTopology();
  const runbooks = opsUnwrap(runbookCatalog(provenanceOf(ON_CALL, 'catalog-runbook', T3)));
  const runbook = runbooks[0]!;
  const state = unwrapOrThrow(environmentStateFromTopology(topology, 'env:prod', TENANT_LABS, { baselineAt: T2 }));
  const traceContent: IncidentTraceContent = {
    recordVersion: 1,
    traceId: 'trace:round-trip-01',
    incidentClass: 'health-degradation',
    environmentId: 'env:prod',
    tenantId: TENANT_LABS,
    topologyDigest: topology.digest,
    initialState: state,
    signals: [{ kind: 'health-probe-failed', componentId: null, observedAt: T6 }],
    events: [{ kind: 'probe-observed', componentId: 'cmp:action-gateway', result: 'failed', observedAt: T6 }],
    priorRevisions: [{ componentId: 'cmp:action-gateway', revision: REV_A }],
    recoveryProbes: [{ componentId: 'cmp:action-gateway', result: 'healthy' }],
    provenance: provenanceOf(ON_CALL, 'fixture-trace', T6),
  };
  const trace = opsUnwrap(sealIncidentTrace(traceContent));
  const proof = opsUnwrap(
    simulateIncidentRunbook({ runbook, trace, topology, provenance: provenanceOf(ON_CALL, 'simulate-incident-runbook', T6) }),
  );
  const { plan } = deployToProd({ componentIds: ['cmp:web-app'] });
  const checklist = opsUnwrap(releaseChecklistFor(plan, referenceGatePolicy().battery, provenanceOf(ON_CALL, 'release-checklist', T6)));

  it('round-trip-digest-verified:runbook', () => {
    const text = serializeRunbook(runbook);
    const restored = opsUnwrap(deserializeRunbook(text));
    expect(restored.digest).toBe(runbook.digest);
    expect(serializeRunbook(restored)).toBe(text);
  });

  it('round-trip-digest-verified:incident-trace', () => {
    const text = serializeIncidentTrace(trace);
    const restored = opsUnwrap(deserializeIncidentTrace(text));
    expect(restored.digest).toBe(trace.digest);
    expect(serializeIncidentTrace(restored)).toBe(text);
  });

  it('round-trip-digest-verified:recovery-proof', () => {
    const text = serializeRecoveryProof(proof);
    const restored = opsUnwrap(admitRecoveryProof(JSON.parse(text)));
    expect(restored.digest).toBe(proof.digest);
    expect(serializeRecoveryProof(restored)).toBe(text);
  });

  it('round-trip-digest-verified:release-checklist', () => {
    const text = serializeChecklist(checklist);
    const restored = opsUnwrap(deserializeChecklist(text));
    expect(restored.digest).toBe(checklist.digest);
    expect(serializeChecklist(restored)).toBe(text);
  });
});