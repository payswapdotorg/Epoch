/**
 * W054 (ACR-006) — the LIVE acquisition verification (env-gated).
 *
 * STATUS: NOT-VERIFIED-live at W054 merge time — no Apify token exists
 * in the working sandbox (operator input required:
 * EPOCH_APIFY_TOKEN + EPOCH_APIFY_ACTOR_ID + EPOCH_APIFY_LIVE_ACQUISITION=1).
 * This test is SKIPPED everywhere those variables are absent (CI never
 * runs it); the moment an operator supplies them it executes ONE real
 * acquisition run through the adapter against the pinned actor and
 * records the provenance evidence.
 *
 * Run (local operator environment — secrets never enter Git):
 *   EPOCH_APIFY_LIVE_ACQUISITION=1 \
 *   EPOCH_APIFY_TOKEN=<token> \
 *   EPOCH_APIFY_ACTOR_ID=<pinnedActorId> \
 *   pnpm --filter @epoch/adapter-apify exec vitest run test/live-acquisition.test.ts
 */
import { describe, expect, it } from 'vitest';
import { ApifySourceAdapter } from '../src/index';

const LIVE =
  process.env.EPOCH_APIFY_LIVE_ACQUISITION === '1' &&
  (process.env.EPOCH_APIFY_TOKEN ?? '') !== '' &&
  (process.env.EPOCH_APIFY_ACTOR_ID ?? '') !== '';

describe.skipIf(!LIVE)('live acquisition run (real provider; provenance evidence)', () => {
  it('runs the pinned actor once and records full provenance', async () => {
    const adapter = new ApifySourceAdapter({
      token: process.env.EPOCH_APIFY_TOKEN!,
      actorId: process.env.EPOCH_APIFY_ACTOR_ID!,
      maxRunsPerDay: 1,
    });
    // Wall-clock is caller-supplied: the live run stamps the operator's
    // actual instant (this is the ONE sanctioned wall-clock read — a test
    // entry point, never library code). `toISOString()` is exactly the
    // canonical Timestamp wire form.
    const now = new Date().toISOString();
    const refreshed = await adapter.refresh(now);
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) {
      throw new Error(`live acquisition failed: ${refreshed.error.code}: ${refreshed.error.message}`);
    }
    const { provenance, artifacts } = refreshed.value;
    // The recorded evidence (see docs/operations/acquisition.md):
    console.log(JSON.stringify({ provenance }, null, 2));
    expect(provenance.adapterId).toBe('apify-acquisition');
    expect(provenance.actorId).toBe(process.env.EPOCH_APIFY_ACTOR_ID!);
    expect(provenance.acquisitionRunId).toMatch(/^apifyrun:[0-9a-f]{16}$/);
    expect(provenance.fetchedAt).toBe(now);
    expect(provenance.rawResultDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(Array.isArray(artifacts)).toBe(true);
    // The scan round trip works over the live dataset.
    const scan = adapter.scan({ operations: [], limit: 1 });
    expect(scan.adapterId).toBe('apify-acquisition');
  });
});
