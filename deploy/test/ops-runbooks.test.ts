/**
 * W033 evidence — RUNBOOKS + the INCIDENT SIMULATOR: one
 * `runbook-reaches-recovery` proof per incident class, the typed
 * non-recovery negative paths, and simulator determinism.
 */
import { describe, expect, it } from 'vitest';
import {
  INCIDENT_CLASSES,
  incidentTraceContent,
  runbookContent,
  sealRunbook,
  simulateIncidentRunbook,
  serializeIncidentTrace,
  serializeRunbook,
  deserializeIncidentTrace,
  deserializeRunbook,
  verifyIncidentTraceDigest,
  runbookCatalog,
  sealIncidentTrace,
  opsUnwrap,
} from '@epoch/ops-kit';
import type { IncidentTrace, IncidentTraceContent, RunbookContent, RunbookRecord } from '@epoch/ops-kit';
import {
  environmentStateFromTopology,
  unwrapOrThrow,
} from '@epoch/deploy-model';
import type { TopologyRevision } from '@epoch/deploy-model';
import {
  ON_CALL,
  REV_A,
  TENANT_LABS,
  T3,
  T6,
  provenanceOf,
  referenceTopology,
} from './helpers';

const traceProvenance = () => provenanceOf(ON_CALL, 'fixture-trace', T6);

/** The five fixture incident traces — one per incident class. */
function referenceTraces(topology: TopologyRevision): readonly IncidentTrace[] {
  const state = unwrapOrThrow(environmentStateFromTopology(topology, 'env:prod', TENANT_LABS, { baselineAt: T3 }));
  const base = {
    recordVersion: 1 as const,
    environmentId: 'env:prod',
    tenantId: TENANT_LABS,
    topologyDigest: topology.digest,
    initialState: state,
    provenance: traceProvenance(),
  };
  const contents: readonly IncidentTraceContent[] = [
    {
      ...base,
      traceId: 'trace:health-degradation-01',
      incidentClass: 'health-degradation',
      signals: [{ kind: 'health-probe-failed', componentId: null, observedAt: T6, detail: 'gateway readiness failing' }],
      events: [{ kind: 'probe-observed', componentId: 'cmp:action-gateway', result: 'failed', observedAt: T6 }],
      priorRevisions: [{ componentId: 'cmp:action-gateway', revision: REV_A }],
      recoveryProbes: [{ componentId: 'cmp:action-gateway', result: 'healthy' }],
    },
    {
      ...base,
      traceId: 'trace:gate-violation-01',
      incidentClass: 'gate-violation',
      signals: [{ kind: 'gate-report-missing', componentId: null, observedAt: T6 }],
      events: [{ kind: 'gate-outcome-observed', gateId: 'gate:verification-battery', green: false, observedAt: T6 }],
      priorRevisions: [],
      recoveryProbes: [],
    },
    {
      ...base,
      traceId: 'trace:capacity-exhaustion-01',
      incidentClass: 'capacity-exhaustion',
      signals: [{ kind: 'capacity-exhausted', componentId: null, observedAt: T6 }],
      events: [{ kind: 'capacity-observed', componentId: 'cmp:web-app', observedReplicas: 9, observedAt: T6 }],
      priorRevisions: [],
      recoveryProbes: [{ componentId: 'cmp:web-app', result: 'healthy' }],
    },
    {
      ...base,
      traceId: 'trace:integrity-mismatch-01',
      incidentClass: 'integrity-mismatch',
      signals: [{ kind: 'digest-mismatch-observed', componentId: null, observedAt: T6 }],
      events: [{ kind: 'digest-observed', componentId: 'cmp:event-log', verified: false, observedAt: T6 }],
      priorRevisions: [{ componentId: 'cmp:event-log', revision: REV_A }],
      recoveryProbes: [{ componentId: 'cmp:event-log', result: 'healthy' }],
    },
    {
      ...base,
      traceId: 'trace:rollout-stall-01',
      incidentClass: 'rollout-stall',
      signals: [{ kind: 'deploy-step-stalled', componentId: null, observedAt: T6 }],
      events: [{ kind: 'step-stalled-observed', stepId: '3:promote:cmp:agent-protocol', observedAt: T6 }],
      priorRevisions: [],
      recoveryProbes: [{ componentId: 'cmp:agent-protocol', result: 'healthy' }],
    },
  ];
  return contents.map((content) => opsUnwrap(sealIncidentTrace(content)));
}

