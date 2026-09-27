// W032 — the NEGATIVE cross-domain evidence: the cross-tenant denial is
// recorded IN-TRACE (with both tenants), and authority-bypass attempts
// are rejected with typed codes AND no state delta.
import { describe, expect, it } from 'vitest';
import { runScenario } from '@epoch/test-harness';
import { OTHER_TENANT, TENANT, VARIANCE_EXCAVATION_ID } from '../scenarios/shared';
import { crossDomainDeliveryScenario } from '../scenarios/cross-domain-delivery';
import { crossDomainDriver, latestWorld } from '../scenarios/cross-domain-driver';

describe('cross-domain-negative', () => {
  const run = runScenario(crossDomainDeliveryScenario(), crossDomainDriver);
  expect(run.ok).toBe(true);
  if (!run.ok) {
    throw new Error('the cross-domain scenario failed to run');
  }
  const trace = run.value.trace;
  const world = latestWorld();

  it('the cross-tenant observation is DENIED and the denial is recorded IN-TRACE with both tenants', () => {
    const entry = trace.steps.find((candidate) => candidate.stepId === 'step:delivery-observe-foreign');
    expect(entry).toBeDefined();
    expect(entry?.outcome).toBe('denied');
    expect(entry?.errorCode).toBe('cross-tenant-denied');
    expect(entry?.stateDelta).toBe(false);
    const report = run.value.reports.find((candidate) => candidate.stepId === 'step:delivery-observe-foreign');
    expect(report?.denial).toEqual({
      code: 'cross-tenant-denied',
      expectedTenantId: TENANT,
      encounteredTenantId: OTHER_TENANT,
    });
    // The denied observation never entered the delivery record.
    expect(world.delivery?.observations.some((observation) => observation.recordId === 'observation:foreign-pit-volume')).toBe(false);
  });

  it('the tenant-isolation invariant is satisfied over the whole scenario (the typed denial shape everywhere)', () => {
    const finding = run.value.result.invariantResults.find((candidate) => candidate.invariant === 'tenant-isolation');
    expect(finding?.satisfied).toBe(true);
    expect(finding?.detail).toContain('denied with the typed shape');
  });

  it('the baseline revision attempt is REJECTED with the typed authority code and NO state delta', () => {
    const entry = trace.steps.find((candidate) => candidate.stepId === 'step:baseline-revise');
    expect(entry).toBeDefined();
    expect(entry?.outcome).toBe('authority-rejected');
    expect(entry?.errorCode).toBe('baseline-mutation-rejected');
    expect(entry?.stateDelta).toBe(false);
    const report = run.value.reports.find((candidate) => candidate.stepId === 'step:baseline-revise');
    expect(report?.authorityRejection?.code).toBe('baseline-mutation-rejected');
  });

  it('the tampered event append is REFUSED by the log (typed digest-mismatch, no state delta)', () => {
    const entry = trace.steps.find((candidate) => candidate.stepId === 'step:recovery-tamper');
    expect(entry).toBeDefined();
    expect(entry?.outcome).toBe('authority-rejected');
    expect(entry?.errorCode).toBe('digest-mismatch');
    expect(entry?.stateDelta).toBe(false);
  });

  it('the authority-routing invariant is satisfied: no bypass ever mutated state', () => {
    const finding = run.value.result.invariantResults.find((candidate) => candidate.invariant === 'authority-routing');
    expect(finding?.satisfied).toBe(true);
    expect(finding?.detail).toContain('no state delta');
    // Structural proof: the approval still pins the EXACT solution digest.
    expect(world.approval?.baselineDigest).toBe(world.solution?.contentDigest);
    // And the delivery record still verifies after every negative attempt.
    expect(trace.steps[trace.steps.length - 1]?.stateDigestAfter).toBe(trace.finalStateDigest);
  });

  it('the variance attribution still references the REAL change record by exact digest (post-negative integrity)', () => {
    expect(world.attribution?.varianceRef.recordId).toBe(VARIANCE_EXCAVATION_ID);
    expect(world.attribution?.varianceRef.contentDigest).toBe(
      world.variances.find((variance) => variance.varianceId === VARIANCE_EXCAVATION_ID)?.contentDigest,
    );
    expect(world.attribution?.cause.contentDigest).toBe(world.issue?.contentDigest);
    // The attribution evidence digests resolve in the REAL evidence store.
    for (const digest of world.attribution?.evidence ?? []) {
      expect(world.evidence.has(digest)).toBe(true);
    }
  });

  it('every negative expectation matched its declared outcome (expectation conformance)', () => {
    const finding = run.value.result.invariantResults.find(
      (candidate) => candidate.invariant === 'expectation-conformance',
    );
    expect(finding?.satisfied).toBe(true);
  });
});
