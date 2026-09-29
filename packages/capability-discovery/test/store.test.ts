// The source-adapter contract (pin 8): provider-neutral interface + the
// ONE reference fixture adapter; no real external registry integrated.
// Plus the tenant-scoped store battery including negative (e):
// cross-tenant isolation of discovery runs.
import { describe, expect, it } from 'vitest';
import { StaticCatalogSourceAdapter, validateScanQuery } from '../src/adapters';
import { CapabilityDiscoveryStore } from '../src/store';
import { runProblemDrivenDiscovery, verifyDiscoveryRun } from '../src/run';
import { createCapabilityGap, transitionCapabilityGap } from '../src/gap';
import { promoteCandidate, ingestExternalCandidate } from '../src/candidates';
import type { DiscoverySchedule } from '../src/types';
import {
  TENANT_A,
  TENANT_B,
  constructionCandidates,
  constructionInput,
  declaredCriteria,
  expectFailure,
  op,
  sourceArtifact,
} from './fixtures';

describe('the source-adapter contract (pin 8)', () => {
  it('the static catalog fixture adapter scans deterministically', () => {
    const adapter = new StaticCatalogSourceAdapter({
      adapterId: 'fixture-catalog',
      description: 'static fixture catalog',
      catalog: [
        sourceArtifact({
          artifactId: 'zeta-artifact',
          summary: 'Zeta claims audits',
          claims: [{ operation: op('software.security-audit'), inputKinds: ['code'], outputKinds: ['document'] }],
        }),
        sourceArtifact({
          artifactId: 'alpha-artifact',
          summary: 'Alpha claims test generation',
          claims: [{ operation: op('software.test-generation'), inputKinds: ['code'], outputKinds: ['code'] }],
        }),
      ],
    });
    const query = {
      operations: [op('software.security-audit'), op('software.test-generation')],
      limit: 10,
    };
    const result = adapter.scan(query);
    expect(result.adapterId).toBe('fixture-catalog');
    // Canonical (alphabetical) order, only matching artifacts.
    expect(result.artifacts.map((artifact) => artifact.artifactId)).toEqual([
      'alpha-artifact',
      'zeta-artifact',
    ]);
    // Same query -> same result (deterministic).
    expect(adapter.scan(query)).toEqual(result);
    // The limit is honored.
    const limited = adapter.scan({ ...query, limit: 1 });
    expect(limited.artifacts).toHaveLength(1);
    expect(limited.artifacts[0]!.artifactId).toBe('alpha-artifact');
    // Version constraints are honored.
    const pinned = adapter.scan({
      operations: [{ id: 'software.security-audit', versionConstraint: '9.9.9' }],
      limit: 10,
    });
    expect(pinned.artifacts).toHaveLength(0);
  });

  it('scan queries are validated (typed surface)', () => {
    expect(validateScanQuery({ operations: [op('x.y')], limit: 0 }).ok).toBe(false);
    expect(validateScanQuery({ operations: [op('x.y')], limit: 5 }).ok).toBe(true);
  });
});

