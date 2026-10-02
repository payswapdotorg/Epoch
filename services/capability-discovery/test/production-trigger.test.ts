/**
 * W054 (ACR-006) — the PRODUCTION ecosystem-discovery trigger tests:
 * the frozen contract invocation (trigger 'scheduled', caller-supplied
 * instants), the quota guard across invocations, graceful degradation
 * (token absent / provider failure / quota exhausted), fail-closed
 * service gates, and run-history provenance recording. Fetch doubles
 * stand in for the provider (NOT-VERIFIED-live: no Apify token exists
 * in this sandbox — the env-gated live test lives in
 * adapters/apify/test/live-acquisition.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { StaticCatalogSourceAdapter } from '@epoch/capability-discovery';
import type { DiscoveryInput } from '@epoch/capability-discovery';
import { ApifySourceAdapter } from '@epoch/adapter-apify';
import {
  acquisitionConfigFromEnv,
  acquisitionConfigured,
  runProductionEcosystemDiscovery,
} from '../src/production';
import { buildService } from './fixtures';
import {
  ALLOW,
  DENY,
  PRINCIPAL_LEAD,
  PRINCIPAL_SCHEDULER,
  TENANT_ALPHA,
} from './fixtures';

const SCAN_OPERATION = 'engineering.stress-analysis';

/** The fixture reference adapter (the always-present degraded-mode source). */
const FIXTURE_ADAPTER = new StaticCatalogSourceAdapter({
  adapterId: 'fixture-catalog',
  description: 'static fixture catalog',
  catalog: [
    {
      artifactId: 'fixture-stress-analysis',
      contentDigest: 'f'.repeat(64),
      summary: 'Claims stress analysis (fixture source)',
      claimedCapabilities: [
        {
          operation: { id: SCAN_OPERATION, versionConstraint: '*' },
          inputKinds: ['geometry'],
          outputKinds: ['numeric'],
          claimBasis: 'declared',
        },
      ],
      environmentNotes: [],
    },
  ],
});

