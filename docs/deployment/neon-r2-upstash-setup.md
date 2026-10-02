# Neon + R2 + Upstash — Production Provisioning Guide (W053, ACR-006)

The reproducible, operator-facing provisioning guide for the three
infrastructure providers behind the Epoch public deployment. **Every
value below is a placeholder** — real credentials NEVER enter the
repository (the ACR-006 secret rule); they live only in the deployment
platform's encrypted environment (Vercel project environment variables)
or the local operator environment.

- Contract: `spec/production-environment.md` (the typed environment
  model), `spec/free-tier-infrastructure.md` (the verified cost-control
  contract — the limits below are quoted from it, verified 2026-10-02).
- Adapter code: `adapters/s3-object-store` (R2), `adapters/upstash-redis`
  (Upstash), `services/application-gateway` (`connectPostgresPool` /
  `bindPgPool` — Neon; the ONLY pg binding point).
- Template: `apps/web/.env.example`.

Provider-neutrality: each provider is an infrastructure adapter behind a
frozen provider-neutral port. No provider is a semantic authority — Neon
holds durable records, R2 holds bytes, Upstash holds ephemeral counters
only.

---

## 1. Neon PostgreSQL (durable authoritative state)

### What it is

Neon is plain PostgreSQL over the wire. The Epoch code path is the
existing `pg` 8.23.0 driver bound at its single documented consumer
(`services/application-gateway`: `connectPostgresPool(connectionString)`
→ `bindPgPool` → the frozen `@epoch/persistence` SPI). **No Neon SDK, no
Neon-specific code** — the connection string is the entire contract.

### Provisioning (free tier, operator steps)

1. Create a Neon account (https://neon.com) and a project (e.g.
   `epoch-production`).
2. Inside the project, open the default branch's **Connection Details**.
3. Copy the pooled connection string (the pooler endpoint keeps
   serverless invocations efficient):
   `postgresql://<operator>:<password>@ep-<project-ref>-pooler.<region>.aws.neon.tech/neondb?sslmode=require`
   - `sslmode=require` is part of the contract (TLS is mandatory).
   - Use the **pooled** (`-pooler`) endpoint for the Vercel deployment
     (many short-lived serverless connections); the direct endpoint also
     works.
4. Record the host — it is the production database host for the
   reset/seed denylist (see `productionHostOf` /
   `refusesProductionTarget` in `@epoch/application-gateway`).

### Free-tier limits (verified 2026-10-02, spec/free-tier-infrastructure.md)

| Resource | Free allocation |
|---|---|
| Projects | 100 / account |
| Compute | 100 CU-hours / project / month |
| Storage | 1 GB / project (20 GB account total) |
| Egress | 5 GB / project / month |
| Scale to zero | after 5 min idle — **cold starts are expected** |
| History window | 6 hours |
| Snapshots | 1 manual snapshot |

Behavior at the limit: hard allowance caps (suspension until reset, not
billing). Expected Epoch consumption: 1 project, kilobytes of records,
minutes of compute — far under every cap.

### Env-var placement (Vercel)

| Variable | Value (placeholder) | Environments |
|---|---|---|
| `EPOCH_DATABASE_URL` | `postgresql://<OPERATOR>:<PASSWORD>@ep-<PROJECT-REF>-pooler.<REGION>.aws.neon.tech/neondb?sslmode=require` | Production (required), Preview (optional) |

In the Vercel dashboard: Project → Settings → Environment Variables →
add for the **Production** (and optionally Preview) environments. Never
paste the value into the repository, an issue, or a PR.

### Verification checklist (after the operator provisions)

1. Boot succeeds; `GET /api/readyz` reports
   `"persistence": { "kind": "postgres", "configured": true, "degraded": false }`
   and `"migrations": { "applied": true, "planDigest": "sha256:<digest>" }`.
2. The plan digest is the deterministic gateway migration digest
   (`GATEWAY_MIGRATION_PLAN` — byte-stable across runs; the pinned value
   is asserted in `services/application-gateway/test/production-negative.test.ts`).
3. Cold start: the first request after >5 min idle pays ~0.5-2 s
   (compute wake) — expected, not an incident.

### Honest verification state (this work order)

