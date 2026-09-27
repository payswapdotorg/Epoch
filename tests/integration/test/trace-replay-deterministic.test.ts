// W032 — trace-replay-deterministic: the named determinism gate.
//
// The harness runner double-runs every scenario; this test pins the
// cross-domain flagship scenario's replay determinism EXPLICITLY:
// rerunning the scenario (against fresh real-kernel worlds both times)
// must produce a byte-identical, digest-verifiable trace and result.
import { describe, expect, it } from 'vitest';
import {
  runScenario,
  scenarioDigest,
  serializeScenario,
  serializeTrace,
  verifyTrace,
} from '@epoch/test-harness';
import { crossDomainDeliveryScenario } from '../scenarios/cross-domain-delivery';
import { crossDomainDriver } from '../scenarios/cross-domain-driver';

describe('trace-replay-deterministic — cross-domain delivery', () => {
  const first = runScenario(crossDomainDeliveryScenario(), crossDomainDriver);
  const second = runScenario(crossDomainDeliveryScenario(), crossDomainDriver);
  expect(first.ok && second.ok).toBe(true);
  if (!first.ok || !second.ok) {
    throw new Error('the cross-domain scenario failed to run');
  }

  it('the scenario passes every invariant (the engine\'s own verdict)', () => {
    expect(first.value.result.passed).toBe(true);
    for (const finding of first.value.result.invariantResults) {
      expect(finding.satisfied, `${finding.invariant}: ${finding.detail}`).toBe(true);
    }
  });

  it('trace-replay-deterministic: the runner double-run produced a byte-identical trace', () => {
    expect(first.value.result.replay).not.toBeNull();
    expect(first.value.result.replay?.deterministic).toBe(true);
    expect(first.value.result.replay?.secondTraceDigest).toBe(first.value.trace.traceDigest);
    const replayFinding = first.value.result.invariantResults.find(
      (finding) => finding.invariant === 'replay-determinism',
    );
    expect(replayFinding?.satisfied).toBe(true);
  });

  it('trace-replay-deterministic: a SECOND full runScenario reproduces the identical trace bytes', () => {
    expect(second.value.trace.traceDigest).toBe(first.value.trace.traceDigest);
    expect(serializeTrace(second.value.trace)).toBe(serializeTrace(first.value.trace));
    expect(second.value.result.resultDigest).toBe(first.value.result.resultDigest);
    expect(second.value.result.traceDigest).toBe(first.value.result.traceDigest);
  });

  it('the trace is sealed + digest-verifiable (content addressing)', () => {
    expect(verifyTrace(first.value.trace)).toEqual({ ok: true });
    expect(first.value.trace.traceDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(first.value.trace.scenarioDigest).toBe(scenarioDigest(first.value.scenario));
    expect(first.value.trace.steps).toHaveLength(first.value.scenario.steps.length);
  });

  it('the scenario record round-trips + digest-verifies (digest-stable serialization)', () => {
    const text = serializeScenario(first.value.scenario);
    expect(scenarioDigest(JSON.parse(text) as never)).toBe(scenarioDigest(first.value.scenario));
  });

  it('every step\'s derived digests are 64-hex (digest discipline end-to-end)', () => {
    for (const entry of first.value.trace.steps) {
      expect(entry.stepDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(entry.stateDigestBefore).toMatch(/^[0-9a-f]{64}$/);
      expect(entry.stateDigestAfter).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
