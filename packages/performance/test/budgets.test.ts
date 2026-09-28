// W034 — budgets: envelope math, verdicts, tamper detection, tenant
// discipline, mismatch guards, reproducibility, and the regression gate
// (synthetic subjects; no kernel composition here — that lives in
// tests/performance).
import { describe, expect, it } from 'vitest';
import {
  allowedCountAt,
  nearFloorOf,
  evaluateBudget,
  enforceBudgets,
  PerformanceBudgetExceededError,
  sealBudget,
  sealBudgetVerdict,
  sealMeasuredCounts,
  serializeBudget,
  deserializeBudget,
  verifySealedBudget,
  verifySealedBudgetVerdict,
  verdictIdOf,
  DEFAULT_BUDGET_POLICY,
  generateWorkload,
  type SealedBudgetRecord,
  type SealedMeasuredCounts,
} from '../src/index';
import { expectError, ok } from './helpers';

const TENANT = 'tenant:globex';
const OTHER_TENANT = 'tenant:initech';

/** The digest-stripped content projection of a sealed record (re-seal basis). */
function contentOf<T extends { contentDigest: string }>(sealed: T): Omit<T, 'contentDigest'> {
  const { contentDigest: _contentDigest, ...content } = sealed;
  void _contentDigest;
  return content;
}

function syntheticWorkload(salt = '') {
  return ok(
    generateWorkload({
      workloadId: 'workload:budgets-synthetic',
      tenantId: TENANT,
      shape: { planLines: 10, observations: 4, packProjections: 2, scenarioSteps: 8 },
      salt,
    }),
    'generate synthetic workload',
  );
}

function syntheticCounts(
  workload: ReturnType<typeof syntheticWorkload>,
  measured: number,
  overrides: Record<string, unknown> = {},
): SealedMeasuredCounts {
  return ok(
    sealMeasuredCounts({
      schema: 'epoch.performance.counts',
      schemaVersion: 1,
      tenantId: TENANT,
      countsId: 'counts:budgets-synthetic',
      subject: 'synthetic-fold',
      workloadId: workload.workloadId,
      workloadDigest: workload.contentDigest,
      counts: {
        'kernel-admission': 0,
        'kernel-fold': measured,
        'projection-compute': 0,
        'digest-compute': 0,
        'harness-scenario': 0,
      },
      measuredBy: 'principal:platform-engineer',
      provenance: { kind: 'observed', sourceRef: 'test:budgets' },
      ...overrides,
    }),
    'seal synthetic counts',
  );
}

function syntheticBudget(): SealedBudgetRecord {
  return ok(
    sealBudget({
      schema: 'epoch.performance.budget',
      schemaVersion: 1,
      tenantId: TENANT,
      budgetId: 'budget:synthetic-fold',
      name: 'Synthetic fold budget',
      description: 'Test fixture budget: kernel-fold allowed = 2 + 2 * planLines.',
      subject: 'synthetic-fold',
      inputUnit: 'planLines',
      envelopes: { 'kernel-fold': { intercept: 2, slopeNumerator: 2, slopeDenominator: 1 } },
      policy: DEFAULT_BUDGET_POLICY,
      provenance: { kind: 'derived', sourceRef: 'test:budgets' },
    }),
    'seal synthetic budget',
  );
}

describe('budget envelope math (exact integers, never floats)', () => {
  it('computes allowed = intercept + floor(slopeNumerator * size / slopeDenominator)', () => {
    expect(allowedCountAt({ intercept: 2, slopeNumerator: 2, slopeDenominator: 1 }, 10)).toBe(22);
    expect(allowedCountAt({ intercept: 0, slopeNumerator: 7, slopeDenominator: 2 }, 10)).toBe(35);
    expect(allowedCountAt({ intercept: 0, slopeNumerator: 7, slopeDenominator: 2 }, 11)).toBe(38); // floor(38.5)
    expect(allowedCountAt({ intercept: 3, slopeNumerator: 0, slopeDenominator: 4 }, 512)).toBe(3);
  });

  it('computes the near floor as ceil(allowed * numerator / denominator)', () => {
    expect(nearFloorOf({ nearThresholdNumerator: 9, nearThresholdDenominator: 10 }, 22)).toBe(20); // ceil(19.8)
    expect(nearFloorOf({ nearThresholdNumerator: 9, nearThresholdDenominator: 10 }, 20)).toBe(18); // ceil(18.0)
    expect(nearFloorOf({ nearThresholdNumerator: 1, nearThresholdDenominator: 2 }, 7)).toBe(4); // ceil(3.5)
  });
});

