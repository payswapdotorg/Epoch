# Epoch Free-Tier Infrastructure & Cost-Control Contract (ACR-006)

Verified against the providers' official documentation on **2026-10-02** (the Tech Lead re-verifies at each program gate; drift is a P2 defect against this document). Sources are the official pricing/plans pages cited per provider.

## Provider allocations (verified 2026-10-02)

### Vercel — Hobby plan (deployment host)
Source: https://vercel.com/docs/plans/hobby (+ https://vercel.com/docs/limits)

| Resource | Free allocation |
|---|---|
| Fast Data Transfer | first 100 GB / month |
| Fast Origin Transfer | first 10 GB / month |
| CDN Requests | first 1,000,000 / month |
| Function Invocations | first 1,000,000 / month |
| Active CPU | 4 CPU-hours / month |
| Provisioned Memory | 360 GB-hours / month |

Behavior at limit: the affected feature **pauses** until the 30-day window resets — Hobby cannot silently spend. Terms note: Hobby is aimed at personal/non-commercial projects; the deployment owner (operator) must confirm the deployment's use of Hobby complies with Vercel's current terms — if the deployment is deemed commercial, a Pro upgrade is an explicit operator decision (not taken by this program).

Expected Epoch consumption: demo product, low traffic — far under every allowance. Conservation: static assets are framework-cached; API routes are `force-dynamic` with small payloads; no image optimization in the critical path.

### Neon — Free plan (PostgreSQL)
Source: https://neon.com/docs/introduction/plans (+ https://neon.com/pricing)

| Resource | Free allocation |
|---|---|
| Projects | 100 (account) |
| Compute | 100 CU-hours / project / month |
| Storage | 1 GB / project (20 GB account total) |
| Egress | 5 GB / project / month |
| Scale to zero | after 5 min idle (cold starts expected) |
| History window | 6 hours |
| Snapshots | 1 manual snapshot |
| Spending notifications | not available on Free |

Behavior at limit: allowances are **hard caps** (suspension until reset, not billing). Expected Epoch consumption: 1 project, 2 tenants, small records (sessions/actions/idempotency/correlation) — kilobytes of storage, minutes of compute.

### Cloudflare R2 — free tier (object/evidence bytes)
Source: https://developers.cloudflare.com/r2/pricing/

| Resource | Free allocation (per month) |
|---|---|
| Storage | 10 GB-month |
| Class A operations (writes/lists) | 1,000,000 |
| Class B operations (reads/heads) | 10,000,000 |
| Egress to internet | FREE |

Behavior at limit: operations beyond the free tier bill against the account's payment method — the **card-on-file caveat**: enabling R2 may require a payment method per Cloudflare's current account requirements (verified at provisioning time by W053; recorded here as a known caveat). Conservation: content-addressed puts are idempotent (re-putting identical bytes is a no-op); listings are prefix-scoped; no per-request listing in hot paths.

Expected Epoch consumption: fixture/demo evidence bytes are KB-scale; production uploads are size-capped by the gateway.

### Upstash — Redis Free (ephemeral/rate limiting)
Source: https://upstash.com/pricing/redis

| Resource | Free allocation |
|---|---|
| Databases | 1 (max) |
| Data size | 256 MB |
| Commands | 500,000 / month |
| Bandwidth | 10 GB / month |
| Max commands/sec | 10,000 |

Behavior at limit: hard allowance caps (throttle/reject, not billing). Expected Epoch consumption: 2 commands per rate-limit check (INCR + EXPIRE) — thousands/month at demo traffic. Keys are epoch-anchored windows with TTL cleanup — no unbounded key growth.

### Apify — Free plan (external acquisition)
Source: https://apify.com/pricing

| Resource | Free allocation |
|---|---|
| Platform credit | $5 / month ($0.20 per compute unit) |
| Payment method | none required |

Behavior at limit: with no payment method, paid runs simply stop when the credit is exhausted — no spend possible. Conservation: `EPOCH_APIFY_MAX_RUNS_PER_DAY` (default 1) hard-caps scheduled acquisition to ≤ ~30 runs/month, a small fraction of the $5 credit, and only `run-sync` small jobs.

## Cost-control rules

1. **No paid resource** may be introduced without explicit repository-level authorization (a new ACR or a recorded Tech Lead decision appended to this document).
2. Providers are chosen so that exceeding free allowances **degrades** (pause/suspension/throttle/stop) instead of silently spending. The one exception is documented: R2 operations beyond free allowances bill against the account — mitigated by the demo-scale consumption model above and monitored via the runbook.
3. The application must **fail safely rather than generate paid usage**: no auto-scaling to paid tiers, no retry storms (bounded retries with backoff), no unbounded queues, no scheduled work beyond quota guards.
4. Quota guards are enforced in code (Apify per-day cap), not by operator vigilance.
5. Every work order in this program reports expected consumption against these tables in its evidence.

## Degradation order (what gives first under load)

1. External acquisition stops (quota guard / credit exhausted) — optional capability, product otherwise healthy.
2. Rate limiting falls back to per-instance in-memory (if Upstash allowance is hit) — abuse control weakens, surfaced in readiness.
3. Neon compute suspends after idle (scale-to-zero) — first request after idle pays cold-start latency; no data loss.
4. Vercel feature pauses at 100% allowance (e.g., function invocations) — the public site pauses until the window resets; no spend.
5. PostgreSQL/R2 remain within allowances at demo scale; if exceeded, the incident runbook (docs/operations/infrastructure.md) governs (suspend new writes before considering any paid action — the operator decision).

## Review cadence

W055 re-verifies every row of this document against the live provider pages at closure and records drift. Any provider limit change that threatens a guardrail is a P2 defect against this contract.
