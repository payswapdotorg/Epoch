# W054 — External Acquisition + Apify + Production Operations

Status: BLOCKED (until W051 merges)
Wave: ACR-006 / concurrent wave 1 (external acquisition + operations)
Depends On: W051
Worker Count: 1

## Objective
Make the ACR-004 ecosystem/external discovery capability usable in production: integrate Apify (or another justified free-tier acquisition provider) through the W045 `DiscoverySourceAdapter` boundary, configure scheduler/execution safely with quota awareness, preserve provenance, prevent external claims from mutating authoritative state, and add the production operational runbooks (logging/alerts where required). Verify recovery after provider failure and that scheduled execution cannot create uncontrolled cost.

Do not broaden this into a general web scraping system. Use the existing capability-discovery architecture.

## Owned write surfaces
- adapters/apify/* (the Apify acquisition adapter: manifest, implementation, tests, README)
- services/capability-discovery/src/* (production scheduler trigger + quota guard ONLY — the frozen scheduler CONTRACT and the discovery semantics stay untouched)
- ops/src/runbooks/* (production runbook entries: acquisition, degradation, recovery)
- docs/operations/acquisition.md (the acquisition operations guide)

## Required
1. **Apify adapter** (adapters/apify): implements the frozen `DiscoverySourceAdapter` contract (`scan(gap/query)` → candidate observations) over the Apify REST API: run an actor (e.g. a website-content or search actor chosen and pinned by actor id), collect results, and map them to provider-neutral candidate discovery records with FULL provenance (adapter id, source kind, run id, fetched-at, raw-result digest). Token via the W051 environment contract (EPOCH_APIFY_TOKEN); zero new dependencies; typed failure semantics (unauthorized/rate-limited/not-found/timeout => typed degraded results, never raw provider errors, never crashes).
2. **Quota guard**: EPOCH_APIFY_MAX_RUNS_PER_DAY hard cap (default 1) enforced by a deterministic day-window counter (in-memory reference; the counter may accelerate via the RequestGuard port when bound) — scheduled execution can never exceed the cap, and the cap defaults to a value safely inside the free $5/month credit.
3. **Untrusted-input discipline**: adapter outputs are candidate observations ONLY — they flow into the existing discovery ingestion path (sandbox/profile → capability mapping → evaluation → registry proposal) and NEVER directly mutate authoritative semantic state; provenance/evidence records are created through the existing evidence contract; this is verified by a negative test (a malicious/fabricated adapter payload cannot produce an approved registry/semantic change without the normal evaluation path).
4. **Scheduler execution safety**: a production run trigger (an authorized caller-supplied invocation path — e.g. a gateway operation or a documented ops entrypoint — invoking `runEcosystemDiscovery` with trigger `scheduled` per the frozen contract; the adapter is NOT the scheduler). No cron library, no timers, no wall-clock inside kernels. The trigger records run history as discovery records (existing contract) and respects the quota guard.
5. **Graceful degradation**: with EPOCH_APIFY_TOKEN absent, discovery capability degrades gracefully (the fixture reference adapter remains; the product surfaces degraded external-discovery state); Apify failures (401/429/timeout/malformed) degrade the run, not the product; recovery after provider failure is verified by test (a failed run leaves no partial authoritative mutation and the next run works).
6. **Operational runbooks** (ops/src/runbooks/* + docs/operations/acquisition.md): acquisition monitoring (run history, quota usage, credit conservation), degradation states, recovery procedures, cost-guardrail documentation tied to spec/free-tier-infrastructure.md.
7. **Live verification (honest boundary)**: when an Apify token is available, run one real acquisition run through the adapter and record the provenance evidence; without a token, verify against a typed test double and record NOT-VERIFIED-live status honestly.

## Acceptance
1. The adapter implements the frozen DiscoverySourceAdapter contract with green tests (unit + negative: unauthorized, rate-limited, timeout, malformed response, provider down).
2. Quota guard enforced (deterministic tests; the cap cannot be exceeded by repeated triggers).
3. Provenance preserved on every observation; the untrusted-input negative test proves no direct semantic mutation path exists.
4. Scheduler trigger follows the frozen contract (trigger `scheduled`, caller-supplied instants, run history recorded).
5. Degradation/recovery verified: token absent → graceful degradation surfaced; provider failure → typed failure, no partial mutation, next run recovers.
6. Runbooks + acquisition ops documentation complete (placeholders only, no secrets).
7. No kernel semantic changes; no root manifest/lockfile changes; zero new dependencies; standard battery green on the PR.

## Non-goals
No general scraping system; no new discovery semantics; no direct registry mutation from external data; no cron infrastructure; no paid actor usage; no provider credentials in Git.