describe('budget verdicts (within / near / over with exact counts)', () => {
  const workload = syntheticWorkload();
  const budget = syntheticBudget();

  it('within-budget: measured below the near floor', () => {
    const verdict = ok(evaluateBudget({ workload, counts: syntheticCounts(workload, 10), budget }), 'evaluate');
    expect(verdict.overall).toBe('within-budget');
    expect(verdict.perClass[0]!.measured).toBe(10);
    expect(verdict.perClass[0]!.allowed).toBe(22);
    expect(verdict.perClass[0]!.exceededBy).toBeNull();
  });

  it('near-budget: measured at or above the near floor but within the envelope', () => {
    for (const measured of [20, 21, 22]) {
      const verdict = ok(evaluateBudget({ workload, counts: syntheticCounts(workload, measured), budget }), 'evaluate');
      expect(verdict.overall).toBe('near-budget');
      expect(verdict.perClass[0]!.verdict).toBe('near-budget');
      expect(verdict.perClass[0]!.exceededBy).toBeNull();
    }
  });

  it('within when just under the near floor (19 < 20)', () => {
    const verdict = ok(evaluateBudget({ workload, counts: syntheticCounts(workload, 19), budget }), 'evaluate');
    expect(verdict.overall).toBe('within-budget');
  });

  it('over-budget: measured exceeds the envelope, carrying the exceeded amount', () => {
    const verdict = ok(evaluateBudget({ workload, counts: syntheticCounts(workload, 23), budget }), 'evaluate');
    expect(verdict.overall).toBe('over-budget');
    const finding = verdict.perClass[0]!;
    expect(finding.operationClass).toBe('kernel-fold');
    expect(finding.measured).toBe(23);
    expect(finding.allowed).toBe(22);
    expect(finding.exceededBy).toBe(1);
    // An over-budget verdict is a TYPED RECORD, never a crash:
    expect(verdict.verdictId).toBe('verdict:synthetic-fold--budgets-synthetic');
  });
});

