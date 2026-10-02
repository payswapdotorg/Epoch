# Epoch Production Environment Contract (ACR-006)

The typed, validated environment model for the public deployment. Names are contract; values are secrets (or deployment-specific) and NEVER enter the repository. The reference implementation is `apps/web/src/server/production-env.ts` (validated by tests); `.env.example` documents placeholders.

## Profiles

`EPOCH_DEPLOYMENT_PROFILE` = `development` | `preview` | `production` (default: `development` when absent or unrecognized — the fail-safe default is the least-privileged, fully-local profile; an unrecognized value is recorded as a validation issue and surfaced in readiness).

- **development**: fixture-backed in-process authorities (today's behavior); no external providers; no durable expectations.
- **preview**: fixture product + real provider bindings where configured; used for pre-production verification; absent providers degrade-and-surface.
- **production**: env-driven provider bindings; `EPOCH_DATABASE_URL` and the object-store variables are REQUIRED (boot fails closed without them — production must never silently run on ephemeral authoritative state); rate limiting falls back to the in-memory reference (surfaced as degraded) when Upstash is unconfigured; Apify unconfigured disables external acquisition gracefully.

## Variables (complete contract)

| Variable | Profile | Meaning | Absent behavior |
|---|---|---|---|
| `EPOCH_DEPLOYMENT_PROFILE` | all | `development`\|`preview`\|`production` | default `development` |
| `EPOCH_DATABASE_URL` | preview/production | PostgreSQL (Neon) connection string (may include `sslmode=require`) | preview: in-memory fallback + degraded flag; production: BOOT FAILURE |
| `EPOCH_OBJECT_STORE_ENDPOINT` | preview/production | S3-compatible endpoint (R2: `https://<account>.r2.cloudflarestorage.com`) | same as above (object store) |
| `EPOCH_OBJECT_STORE_BUCKET` | preview/production | bucket name | same |
| `EPOCH_OBJECT_STORE_ACCESS_KEY_ID` | preview/production | S3 access key id | same |
| `EPOCH_OBJECT_STORE_SECRET_ACCESS_KEY` | preview/production | S3 secret (server-side only) | same |
| `EPOCH_OBJECT_STORE_REGION` | preview/production | region (`auto` for R2) | default `auto` |
| `EPOCH_RATE_LIMIT_REST_URL` | all | Upstash REST URL | in-memory reference limiter (per-instance) |
| `EPOCH_RATE_LIMIT_REST_TOKEN` | all | Upstash REST token | same |
| `EPOCH_RATE_LIMIT_TIMEOUT_MS` | all | guard call timeout (default `800`) | default |
| `EPOCH_RATE_LIMIT_IP_*` | all | IP-guard budget: `REQUESTS_PER_WINDOW` (default `120`), `WINDOW_MS` (default `60000`) | defaults |
| `EPOCH_RATE_LIMIT_TENANT_*` | all | tenant-guard budget (default `600`/`60000`) | defaults |
| `EPOCH_RATE_LIMIT_OPERATION_*` | all | operation-guard budget (default `120`/`60000`) | defaults |
| `EPOCH_RATE_LIMIT_SESSION_*` | all | session-guard budget (default `300`/`60000`) | defaults |
| `EPOCH_APIFY_TOKEN` | all | Apify API token (server-side only) | external acquisition disabled (graceful) |
| `EPOCH_APIFY_MAX_RUNS_PER_DAY` | all | hard per-day run cap (default `1`) | default |
| `EPOCH_APIFY_ACTOR_ID` | all | pinned acquisition actor | disabled without token |

Validation: every variable is checked for shape (URL parse, integer parse, non-empty); issues are collected (never thrown mid-read) and reported by readiness; secret VALUES are never included in issues, logs, errors or readiness payloads (presence booleans only).

## Fail-safe precedence (authoritative rules)

1. Security-sensitive gates (tenant gate, session gate, authorization, envelope validation, request-size limits) fail CLOSED — always, in every profile.
2. Durable persistence (PostgreSQL) and object storage are REQUIRED in production (boot failure with a typed, safe error) and degrade-and-surface in preview.
3. Rate limiting never blocks boot: Upstash unconfigured/unavailable → the in-memory reference limiter (per-instance) + surfaced degraded state; a guard infrastructure failure is resolved per the guard's declared failure policy (`fail-open` default for availability — rate limiting is abuse control, not authorization; `fail-closed` is available for stricter deployments).
4. Optional capabilities (Apify acquisition) fail GRACEFULLY: disabled + surfaced; the product stays otherwise healthy.
5. No provider error is ever surfaced raw: typed mapping to the gateway error taxonomy (`transient`/`gateway-overloaded` for rate limits; `transient` with provider-unavailable codes for infrastructure; `authority-rejected` only when an actual Epoch authority rejects).

## Bootstrap sequence (production)

1. Read + validate the environment (production-env).
2. Construct the pg pool from `EPOCH_DATABASE_URL` and bind it (`connectPostgresPool` → `bindPgPool` — the only pg binding seam, in services/application-gateway).
3. Construct the S3 object store adapter from the object-store variables.
4. Construct the guards (Upstash-backed when configured; in-memory reference otherwise).
5. Build the per-tenant gateway environments (fixture restore: worlds/evidence/identity/tenancy are fixture-seeded content; sessions/actions/idempotency/correlation persist in Neon).
6. Apply the deterministic gateway migration plan (idempotent; plan digest recorded).
7. Serve; readiness reports bindings, migration state and degraded flags.

Cold starts repeat this sequence per serverless instance; it is idempotent by construction (digest-verified fixture restore; idempotent migrations; upsert-style bindings).

## Secret handling rules

- Placeholders only in Git (`.env.example`); real values only in the deployment platform's encrypted environment (Vercel project env vars) or local operator env.
- Server-side only: no provider credential is ever imported or referenced from client components; the Next build marks them server-only by construction (they are read exclusively in `apps/web/src/server/**` and `services/**`).
- CI needs no provider secrets (the standard battery is hermetic).
- The 7-gate token audit (gate 2) scans every PR of this program.
- Readiness/health endpoints expose presence booleans and binding kinds, never values.

## Production protection rules

- Reset/seed/bootstrap scripts refuse production targets: profile guard (`EPOCH_DEPLOYMENT_PROFILE=production` → refuse) + connection-string denylist (a URL whose host matches the production database host → refuse), enforced in the script layer (W053 documents the exact procedure).
- Production data is never silently treated as disposable test data; any destructive operation requires an explicit, recorded operator action.
