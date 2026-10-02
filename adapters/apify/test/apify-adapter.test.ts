/**
 * W054 (ACR-006) — the Apify acquisition adapter tests (typed fetch
 * doubles; the live-provider run is the env-gated
 * live-acquisition.test.ts — NOT-VERIFIED-live in this sandbox: no
 * token exists, operator input required).
 */
import { describe, expect, it } from 'vitest';
import {
  ApifyDailyRunQuota,
  ApifySourceAdapter,
  APIFY_API_BASE_URL,
  DEFAULT_APIFY_MAX_RUNS_PER_DAY,
} from '../src/index';
import type { ApifyAcquisitionError, ApifyResult } from '../src/index';

/** One valid dataset item (the pinned actor contract). */
function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    summary: 'Claims structural stress analysis capability',
    claimedCapabilities: [
      {
        operation: { id: 'engineering.stress-analysis', versionConstraint: '*' },
        inputKinds: ['geometry'],
        outputKinds: ['numeric'],
        claimBasis: 'declared',
      },
    ],
    environmentNotes: [],
    ...overrides,
  };
}

/** A scripted fetch double: queues responses per call and records requests. */
function scriptedFetch(
  responses: Array<{ readonly status: number; readonly body: unknown; readonly headers?: Record<string, string> }>,
  seen: Array<{ readonly url: string; readonly init: RequestInit }> = [],
): typeof fetch {
  let call = 0;
  return (async (url: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(url), init: init ?? ({} as RequestInit) });
    const response = responses[Math.min(call, responses.length - 1)]!;
    call += 1;
    const body =
      typeof response.body === 'string' ? response.body : JSON.stringify(response.body ?? null);
    return new Response(body, {
      status: response.status,
      headers: { 'content-type': 'application/json', ...(response.headers ?? {}) },
    });
  }) as typeof fetch;
}

const NOW = '2026-10-05T09:00:00.000Z';
const NOW_EPOCH_MS = Date.parse(NOW);
const NEXT_DAY = '2026-10-06T09:00:00.000Z';
const OPTIONS = {
  token: 'test-token',
  actorId: 'my-pinned-actor',
  fetchImpl: undefined as typeof fetch | undefined,
};

/** Assert a typed failure value (test helper). */
function expectFailure(
  result: ApifyResult<unknown>,
  code: string,
): ApifyAcquisitionError {
  if (result.ok) throw new Error(`expected a typed "${code}" failure, got a success`);
  if (result.error.code !== code) {
    throw new Error(`expected "${code}", got "${result.error.code}": ${result.error.message}`);
  }
  return result.error;
}

