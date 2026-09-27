// W032 — runner + result + reporting tests: the engine end-to-end.
import { describe, expect, it } from 'vitest';
import {
  DriverContractError,
  formatRunSummary,
  renderRunReport,
  runScenario,
  serializeRunReport,
  stepReportDigest,
} from '../src';
import { ledgerDriver } from './fixture-driver';
import { ledgerScenario } from './scenarios';

describe('runner + result records', () => {
  it('runs the reference scenario to a PASS with a content-addressed result', () => {
    const run = runScenario(ledgerScenario(), ledgerDriver);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const { result } = run.value;
    expect(result.passed).toBe(true);
    expect(result.scenarioId).toBe('scenario:fixture-ledger');
    expect(result.stepCount).toBe(7);
    expect(result.traceDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.resultDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.invariantResults.length).toBeGreaterThan(0);
    expect(result.invariantResults.every((finding) => finding.satisfied)).toBe(true);
  });

  it('the result digest is content-addressed (two runs digest identically)', () => {
    const first = runScenario(ledgerScenario(), ledgerDriver);
    const second = runScenario(ledgerScenario(), ledgerDriver);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.result.resultDigest).toBe(first.value.result.resultDigest);
    expect(second.value.result.traceDigest).toBe(first.value.result.traceDigest);
  });

  it('a malformed scenario is a typed parse failure (never an exception)', () => {
    const run = runScenario({ bad: 'shape' }, ledgerDriver);
    expect(run.ok).toBe(false);
    if (!run.ok) {
      expect(run.error.code).toBe('scenario-parse-failed');
    }
  });

  it('an unknown driverOp raises the typed DriverContractError (negative)', () => {
    const scenario = ledgerScenario();
    scenario.steps = [
      { ...scenario.steps[0]!, driverOp: 'ledger.nonexistent' } as never,
    ];
    expect(() => runScenario(scenario, ledgerDriver)).toThrow(DriverContractError);
  });

  it('the machine-readable run report round-trips and carries the trace digest', () => {
    const run = runScenario(ledgerScenario(), ledgerDriver);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const report = renderRunReport(run.value);
    expect(report.passed).toBe(true);
    expect(report.traceDigest).toBe(run.value.trace.traceDigest);
    expect(report.reportDigest).toMatch(/^[0-9a-f]{64}$/);
    const text = serializeRunReport(report);
    expect(JSON.parse(text).scenarioId).toBe(report.scenarioId);
  });

  it('the summary line is stable and verdict-prefixed', () => {
    const run = runScenario(ledgerScenario(), ledgerDriver);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const summary = formatRunSummary(run.value);
    expect(summary.startsWith('[PASS] scenario:fixture-ledger')).toBe(true);
    expect(summary).toContain('deterministic');
  });

  it('every step report digests stably (evidence cross-referencing)', () => {
    const run = runScenario(ledgerScenario(), ledgerDriver);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    for (const report of run.value.reports) {
      expect(stepReportDigest(report)).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
