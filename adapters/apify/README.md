# @epoch/adapter-apify — the Apify acquisition adapter (W054, ACR-006)

The EXTERNAL-SOURCE implementation of the frozen W045
`DiscoverySourceAdapter` contract (`@epoch/capability-discovery`) over the
Apify REST API. Apify is an infrastructure **adapter** behind the frozen
seam — never a kernel dependency, never a semantic authority
(architecture-lock rule 13; ACR-006 authority boundaries). Its output is
**untrusted adapter input with provenance**.

## What it does

1. **Fetch-ahead refresh (explicit, never scheduled here)** —
   `refresh(now)` (caller-supplied instant, zero wall-clock) runs the
   PINNED actor (`EPOCH_APIFY_ACTOR_ID`) through
   `POST {apiBaseUrl}/acts/{actorId}/run-sync-get-dataset-items?token=…&timeout=30`
   and maps the dataset items to provider-neutral `SourceArtifact`
   records (candidate observations only).
2. **Synchronous scan (the frozen contract)** — `scan(query)` filters the
   cached artifacts exactly like the `StaticCatalogSourceAdapter`
   reference: claim operation id equality + version-constraint match
   (`*` admits any), canonical order, capped by `query.limit`. `scan`
   never throws; an unrefreshed adapter scans empty.
3. **Full provenance** — every successful refresh returns an
   `ApifyAcquisitionProvenance` record: adapter id, source kind, pinned
   actor id, a content-addressed `acquisitionRunId`
   (`apifyrun:<16hex>` over `{actorId, fetchedAt, rawResultDigest}`),
   the provider run id when the response carries it (header-derived,
   never fabricated), the caller-supplied `fetchedAt` instant, the
   SHA-256 `rawResultDigest` over the canonical raw dataset payload,
   and the item/mapped/dropped counts. Per artifact, `contentDigest` is
   the SHA-256 of the RAW dataset item — computed by the adapter, never
   trusted from the payload.

## The pinned dataset-item contract

The pinned actor's dataset items are expected to carry a
**provider-neutral capability observation** (the whitelisted fields):

```jsonc
{
  "summary": "…non-empty description…",
  "claimedCapabilities": [
    {
      "operation": { "id": "engineering.stress-analysis", "versionConstraint": "*" },
      "inputKinds": ["geometry"], "outputKinds": ["numeric"],
      "quality": { "metric": "…", "threshold": 1, "unit": "…", "direction": "min" },
      "claimBasis": "declared"
    }
  ],
  "licenseNote": "…optional…",
  "environmentNotes": ["…optional slug strings…"]
}
```

Everything else in a raw item is **ignored at the mapping boundary**:
unknown fields (`evaluationState`, `security`, `policyApproval`, …)
cannot pass — the mapper reads only the whitelisted fields, derives the
artifact id from the item digest, and validates the mapped artifact with
the kernel's own frozen `SourceArtifactSchema`. Malformed items are
dropped and counted (`droppedItemCount`); they never fail the product.

## Quota guard (the cost guardrail)

`EPOCH_APIFY_MAX_RUNS_PER_DAY` (default **1**) is enforced by a
deterministic epoch-day counter — `dayIndex = floor(nowEpochMs /
86_400_000)` (the W051 fixed-window pattern). Facts:

- A refresh **attempt** consumes quota even when the provider fails
  (deliberately conservative: a timed-out request may still have
  consumed provider compute; no retry can ever exceed the daily cap).
- The counter **resets deterministically** at the next UTC epoch-day
  boundary.
- The counter is **in-memory, per instance, by design**. It is a COST
  GUARD, not a security boundary: a serverless cold start begins a fresh
  counter. The guard is sound because refreshes happen ONLY inside the
  scheduled production trigger
  (`services/capability-discovery/src/production.ts`), never per client
  request — and even a worst-case cold-start-per-scheduled-run stays far
  inside the free-tier credit math (≤ 30 runs/month ≈ a small fraction
  of the $5 monthly credit; see `spec/free-tier-infrastructure.md`).

## Typed failure semantics

`ApifyResult<T>` — errors are values, never exceptions, never raw
provider payloads:

| Code | When |
| --- | --- |
| `unauthorized` | HTTP 401 (bad token) |
| `payment-required` | HTTP 402 (platform credit exhausted) |
| `not-found` | HTTP 404 (unknown/unpinned actor) |
| `rate-limited` | HTTP 429 |
| `timeout` | the client abort fired (default 35 s ≥ the 30 s run-sync cap) |
| `malformed-response` | non-JSON or non-array dataset payload |
| `unavailable` | other non-2xx or network failure |
| `quota-exceeded` | the per-day cap is exhausted |
| `validation` | (reserved) invalid construction input |

A failed refresh **leaves the previous cache untouched** (no partial
mutation); the next refresh (same adapter instance, within quota)
recovers. Failures degrade the acquisition **run**, never the product.

## Untrusted-input discipline (why this can never mutate authority)

Artifacts are **candidate observations only**. They flow exclusively
into the kernel ingestion boundary (`ingestExternalCandidate`), which:

- forces evaluation state `discovered` and trust domain `external` with
  `sandboxRequired: true` (regardless of any payload content);
- forces claim basis `declared` (external claims are never `measured`);
- admits consequential use ONLY through the CC1.0 promotion gate
  (sandbox report → evaluation evidence → human policy approval), each
  step a typed rejection when evidence is missing.

The negative battery in `test/apify-adapter.test.ts` pins this end to
end: a fabricated/malicious dataset payload cannot produce an approved
registry/semantic change.

## Dependencies

ZERO new dependencies: the platform `fetch` (injectable for test
doubles) + the frozen kernel contract (`@epoch/capability-discovery`).
No timers besides the per-request abort deadline; no wall-clock; no
environment reads (configuration is caller-supplied; the production
environment contract mapping `EPOCH_APIFY_*` lives at the binding seam).

## Live verification status

**NOT-VERIFIED-live.** No Apify token exists in this sandbox (operator
input required — see `docs/operations/acquisition.md`). The adapter is
verified against typed fetch doubles; the committed env-gated live test
(`test/live-acquisition.test.ts`) executes the real provider the moment
a token + pinned actor id are supplied.