describe('the fetch-ahead refresh + synchronous scan round trip', () => {
  it('runs the pinned actor at the pinned URL and maps items to artifacts', async () => {
    const seen: Array<{ readonly url: string; readonly init: RequestInit }> = [];
    const adapter = new ApifySourceAdapter({
      ...OPTIONS,
      fetchImpl: scriptedFetch([{ status: 200, body: [item()] }], seen),
    });
    const refreshed = await adapter.refresh(NOW);
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;

    // The pinned REST call: POST run-sync-get-dataset-items with the token.
    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toBe(
      `${APIFY_API_BASE_URL}/acts/my-pinned-actor/run-sync-get-dataset-items?token=test-token&timeout=30`,
    );
    expect(seen[0]!.init.method).toBe('POST');

    const artifacts = refreshed.value.artifacts;
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]!.summary).toBe('Claims structural stress analysis capability');
    expect(artifacts[0]!.claimedCapabilities[0]!.operation.id).toBe('engineering.stress-analysis');
    // The artifact id is derived from the raw-item digest (never caller-supplied).
    expect(artifacts[0]!.artifactId).toMatch(/^apify-[0-9a-f]{16}$/);
    expect(artifacts[0]!.contentDigest).toMatch(/^[0-9a-f]{64}$/);

    // The synchronous scan matches the cached artifact (reference semantics).
    const scan = adapter.scan({
      operations: [{ id: 'engineering.stress-analysis', versionConstraint: '*' }],
      limit: 10,
    });
    expect(scan.adapterId).toBe('apify-acquisition');
    expect(scan.artifacts).toHaveLength(1);
    // A different operation does not match.
    const miss = adapter.scan({
      operations: [{ id: 'software.security-audit', versionConstraint: '*' }],
      limit: 10,
    });
    expect(miss.artifacts).toHaveLength(0);
  });

  it('respects the query limit and is deterministic', async () => {
    const adapter = new ApifySourceAdapter({
      ...OPTIONS,
      fetchImpl: scriptedFetch([{ status: 200, body: [item(), item({ summary: 'Second artifact' })] }]),
    });
    await adapter.refresh(NOW);
    const query = {
      operations: [{ id: 'engineering.stress-analysis', versionConstraint: '*' }],
      limit: 1,
    };
    const first = adapter.scan(query);
    const second = adapter.scan(query);
    expect(first.artifacts).toHaveLength(1);
    expect(second.artifacts).toEqual(first.artifacts);
  });

  it('carries FULL provenance: adapter identity, run id, fetched-at, raw digest', async () => {
    const adapter = new ApifySourceAdapter({
      ...OPTIONS,
      fetchImpl: scriptedFetch([
        { status: 200, body: [item()], headers: { 'apify-run-id': 'providerRun123' } },
      ]),
    });
    const refreshed = await adapter.refresh(NOW);
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    const provenance = refreshed.value.provenance;
    expect(provenance.adapterId).toBe('apify-acquisition');
    expect(provenance.sourceKind).toBe('public-catalog');
    expect(provenance.actorId).toBe('my-pinned-actor');
    expect(provenance.acquisitionRunId).toMatch(/^apifyrun:[0-9a-f]{16}$/);
    expect(provenance.providerRunId).toBe('providerRun123');
    expect(provenance.fetchedAt).toBe(NOW);
    expect(provenance.rawResultDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(provenance.itemCount).toBe(1);
    expect(provenance.mappedArtifactCount).toBe(1);
    expect(provenance.droppedItemCount).toBe(0);
    // The last-refresh provenance is exposed for run-history recording.
    expect(adapter.lastRefreshProvenance()).toEqual(provenance);
    // Deterministic: identical actor/fetchedAt/rawDigest -> identical run id.
    const again = new ApifySourceAdapter({
      ...OPTIONS,
      fetchImpl: scriptedFetch([{ status: 200, body: [item()] }]),
    });
    const second = await again.refresh(NOW);
    expect(second.ok && second.value.provenance.acquisitionRunId).toBe(provenance.acquisitionRunId);
  });

  it('drops malformed items at the mapping boundary and never fails the run', async () => {
    const adapter = new ApifySourceAdapter({
      ...OPTIONS,
      fetchImpl: scriptedFetch([
        {
          status: 200,
          body: [
            item(),
            'a string is not an item',
            { summary: '', claimedCapabilities: [] }, // empty summary -> invalid
            { summary: 'no claims array' }, // missing claims -> invalid
            {
              summary: 'bad operation id',
              claimedCapabilities: [
                {
                  operation: { id: 'not-qualified', versionConstraint: '*' },
                  inputKinds: ['text'],
                  outputKinds: ['text'],
                  claimBasis: 'declared',
                },
              ],
            },
          ],
        },
      ]),
    });
    const refreshed = await adapter.refresh(NOW);
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    expect(refreshed.value.provenance.itemCount).toBe(5);
    expect(refreshed.value.provenance.mappedArtifactCount).toBe(1);
    expect(refreshed.value.provenance.droppedItemCount).toBe(4);
    expect(refreshed.value.artifacts).toHaveLength(1);
  });
});

describe('typed failure semantics (never raw provider errors, never crashes)', () => {
  const cases: ReadonlyArray<readonly [number | 'timeout' | 'network' | 'not-json' | 'not-array', string]> = [
    [401, 'unauthorized'],
    [402, 'payment-required'],
    [404, 'not-found'],
    [429, 'rate-limited'],
    [500, 'unavailable'],
    ['timeout', 'timeout'],
    ['network', 'unavailable'],
    ['not-json', 'malformed-response'],
    ['not-array', 'malformed-response'],
  ];
  for (const [mode, code] of cases) {
    it(`maps ${String(mode)} to the typed ${code} failure`, async () => {
      const fetchImpl = (() => {
        if (mode === 'timeout') {
          return (async () => {
            throw Object.assign(new Error('aborted'), { name: 'AbortError' });
          }) as typeof fetch;
        }
        if (mode === 'network') {
          return (async () => {
            throw new Error('connection refused');
          }) as typeof fetch;
        }
        if (mode === 'not-json') {
          return (async () => new Response('<html>not json</html>', { status: 200 })) as typeof fetch;
        }
        if (mode === 'not-array') {
          return (async () =>
            new Response(JSON.stringify({ items: [] }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })) as typeof fetch;
        }
        return scriptedFetch([{ status: mode as number, body: { error: 'provider says boom' } }]);
      })();
      const adapter = new ApifySourceAdapter({ ...OPTIONS, fetchImpl });
      const failed = await adapter.refresh(NOW);
      expectFailure(failed, code);
      // The failure degrades THIS RUN, not the product: the adapter still
      // scans (empty), never throws, and no partial cache exists.
      expect(adapter.scan({ operations: [], limit: 5 }).artifacts).toEqual([]);
      expect(adapter.lastRefreshProvenance()).toBe(null);
    });
  }

  it('a failed refresh leaves the previous cache untouched (no partial mutation) and the next run recovers', async () => {
    const responses: Array<{ readonly status: number; readonly body: unknown }> = [
      { status: 200, body: [item()] },
      { status: 500, body: { error: 'boom' } },
      { status: 200, body: [item({ summary: 'Recovered artifact' })] },
    ];
    const adapter = new ApifySourceAdapter({
      ...OPTIONS,
      maxRunsPerDay: 3,
      fetchImpl: scriptedFetch(responses),
    });
    const first = await adapter.refresh(NOW);
    expect(first.ok).toBe(true);
    const failed = await adapter.refresh('2026-10-05T10:00:00.000Z');
    expectFailure(failed, 'unavailable');
    // The good cache survives the failed refresh.
    const cached = adapter.scan({
      operations: [{ id: 'engineering.stress-analysis', versionConstraint: '*' }],
      limit: 10,
    });
    expect(cached.artifacts).toHaveLength(1);
    // The next run (within quota) recovers.
    const recovered = await adapter.refresh('2026-10-05T11:00:00.000Z');
    expect(recovered.ok).toBe(true);
  });
});

