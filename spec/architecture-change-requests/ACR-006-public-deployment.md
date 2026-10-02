# ACR-006 — Public Deployment, Free-Tier Infrastructure & Production Operations

## Status

APPROVED
Approved by product/architecture authority (operator directive, 2026-10-02): take the completed Epoch product (W001-W050, ACR-005) and make it publicly deployable and actually accessible over the internet using free-tier infrastructure wherever possible.
Effective architecture version: E1.0/X1.0 unchanged — this ACR introduces NO new semantic authority; it adds a deployment/operations program behind the existing authority model.

## Intent

The Epoch product is complete (W001-W050) but not publicly reachable. This ACR authorizes the program that makes it genuinely usable from an ordinary browser over the public internet, on free-tier infrastructure wherever realistically possible, while preserving:

- the repository as the sole durable source of truth;
- the E1.0/X1.0 authority invariants (architecture lock);
- tenant isolation and the centralized authorization model;
- the Application Gateway as the single client-facing boundary;
- provider neutrality — no provider becomes a semantic authority.

The end state is a real, verified public deployment, not the existence of deployment configuration. Acceptance is based on the actual publicly deployed product.

## Deployment objective (target topology)

```
PUBLIC INTERNET (HTTPS)
      |
      v
Vercel — Epoch Web Application (apps/web, production Next.js build;
      |   the Application Gateway is bound IN-PROCESS per the frozen
      |   W046 binding seam — apps/web is the deployed runtime host)
      v
Epoch Application Gateway (the client-facing boundary:
      |  session gate, tenant gate, W009 authorization propagation,
      |  correlation ledger, idempotency, request guards)
      |
      +-------------> Neon PostgreSQL (durable authoritative state,
      |                 via bindPgPool over the frozen persistence SPI)
      |
      +-------------> Cloudflare R2 (object/evidence BYTES ONLY,
      |                 via an S3-compatible ObjectStore adapter behind
      |                 the frozen @epoch/object-storage SPI)
      |
      +-------------> Upstash Redis (ephemeral ONLY: rate-limit counters,
      |                 short-lived cache, idempotency acceleration —
      |                 NEVER authoritative durable state)
      |
      +-------------> controlled provider adapters
                        |
                        +-> Apify (external-source acquisition behind the
                            W045 DiscoverySourceAdapter seam; outputs are
                            untrusted source observations with provenance)
```

This matches the operator's preferred topology. The gateway runs in-process inside apps/web (the documented W046/W047 composition point: "W047+ bind their transports to this class in-process or behind a server"). No second backend service is created; W052 must not bypass the Application Gateway.

## Authority boundaries (unchanged and reinforced)

Epoch remains: semantic authority, lifecycle authority, tenant/authorization authority, action authority, verification/evidence authority.

Providers are infrastructure adapters:

```
PostgreSQL capability -> Neon adapter (bindPgPool + connection string) -> PersistencePort SPI -> Epoch durable state
Object bytes          -> S3-compatible adapter (R2 endpoint)            -> ObjectStore SPI   -> bytes only
Ephemeral/cache       -> Upstash REST adapter                            -> RateLimiter/EphemeralPort -> counters only
Acquisition           -> Apify adapter                                   -> DiscoverySourceAdapter seam -> untrusted observations + provenance
Runtime host          -> Vercel                                          -> deployment target (no semantics)
```

No provider may become: world-model authority, solution authority, delivery authority, verification authority, entitlement authority, lifecycle authority, canonical evidence ledger, or tenant authorization authority. If a provider disappears, Epoch's semantic model must remain valid. Redis is non-authoritative by construction; R2 stores bytes, not semantic truth; Apify output is adapter input, never direct semantic mutation.

## Provider-neutral infrastructure ports (frozen seams)

Existing frozen seams (no changes to their semantics):

