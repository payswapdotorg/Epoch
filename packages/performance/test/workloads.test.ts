// W034 — workloads: generator determinism, payload grammar, tamper
// detection, round trips, and the workload-ledger tenant/identity
// discipline (R12).
import { describe, expect, it } from 'vitest';
import {
  generateWorkload,
  verifySealedWorkload,
  serializeWorkload,
  deserializeWorkload,
  admitWorkload,
  openWorkloadLedger,
  inputSizeOf,
  quantityValueAt,
  unitCostAt,
  instantAt,
  type SealedWorkloadRecord,
} from '../src/index';
import { expectError, ok } from './helpers';

const TENANT = 'tenant:globex';
const OTHER_TENANT = 'tenant:initech';

const SEED = {
  workloadId: 'workload:workloads-test',
  tenantId: TENANT,
  shape: { planLines: 12, observations: 5, packProjections: 7, scenarioSteps: 9 },
  salt: 'alpha',
};

function mustGenerate(seed: unknown): SealedWorkloadRecord {
  return ok(generateWorkload(seed), 'generate workload');
}

describe('workload generator determinism (same seed -> same digest)', () => {
  it('two generations of the same seed derive identical workloads', () => {
    const first = mustGenerate(SEED);
    const second = mustGenerate(SEED);
    expect(first.contentDigest).toBe(second.contentDigest);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('a different salt derives a different workload', () => {
    const base = mustGenerate(SEED);
    const salted = mustGenerate({ ...SEED, salt: 'beta' });
    expect(salted.contentDigest).not.toBe(base.contentDigest);
    expect(salted.planLines.length).toBe(base.planLines.length);
  });

  it('a different shape derives a different workload', () => {
    const base = mustGenerate(SEED);
    const bigger = mustGenerate({ ...SEED, shape: { ...SEED.shape, planLines: 13 } });
    expect(bigger.contentDigest).not.toBe(base.contentDigest);
    expect(bigger.planLines.length).toBe(13);
  });

  it('deterministic value helpers never touch the clock or randomness', () => {
    expect(quantityValueAt(0)).toBe('100');
    expect(quantityValueAt(1)).toBe('107');
    expect(quantityValueAt(139)).toBe(quantityValueAt(139));
    expect(unitCostAt(0)).toBe('25.50');
    expect(unitCostAt(1)).toBe('26.50');
    expect(instantAt(0)).toBe('2026-07-01T08:00:00.000Z');
    expect(instantAt(3)).toBe('2026-07-01T11:00:00.000Z');
    expect(instantAt(3)).toBe(instantAt(3));
  });
});

describe('workload payload grammar (N plan lines, M observations, P projections, S steps)', () => {
  const workload = mustGenerate(SEED);

  it('sizes mirror the seed shape over the input-unit vocabulary', () => {
    expect(workload.sizes.planLines).toBe(12);
    expect(workload.sizes.observations).toBe(5);
    expect(workload.sizes.packProjections).toBe(7);
    expect(workload.sizes.scenarioSteps).toBe(9);
    expect(inputSizeOf(workload, 'observations')).toBe(5);
  });

  it('plan lines carry deterministic, index-derived ids and values', () => {
    expect(workload.planLines.length).toBe(12);
    expect(workload.planLines[0]!.lineId).toBe('line:perf-000000');
    expect(workload.planLines[11]!.lineId).toBe('line:perf-000011');
    expect(new Set(workload.planLines.map((line) => line.lineId)).size).toBe(12);
    for (const [index, line] of workload.planLines.entries()) {
      expect(line.quantity.value).toBe(quantityValueAt(index));
      expect(line.unitCost.amount).toBe(unitCostAt(index));
      expect(line.unitCost.currency).toBe('EUR');
    }
  });

  it('observations reference plan-line activities deterministically', () => {
    expect(workload.observations.length).toBe(5);
    expect(workload.observations[0]!.observationId).toBe('observation:perf-000000');
    expect(new Set(workload.observations.map((observation) => observation.observationId)).size).toBe(5);
    for (const observation of workload.observations) {
      expect(observation.subjectActivityIndex).toBeLessThan(SEED.shape.planLines);
      expect(observation.observedAt).toMatch(/^2026-07-01T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  });

  it('pack projections cycle the closed surface vocabulary', () => {
    expect(workload.packProjections.length).toBe(7);
    expect(workload.packProjections[0]!.surface).toBe('boq');
    expect(workload.packProjections[4]!.surface).toBe('deployment-plan');
    expect(workload.packProjections[5]!.surface).toBe('boq'); // cycles
  });

  it('scenario steps cycle the closed op vocabulary with deterministic inputs', () => {
    expect(workload.scenarioSteps.length).toBe(9);
    expect(workload.scenarioSteps[0]!.op).toBe('ledger.append');
    expect(workload.scenarioSteps[1]!.op).toBe('ledger.head');
    expect(workload.scenarioSteps[2]!.op).toBe('ledger.append');
    expect(workload.scenarioSteps[3]!.input.value).toBe(3 * 13 + 7);
  });
});

describe('workload record validation (malformed workloads rejected)', () => {
  it('rejects a non-object seed', () => {
    const bad = expectError(generateWorkload('garbage'), 'generate from garbage');
    expect(bad.code).toBe('performance-invalid');
    expect((bad.issues as { path: string }[])[0]!.path).toBe('$');
  });

  it('rejects zero dimensions (a degenerate workload is not a workload)', () => {
    const bad = expectError(
      generateWorkload({
        workloadId: 'workload:bad-shape',
        tenantId: TENANT,
        shape: { planLines: 0, observations: 5, packProjections: 7, scenarioSteps: 9 },
      }),
      'generate zero-dimension workload',
    );
    expect(bad.code).toBe('performance-invalid');
    expect(
      (bad.issues as { path: string }[]).some((issue) => issue.path.includes('planLines')),
    ).toBe(true);
  });

  it('rejects a malformed tenant id and workload id', () => {
    expect(generateWorkload({ workloadId: 'nope', tenantId: TENANT, shape: SEED.shape }).ok).toBe(false);
    expect(generateWorkload({ workloadId: 'workload:x', tenantId: 'globex', shape: SEED.shape }).ok).toBe(false);
  });
});

describe('workload record tamper detection + round trip', () => {
  const workload = mustGenerate(SEED);

  it('verify accepts the pristine sealed record', () => {
    const verified = ok(verifySealedWorkload(workload), 'verify workload');
    expect(verified.contentDigest).toBe(workload.contentDigest);
  });

  it('verify detects a tampered payload (digest mismatch)', () => {
    const tampered = {
      ...workload,
      planLines: [...workload.planLines.slice(0, -1), { ...workload.planLines[workload.planLines.length - 1]!, title: 'edited' }],
    };
    const error = expectError(verifySealedWorkload(tampered), 'verify tampered workload');
    expect(error.code).toBe('digest-mismatch');
    expect(String(error.expected)).not.toBe(String(error.encountered));
  });

  it('verify detects a forged digest', () => {
    const error = expectError(verifySealedWorkload({ ...workload, contentDigest: 'e'.repeat(64) }), 'verify forged workload');
    expect(error.code).toBe('digest-mismatch');
  });

  it('serializes + deserializes byte-identically with a verifying digest', () => {
    const text = serializeWorkload(workload);
    const round = ok(deserializeWorkload(text, workload.contentDigest), 'deserialize workload');
    expect(round.digestVerifies).toBe(true);
    expect(serializeWorkload(round.record)).toBe(text);
  });

  it('a wrong claimed digest does not verify (round-trip gate)', () => {
    const round = ok(deserializeWorkload(serializeWorkload(workload), 'a'.repeat(64)), 'deserialize workload');
    expect(round.digestVerifies).toBe(false);
  });

  it('invalid JSON is a typed serialization error', () => {
    const error = expectError(deserializeWorkload('nope', workload.contentDigest), 'deserialize workload');
    expect(error.code).toBe('serialization-invalid');
  });
});

describe('workload ledger (tenant isolation + identity discipline)', () => {
  it('admits a same-tenant workload and stays idempotent', () => {
    const ledger = openWorkloadLedger(TENANT);
    const workload = mustGenerate(SEED);
    const first = ok(admitWorkload(ledger, workload), 'admit workload');
    expect(first.workloads.length).toBe(1);
    const again = ok(admitWorkload(first, workload), 're-admit workload');
    expect(again.workloads.length).toBe(1);
  });

  it('denies a cross-tenant workload (R12)', () => {
    const ledger = openWorkloadLedger(TENANT);
    const foreign = mustGenerate({ ...SEED, tenantId: OTHER_TENANT, workloadId: 'workload:foreign' });
    const error = expectError(admitWorkload(ledger, foreign), 'admit foreign workload');
    expect(error.code).toBe('cross-tenant-denied');
    expect(String(error.expectedTenantId)).toBe(TENANT);
    expect(String(error.encounteredTenantId)).toBe(OTHER_TENANT);
  });

  it('rejects same identity with different content (version conflict)', () => {
    const ledger = openWorkloadLedger(TENANT);
    const workload = mustGenerate(SEED);
    const admitted = ok(admitWorkload(ledger, workload), 'admit workload');
    const divergent = mustGenerate({ ...SEED, salt: 'divergent' });
    const error = expectError(admitWorkload(admitted, divergent), 'admit divergent workload');
    expect(error.code).toBe('version-conflict');
    expect(String(error.subjectId)).toBe(workload.workloadId);
    expect(String(error.publishedDigest)).toBe(workload.contentDigest);
    expect(String(error.encounteredDigest)).toBe(divergent.contentDigest);
  });

  it('rejects a tampered workload at the ledger gate (tamper detection)', () => {
    const ledger = openWorkloadLedger(TENANT);
    const workload = mustGenerate(SEED);
    const error = expectError(admitWorkload(ledger, { ...workload, contentDigest: 'b'.repeat(64) }), 'admit tampered workload');
    expect(error.code).toBe('digest-mismatch');
  });

  it('never mutates the input ledger (append-only discipline)', () => {
    const ledger = openWorkloadLedger(TENANT);
    const workload = mustGenerate(SEED);
    ok(admitWorkload(ledger, workload), 'admit workload');
    expect(ledger.workloads.length).toBe(0);
  });
});