describe('the per-day quota guard (deterministic, in-memory by design)', () => {
  it('defaults to 1 run per day (the free-tier posture)', () => {
    expect(DEFAULT_APIFY_MAX_RUNS_PER_DAY).toBe(1);
    const quota = new ApifyDailyRunQuota(DEFAULT_APIFY_MAX_RUNS_PER_DAY);
    expect(quota.status(NOW_EPOCH_MS).maxRunsPerDay).toBe(1);
  });

  it('refuses runs beyond the cap within one epoch-day and resets across days', async () => {
    const seen: Array<{ readonly url: string; readonly init: RequestInit }> = [];
    const adapter = new ApifySourceAdapter({
      ...OPTIONS,
      maxRunsPerDay: 1,
      fetchImpl: scriptedFetch([{ status: 200, body: [item()] }], seen),
    });
    const first = await adapter.refresh(NOW);
    expect(first.ok).toBe(true);

    // Same epoch-day: the second refresh is refused BEFORE any request.
    const sameDay = await adapter.refresh('2026-10-05T23:59:59.999Z');
    expectFailure(sameDay, 'quota-exceeded');
    expect(seen).toHaveLength(1); // no provider call was issued

    // The quota view reports the deterministic window + reset instant.
    const status = adapter.quotaStatus(Date.parse('2026-10-05T23:59:59.999Z'));
    expect(status.runsUsed).toBe(1);
    expect(status.runsRemaining).toBe(0);
    expect(status.resetsAtEpochMs).toBe(Date.parse('2026-10-06T00:00:00.000Z'));

    // The next epoch-day resets the counter (deterministic day window).
    const nextDay = await adapter.refresh(NEXT_DAY);
    expect(nextDay.ok).toBe(true);
    expect(seen).toHaveLength(2);
  });

  it('a failed provider attempt still consumes quota (the conservative cost posture)', async () => {
    const adapter = new ApifySourceAdapter({
      ...OPTIONS,
      maxRunsPerDay: 1,
      fetchImpl: scriptedFetch([{ status: 401, body: { error: 'bad token' } }]),
    });
    const failed = await adapter.refresh(NOW);
    expectFailure(failed, 'unauthorized');
    // The 401 attempt consumed the day's single run slot: no retry storm.
    const retry = await adapter.refresh('2026-10-05T12:00:00.000Z');
    expectFailure(retry, 'quota-exceeded');
  });

  it('the standalone counter is pure across the window math', () => {
    const quota = new ApifyDailyRunQuota(2);
    const before = quota.status(Date.parse('2026-10-05T00:00:00.000Z'));
    expect(before.runsUsed).toBe(0);
    expect(quota.consume(Date.parse('2026-10-05T00:00:00.000Z')).ok).toBe(true);
    expect(quota.consume(Date.parse('2026-10-05T23:59:59.999Z')).ok).toBe(true);
    expectFailure(quota.consume(Date.parse('2026-10-05T23:59:59.999Z')), 'quota-exceeded');
    // New day: fresh window.
    expect(quota.consume(Date.parse('2026-10-06T00:00:00.000Z')).ok).toBe(true);
  });

  it('rejects invalid construction input (fail-fast configuration)', () => {
    expect(() => new ApifyDailyRunQuota(0)).toThrow(/maxRunsPerDay/);
    expect(() => new ApifySourceAdapter({ ...OPTIONS, token: '' })).toThrow(/token/);
    expect(() => new ApifySourceAdapter({ ...OPTIONS, actorId: '' })).toThrow(/actorId/);
  });
});
