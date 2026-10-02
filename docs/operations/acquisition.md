# Acquisition Operations Guide (W054, ACR-006)

The operator-facing guide to EXTERNAL ACQUISITION — the ACR-004
ecosystem-discovery capability running in production through the
**Apify** acquisition adapter behind the frozen W045
`DiscoverySourceAdapter` seam. Companion documents:
`spec/production-environment.md` (the environment contract),
`spec/free-tier-infrastructure.md` (the cost-control contract),
`ops/src/runbooks/acquisition.ts` (the typed runbook records),
`adapters/apify/README.md` (the adapter contract).

> Provider note (why this document names Apify when `deploy/`+`ops/`
> records do not): the deploy/ops TREES are provider-neutral by
> construction (see the
> [provider-neutrality contract](./provider-neutrality-contract.md));
> Apify is an infrastructure **adapter** behind the frozen seam, exactly
> like Neon/R2/Upstash behind theirs (ACR-006 authority boundaries).
> The typed runbook records describe this capability in neutral
> vocabulary; this operations guide is where the concrete provider,
> variables and free-tier math live.

## What the acquisition adapter does

`adapters/apify` (`@epoch/adapter-apify`) implements the FROZEN
`DiscoverySourceAdapter` contract:

1. **Fetch-ahead refresh** — an EXPLICIT, caller-invoked
   `adapter.refresh(now)` (caller-supplied instant; zero wall-clock,
   zero timers in the adapter) runs the PINNED actor
   (`EPOCH_APIFY_ACTOR_ID`) over the Apify REST API:
   `POST https://api.apify.com/v2/acts/{actorId}/run-sync-get-dataset-items?token={token}&timeout=30`.
2. **Dataset mapping** — dataset items are mapped to provider-neutral
   `SourceArtifact` records (candidate observations: claims only) through
   a strict whitelist (`summary`, `claimedCapabilities`, `licenseNote`,
   `environmentNotes`); digests are computed by the adapter (never
   trusted from the payload); malformed items are dropped and counted.
3. **Synchronous scan** — `scan(query)` filters the cached dataset with
   the `StaticCatalogSourceAdapter` reference semantics. The frozen
   contract's `scan()` is synchronous; that is why acquisition is
   fetch-ahead, never on-demand.

**Untrusted-input discipline (the authority boundary):** acquisition
artifacts are CANDIDATE OBSERVATIONS ONLY. They flow into the existing
discovery ingestion path (`ingestExternalCandidate`), which forces
state `discovered`, trust domain `external`, `sandboxRequired: true`
and claim basis `declared`. Consequential use requires the full
promotion gate (sandbox report → measured evaluation evidence → human
policy approval). There is structurally no path from Apify output to
authoritative registry/semantic state — pinned by the negative battery
(`adapters/apify/test/untrusted-input.test.ts`).

## Actor pinning

The acquisition source is ONE pinned actor, selected by the operator
and recorded in the environment (`EPOCH_APIFY_ACTOR_ID`). The pin is
deliberate: it makes the acquisition source reviewable (one actor, one
dataset contract, one cost profile) and prevents the adapter from
becoming a general scraping system (W054 non-goal). The pinned actor's
dataset items are expected to carry the neutral capability-observation
shape documented in `adapters/apify/README.md` (the whitelisted item
contract). Changing the actor is an operator action that changes the
acquisition source — record it with the next run's provenance.

## The quota guard (cost guardrail)

`EPOCH_APIFY_MAX_RUNS_PER_DAY` (default **1**) is enforced by a
deterministic epoch-day counter (`dayIndex = floor(nowEpochMs /
86_400_000)` — the same fixed-window math as the W051 gateway guards):

- refreshes happen ONLY inside the scheduled production trigger — never
  per client request;
- a refresh ATTEMPT consumes quota even when the provider fails (the
  conservative cost posture: a timed-out run may still have consumed
  provider compute, and no retry can exceed the daily cap);
- the counter resets deterministically at the next UTC day boundary;
- the counter is **in-memory, per adapter instance, by design**. It is
  a COST GUARD, not a security boundary — a serverless cold start
  begins a fresh counter. This is sound because (a) refreshes only run
  in the scheduled path and (b) even a worst case of one run per
  scheduled invocation per cold start stays inside the free credit
  (math below). Long-lived processes should hold ONE adapter instance
  (the trigger accepts a pre-built adapter so every invocation shares
  the cap).

### Free-tier math (tied to spec/free-tier-infrastructure.md)

Apify Free = **$5 platform credit/month** ($0.20/compute unit ⇒ 25 CU),
no payment method on file — paid runs simply stop when credit is
exhausted (no spend possible).

| Posture | Runs/month | Credit consumption (conservative 1 CU/run) |
| --- | --- | --- |
| Expected (weekly schedule at the default cap) | ~4–5 | ~$1.00 of $5 — a small fraction |
| Worst case (a run every scheduled trigger, cap 1/day) | ≤ 30 | ~30 CU — may exhaust the 25 CU credit before month end |

The default posture keeps scheduled acquisition at a small fraction of
the credit. Even the worst case cannot SPEND anything: with no payment
method on file, runs stop at the credit boundary (degrade, not bill).
The quota guard exists so Epoch never even reaches that boundary
through scheduled execution. Raising the cap is an explicit, recorded
operator cost decision (runbook `rb:acquisition-quota-exhaustion`).

