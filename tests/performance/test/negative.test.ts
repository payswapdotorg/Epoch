// W034 — negatives: malformed workloads are rejected; tampered digests
// fail closed; mismatched bindings are typed rejections; tenant
// isolation holds at every performance boundary (the workload ledger
// AND the budget evaluation).
import { describe, expect, it } from 'vitest';
import {
  admitWorkload,
  evaluateBudget,
  generateWorkload,
  openWorkloadLedger,
  sealBudget,
  sealMeasuredCounts,
  verifySealedBudget,
  verifySealedMeasuredCounts,
  verifySealedWorkload,
} from '@epoch/performance';
import { budgetOf } from '../src/budget-catalog';
import { measureSubject } from '../src/measure';
import { OTHER_TENANT, TENANT } from '../src/materialize';
import { expectError } from '../src/test-helpers';

/** The digest-stripped content of a sealed record (re-seal basis). */
function contentOf<T extends { contentDigest: string }>(sealed: T): Omit<T, 'contentDigest'> {
  const { contentDigest: _contentDigest, ...content } = sealed;
  void _contentDigest;
  return content;
}

describe('malformed workloads are rejected (typed validation, never exceptions)', () => {
  it('a non-object seed is rejected with flattened issues', () => {
    const bad = expectError(generateWorkload(42), 'generate from garbage');
    expect(bad.code).toBe('performance-invalid');
    expect((bad.issues as { path: string }[]).length).toBeGreaterThan(0);
  });

  it('zero and negative dimensions are rejected', () => {
    for (const shape of [
      { planLines: 0, observations: 8, packProjections: 5, scenarioSteps: 16 },
      { planLines: 32, observations: -1, packProjections: 5, scenarioSteps: 16 },
      { planLines: 32, observations: 8, packProjections: 0, scenarioSteps: 16 },
    ]) {
      const bad = expectError(generateWorkload({ workloadId: 'workload:bad', tenantId: TENANT, shape }), 'generate bad shape');
      expect(bad.code).toBe('performance-invalid');
    }
  });

  it('fractional dimensions are rejected (integer sizes only)', () => {
    const bad = expectError(
      generateWorkload({
        workloadId: 'workload:bad',
        tenantId: TENANT,
        shape: { planLines: 32.5, observations: 8, packProjections: 5, scenarioSteps: 16 },
      }),
      'generate fractional shape',
    );
    expect(bad.code).toBe('performance-invalid');
  });
});

describe('tampered digests fail closed (tamper detection at every boundary)', () => {
  it('a tampered workload record fails verification', () => {
    const measurement = measureSubject('program-fold', 'small');
    const tampered = {
      ...measurement.workload,
      planLines: [...measurement.workload.planLines.slice(0, -1), { ...measurement.workload.planLines.at(-1)!, title: 'tampered' }],
    };
    const failure = expectError(verifySealedWorkload(tampered), 'verify tampered workload');
    expect(failure.code).toBe('digest-mismatch');
    expect(String(failure.expected)).not.toBe(String(failure.encountered));
  });

  it('a tampered measured-counts record fails verification', () => {
    const measurement = measureSubject('observation-stack', 'small');
    const tampered = {
      ...measurement.counts,
      counts: { ...measurement.counts.counts, 'kernel-admission': 0 },
    };
    const failure = expectError(verifySealedMeasuredCounts(tampered), 'verify tampered counts');
    expect(failure.code).toBe('digest-mismatch');
  });

  it('a tampered catalog budget fails verification', () => {
    const budget = budgetOf('program-fold');
    const foldEnvelope = budget.envelopes['kernel-fold']!;
    const tampered = {
      ...budget,
      envelopes: { ...budget.envelopes, 'kernel-fold': { ...foldEnvelope, intercept: 999999 } },
    };
    const failure = expectError(verifySealedBudget(tampered), 'verify tampered budget');
    expect(failure.code).toBe('digest-mismatch');
  });

  it('a forged workload digest fails evaluation closed (digest-mismatch, not a crash)', () => {
    const measurement = measureSubject('variance-stack', 'small');
    const failure = expectError(
      evaluateBudget({
        workload: { ...measurement.workload, contentDigest: 'e'.repeat(64) },
        counts: measurement.counts,
        budget: budgetOf('variance-stack'),
      }),
      'evaluate against forged workload',
    );
    expect(failure.code).toBe('digest-mismatch');
  });
});