1. `@epoch/persistence` SPI (RecordStore/transaction/migrations) — the ONLY durable-state seam. PostgreSQL adapter already exists (`packages/persistence/src/postgres`), driver binding only at `services/application-gateway` (`bindPgPool` — the only pg binding point).
2. `@epoch/object-storage` SPI (digest-addressed put/get/has/list/size) — R2 stores bytes behind a new S3-compatible adapter; content-addressed identities remain authoritative in Epoch.
3. W045 `DiscoverySourceAdapter` seam (`packages/capability-discovery/src/adapters.ts`) — the only external-acquisition seam; Apify is one adapter.

New seams introduced by this ACR (frozen by W051 before W052/W053/W054 begin):

4. **RequestGuard / rate-limit port** — a provider-neutral ephemeral-counter port (fixed-window counters with fail-safe semantics) defined in `services/application-gateway` (the boundary owner), with an in-memory reference implementation; the Upstash adapter (W053) implements it over the Upstash REST API. Rate limiting is enforced at the gateway boundary, never by a provider-native control alone.
5. **Production environment contract** — a single typed, validated environment model (`apps/web/src/server/production-env.ts`) that maps environment variables to bound implementations (PG wire / S3 object store / Upstash guard) with explicit fail-safe fallbacks and degraded-mode signaling. Placeholders only in the repository; no real values ever committed.
6. **S3-compatible object-store adapter port** — an injected HTTP/signing port so the R2 adapter (`adapters/s3-object-store`) has zero new runtime dependencies (AWS SigV4 over the platform `fetch`/`node:crypto`).
7. **Provider acquisition adapter port** — the Apify adapter (`adapters/apify`) implements the existing `DiscoverySourceAdapter` contract over the Apify REST API with a quota guard (per-day run cap); zero new runtime dependencies.

Zero-new-dependency rule: this program MUST NOT add runtime dependencies to the frozen dependency baseline (pnpm-workspace catalog). Neon is plain PostgreSQL over the existing `pg` 8.23.0 pin; R2/Upstash/Apify speak REST over `fetch`; SigV4 signing uses `node:crypto`. Any exception requires a Tech Lead foundation change (work/foundation-*) with explicit justification.

## Production environment model

One environment contract, three profiles:

- `development` (default): today's fixture-backed in-process behavior; no external providers.
- `preview`: fixture product + real provider bindings where configured; used for pre-production verification.
- `production`: env-driven provider bindings; fixture demo tenants remain the product content of the public deployment (see Product scope below); persistence/sessions/idempotency/correlation durable in Neon; objects in R2; guards in Upstash when configured.

Environment variables (names are contract; values are secrets, never committed):

```
EPOCH_DEPLOYMENT_PROFILE = development | preview | production
EPOCH_DATABASE_URL       = postgresql://… (Neon connection string; absent => in-memory fallback + degraded flag)
EPOCH_OBJECT_STORE_*     = ENDPOINT / BUCKET / ACCESS_KEY_ID / SECRET_ACCESS_KEY / REGION (S3-compatible; absent => in-memory fallback + degraded flag)
EPOCH_RATE_LIMIT_*       = REST_URL / REST_TOKEN (Upstash; absent => in-memory reference limiter)
EPOCH_APIFY_TOKEN        = (absent => external acquisition disabled, product degrades gracefully)
EPOCH_APIFY_MAX_RUNS_PER_DAY = integer quota guard (default 1)
EPOCH_RATE_LIMIT_*_REQUESTS_PER_WINDOW / WINDOW_MS = limiter budgets
```

Fail-safe precedence: security-sensitive gates (tenant gate, session gate, authorization, validation) fail CLOSED always; optional capabilities (external acquisition, cache acceleration) fail GRACEFULLY (disabled + surfaced); persistence/object-store absence is DEGRADED-and-SURFACED in non-production profiles and a boot failure in the production profile (production must not silently run on ephemeral state).

## Product scope of the public deployment (explicit boundary)

The public deployment ships the EXISTING product: the two deterministic demo tenants (construction `tenant:nordstrand`, software `tenant:lightspeed`) with their fixture worlds, personas and journey scenarios. "P01 Public onboarding" means: a real anonymous visitor reaches the public URL over HTTPS, selects a domain/persona, signs in through the product's identity boundary, and enters a working session — with sessions/actions/idempotency durable across restarts.