## Provenance

Every successful refresh returns and records an
`ApifyAcquisitionProvenance`:

| Field | Meaning |
| --- | --- |
| `adapterId` / `sourceKind` | `apify-acquisition` / `public-catalog` (the frozen vocabulary's class for externally-acquired public capability claims) |
| `actorId` | the pinned actor |
| `acquisitionRunId` | content-addressed `apifyrun:<16hex>` over (actorId, fetchedAt, rawResultDigest) |
| `providerRunId` | the provider's run id when the response carries it (header-derived; never fabricated) |
| `fetchedAt` | the caller-supplied instant |
| `rawResultDigest` | SHA-256 over the canonical raw dataset payload |
| `itemCount` / `mappedArtifactCount` / `droppedItemCount` | the mapping outcome |

The production trigger's outcome carries this record, and the stored
ingested candidates carry the kernel's provenance
(`external.adapterId` + `artifactId` + content digest) — the run
history is provenance-carrying end to end.

## The production trigger

`services/capability-discovery` (production wiring ONLY — the frozen
scheduler contract is untouched) exports
`runProductionEcosystemDiscovery(input)`:

- invokes the FROZEN service contract
  (`CapabilityDiscoveryService.runEcosystemScan`) with trigger
  **`scheduled`**, the caller-supplied instant and the invoking
  schedule/entrypoint id (`invokedBy`);
- composes the Apify adapter (refreshed within the quota) WITH the
  fixture reference adapter; when the acquisition leg is
  disabled/degraded, the scan runs on the fixture source alone —
  **degrade the run, never the product**;
- returns the typed outcome: acquisition state
  (`enabled` / `degraded` + typed failure / `disabled`), the
  content-addressed run id, ingested candidate ids and updated gap ids;
- performs NO environment reads: the deployment binding seam parses
  `EPOCH_APIFY_TOKEN` / `EPOCH_APIFY_ACTOR_ID` /
  `EPOCH_APIFY_MAX_RUNS_PER_DAY` (the W051 production environment
  contract) and hands the result to the trigger
  (`acquisitionConfigFromEnv` maps the record).

There is NO cron/timer in the product: the authorized scheduler (a
platform job, a gateway operation or a documented ops entrypoint)
calls the trigger at an instant IT supplies.

## Degradation states + recovery

| State | Detection | Recovery |
| --- | --- | --- |
| **Source unconfigured** (token/actor absent) | readiness reports acquisition `disabled`; runs record `mode: disabled` | operator provisions the credential (below); the next run records provenance |
| **Provider failure** (401/402/404/429/timeout/malformed/network) | runs record `mode: degraded` with the typed failure code | no partial state exists (the failed refresh replaces nothing); the next run within quota recovers — verified by test |
| **Quota exhausted** (per-day cap) | runs record `mode: degraded`, `quota-exceeded`; no provider call issued | wait for the UTC epoch-day reset (default) or raise the cap as a recorded cost decision |

Typed runbook records: `ops/src/runbooks/acquisition.ts`
(`rb:acquisition-source-unconfigured`,
`rb:acquisition-provider-degradation`,
`rb:acquisition-quota-exhaustion`) — sealed with the same validators
as the reference catalog. **Wiring note:** `ops/src/index.ts` is
outside W054's owned surface, so these records are not yet re-exported
from `@epoch/ops-kit` nor covered by the deploy-tree evidence suite —
a serialized Tech Lead change wires them (recorded in the W054 PR).

## The operator credential boundary

- `EPOCH_APIFY_TOKEN` and `EPOCH_APIFY_ACTOR_ID` are SECRETS/config —
  never in Git (`.env.example` carries placeholders only; the 7-gate
  token audit applies to every PR).
- Production placement: the **Vercel project environment variables**
  (encrypted, server-side only) — the same mechanism as the other
  provider credentials (spec/production-environment.md secret-handling
  rules). No API key ever reaches the browser bundle; the adapter and
  trigger execute server-side only.
- Local operator environment: a local `.env` outside the repository.

## How to run a live acquisition (when a token exists)

**Status: NOT-VERIFIED-live at W054 merge time — no Apify token exists
in the working sandbox. The exact operator input needed: (1) an Apify
account + API token, (2) a pinned actor id whose dataset items carry
the neutral capability-observation contract.**

Once provided, the committed env-gated live verification runs ONE real
acquisition through the adapter (secrets stay in the local
environment; nothing enters Git):

```bash
EPOCH_APIFY_LIVE_ACQUISITION=1 \
EPOCH_APIFY_TOKEN=<apify token> \
EPOCH_APIFY_ACTOR_ID=<pinned actor id> \
pnpm --filter @epoch/adapter-apify exec vitest run test/live-acquisition.test.ts
```

The evidence it produces: the printed `ApifyAcquisitionProvenance`
JSON — adapter id, pinned actor id, content-addressed
`acquisitionRunId`, the provider run id (when returned), the
fetched-at instant, the raw-result digest and the item/mapped/dropped
counts — plus a green scan round trip over the live dataset. Record
that provenance (redacting nothing — it is secret-free by
construction) as the live-verification evidence in the work order
closure. To drive a full scheduled run against a real deployment, set
the same variables (minus the live gate) in the deployment platform's
environment and invoke the production trigger through the deployment's
authorized scheduler path.