- **Code + real-engine: VERIFIED** — the full persistence conformance
  suite + golden-SQL corpus run against the embedded real PostgreSQL
  engine (`services/application-gateway/test/pglite-engine.test.ts`);
  the migration digest is byte-stable; the failure battery (#3, #7, #8)
  proves typed failures over failing wires and durable idempotent replay
  over the real engine.
- **Live Neon connection: NOT VERIFIED** — requires the operator's
  account (the honest-blocking rule). The factory
  (`connectPostgresPool`) is real, lazy and serverless-safe; the URL
  contract above is the only input it needs.

---

## 2. Cloudflare R2 (object/evidence BYTES ONLY)

### What it is

R2 is an S3-compatible object store. The Epoch adapter
(`adapters/s3-object-store`) implements the frozen
`@epoch/object-storage` SPI over ANY S3-compatible endpoint using AWS
SigV4 request signing (`node:crypto` + the platform `fetch` — zero new
dependencies; the signer is pinned by the official AWS documentation
signature vector). R2 stores **bytes only** — content-addressed by the
SHA-256 digest Epoch computes; metadata is a neutral JSON sidecar;
digests are recomputed server-side and verified on retrieval. Provider
portability: AWS S3 / MinIO / Backblaze B2 work by endpoint change.

### Provisioning (free tier, operator steps)

1. Create a Cloudflare account (https://dash.cloudflare.com).
   **Caveat (verified 2026-10-02):** enabling R2 may require a payment
   method on file per Cloudflare's current account requirements — an
   operator decision recorded in spec/free-tier-infrastructure.md.
2. Dashboard → R2 Object Storage → **Create bucket**:
   - Name: `epoch-evidence` (placeholder — any DNS-safe name).
   - Location: **Auto** (region `auto` — the adapter default).
3. Create the S3 API token: R2 overview → **Manage R2 API Tokens** →
   Create API Token:
   - Permissions: **Object Read & Write** (exactly this scope — nothing
     broader).
   - Specify bucket: the bucket from step 2 (scope the token to the one
     bucket).
   - Copy the **Access Key ID** and **Secret Access Key** (shown once).
4. Note the S3 API endpoint for the account:
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (the account id is on
   the R2 overview page).

### Free-tier limits (verified 2026-10-02)

| Resource | Free allocation (per month) |
|---|---|
| Storage | 10 GB-month |
| Class A operations (writes/lists) | 1,000,000 |
| Class B operations (reads/heads) | 10,000,000 |
| Egress to internet | FREE |

Behavior at the limit: operations beyond the free tier bill against the
account's payment method (the one non-degrading provider — the
card-on-file caveat). Expected Epoch consumption: demo/fixture evidence
bytes are KB-scale; content-addressed puts are idempotent; listings are
prefix-scoped and out of hot paths — far under the caps. If allowances
are ever threatened, the incident runbook
(docs/operations/infrastructure.md) governs (suspend new writes first;
paid action = operator decision).

### Env-var placement (Vercel)

| Variable | Value (placeholder) | Environments |
|---|---|---|
| `EPOCH_OBJECT_STORE_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | Production (required), Preview (optional) |
| `EPOCH_OBJECT_STORE_BUCKET` | `epoch-evidence` | same |
| `EPOCH_OBJECT_STORE_ACCESS_KEY_ID` | `<R2 ACCESS KEY ID>` | same |
| `EPOCH_OBJECT_STORE_SECRET_ACCESS_KEY` | `<R2 SECRET ACCESS KEY>` | same |
| `EPOCH_OBJECT_STORE_REGION` | `auto` | same (default) |

All four non-region variables are REQUIRED together in production
(partial configuration falls back to in-memory + a surfaced issue —
`apps/web/src/server/production-env.ts`).

### Verification checklist (after the operator provisions)

1. `GET /api/readyz` reports
   `"objectStore": { "kind": "s3", "configured": true, "degraded": false }`.
2. Upload evidence through the product (any evidence intake with
   bytes); retrieve it; the digest verifies (the adapter recomputes it).
3. Bucket layout: `objects/<sha256hex>` (bytes) and
   `meta/<sha256hex>.json` (neutral sidecar) under the optional key
   prefix.

### Honest verification state (this work order)

- **SigV4 + test doubles: VERIFIED** — the signer reproduces the official
  AWS documentation signature vector; the full SPI surface
  (put/get/has/list/size, digest alignment with the in-memory reference,
  the negative battery: network down, 5xx, 403, tampered bytes,
  malformed sidecars, malformed R2 listing XML) is double-tested.
- **Live R2: NOT VERIFIED** — requires the operator's Cloudflare account
  (the honest-blocking rule). No adapter change is expected; any
  live-only defect lands in the same owned surface with a regression
  test (the Upstash adapter's live-only fix in this work order is the
  precedent for how that flows).

---

## 3. Upstash Redis (ephemeral: rate-limit counters ONLY)

### What it is

Upstash is a Redis with an HTTP/REST interface. The Epoch adapter
(`adapters/upstash-redis`) implements the provider-neutral W051
`RequestGuard` port over the Upstash REST API: **one atomic command per
check** (a single `EVAL`: INCR + EXPIRE NX), epoch-anchored fixed
windows (the gateway's canonical `fixedWindowKey` math — semantically
identical to the in-memory reference), bearer-token auth, timeout +
typed failure resolution per the declared policy (fail-open default:
rate limiting is abuse control, NEVER authorization).

**Redis NEVER holds authoritative durable state** — counters only, with
TTLs that outlive the window (self-expiring keys, no unbounded growth).
Authoritative idempotency records live in PostgreSQL.

### Provisioning (free tier, operator steps)

1. Create an Upstash account (https://console.upstash.com).
2. **Redis** → Create database:
   - Name: `epoch-rate-limit` (placeholder).
   - Region: pick the region nearest the Vercel deployment.
   - Type: Regional (free), TLS on (default).
3. Copy the **REST URL** and **REST token** from the database page
   (the "REST API" section — the URL looks like
   `https://<db-name>.upstash.io`).

The REST contract (live-verified by this work order): commands are JSON
arrays POSTed to the REST **root** (`["EVAL", <script>, "1", <key>,
<ttl>]` → `{"result":<n>}`); errors answer `{"error":"…"}` with HTTP
status (e.g. 401 for an invalid token).

### Free-tier limits (verified 2026-10-02)

| Resource | Free allocation |
|---|---|
| Databases | 1 (max) |
| Data size | 256 MB |
| Commands | 500,000 / month |
| Bandwidth | 10 GB / month |
| Max commands/sec | 10,000 |

Behavior at the limit: hard allowance caps (throttle/reject, not
billing). Expected Epoch consumption: **one command per rate-limit
check** by design — thousands/month at demo traffic (a small fraction of
500K).

### Env-var placement (Vercel)

| Variable | Value (placeholder) | Environments |
|---|---|---|
| `EPOCH_RATE_LIMIT_REST_URL` | `https://<DB-NAME>.upstash.io` | All (absent → in-memory reference limiter, surfaced degraded) |
| `EPOCH_RATE_LIMIT_REST_TOKEN` | `<UPSTASH REST TOKEN>` | same |
| `EPOCH_RATE_LIMIT_TIMEOUT_MS` | `800` (default) | optional |
| `EPOCH_RATE_LIMIT_{IP,TENANT,OPERATION,SESSION}_REQUESTS_PER_WINDOW` / `_WINDOW_MS` | defaults `120/60000`, `600/60000`, `120/60000`, `300/60000` | optional |

Rate limiting never blocks boot: unconfigured/unavailable → the
per-instance in-memory reference + a surfaced degraded flag.

### Verification checklist (after the operator provisions)

1. `GET /api/readyz` reports
   `"rateLimit": { "kind": "upstash", "configured": true, "degraded": false }`.
2. Run the live adapter verification ONCE against the real database
   (the same suite this work order used for the 3-day trial):
   `EPOCH_RATE_LIMIT_REST_URL=<url> EPOCH_RATE_LIMIT_REST_TOKEN=<token> pnpm --filter @epoch/adapter-upstash-redis exec vitest run test/live-upstash-verification.test.ts`
   — expect: the counter INCRs visibly, the TTL is set (≤ 2× window),
   windows deny beyond the limit with the epoch-anchored retryAfter, and
   an invalid token fails open (degraded) per policy.
3. Exceed a budget deliberately (e.g. set `EPOCH_RATE_LIMIT_OPERATION_REQUESTS_PER_WINDOW=1`
   in a Preview environment) and observe the typed
   `transient`/`gateway-overloaded` denial with `details.rateLimit`.

### Honest verification state (this work order)

- **LIVE-VERIFIED** against real Upstash infrastructure (a temporary
  no-signup 3-day trial database — no operator credentials needed):
  the full live suite passed (see docs/operations/infrastructure.md for
  the redacted evidence). **A live-only defect was found and fixed**:
  the W051 adapter posted the command to the `/eval` path prefix, which
  real Upstash ignores (path-style endpoints take arguments from the
  path) — the adapter now uses the live-verified body-style form (POST
  the command array to the REST root). Production credentials remain
  operator input; the temporary trial database expires after 3 days and
  is NOT production infrastructure.

---

## 4. Wiring it together (the bootstrap contract)

The production bootstrap sequence (spec/production-environment.md):
read + validate the environment → construct the pg pool and bind it →
construct the S3 object store → construct the guards → build the
per-tenant gateway environments (fixture restore) → apply the
deterministic migration plan (idempotent; digest recorded in readiness)
→ serve. All of this happens per serverless instance, idempotently (the
pool is cached on `globalThis`; migrations are `CREATE IF NOT EXISTS`).

Reset/seed/bootstrap scripts (present or future) MUST refuse production
targets — enforced in the script layer through
`refusesProductionTarget` (`@epoch/application-gateway`):

```ts
import { productionHostOf, refusesProductionTarget } from '@epoch/application-gateway';

const verdict = refusesProductionTarget({
  profile: process.env['EPOCH_DEPLOYMENT_PROFILE'],          // 'production' → refuse
  connectionString: process.env['EPOCH_TARGET_DATABASE_URL'], // the DB the script would touch
  productionHost: productionHostOf(process.env['EPOCH_DATABASE_URL']) ?? undefined, // denylist anchor
});
if (verdict.refused) {
  throw new Error(`refusing: ${verdict.reasons.join('; ')}`);
}
```

See `docs/operations/infrastructure.md` for failure/recovery, quota
monitoring and backup/restore.