/** A scripted fetch double for the acquisition provider. */
function scriptedFetch(
  responses: Array<{ readonly status: number; readonly body: unknown }>,
  seen: Array<{ readonly url: string }> = [],
): typeof fetch {
  let call = 0;
  return (async (url: string | URL | Request) => {
    seen.push({ url: String(url) });
    const response = responses[Math.min(call, responses.length - 1)]!;
    call += 1;
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

/** One valid acquisition dataset item for the scan operation. */
function datasetItem(): Record<string, unknown> {
  return {
    summary: 'External stress-analysis capability observation',
    claimedCapabilities: [
      {
        operation: { id: SCAN_OPERATION, versionConstraint: '*' },
        inputKinds: ['geometry'],
        outputKinds: ['numeric'],
        claimBasis: 'declared',
      },
    ],
    environmentNotes: [],
  };
}

/** Seed an UNSATISFIED gap for the scan operation (problem-driven run). */
function seedGap(service: ReturnType<typeof buildService>): void {
  const input: DiscoveryInput = {
    schemaVersion: 1,
    tenantId: TENANT_ALPHA,
    task: {
      summary: 'Assess a structure',
      lifecycleStage: 'understand',
      domainRefs: ['construction'],
      objectives: ['assessment'],
    },
    worldRefs: [],
    evidenceSignals: [],
    constraintSignals: [],
    taskSignals: [
      {
        signalId: 's-analysis',
        kind: 'operation',
        summary: 'Structural analysis',
        subjectRefs: [],
        evidenceRefs: [],
        constraintRefs: [],
        operationRef: { id: SCAN_OPERATION, versionConstraint: '*' },
        representationHints: ['geometry'],
        outputHints: ['numeric'],
      },
    ],
    packContributions: [],
  };
  const seeded = service.runProblemDiscovery({
    principal: PRINCIPAL_LEAD,
    authorization: ALLOW,
    tenantId: TENANT_ALPHA,
    input,
    options: { candidates: [] },
    at: '2026-10-05T09:00:00.000Z',
  });
  if (!seeded.ok) throw new Error(seeded.error.message);
}

describe('the production trigger follows the frozen contract', () => {
  it('invokes the service contract with trigger scheduled at the caller-supplied instant', async () => {
    const service = buildService();
    seedGap(service);
    const seen: Array<{ readonly url: string }> = [];
    const outcome = await runProductionEcosystemDiscovery({
      now: '2026-10-06T09:00:00.000Z',
      service,
      principal: PRINCIPAL_SCHEDULER,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      fixtureAdapter: FIXTURE_ADAPTER,
      acquisition: {
        adapter: new ApifySourceAdapter({
          token: 'test-token',
          actorId: 'my-pinned-actor',
          fetchImpl: scriptedFetch([{ status: 200, body: [datasetItem()] }], seen),
        }),
      },
      invokedBy: 'sched-weekly-alpha',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.trigger).toBe('scheduled');
    expect(outcome.value.invokedBy).toBe('sched-weekly-alpha');
    expect(outcome.value.at).toBe('2026-10-06T09:00:00.000Z');
    expect(outcome.value.degraded).toBe(false);
    expect(outcome.value.runId).toMatch(/^discrun:[0-9a-f]{16}$/);
    // The acquisition leg ran the pinned actor exactly once.
    expect(seen).toHaveLength(1);
    // The run ingested candidates (fixture + acquisition sources).
    expect(outcome.value.ingestedCandidateIds.length).toBeGreaterThan(0);
    expect(outcome.value.updatedGapIds.length).toBeGreaterThan(0);
  });

  it('records acquisition provenance in the run history (stored candidates)', async () => {
    const service = buildService();
    seedGap(service);
    const outcome = await runProductionEcosystemDiscovery({
      now: '2026-10-06T09:00:00.000Z',
      service,
      principal: PRINCIPAL_SCHEDULER,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      fixtureAdapter: FIXTURE_ADAPTER,
      acquisition: {
        adapter: new ApifySourceAdapter({
          token: 'test-token',
          actorId: 'my-pinned-actor',
          fetchImpl: scriptedFetch([{ status: 200, body: [datasetItem()] }]),
        }),
      },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // The outcome carries the full acquisition provenance record.
    const acquisition = outcome.value.acquisition;
    expect(acquisition.mode).toBe('enabled');
    if (acquisition.mode !== 'enabled') return;
    expect(acquisition.provenance.adapterId).toBe('apify-acquisition');
    expect(acquisition.provenance.actorId).toBe('my-pinned-actor');
    expect(acquisition.provenance.acquisitionRunId).toMatch(/^apifyrun:[0-9a-f]{16}$/);
    expect(acquisition.provenance.fetchedAt).toBe('2026-10-06T09:00:00.000Z');
    expect(acquisition.provenance.rawResultDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(acquisition.quota.maxRunsPerDay).toBe(1);
    // The STORED candidate carries the external-source provenance with the
    // adapter identity (the existing run-history contract).
    const listed = service.listCandidates(PRINCIPAL_LEAD, ALLOW);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const external = listed.value.filter(
      (candidate) => candidate.provenance.sourceKind === 'external-source',
    );
    expect(external.length).toBeGreaterThan(0);
    const apifyCandidate = external.find(
      (candidate) => candidate.provenance.external?.adapterId === 'apify-acquisition',
    );
    expect(apifyCandidate).toBeDefined();
    // Untrusted discipline: the externally-ingested candidate is a
    // non-consequential discovered observation.
    expect(apifyCandidate!.evaluationState).toBe('discovered');
    expect(apifyCandidate!.security.trustDomain).toBe('external');
  });
});

describe('the production trigger is quota-guarded', () => {
  it('refuses acquisition beyond the per-day cap across invocations sharing the adapter', async () => {
    const service = buildService();
    seedGap(service);
    const seen: Array<{ readonly url: string }> = [];
    const sharedAdapter = new ApifySourceAdapter({
      token: 'test-token',
      actorId: 'my-pinned-actor',
      maxRunsPerDay: 1,
      fetchImpl: scriptedFetch([{ status: 200, body: [datasetItem()] }], seen),
    });
    const base = {
      service,
      principal: PRINCIPAL_SCHEDULER,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      fixtureAdapter: FIXTURE_ADAPTER,
      acquisition: { adapter: sharedAdapter },
    };
    const first = await runProductionEcosystemDiscovery({
      ...base,
      now: '2026-10-06T09:00:00.000Z',
    });
    expect(first.ok && first.value.acquisition.mode).toBe('enabled');
    expect(seen).toHaveLength(1);

    // A SECOND scheduled trigger the same day: the quota guard refuses
    // the acquisition refresh BEFORE any provider call; the run proceeds
    // degraded on the fixture source (product healthy).
    const second = await runProductionEcosystemDiscovery({
      ...base,
      now: '2026-10-06T21:00:00.000Z',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.degraded).toBe(true);
    expect(second.value.acquisition.mode).toBe('degraded');
    if (second.value.acquisition.mode === 'degraded') {
      expect(second.value.acquisition.reason).toBe('quota-exceeded');
      expect(second.value.acquisition.failure.code).toBe('quota-exceeded');
    }
    expect(seen).toHaveLength(1); // NO second provider call
    // The fixture source still feeds discovery in the degraded run.
    expect(second.value.ingestedCandidateIds).toEqual([]);

    // The next epoch-day resets the counter (deterministic window).
    const nextDay = await runProductionEcosystemDiscovery({
      ...base,
      now: '2026-10-07T09:00:00.000Z',
    });
    expect(nextDay.ok && nextDay.value.acquisition.mode).toBe('enabled');
    expect(seen).toHaveLength(2);
  });
});

describe('the production trigger degrades gracefully', () => {
  it('without a token: acquisition disabled, discovery runs on the fixture source', async () => {
    const service = buildService();
    seedGap(service);
    const seen: Array<{ readonly url: string }> = [];
    const outcome = await runProductionEcosystemDiscovery({
      now: '2026-10-06T09:00:00.000Z',
      service,
      principal: PRINCIPAL_SCHEDULER,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      fixtureAdapter: FIXTURE_ADAPTER,
      acquisition: {
        config: { token: '', actorId: '', maxRunsPerDay: 1 },
        fetchImpl: scriptedFetch([{ status: 200, body: [datasetItem()] }], seen),
      },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.degraded).toBe(true);
    expect(outcome.value.acquisition.mode).toBe('disabled');
    if (outcome.value.acquisition.mode === 'disabled') {
      expect(outcome.value.acquisition.reason).toBe('token-or-actor-absent');
    }
    // No provider call was ever issued.
    expect(seen).toHaveLength(0);
    // The product stays healthy: the fixture source ingested a candidate.
    expect(outcome.value.ingestedCandidateIds.length).toBe(1);
  });

  it('on a provider failure: the run degrades (typed), the next run recovers', async () => {
    const service = buildService();
    seedGap(service);
    const seen: Array<{ readonly url: string }> = [];
    const responses: Array<{ readonly status: number; readonly body: unknown }> = [
      { status: 401, body: { error: 'bad token' } },
      { status: 200, body: [datasetItem()] },
    ];
    const outcome = await runProductionEcosystemDiscovery({
      now: '2026-10-06T09:00:00.000Z',
      service,
      principal: PRINCIPAL_SCHEDULER,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      fixtureAdapter: FIXTURE_ADAPTER,
      acquisition: {
        adapter: new ApifySourceAdapter({
          token: 'test-token',
          actorId: 'my-pinned-actor',
          maxRunsPerDay: 2,
          fetchImpl: scriptedFetch(responses, seen),
        }),
      },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.acquisition.mode).toBe('degraded');
    if (outcome.value.acquisition.mode === 'degraded') {
      expect(outcome.value.acquisition.reason).toBe('provider-failure');
      expect(outcome.value.acquisition.failure.code).toBe('unauthorized');
    }
    // The product stayed healthy (fixture ingestion + a run record).
    expect(outcome.value.ingestedCandidateIds.length).toBe(1);
    expect(outcome.value.runId).toMatch(/^discrun:[0-9a-f]{16}$/);

    // The next run (within quota) recovers the acquisition leg.
    const recovered = await runProductionEcosystemDiscovery({
      now: '2026-10-06T12:00:00.000Z',
      service,
      principal: PRINCIPAL_SCHEDULER,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      fixtureAdapter: FIXTURE_ADAPTER,
      acquisition: {
        adapter: new ApifySourceAdapter({
          token: 'test-token',
          actorId: 'my-pinned-actor',
          maxRunsPerDay: 1,
          fetchImpl: scriptedFetch(responses.slice(1), seen),
        }),
      },
    });
    expect(recovered.ok && recovered.value.acquisition.mode).toBe('enabled');
  });

  it('fail-closed service gates: an authorization denial is a typed failure, never a degraded run', async () => {
    const service = buildService();
    seedGap(service);
    const outcome = await runProductionEcosystemDiscovery({
      now: '2026-10-06T09:00:00.000Z',
      service,
      principal: PRINCIPAL_SCHEDULER,
      authorization: DENY,
      tenantId: TENANT_ALPHA,
      fixtureAdapter: FIXTURE_ADAPTER,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('authorization-rejected');
  });
});

describe('the acquisition environment mapping', () => {
  it('parses the EPOCH_APIFY_* contract with safe defaults', () => {
    expect(acquisitionConfigFromEnv({})).toEqual({
      token: '',
      actorId: '',
      maxRunsPerDay: 1,
    });
    const configured = acquisitionConfigFromEnv({
      EPOCH_APIFY_TOKEN: 'secret-token',
      EPOCH_APIFY_ACTOR_ID: 'pinned~actor',
      EPOCH_APIFY_MAX_RUNS_PER_DAY: '3',
    });
    expect(configured).toEqual({ token: 'secret-token', actorId: 'pinned~actor', maxRunsPerDay: 3 });
    expect(acquisitionConfigured(configured)).toBe(true);
    // Invalid cap values fail safe to the default (least-cost posture).
    expect(
      acquisitionConfigFromEnv({
        EPOCH_APIFY_TOKEN: 'secret-token',
        EPOCH_APIFY_ACTOR_ID: 'pinned~actor',
        EPOCH_APIFY_MAX_RUNS_PER_DAY: 'not-a-number',
      }).maxRunsPerDay,
    ).toBe(1);
    expect(
      acquisitionConfigured(acquisitionConfigFromEnv({ EPOCH_APIFY_TOKEN: 'only-token' })),
    ).toBe(false);
  });
});
