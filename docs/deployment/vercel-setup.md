# Epoch Web — Vercel Production Deployment Runbook (W052, ACR-006)

The reproducible procedure for deploying `apps/web` — the Epoch web product with
the Application Gateway bound in-process — to Vercel from this repository, and
for validating the public deployment with the production journey harness.

**Honest status (do not trust claims without evidence):** NOT-DEPLOYED. No
Vercel credentials exist in the working environment (the ACR-006
honest-blocking rule). This runbook is verified up to the credential boundary:
the build configuration is the committed `apps/web/vercel.json` (W051-frozen),
its install/build commands were executed successfully in this repository
checkout, and the production journey harness
(`apps/web/qa/production/`) passed against a real local production build
(`next build` + `next start`, preview profile — see
[docs/journeys/production-web.md](../journeys/production-web.md)). The public
URL, deployment identifiers and live journey results enter this document ONLY
after the operator executes the steps below against a real Vercel account.

**What the operator must provide (the credential boundary):**

1. a Vercel account (Hobby tier works within the free-tier contract below);
2. the ability to connect that account to the `payswapdotorg/Epoch` GitHub
   repository (Vercel's GitHub App authorization);
3. the provider secrets from W053 (`EPOCH_DATABASE_URL` from Neon, the
   `EPOCH_OBJECT_STORE_*` set from Cloudflare R2, optionally the Upstash
   `EPOCH_RATE_LIMIT_*` pair) — provisioning guides:
   [neon-r2-upstash-setup.md](./neon-r2-upstash-setup.md) (W053).

Placeholders only — NO secret value ever enters this repository.

---

## 1. Create the Vercel project (one-time, ~5 minutes)

1. Sign in to the Vercel dashboard (https://vercel.com) with the operator
   account.
2. **Add New… → Project**, then **Import Git Repository → payswapdotorg/Epoch**.
   (First time: install the Vercel GitHub App and grant it access to the
   `payswapdotorg/Epoch` repository.)
3. The framework/build settings are ALREADY committed in
   [`apps/web/vercel.json`](../../apps/web/vercel.json) — Vercel merges them
   automatically. Verify the resolved configuration matches exactly (Project →
   Settings → Build & Development Settings):

   | Setting | Value (from `vercel.json`) | Locally verified |
   |---|---|---|
   | Framework Preset | Next.js | — |
   | Root Directory | `.` (the repository root) | — |
   | Install Command | `corepack enable pnpm && pnpm install` | ✅ (pnpm 10.x workspace install) |
   | Build Command | `pnpm --filter @epoch/web build` | ✅ (`next build` in apps/web, this checkout) |
   | Output Directory | `apps/web/.next` | ✅ |

   Do not override these in the UI — the manifest is the single source
   (`framework: nextjs`, `rootDirectory: "."`). The monorepo's workspace
   packages are consumed as linked sources and transpiled by the Next build;
   no additional configuration is needed.

4. Leave **Production Branch** = `main` (the default; spec rule: production
   deploys from `main` only; PRs produce preview deployments automatically).

## 2. Configure the environment variables (Project → Settings → Environment Variables)

Add every variable below through the Vercel UI
(`https://vercel.com/[team]/[project]/settings/environment-variables`), for the
**Production** environment (add **Preview** copies if you want preview
deployments to bind the same providers — the preview profile tolerates absent
providers, production does not). Names are contract
([spec/production-environment.md](../../spec/production-environment.md));
values are secrets — placeholders shown here.

### 2.1 The deployment profile (required)

| Variable | Value |
|---|---|
| `EPOCH_DEPLOYMENT_PROFILE` | `production` |

Production REQUIRES the persistence + object-store variables below — the boot
path fails closed without them (typed refusal; `/api/readyz` reports
`ready:false`; the instance serves no traffic). This is deliberate: production
must never silently run on ephemeral authoritative state.

### 2.2 Persistence — Neon PostgreSQL (required for production)

| Variable | Value (placeholder) |
|---|---|
| `EPOCH_DATABASE_URL` | `postgresql://<user>:<password>@<ep-…>.neon.tech/<db>?sslmode=require` |

Source: the Neon project provisioned per the W053 guide. Server-side only;
Vercel marks all variables server-only by default (never add them to a
client-visible scope — the Next build reads them exclusively in
`apps/web/src/server/**`).

### 2.3 Object storage — Cloudflare R2 / any S3 endpoint (required for production)

| Variable | Value (placeholder) |
|---|---|
| `EPOCH_OBJECT_STORE_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `EPOCH_OBJECT_STORE_BUCKET` | `<bucket-name>` |
| `EPOCH_OBJECT_STORE_ACCESS_KEY_ID` | `<access-key-id>` |
| `EPOCH_OBJECT_STORE_SECRET_ACCESS_KEY` | `<secret-access-key>` |
| `EPOCH_OBJECT_STORE_REGION` | `auto` |

All four of endpoint/bucket/access-key/secret are required together — a
partial set is a recorded validation issue and the store falls back to
in-memory (boot-blocking in production).

### 2.4 Rate limiting — Upstash Redis REST (optional, recommended)

| Variable | Value (placeholder) | Default when absent |
|---|---|---|
| `EPOCH_RATE_LIMIT_REST_URL` | `https://<xxx>.upstash.io` | in-memory reference limiter (per-instance, surfaced degraded) |
| `EPOCH_RATE_LIMIT_REST_TOKEN` | `<rest-token>` | same |
| `EPOCH_RATE_LIMIT_TIMEOUT_MS` | `800` | `800` |
| `EPOCH_RATE_LIMIT_IP_REQUESTS_PER_WINDOW` | `120` | `120` |
| `EPOCH_RATE_LIMIT_IP_WINDOW_MS` | `60000` | `60000` |
| `EPOCH_RATE_LIMIT_TENANT_REQUESTS_PER_WINDOW` | `600` | `600` |
| `EPOCH_RATE_LIMIT_TENANT_WINDOW_MS` | `60000` | `60000` |
| `EPOCH_RATE_LIMIT_OPERATION_REQUESTS_PER_WINDOW` | `120` | `120` |
| `EPOCH_RATE_LIMIT_OPERATION_WINDOW_MS` | `60000` | `60000` |
| `EPOCH_RATE_LIMIT_SESSION_REQUESTS_PER_WINDOW` | `300` | `300` |
| `EPOCH_RATE_LIMIT_SESSION_WINDOW_MS` | `60000` | `60000` |

Note: without Upstash, each serverless instance enforces its own in-memory
budget (honest, weaker under many instances). With Upstash the budget is
shared across instances.

### 2.5 External acquisition — Apify (optional)

| Variable | Value (placeholder) | Default when absent |
|---|---|---|
| `EPOCH_APIFY_TOKEN` | `<apify-token>` | acquisition disabled (graceful, surfaced) |
| `EPOCH_APIFY_ACTOR_ID` | `<actor-id>` | disabled without token |
| `EPOCH_APIFY_MAX_RUNS_PER_DAY` | `1` | `1` (hard quota guard) |

### 2.6 Sensitive-variable hygiene

- Mark database/store/token variables as **Sensitive** in the Vercel UI
  (values hidden after save; never echoed in build logs).
- Readiness (`/api/readyz`) exposes presence booleans and binding kinds ONLY —
  it can never echo a value (enforced by construction in
  `apps/web/src/server/production-env.ts`).

## 3. Deploy and record the public URL

1. **Deploy** (Project → Deployments → **Deploy** on `main`, or push/merge a
   commit to `main`). First deployment takes a few minutes (install + build).
2. Verify the deployment's **Build Command** output shows
   `pnpm --filter @epoch/web build` and the route table including
   `/api/gateway`, `/api/healthz`, `/api/readyz`.
3. The platform assigns a public URL of the form
   `https://<project>.vercel.app` (custom domains optional — TLS is automatic;
   a custom domain is NOT required for acceptance).
4. **Record ONLY what actually resolves** (the honest-blocking rule): the
   public URL, the Vercel deployment ID (Deployment → … → Copy Deployment ID)
   and the deployed source commit (40-char SHA) go into
   [docs/journeys/production-web.md](../journeys/production-web.md) and the
   release record — never a fabricated value.

## 4. Post-deploy validation (the acceptance sequence)

Run from a repository checkout (the harness reads `qa/fixtures/registry.json`
for the digest anchors):

```bash
cd apps/web

# 4.1 liveness + readiness (typed payloads over HTTPS)
curl -s https://<project>.vercel.app/api/healthz   # {"ok":true,"profile":"production","uptimeMs":…}
curl -s https://<project>.vercel.app/api/readyz    # ready:true, bindings postgres/s3/upstash, degraded:[]

# 4.2 the production journey harness (P01-P08, P11, P12, P14, P15, P18 + health)
EPOCH_PRODUCTION_BASE_URL=https://<project>.vercel.app \
EPOCH_HARNESS_TRACE=/tmp/production-journeys.trace.json \
npx vitest run qa/production
```

Expected readiness for a fully-configured production deployment:
`bindings.persistence.kind === "postgres"`, `objectStore.kind === "s3"`,
`rateLimit.kind === "upstash"` (when configured), `degraded: []` (acquisition
stays `disabled` until Apify is configured — that is a graceful degradation,
not an error).

### 4.3 P17 — the rate-limit behavior check

P17 needs a deliberately tiny budget so the journey can exceed it:

1. In Vercel (Project → Settings → Environment Variables) TEMPORARILY set
   `EPOCH_RATE_LIMIT_IP_REQUESTS_PER_WINDOW=3` for Production and redeploy
   (`main` → Deploy).
2. Run only the P17 journey:

   ```bash
   EPOCH_PRODUCTION_BASE_URL=https://<project>.vercel.app \
   EPOCH_HARNESS_IP_BUDGET=3 \
   npx vitest run qa/production -t "P17"
   ```

   Expected: HTTP 429 with the typed `transient`/`gateway-overloaded`
   envelope, `retry-after` header ≥ 1, `details.rateLimit.limit === 3`, and
   `/api/healthz` still 200 afterwards (no crash).
3. Restore the production budget (delete the temporary override or set it
   back) and redeploy.

### 4.4 The full-browser journeys (W055)

The browser-level journeys (P01 through the visible client, offline queue,
cross-device handoff) run against the deployed URL through the W047 Playwright
suite configuration (`apps/web/playwright.config.ts` — set its baseURL to the
deployment URL) and are consolidated by W055.

## 5. Rollback

Vercel instant rollback: Project → Deployments → select the previous healthy
production deployment → **… → Promote to Production**. Data-compatibility
expectations and the recovery procedures live in
[spec/production-rollback.md](../../spec/production-rollback.md) (migrations
are forward-only with the deterministic plan digest — see the rollback spec
before rolling back across a migration boundary).

## 6. Free-tier contract + the commercial-use caveat

The verified free-tier allocations and cost-control rules are recorded in
[spec/free-tier-infrastructure.md](../../spec/free-tier-infrastructure.md).
Vercel Hobby (the free tier) provides 100 GB fast data transfer/month, 1M
function invocations, 4 CPU-hours; usage **pauses** at the limits (no silent
spend possible). **Caveat (verbatim from the verified contract): Vercel's
Hobby-tier terms aim the plan at personal/non-commercial projects — the
deployment owner (the operator) must confirm the deployment's use of Hobby
complies with Vercel's current terms; if the deployment is deemed commercial,
upgrading to a paid plan is an explicit operator decision, not one this
program takes.**

## 7. Troubleshooting quick reference

| Symptom | Meaning | Action |
|---|---|---|
| Deployment builds but `/api/readyz` → 503 `ready:false`, message mentions the production profile | The production profile booted without `EPOCH_DATABASE_URL` and/or the `EPOCH_OBJECT_STORE_*` set (fail-closed by design) | Add the missing variables (§2), redeploy |
| `/api/readyz` shows `persistence: in-memory` degraded flag in production | Impossible if the profile booted — verify the profile is really `production` (`/api/healthz` → `profile`) | Check `EPOCH_DEPLOYMENT_PROFILE` |
| `ready:false` with a provider connection error class | A provider endpoint is unreachable from Vercel | Check the Neon/R2/Upstash endpoints + credentials (§2) |
| First requests after idle are slow (Neon) | Neon free-tier scale-to-zero cold start (expected, not exceptional) | None — the pool reconnects; readiness reports the binding, not a live ping |
| 429 `gateway-overloaded` under normal traffic | An IP/tenant/operation/session budget is exhausted | Review the `EPOCH_RATE_LIMIT_*` budgets (§2.4); the response's `details.rateLimit` names the guard |

## 8. What this runbook intentionally does NOT contain

- No real credentials, URLs of provisioned resources, or deployment IDs (they
  do not exist yet; they are recorded only after live verification).
- No provider provisioning steps (W053's
  [neon-r2-upstash-setup.md](./neon-r2-upstash-setup.md)) and no acquisition
  operations (W054's [docs/operations/acquisition.md](../operations/acquisition.md)).
- No second backend: `apps/web`'s `/api/gateway` remains the ONLY client-facing
  mutation/read path (the Application Gateway is bound in-process).