describe('the tenant-scoped store (negative e: cross-tenant isolation)', () => {
  function recordedRun() {
    const result = runProblemDrivenDiscovery(constructionInput(), {
      at: '2026-10-05T09:00:00.000Z',
      candidates: Object.values(constructionCandidates()),
      criteria: declaredCriteria(),
    });
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  }

  it('records and reads runs tenant-scoped; foreign reads are denied', () => {
    const store = new CapabilityDiscoveryStore();
    const artifact = recordedRun();
    expect(store.recordRun(TENANT_A, artifact).ok).toBe(true);

    // Same tenant reads fine.
    expect(store.getRun(TENANT_A, artifact.run.runId).ok).toBe(true);
    // Foreign tenant reads are the typed cross-tenant denial.
    const denied = store.getRun(TENANT_B, artifact.run.runId);
    expectFailure(denied, 'cross-tenant-denied');
    // Listing is scoped.
    expect(store.listRuns(TENANT_B)).toEqual([]);
    expect(store.listRuns(TENANT_A)).toHaveLength(1);
    // Recording a run under the wrong tenant scope is denied.
    expectFailure(store.recordRun(TENANT_B, artifact), 'cross-tenant-denied');
  });

  it('unknown runs are typed failures', () => {
    const store = new CapabilityDiscoveryStore();
    expectFailure(store.getRun(TENANT_A, 'discrun:0123456789abcdef'), 'unknown-run');
  });

  it('gaps are tenant-scoped with typed cross-tenant denial', () => {
    const store = new CapabilityDiscoveryStore();
    const gap = createCapabilityGap({
      tenantId: TENANT_A,
      operation: op('software.security-audit'),
      demandSummary: 'audit',
      lifecycleStage: 'realize',
      triggeringSignalIds: [],
      at: '2026-10-05T09:00:00.000Z',
    });
    expect(store.upsertGap(TENANT_A, gap).ok).toBe(true);
    expect(store.getGap(TENANT_A, gap.gapId).ok).toBe(true);
    expectFailure(store.getGap(TENANT_B, gap.gapId), 'cross-tenant-denied');
    expectFailure(store.upsertGap(TENANT_B, gap), 'cross-tenant-denied');
    expect(store.listGaps(TENANT_B)).toEqual([]);
    expect(store.listGaps(TENANT_A, { state: 'UNSATISFIED' })).toHaveLength(1);
    expect(store.listGaps(TENANT_A, { state: 'VERIFIED' })).toEqual([]);
  });

  it('schedules are tenant-scoped with typed cross-tenant denial', () => {
    const store = new CapabilityDiscoveryStore();
    const schedule: DiscoverySchedule = {
      scheduleId: 'sched-weekly',
      tenantId: TENANT_A,
      cadence: { kind: 'weekly' },
      adapterIds: ['fixture-catalog'],
      enabled: true,
    };
    expect(store.upsertSchedule(TENANT_A, schedule).ok).toBe(true);
    expectFailure(store.upsertSchedule(TENANT_B, schedule), 'cross-tenant-denied');
    expect(store.listSchedules(TENANT_B)).toEqual([]);
    expect(store.markScheduleRun(TENANT_A, 'sched-weekly', '2026-10-12T09:00:00.000Z').ok).toBe(true);
    expectFailure(
      store.markScheduleRun(TENANT_B, 'sched-weekly', '2026-10-12T09:00:00.000Z'),
      'cross-tenant-denied',
    );
    expectFailure(store.markScheduleRun(TENANT_A, 'sched-missing', '2026-10-12T09:00:00.000Z'), 'unknown-schedule');
  });

  it('candidate state evolution requires a recorded promotion (promotion-gate enforcement)', () => {
    const store = new CapabilityDiscoveryStore();
    const ingested = ingestExternalCandidate({
      tenantId: TENANT_A,
      adapterId: 'fixture-catalog',
      artifact: sourceArtifact({
        artifactId: 'audit-artifact',
        summary: 'audit claims',
        claims: [{ operation: op('software.security-audit'), inputKinds: ['code'], outputKinds: ['document'] }],
      }),
    });
    if (!ingested.ok) throw new Error(ingested.error.message);
    expect(store.upsertCandidate(TENANT_A, ingested.value).ok).toBe(true);

    // Direct state flip without a promotion record is rejected.
    expectFailure(
      store.upsertCandidate(TENANT_A, { ...ingested.value, evaluationState: 'verified' }),
      'candidate-state-conflict',
    );

    // The honest gate walk is accepted and recorded.
    const first = promoteCandidate({
      candidate: ingested.value,
      targetState: 'ingested',
      evidenceDigest: 'a'.repeat(64),
      at: '2026-10-06T09:00:00.000Z',
      previousPromotionDigest: null,
    });
    if (!first.ok) throw new Error(first.error.message);
    const recorded = store.recordPromotion(TENANT_A, first.value.record, first.value.promoted);
    expect(recorded.ok).toBe(true);
    const readCandidate = store.getCandidate(ingested.value.candidateId);
    if (!readCandidate.ok) throw new Error(readCandidate.error.message);
    expect(readCandidate.value.evaluationState).toBe('ingested');
    expect(store.promotionChain(ingested.value.candidateId)).toHaveLength(1);

    // A chain-broken promotion is rejected.
    const sandboxed = promoteCandidate({
      candidate: first.value.promoted,
      targetState: 'sandboxed',
      evidenceDigest: 'b'.repeat(64),
      sandboxReport: { passed: true, isolationLevel: 'process', findings: [] },
      at: '2026-10-06T09:01:00.000Z',
      previousPromotionDigest: null, // WRONG: must link to the first record
    });
    if (!sandboxed.ok) throw new Error(sandboxed.error.message);
    expectFailure(store.recordPromotion(TENANT_A, sandboxed.value.record, sandboxed.value.promoted), 'promotion-gate-rejected');
  });

  it('recorded run artifacts remain verifiable (lineage survives storage)', () => {
    const store = new CapabilityDiscoveryStore();
    const artifact = recordedRun();
    store.recordRun(TENANT_A, artifact);
    const read = store.getRun(TENANT_A, artifact.run.runId);
    expect(read.ok).toBe(true);
    if (read.ok) expect(verifyDiscoveryRun(read.value).ok).toBe(true);
  });

  it('gap transitions are stored append-only and chain-verified', () => {
    const store = new CapabilityDiscoveryStore();
    const gap = createCapabilityGap({
      tenantId: TENANT_A,
      operation: op('software.security-audit'),
      demandSummary: 'audit',
      lifecycleStage: 'realize',
      triggeringSignalIds: [],
      at: '2026-10-05T09:00:00.000Z',
    });
    store.upsertGap(TENANT_A, gap);
    const transitioned = transitionCapabilityGap(gap, {
      toState: 'CANDIDATE_FOUND',
      at: '2026-10-06T09:00:00.000Z',
      cause: 'scan',
    });
    if (!transitioned.ok) throw new Error(transitioned.error.message);
    store.upsertGap(TENANT_A, transitioned.value);
    const read = store.getGap(TENANT_A, gap.gapId);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value.transitions).toHaveLength(2);
      expect(read.value.state).toBe('CANDIDATE_FOUND');
    }
  });
});