/** The five fixture traces against the reference topology. */
const fixture = () => {
  const topology = referenceTopology();
  const runbooks = opsUnwrap(runbookCatalog(provenanceOf(ON_CALL, 'catalog-runbook', T3)));
  const traces = referenceTraces(topology);
  return { topology, runbooks, traces };
};

describe('the runbook catalog (typed data)', () => {
  it('runbook-catalog-complete: one sealed runbook per incident class, deterministic digests', () => {
    const { runbooks } = fixture();
    expect(runbooks).toHaveLength(5);
    expect(runbooks.map((runbook) => runbook.incidentClass).sort()).toEqual([...INCIDENT_CLASSES].sort());
    const again = opsUnwrap(runbookCatalog(provenanceOf(ON_CALL, 'catalog-runbook', T3)));
    expect(again.map((runbook) => runbook.digest)).toEqual(runbooks.map((runbook) => runbook.digest));
    // Runbooks reference topology components by id.
    for (const runbook of runbooks) {
      for (const step of [...runbook.containment, ...runbook.mitigation]) {
        if (step.componentId !== null) expect(step.componentId).toMatch(/^cmp:[a-z0-9-]+$/);
      }
    }
  });

  it('runbook-round-trip-digest-verified: serialize -> deserialize verifies every runbook', () => {
    const { runbooks } = fixture();
    for (const runbook of runbooks) {
      const text = serializeRunbook(runbook);
      const restored = opsUnwrap(deserializeRunbook(text));
      expect(restored.digest).toBe(runbook.digest);
      expect(serializeRunbook(restored)).toBe(text);
    }
  });

  it('incident-trace-round-trip-digest-verified: serialize -> deserialize verifies every trace', () => {
    const { traces } = fixture();
    for (const trace of traces) {
      const text = serializeIncidentTrace(trace);
      const restored = opsUnwrap(deserializeIncidentTrace(text));
      expect(restored.digest).toBe(trace.digest);
      expect(serializeIncidentTrace(restored)).toBe(text);
      expect(opsUnwrap(verifyIncidentTraceDigest(restored)).traceId).toBe(trace.traceId);
    }
  });

  it('incident-trace-tamper-rejected: a mutated trace fails its digest', () => {
    const { traces } = fixture();
    const tampered: IncidentTrace = {
      ...incidentTraceContent(traces[0]!),
      incidentClass: 'rollout-stall',
      digest: traces[0]!.digest, // claimed digest retained — content mutated
    };
    const result = verifyIncidentTraceDigest(tampered);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('digest-mismatch');
  });
});