describe('mismatched bindings are typed rejections', () => {
  it('counts bound to a different workload revision are rejected (workload-mismatch)', () => {
    const measurement = measureSubject('variance-stack', 'small');
    const other = measureSubject('variance-stack', 'medium');
    const failure = expectError(
      evaluateBudget({ workload: other.workload, counts: measurement.counts, budget: budgetOf('variance-stack') }),
      'evaluate mismatched workload',
    );
    expect(failure.code).toBe('workload-mismatch');
    expect(String(failure.expectedWorkloadDigest)).toBe(other.workload.contentDigest);
    expect(String(failure.encounteredWorkloadDigest)).toBe(measurement.workload.contentDigest);
  });

  it('counts of a different subject are rejected (subject-mismatch)', () => {
    const measurement = measureSubject('variance-stack', 'small');
    const resealed = sealMeasuredCounts({ ...contentOf(measurement.counts), subject: 'another-subject' });
    expect(resealed.ok).toBe(true);
    if (!resealed.ok) {
      throw new Error(JSON.stringify(resealed.error));
    }
    const failure = expectError(
      evaluateBudget({ workload: measurement.workload, counts: resealed.value, budget: budgetOf('variance-stack') }),
      'evaluate mismatched subject',
    );
    expect(failure.code).toBe('subject-mismatch');
    expect(String(failure.expectedSubject)).toBe('variance-stack');
    expect(String(failure.encounteredSubject)).toBe('another-subject');
  });
});

describe('tenant isolation (R12) at every performance boundary', () => {
  it('the workload ledger denies a cross-tenant workload', () => {
    const ledger = openWorkloadLedger(TENANT);
    const foreign = generateWorkload({
      workloadId: 'workload:foreign-negative',
      tenantId: OTHER_TENANT,
      shape: { planLines: 16, observations: 4, packProjections: 5, scenarioSteps: 8 },
    });
    expect(foreign.ok).toBe(true);
    if (!foreign.ok) {
      throw new Error(JSON.stringify(foreign.error));
    }
    const failure = expectError(admitWorkload(ledger, foreign.value), 'admit foreign workload');
    expect(failure.code).toBe('cross-tenant-denied');
    expect(String(failure.expectedTenantId)).toBe(TENANT);
    expect(String(failure.encounteredTenantId)).toBe(OTHER_TENANT);
  });

  it('budget evaluation denies cross-tenant counts (the measurement must belong to the workload tenant)', () => {
    const measurement = measureSubject('observation-stack', 'small');
    const foreignCounts = sealMeasuredCounts({ ...contentOf(measurement.counts), tenantId: OTHER_TENANT });
    expect(foreignCounts.ok).toBe(true);
    if (!foreignCounts.ok) {
      throw new Error(JSON.stringify(foreignCounts.error));
    }
    const failure = expectError(
      evaluateBudget({ workload: measurement.workload, counts: foreignCounts.value, budget: budgetOf('observation-stack') }),
      'evaluate foreign counts',
    );
    expect(failure.code).toBe('cross-tenant-denied');
    expect(String(failure.expectedTenantId)).toBe(TENANT);
    expect(String(failure.encounteredTenantId)).toBe(OTHER_TENANT);
  });

  it('budget evaluation denies a cross-tenant budget record', () => {
    const measurement = measureSubject('observation-stack', 'small');
    const foreignBudget = sealBudget({
      ...contentOf(budgetOf('observation-stack')),
      tenantId: OTHER_TENANT,
      budgetId: 'budget:foreign-tenant',
    });
    expect(foreignBudget.ok).toBe(true);
    if (!foreignBudget.ok) {
      throw new Error(JSON.stringify(foreignBudget.error));
    }
    const failure = expectError(
      evaluateBudget({ workload: measurement.workload, counts: measurement.counts, budget: foreignBudget.value }),
      'evaluate foreign budget',
    );
    expect(failure.code).toBe('cross-tenant-denied');
  });
});