Self-service signup, new tenant creation, new domain packs, billing or any new semantic capability is OUT OF SCOPE for ACR-006 (each requires its own ACR). This ACR changes deployment/operations, not the semantic model.

## Secret/configuration model

- No secret values in Git, ever. `.env.example` templates carry placeholders only.
- Provider credentials live only in the deployment platform's encrypted environment (Vercel project environment variables) and the local operator environment.
- No API key in the browser bundle; all provider clients execute server-side only (apps/web server runtime / gateway service).
- CI never needs provider credentials for its standard battery; deployment secrets flow only through the deployment platform's secure mechanisms.
- Secret-token audit (gate 2 of the 7-gate review) applies to every PR in this program.

## Database / storage / cache / external-source boundaries

- **Neon PostgreSQL** is the ONLY durable authoritative state (E1.0 lock rule 15). Migrations are deterministic and reproducible from the repository (the gateway's migration plan); connection configuration is environment-specific; reset/seed scripts MUST refuse to run against production (profile guard + connection-string denylist check); production data is never silently treated as disposable test data.
- **Cloudflare R2** stores evidence/asset bytes only. Digest-addressed identities are computed and verified by Epoch; uploads/downloads never bypass the gateway's authority checks; missing bytes fail safely and observably (typed `object-not-found`), never silently.
- **Upstash Redis** holds ONLY ephemeral values: rate-limit counters, short-lived cache entries, idempotency acceleration hints. Authoritative idempotency records remain in PostgreSQL (Redis can only accelerate the check, never decide it alone). No authoritative durable state may move into Redis.
- **Apify** is an external-source acquisition adapter. Source claims remain untrusted inputs; external data never directly mutates authoritative semantic state; provenance/evidence is recorded; source failures degrade gracefully (discovery capability disabled/surfaced, product otherwise healthy); source-specific behavior stays outside kernel semantics; credentials never enter the repository.

## Deployment/release rules

- One deployment target: `apps/web` on Vercel (Hobby tier), connected to the GitHub repository, production deploys from `main` only.
- The public URL, deployment identifiers and source commits are recorded in the repository ONLY after verification (never fabricated).
- Every production release records: source commit (40-char SHA), Vercel deployment ID, environment profile, and the release identity in `release/`.
- Rollback: Vercel instant rollback to the previous production deployment + documented recovery runbook; the repository documents the procedure and the data-compatibility expectations (forward-only migrations with the deterministic plan digest).
- The 7-gate review chain applies to every work order in this program.

## Public security/rate-limit/abuse controls

Minimum controls at or behind the gateway boundary:

- rate limiting per client/IP and per session (RequestGuard port; in-memory reference or Upstash-backed);
- request-size limits and strict envelope validation (already fail-closed in the W046/W047 transport);
- tenant isolation (fail-closed routing per tenant, R12 — verified by negative test);
- secure session/cookie configuration (production profile: Secure/HttpOnly/SameSite);
- no CORS opening beyond the deployed origin;
- no debug endpoints in production; no development credentials; safe error envelopes (no stack/secret leakage);
- upload validation (digest recomputed server-side, size caps, neutral kinds only);
- safe object access (digest-addressed, authority-checked; no public bucket listing);
- audit/correlation identifiers on every gateway operation (already in the W046 contract).

Security uses the EXISTING Epoch authority model — no parallel security authority is introduced.

## Observability and recovery requirements

- `GET /api/healthz` — liveness (process up, profile, version, uptime).
- `GET /api/readyz` — readiness: gateway prepared, persistence binding state (in-memory|postgres), object store binding (in-memory|s3), guard binding (in-memory|upstash), migration state, degraded-capability flags. Readiness never leaks secret values.
- Structured, correlation-aware error envelopes (recoverable, typed — the W046 contract) with provider-failure mapping (timeout/unavailable/quota => typed degraded responses, never raw provider errors).
- Recovery: provider failures are observable (health/readyz + error codes), retry only where safe (idempotent operations only), no retry storms (bounded retries with backoff), timeouts on every provider call.
- Recovery runbooks live in `docs/operations/` (W053/W054/W055).

## Free-tier cost-control contract

Verified against the providers' official documentation on 2026-10-02 (recorded with sources in `spec/free-tier-infrastructure.md`; W051 re-verifies at implementation time):

| Provider / service | Free allocation (verified 2026-10-02) | Expected Epoch consumption | Hard safety limit |
|---|---|---|---|
| Vercel Hobby | 100 GB fast data transfer/mo; 10 GB origin transfer; 1M function invocations; 4 CPU-hrs active CPU; 360 GB-hrs memory | demo product, low traffic | usage pauses at limits (no spend possible on Hobby without explicit upgrade) |
| Neon Free | 100 projects; 100 CU-hours/project/mo; 1 GB storage/project; 5 GB egress/project; scale-to-zero after 5 min | 1 project, well under all caps | hard allowance caps (suspension, not billing) |
| Cloudflare R2 free tier | 10 GB-month storage; 1M Class A ops/mo; 10M Class B ops/mo; egress free | evidence/fixture bytes (KB-scale) | allowance caps; card-on-file requirement verified at provisioning |
| Upstash Redis Free | 1 database; 256 MB; 500K commands/mo; 10 GB bandwidth | rate-limit counters (low thousands/mo) | hard allowance caps (throttle, not billing) |
| Apify Free | $5 platform credit/mo ($0.2/compute unit) | ≤ 1 acquisition run/day by default quota guard | EPOCH_APIFY_MAX_RUNS_PER_DAY hard cap; no payment method => runs stop at $0 spend |

Rules: no paid resource without explicit repository-level authorization (a new ACR or a recorded Tech Lead decision); the application must fail safely rather than generate paid usage; providers are chosen so that exceeding free allowances degrades (pause/suspension/throttle) instead of silently spending. Known caveat recorded honestly: Vercel Hobby terms restrict commercial use — the operator (deployment owner) must confirm the deployment's use of Hobby complies with Vercel's current terms; if not, a paid plan decision requires explicit authorization.

## Provider failure/degradation behavior

Assume free-tier infrastructure can disappear, throttle, sleep, reject requests, change limits or become unavailable (Neon scale-to-zero cold starts are expected, not exceptional). The application must: surface degraded capability (readyz flags + typed errors); preserve authoritative state; retry only where safe; avoid retry storms; use idempotency; use timeouts on every provider call; avoid infinite queues; fail CLOSED for security-sensitive operations; fail GRACEFULLY for optional discovery/acquisition features. No undocumented provider behavior may become an operational dependency. Mandatory negative tests (W053): Redis unavailable; object storage unavailable; database unavailable; malformed provider response; cross-tenant attempt; storage authorization bypass attempt; duplicate idempotency request; migration mismatch; configuration/secret absence.

## Data retention and backup posture

- Neon Free: 6-hour history window, 1 manual snapshot. Therefore: the repository remains the source of truth for SCHEMA (deterministic migrations) and demo fixture content; Neon holds only runtime-produced state (sessions, actions, idempotency, correlation, evidence records). W053 documents a manual snapshot/restore procedure and an export script (`pg_dump` equivalent over the persistence port) as the backup posture; loss of runtime state is recoverable to the fixture baseline by re-running migrations + fixture bootstrap (documented, deterministic).
- R2: evidence bytes are content-addressed and reproducible from the committed fixtures for demo content; production-uploaded evidence retention follows the bucket's lifecycle (no auto-delete configured).
- Upstash: zero retention expectations (ephemeral by contract).
- Apify: acquisition run records (provenance) are persisted as Epoch evidence records; Apify's own retention is irrelevant to Epoch authority.

## Public-domain/TLS assumptions

- TLS is terminated by the deployment platform (Vercel) with automatic certificates; no custom domain is required for acceptance — the platform-assigned `*.vercel.app` URL is acceptable.
- If the operator later attaches a custom domain, DNS/TLS configuration is a deployment-platform concern recorded in the runbook; no application change.

## Work Order graph (WO2.0)

```
ACR-006
   |
 W051  Production Deployment Foundation (Tech Lead, serialized)
   |
 +---------+----------+
 |         |          |
W052      W053      W054   (concurrent, max 3 workers, pairwise-disjoint)
 |         |          |
 +---------+----------+
   |
 W055  Serialized Production Closure (Tech Lead)
```

| ID | Scope | Depends | Owned surfaces |
|---|---|---|---|
| W051 | Production deployment foundation: environment contract, provider-neutral deployment contracts, health/readiness, bootstrap/migration contract, deployment manifests + env templates (placeholders only), cost guardrails, observability contract, freeze seams for W052-W054 | ACR-006 | spec/deployment-architecture.md, spec/production-environment.md, spec/free-tier-infrastructure.md, spec/production-security.md, spec/production-operations.md, spec/production-rollback.md, docs/deployment/*, services/application-gateway/src/{rate-limit,upstash-binding}.ts + tests, adapters/s3-object-store/*, adapters/upstash-redis/* (contract skeletons ONLY if W053 owns implementations — see below), apps/web/src/server/production-*.ts, apps/web/app/api/healthz/*, apps/web/app/api/readyz/*, apps/web/.env.example, apps/web/vercel.json, spec/development-state/*, AI_CONTINUATION.md, spec/PROJECT-STATE.md, docs/LLM-ARCHITECT-HANDOFF.md |
| W052 | Public web + Vercel production deployment: deploy apps/web to a real public environment, production env vars, public URL, health/readiness validation, auth/session validation, API routing validation, tenant boundary validation, real browser journeys against the deployed site | W051 | apps/web/* (EXCEPT the W051-frozen files: src/server/production-*.ts, app/api/healthz/*, app/api/readyz/*, .env.example, vercel.json — read-only for W052), docs/journeys/production-web.md |
| W053 | Neon + R2 + Upstash production infrastructure: implement + verify the S3/R2 object-store adapter and the Upstash rate-limit adapter against the W051-frozen ports, connect PostgreSQL through Neon, provision/verify schemas + migrations, tenant isolation, evidence flow, provider failure/degradation, reproducible setup docs | W051 | adapters/s3-object-store/src/* (implementation + tests), adapters/upstash-redis/src/* (implementation + tests), packages/persistence/src/postgres/* (production hardening ONLY if required, else read-only), docs/operations/infrastructure.md, docs/deployment/neon-r2-upstash-setup.md |
| W054 | External acquisition + Apify + production operations: make ACR-004 ecosystem discovery usable in production through the adapter boundary, Apify integration with quota awareness + provenance preservation, scheduler/execution safety, operational dashboards/logging/alerts where required, provider failure recovery | W051 | adapters/apify/*, services/capability-discovery/src/* (production scheduler trigger + quota guard), ops/src/runbooks/*, docs/operations/acquisition.md |
| W055 | Serialized production closure: topology verification, environment parity, web ↔ gateway ↔ Neon ↔ R2 ↔ Redis integration, acquisition integration, auth/tenant/security review, rate-limit review, migration review, cost guardrail review, recovery + rollback testing, public journey validation, production release identity, documentation/state reconciliation | W052, W053, W054 | cross-cutting (serialized): spec/journey-validation.md, spec/PROJECT-STATE.md, AI_CONTINUATION.md, docs/LLM-ARCHITECT-HANDOFF.md, docs/journeys/production.md, release/clients/release-manifest.json (production entries), .github/workflows/* (deployment-config validation), README.md |

Ownership refinements (disjointness rules for the concurrent wave):

- W051 creates `adapters/s3-object-store` and `adapters/upstash-redis` as CONTRACT-ONLY skeletons (package manifests, port type re-exports, failing/TODO-free test stubs excluded — the packages compile, their READMEs pin the W053 implementation contract). W053 owns their `src/*` implementation and tests. This keeps the adapter package manifests (which touch no shared root files — nested manifests belong to the owning Work Order per the CI baseline guard) out of the concurrent wave.
- W051 owns `apps/web/src/server/production-*.ts` and the health/readyz routes; W052 owns the rest of apps/web but MUST NOT edit the W051-frozen files (listed above); W052's deployment configuration (vercel.json wiring adjustments, production env var documentation) lands via its own files or explicit coordination notes in its PR.
- W054 owns `services/capability-discovery` production wiring (the scheduler CONTRACT stays frozen; W054 adds the quota-guarded run trigger), `adapters/apify`, and `ops/` runbooks.
- Root manifests/lockfile: NO work order in this program modifies them (zero-new-dependency rule). If an exception becomes unavoidable, it is a serialized Tech Lead foundation change (work/foundation-*) outside the concurrent wave.

## Production journeys (acceptance mechanism)

`spec/journey-validation.md` is extended (by this ACR's merge) with the production journey set P01-P18 (public onboarding, sign-in/session, tenant/project selection, understand/reconstruct, capability discovery, decide/approve, plan/acquire, realize/observe/verify, offline/reconnect where the client permits, cross-device handoff, agent supervision, recovery, release/update, production persistence, object upload/retrieval, provider degradation/recovery, rate-limit behavior, tenant isolation). Acceptance is based on the ACTUAL publicly deployed product — never from unit tests alone — using the established loop: observe → record → reproduce → regression test → fix → rerun → close. W052 executes the web journeys against the deployed site and records evidence under `docs/journeys/`; W055 consolidates.

## Acceptance criteria (gate)

The program is COMPLETE only when ALL of the following are true (verified against the real deployment):

1. Public availability: real public URL works over HTTPS; the production application launches; the core workflow is usable from an ordinary browser; no dev server serves the public traffic.
2. Data: production PostgreSQL works with reproducible migrations; production object storage works; cache/rate limiting works where required; persistence survives application restart.
3. Security: tenant isolation passes; no credentials leak; provider credentials remain server-side; authorization remains centralized; rate limits work; failure states fail safely.
4. Architecture: no new semantic authority exists; no provider-native state became Epoch authority; the Application Gateway remains the client-facing boundary; Redis is non-authoritative; R2 stores bytes, not semantic truth; Apify/external data remains adapter input.
5. Operations: logs are useful; health/readiness works; provider failures are observable; rollback/recovery is documented; quotas are documented; free-tier guardrails exist.
6. Product: production browser journeys pass; P0 defects = 0; P1 = 0; every P2 has disposition; real deployed URLs are tested; deployment source commit + release identity are recorded.

## Honest-blocking rule (credential boundary)

Actual provider provisioning (Vercel project, Neon project, R2 bucket, Upstash database, Apify account) requires operator-owned accounts and credentials that are NOT present in the repository or the working sandbox. The program is structured so that all engineering work up to the credential boundary is real and verifiable (code, ports, adapters with negative tests against test doubles, local real-engine tests via PGlite, deployment manifests, runbooks). The final "connected + publicly verified" acceptance items execute as soon as the operator provides the deployment credentials through the deployment platform's secure mechanisms. Work orders report their verification state honestly (VERIFIED / NOT VERIFIED per provider); no deployment URL or identifier is ever fabricated, and no "deployed" claim is made from a build or configuration alone.

## Non-goals

No new semantic subsystem; no change to the authority model; no second backend; no self-service signup; no paid infrastructure; no general-purpose web scraping system (Apify is scoped to capability-discovery acquisition through the existing adapter boundary); no custom domain requirement; no migration off the frozen dependency baseline.

## Frontier effect

On merge of this ACR: frontier becomes `eligible=[W051]`; W051 is the sole authorized work order; after W051 merges and the Tech Lead reconciles state, `W052|W053|W054` become concurrently eligible (pairwise-disjoint surfaces, max 3 workers); W055 is blocked until all three merge. No W051+ work order exists before this ACR is merged.