describe('runbook-reaches-recovery (one named proof per incident class)', () => {
  const { topology, runbooks, traces } = fixture();
  const runbookByClass = new Map(runbooks.map((runbook) => [runbook.incidentClass, runbook] as const));
  const traceByClass = new Map(traces.map((trace) => [trace.incidentClass, trace] as const));

  for (const incidentClass of INCIDENT_CLASSES) {
    it(`runbook-reaches-recovery:${incidentClass}`, () => {
      const runbook = runbookByClass.get(incidentClass)!;
      const trace = traceByClass.get(incidentClass)!;
      const proof = opsUnwrap(
        simulateIncidentRunbook({
          runbook,
          trace,
          topology,
          provenance: provenanceOf(ON_CALL, 'simulate-incident-runbook', T6),
        }),
      );
      expect(proof.recoveryReached).toBe(true);
      expect(proof.detectionMatched).toBe(true);
      expect(proof.checksEvaluated.every((check) => check.passed)).toBe(true);
      expect(proof.stepsApplied.length).toBe(runbook.containment.length + runbook.mitigation.length);
      expect(proof.runbookId).toBe(runbook.runbookId);
      expect(proof.traceId).toBe(trace.traceId);
      expect(proof.finalStateDigest).toMatch(/^[0-9a-f]{64}$/);
    });
  }

  it('simulator-replay-determinism: two simulations produce byte-identical proof digests', () => {
    const runbook = runbookByClass.get('health-degradation')!;
    const trace = traceByClass.get('health-degradation')!;
    const simulate = () =>
      opsUnwrap(
        simulateIncidentRunbook({ runbook, trace, topology, provenance: provenanceOf(ON_CALL, 'simulate-incident-runbook', T6) }),
      );
    const a = simulate();
    const b = simulate();
    expect(b.digest).toBe(a.digest);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe('the simulator is not vacuous (typed non-recovery + refusals)', () => {
  const { topology, runbooks, traces } = fixture();
  const runbookByClass = new Map(runbooks.map((runbook) => [runbook.incidentClass, runbook] as const));
  const traceByClass = new Map(traces.map((trace) => [trace.incidentClass, trace] as const));

  it('runbook-missing-mitigation-yields-typed-non-recovery: removing the restore step fails recovery', () => {
    const runbook = runbookByClass.get('health-degradation')!;
    const stripped: RunbookContent = {
      ...runbookContent(runbook),
      mitigation: runbook.mitigation.filter((step) => step.action !== 'restore-placement-revision'),
    };
    const resealed = opsUnwrap(sealRunbook(stripped));
    const proof = opsUnwrap(
      simulateIncidentRunbook({
        runbook: resealed,
        trace: traceByClass.get('health-degradation')!,
        topology,
        provenance: provenanceOf(ON_CALL, 'simulate-incident-runbook', T6),
      }),
    );
    expect(proof.recoveryReached).toBe(false);
    const restoredCheck = proof.checksEvaluated.find((check) => check.kind === 'placement-revision-restored');
    expect(restoredCheck?.passed).toBe(false);
  });

  it('runbook-signal-mismatch-typed-non-recovery: an unobserved detection signal fails detection + recovery', () => {
    const runbook = runbookByClass.get('gate-violation')!;
    // Re-key the runbook's detection on a signal the gate-violation trace
    // NEVER observes (health-probe-failed) — detection cannot match.
    const rekeyed: RunbookContent = {
      ...runbookContent(runbook),
      detection: [
        {
          kind: 'health-probe-failed',
          componentId: null,
          description: 'A signal this trace never emits.',
        },
      ],
    };
    const resealed = opsUnwrap(sealRunbook(rekeyed));
    const proof = opsUnwrap(
      simulateIncidentRunbook({
        runbook: resealed,
        trace: traceByClass.get('gate-violation')!,
        topology,
        provenance: provenanceOf(ON_CALL, 'simulate-incident-runbook', T6),
      }),
    );
    expect(proof.detectionMatched).toBe(false);
    expect(proof.unmatchedSignals).toEqual(['health-probe-failed']);
    expect(proof.recoveryReached).toBe(false);
  });

  it('simulator-refuses-cross-class-pairing: a runbook may only replay its own incident class', () => {
    const runbook = runbookByClass.get('health-degradation')!;
    const trace = traceByClass.get('capacity-exhaustion')!;
    const result = simulateIncidentRunbook({
      runbook,
      trace,
      topology,
      provenance: provenanceOf(ON_CALL, 'simulate-incident-runbook', T6),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation');
  });

  it('simulator-refuses-unknown-component: a runbook referencing a foreign component id is refused', () => {
    const runbook = runbookByClass.get('health-degradation')!;
    const poisoned: RunbookContent = {
      ...runbookContent(runbook),
      mitigation: runbook.mitigation.map((step) =>
        step.componentId === 'cmp:action-gateway' ? { ...step, componentId: 'cmp:nonexistent' } : step,
      ),
    };
    const resealed = opsUnwrap(sealRunbook(poisoned));
    const result = simulateIncidentRunbook({
      runbook: resealed,
      trace: traceByClass.get('health-degradation')!,
      topology,
      provenance: provenanceOf(ON_CALL, 'simulate-incident-runbook', T6),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unknown-component');
  });

  it('simulator-refuses-topology-skew: a trace from another topology revision is refused', () => {
    const runbook = runbookByClass.get('health-degradation')!;
    const trace = traceByClass.get('health-degradation')!;
    const otherTopology = referenceTopology(2);
    const result = simulateIncidentRunbook({
      runbook,
      trace,
      topology: otherTopology,
      provenance: provenanceOf(ON_CALL, 'simulate-incident-runbook', T6),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('topology-skew');
  });

  it('simulator-refuses-tampered-runbook: a mutated runbook digest is refused', () => {
    const runbook = runbookByClass.get('health-degradation')!;
    const tampered: RunbookRecord = { ...runbook, title: 'mutated after sealing' };
    const result = simulateIncidentRunbook({
      runbook: tampered,
      trace: traceByClass.get('health-degradation')!,
      topology,
      provenance: provenanceOf(ON_CALL, 'simulate-incident-runbook', T6),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('digest-mismatch');
  });
});