describe('budget-verdict-reproducible (pure evaluation, byte-identical reruns)', () => {
  const workload = syntheticWorkload('repro');
  const budget = syntheticBudget();

  it('identical inputs derive identical verdict digests', () => {
    const first = ok(evaluateBudget({ workload, counts: syntheticCounts(workload, 21), budget }), 'evaluate');
    const second = ok(evaluateBudget({ workload, counts: syntheticCounts(workload, 21), budget }), 'evaluate');
    expect(first.contentDigest).toBe(second.contentDigest);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('a different workload salt derives a different verdict', () => {
    const other = syntheticWorkload('other-salt');
    const verdict = ok(evaluateBudget({ workload: other, counts: syntheticCounts(other, 21), budget }), 'evaluate');
    const base = ok(evaluateBudget({ workload, counts: syntheticCounts(workload, 21), budget }), 'evaluate');
    expect(verdict.contentDigest).not.toBe(base.contentDigest);
  });

  it('verdict ids are deterministic functions of budget + workload identities', () => {
    expect(verdictIdOf('budget:synthetic-fold', 'workload:budgets-synthetic')).toBe(
      'verdict:synthetic-fold--budgets-synthetic',
    );
  });
});

describe('budget evaluation guards (typed, never exceptions)', () => {
  const workload = syntheticWorkload();
  const budget = syntheticBudget();

  it('tampered workload digest fails closed as digest-mismatch', () => {
    const tampered = { ...workload, contentDigest: 'f'.repeat(64) };
    const error = expectError(evaluateBudget({ workload: tampered, counts: syntheticCounts(workload, 10), budget }), 'evaluate');
    expect(error.code).toBe('digest-mismatch');
  });

  it('tampered counts digest fails closed as digest-mismatch', () => {
    const counts = syntheticCounts(workload, 10);
    const error = expectError(
      evaluateBudget({ workload, counts: { ...counts, counts: { ...counts.counts, 'kernel-fold': 999 } }, budget }),
      'evaluate',
    );
    expect(error.code).toBe('digest-mismatch');
  });

  it('tampered budget digest fails closed as digest-mismatch', () => {
    const error = expectError(
      evaluateBudget({ workload, counts: syntheticCounts(workload, 10), budget: { ...budget, contentDigest: '0'.repeat(64) } }),
      'evaluate',
    );
    expect(error.code).toBe('digest-mismatch');
  });

  it('cross-tenant counts are denied (R12)', () => {
    const counts = syntheticCounts(workload, 10);
    const foreign = ok(sealMeasuredCounts({ ...contentOf(counts), tenantId: OTHER_TENANT }), 'seal foreign counts');
    const error = expectError(evaluateBudget({ workload, counts: foreign, budget }), 'evaluate');
    expect(error.code).toBe('cross-tenant-denied');
    expect(String(error.expectedTenantId)).toBe(TENANT);
    expect(String(error.encounteredTenantId)).toBe(OTHER_TENANT);
  });

  it('cross-tenant budget is denied (R12)', () => {
    const foreignBudget = ok(
      sealBudget({ ...contentOf(budget), tenantId: OTHER_TENANT, budgetId: 'budget:foreign' }),
      'seal foreign budget',
    );
    const error = expectError(evaluateBudget({ workload, counts: syntheticCounts(workload, 10), budget: foreignBudget }), 'evaluate');
    expect(error.code).toBe('cross-tenant-denied');
  });

  it('counts of a different workload revision are rejected as workload-mismatch', () => {
    const otherWorkload = syntheticWorkload('different');
    const error = expectError(evaluateBudget({ workload: otherWorkload, counts: syntheticCounts(workload, 10), budget }), 'evaluate');
    expect(error.code).toBe('workload-mismatch');
    expect(String(error.expectedWorkloadDigest)).toBe(otherWorkload.contentDigest);
    expect(String(error.encounteredWorkloadDigest)).toBe(workload.contentDigest);
  });

  it('counts of a different subject are rejected as subject-mismatch', () => {
    const counts = syntheticCounts(workload, 10);
    const otherSubject = ok(
      sealMeasuredCounts({ ...contentOf(counts), subject: 'another-subject' }),
      'seal other-subject counts',
    );
    const error = expectError(evaluateBudget({ workload, counts: otherSubject, budget }), 'evaluate');
    expect(error.code).toBe('subject-mismatch');
    expect(String(error.expectedSubject)).toBe('synthetic-fold');
    expect(String(error.encounteredSubject)).toBe('another-subject');
  });

  it('malformed budget content is rejected with flattened issues', () => {
    const bad = expectError(sealBudget({ schema: 'epoch.performance.budget', nope: true }), 'seal bad budget');
    expect(bad.code).toBe('performance-invalid');
    expect(Array.isArray(bad.issues) && bad.issues.length > 0).toBe(true);
  });

  it('a budget without envelopes is rejected', () => {
    const bad = expectError(sealBudget({ ...budget, envelopes: {} }), 'seal empty budget');
    expect(bad.code).toBe('performance-invalid');
  });
});

describe('regression gate (enforceBudgets bites)', () => {
  const workload = syntheticWorkload();
  const budget = syntheticBudget();

  it('within/near verdicts enforce cleanly (no throw)', () => {
    const within = ok(evaluateBudget({ workload, counts: syntheticCounts(workload, 10), budget }), 'evaluate');
    const near = ok(evaluateBudget({ workload, counts: syntheticCounts(workload, 20), budget }), 'evaluate');
    expect(() => enforceBudgets([within, near])).not.toThrow();
  });

  it('an over-budget verdict throws the typed gate error carrying exact counts', () => {
    const over = ok(evaluateBudget({ workload, counts: syntheticCounts(workload, 23), budget }), 'evaluate');
    let thrown: PerformanceBudgetExceededError | undefined;
    try {
      enforceBudgets([over]);
    } catch (error) {
      thrown = error as PerformanceBudgetExceededError;
    }
    expect(thrown).toBeInstanceOf(PerformanceBudgetExceededError);
    expect(thrown!.violations.length).toBe(1);
    expect(thrown!.violations[0]!.verdict.verdictId).toBe('verdict:synthetic-fold--budgets-synthetic');
    expect(thrown!.violations[0]!.exceeded[0]!.measured).toBe(23);
    expect(thrown!.violations[0]!.exceeded[0]!.allowed).toBe(22);
    expect(thrown!.message).toContain('PERFORMANCE-BUDGET-EXCEEDED');
    expect(thrown!.message).toContain('measured 23 > allowed 22');
  });
});

describe('budget record round-trip + digest verification', () => {
  const budget = syntheticBudget();

  it('serializes + deserializes byte-identically with a verifying digest', () => {
    const text = serializeBudget(budget);
    const round = ok(deserializeBudget(text, budget.contentDigest), 'deserialize budget');
    expect(round.digestVerifies).toBe(true);
    expect(serializeBudget(round.record)).toBe(text);
  });

  it('a wrong claimed digest does not verify', () => {
    const round = ok(deserializeBudget(serializeBudget(budget), '0'.repeat(64)), 'deserialize budget');
    expect(round.digestVerifies).toBe(false);
  });

  it('invalid JSON is a typed serialization error', () => {
    const error = expectError(deserializeBudget('{not-json', budget.contentDigest), 'deserialize budget');
    expect(error.code).toBe('serialization-invalid');
  });

  it('verify detects a tampered sealed budget', () => {
    const tampered = { ...budget, name: 'renamed-after-sealing' };
    const error = expectError(verifySealedBudget(tampered), 'verify budget');
    expect(error.code).toBe('digest-mismatch');
  });

  it('seal recomputes the same digest for equal content (determinism)', () => {
    const again = ok(sealBudget(contentOf(budget)), 'seal budget again');
    expect(again.contentDigest).toBe(budget.contentDigest);
  });
});

describe('verdict record tamper detection + round trip', () => {
  it('a hand-forged verdict (content edited after sealing) fails verification', () => {
    const workload = syntheticWorkload();
    const budget = syntheticBudget();
    const verdict = ok(evaluateBudget({ workload, counts: syntheticCounts(workload, 10), budget }), 'evaluate');
    const forged = ok(sealBudgetVerdict({ ...contentOf(verdict), overall: 'within-budget' }), 'forge verdict');
    expect(forged.overall).toBe('within-budget');
    const error = expectError(verifySealedBudgetVerdict({ ...verdict, overall: 'over-budget' }), 'verify verdict');
    expect(error.code).toBe('digest-mismatch');
  });
});
