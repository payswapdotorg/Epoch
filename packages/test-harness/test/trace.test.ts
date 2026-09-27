// W032 — trace tests: sealing, verification, tamper detection, determinism.
import { describe, expect, it } from 'vitest';
import {
  runScenario,
  sealTrace,
  serializeTrace,
  verifyTrace,
  type ExecutionTrace,
} from '../src';
import { ledgerDriver } from './fixture-driver';
import { ledgerScenario } from './scenarios';

describe('execution trace', () => {
  const run = runScenario(ledgerScenario(), ledgerDriver);
  expect(run.ok).toBe(true);
  if (!run.ok) {
    throw new Error(`fixture scenario failed to run: ${run.error.message}`);
  }
  const trace: ExecutionTrace = run.value.trace;

  it('seals with a 64-hex content digest that verifies', () => {
    expect(trace.traceDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyTrace(trace)).toEqual({ ok: true });
  });

  it('records per-step input digests, output digests, events and state deltas', () => {
    expect(trace.steps).toHaveLength(7);
    const append = trace.steps[0]!;
    expect(append.kind).toBe('call');
    expect(append.inputDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(append.outputDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(append.events).toHaveLength(1);
    expect(append.events[0]?.discriminator).toBe('ledger:record-appended');
    expect(append.stateDelta).toBe(true);
    const read = trace.steps[2]!;
    expect(read.stateDelta).toBe(false);
    const denied = trace.steps[5]!;
    expect(denied.outcome).toBe('denied');
    expect(denied.errorCode).toBe('cross-tenant-denied');
    expect(denied.stateDelta).toBe(false);
  });

  it('records typed assert findings at their step', () => {
    const asserted = trace.steps[4]!;
    expect(asserted.kind).toBe('assert');
    expect(asserted.outcome).toBe('asserted');
    expect(asserted.assertFindings?.length).toBeGreaterThan(0);
    expect(asserted.assertFindings?.every((finding) => finding.satisfied)).toBe(true);
  });

  it('detects a tampered trace (digest mismatch)', () => {
    const tampered: ExecutionTrace = {
      ...trace,
      steps: trace.steps.map((entry, index) =>
        index === 0 ? { ...entry, outputDigest: 'f'.repeat(64) } : entry,
      ),
    };
    const verification = verifyTrace(tampered);
    expect(verification.ok).toBe(false);
    if (!verification.ok) {
      expect(verification.error.code).toBe('trace-digest-mismatch');
    }
  });

  it('serializes canonically (byte-stable across two serializations)', () => {
    expect(serializeTrace(trace)).toBe(serializeTrace(trace));
  });

  it('two executions produce a byte-identical trace (replay determinism)', () => {
    const second = runScenario(ledgerScenario(), ledgerDriver);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.trace.traceDigest).toBe(trace.traceDigest);
      expect(serializeTrace(second.value.trace)).toBe(serializeTrace(trace));
    }
  });

  it('a changed scenario produces a different trace digest', () => {
    const mutated = ledgerScenario();
    mutated.steps = mutated.steps.filter((step) => step.stepId !== 'step:read-count');
    const other = runScenario(mutated, ledgerDriver);
    expect(other.ok).toBe(true);
    if (other.ok) {
      expect(other.value.trace.traceDigest).not.toBe(trace.traceDigest);
    }
  });

  it('sealTrace is the inverse view of the content (idempotent sealing)', () => {
    const content = {
      schemaVersion: trace.schemaVersion,
      traceId: trace.traceId,
      scenarioId: trace.scenarioId,
      scenarioDigest: trace.scenarioDigest,
      driverName: trace.driverName,
      steps: trace.steps,
      finalStateDigest: trace.finalStateDigest,
    } as const;
    expect(sealTrace(content).traceDigest).toBe(trace.traceDigest);
  });
});
