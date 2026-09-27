// W032 — invariant library tests: every invariant on its satisfied AND
// violated path (the W031 negative-test discipline, generalized).
import { describe, expect, it } from 'vitest';
import {
  INVARIANT_IDS,
  TENANT_DENIAL_CODES,
  evaluateInvariant,
  isRunLevelInvariant,
  runScenario,
} from '../src';
import { ledgerDriver } from './fixture-driver';
import { brokenIdentityScenario, expectationMismatchScenario, ledgerScenario } from './scenarios';

describe('invariant library', () => {
  const run = runScenario(ledgerScenario(), ledgerDriver);
  expect(run.ok).toBe(true);
  if (!run.ok) {
    throw new Error(`fixture scenario failed to run: ${run.error.message}`);
  }
  const satisfied = new Map(run.value.result.invariantResults.map((finding) => [finding.invariant, finding]));

  it('the library exposes the closed invariant vocabulary', () => {
    expect(INVARIANT_IDS).toContain('tenant-isolation');
    expect(INVARIANT_IDS).toContain('provenance-chain');
    expect(INVARIANT_IDS).toContain('authority-routing');
    expect(INVARIANT_IDS).toContain('identity-preservation');
    expect(INVARIANT_IDS).toContain('replay-determinism');
  });

  it('tenant isolation: satisfied on the reference scenario', () => {
    expect(satisfied.get('tenant-isolation')?.satisfied).toBe(true);
    expect(TENANT_DENIAL_CODES).toContain('cross-tenant-denied');
  });

  it('provenance chain: satisfied on the reference scenario', () => {
    expect(satisfied.get('provenance-chain')?.satisfied).toBe(true);
  });

  it('authority routing: satisfied on the reference scenario', () => {
    expect(satisfied.get('authority-routing')?.satisfied).toBe(true);
  });

  it('identity preservation: satisfied on the reference scenario', () => {
    expect(satisfied.get('identity-preservation')?.satisfied).toBe(true);
  });

  it('replay determinism: satisfied via the runner double-run', () => {
    expect(satisfied.get('replay-determinism')?.satisfied).toBe(true);
    expect(run.value.result.replay?.deterministic).toBe(true);
  });

  it('scenario round-trip: satisfied on the reference scenario', () => {
    expect(satisfied.get('scenario-round-trip')?.satisfied).toBe(true);
  });

  it('expectation conformance FAILS when a declared expectation is wrong (negative)', () => {
    const mismatch = runScenario(expectationMismatchScenario(), ledgerDriver);
    expect(mismatch.ok).toBe(true);
    if (mismatch.ok) {
      const finding = mismatch.value.result.invariantResults.find(
        (candidate) => candidate.invariant === 'expectation-conformance',
      );
      expect(finding?.satisfied).toBe(false);
      expect(mismatch.value.result.passed).toBe(false);
    }
  });

  it('identity preservation FAILS when a canonical id is never observed (negative)', () => {
    const broken = runScenario(brokenIdentityScenario(), ledgerDriver);
    expect(broken.ok).toBe(true);
    if (broken.ok) {
      const finding = broken.value.result.invariantResults.find(
        (candidate) => candidate.invariant === 'identity-preservation',
      );
      expect(finding?.satisfied).toBe(false);
      expect(finding?.detail).toContain('record:never-appended');
      expect(broken.value.result.passed).toBe(false);
    }
  });

  it('replay determinism FAILS CLOSED when the double-run is disabled (negative)', () => {
    const single = runScenario(ledgerScenario(), ledgerDriver, { replayCheck: false });
    expect(single.ok).toBe(true);
    if (single.ok) {
      const finding = single.value.result.invariantResults.find(
        (candidate) => candidate.invariant === 'replay-determinism',
      );
      expect(finding?.satisfied).toBe(false);
      expect(single.value.result.replay).toBeNull();
    }
  });

  it('an unknown invariant id is a typed finding, never a silent pass (negative)', () => {
    const findings = evaluateInvariant('not-an-invariant', {
      scenario: run.value.scenario,
      reports: run.value.reports,
      trace: run.value.trace,
    }, undefined);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.satisfied).toBe(false);
    expect(findings[0]?.detail).toContain('unknown invariant');
  });

  it('run-level invariants refuse per-point evaluation (fail closed)', () => {
    expect(isRunLevelInvariant('replay-determinism')).toBe(true);
    expect(isRunLevelInvariant('scenario-round-trip')).toBe(true);
    expect(isRunLevelInvariant('tenant-isolation')).toBe(false);
    const findings = evaluateInvariant('replay-determinism', {
      scenario: run.value.scenario,
      reports: run.value.reports,
      trace: run.value.trace,
    }, undefined);
    expect(findings[0]?.satisfied).toBe(false);
  });
});
