# Epoch Deployment Architecture (ACR-006)

Authoritative deployment topology and trust boundaries for the public deployment program. Provider implementations are adapters behind the frozen neutral ports; the authority model is unchanged (E1.0/X1.0, ACR-006 adds no semantic authority).

## Topology

```
PUBLIC INTERNET (HTTPS, TLS terminated by the platform)
      |
      v
Vercel — apps/web production build (Next.js, Node runtime)
      |    The Application Gateway is bound IN-PROCESS (the frozen W046
      |    composition seam; apps/web is the deployed runtime host).
      v
Epoch Application Gateway (the ONLY client-facing boundary)
      |    envelope validation -> request guards (rate limit)
      |    -> session gate -> tenant gate -> idempotency rule
      |    -> W009 authorization -> dispatch -> correlation ledger
      |
      +-----> Neon PostgreSQL (durable authoritative state)
      |         bindPgPool(new Pool(EPOCH_DATABASE_URL)) — the ONLY pg
      |         binding point (services/application-gateway); sessions,
      |         actions, idempotency records, correlation ledger, evidence
      |         records, migration state.
      |
      +-----> Cloudflare R2 (object/evidence BYTES ONLY)
      |         adapters/s3-object-store implements the frozen
      |         @epoch/object-storage ObjectStore SPI over the S3 API
      |         (SigV4 via node:crypto, zero new dependencies).
      |
      +-----> Upstash Redis (EPHEMERAL ONLY)
      |         adapters/upstash-redis implements the W051 RequestGuard
      |         port over the Upstash REST API (rate-limit counters);
      |         never authoritative durable state.
      |
      +-----> Apify (external-source acquisition)
                adapters/apify implements the frozen W045
                DiscoverySourceAdapter seam; outputs are untrusted
                candidate observations with provenance; quota-guarded.
```

## Trust boundaries

| Boundary | Rule |
|---|---|
| Browser → apps/web | HTTPS only; the browser bundle contains no provider credentials, no kernel imports, no gateway internals. |
| apps/web → Application Gateway | In-process; the ONLY mutation/read path is `/api/gateway` with typed envelopes over the frozen client-runtime vocabulary. |
| Application Gateway → Neon | Server-side only; the connection string is a deployment secret; the persistence SPI is the only durable-state seam. |
| Application Gateway → R2 | Server-side only; SigV4 credentials are deployment secrets; bytes are digest-addressed; metadata is provider-neutral. |
| Application Gateway → Upstash | Server-side only; REST token is a deployment secret; ephemeral values only. |
| Discovery trigger → Apify | Server-side only; adapter is the only seam; quota guard caps runs; outputs untrusted. |

No provider is reachable from the browser. No provider appears in kernel types. No provider holds semantic authority.

## Component responsibilities

- **apps/web (Vercel)**: product UI + the in-process gateway binding + the production environment contract (profile detection, variable validation) + health/readiness endpoints + transport-level guards (IP-keyed).
- **services/application-gateway**: the boundary logic — request guards (port + in-memory reference), the pg driver binding (`bindPgPool`, `connectPostgresPool`), session/idempotency/correlation persistence bindings, authority dispatch (unchanged W046 semantics).
- **adapters/s3-object-store**: ObjectStore SPI over S3-compatible endpoints (R2 production target; any S3 endpoint works — provider portability).
- **adapters/upstash-redis**: RequestGuard port over Upstash REST.
- **adapters/apify**: DiscoverySourceAdapter seam over Apify REST.
- **packages/***: unchanged kernel/contract semantics. No kernel package learns about any provider.

## Ports (capability → provider → adapter → authority)

```
PostgreSQL      -> Neon                -> bindPgPool/connectPostgresPool -> PersistencePort SPI -> Epoch durable state
Object bytes    -> Cloudflare R2       -> adapters/s3-object-store       -> ObjectStore SPI     -> bytes (digest-addressed)
Rate limiting   -> Upstash Redis       -> adapters/upstash-redis         -> RequestGuard port   -> ephemeral counters
Acquisition     -> Apify               -> adapters/apify                 -> DiscoverySourceAdapter -> untrusted observations
Runtime host    -> Vercel              -> (deployment target; no code seam)
```

Swapping any provider requires only environment/endpoint changes — no kernel changes. If a provider disappears, Epoch's semantic model remains valid (degradation is surfaced, authoritative state persists in PostgreSQL).

## Deployment model

- One Vercel project connected to the GitHub repository; production deploys from `main` only; preview deploys from PRs automatically.
- Build: `pnpm install` (frozen lockfile) + the apps/web production build; the workspace packages are consumed as linked sources (transpiled by the Next build).
- Runtime: Node.js serverless functions (`/api/*` routes, `force-dynamic`); the product runtime singleton is built per instance and cached on globalThis (cold starts rebuild it; durable state is in Neon, so rebuilds are safe).
- Neon scale-to-zero: cold starts add latency on first connection after idle; the connection path uses a pool with the standard pg connection lifecycle; readiness reports the binding, not a live ping per request.

## What this topology optimizes for (in order)

1. correctness — the authority model is unchanged; all mutations through the gateway;
2. security — one boundary, fail-closed gates, server-side-only credentials;
3. free-tier viability — allowances verified in spec/free-tier-infrastructure.md;
4. provider portability — neutral ports at every seam;
5. low operational complexity — one deployed app, managed providers;
6. recovery — durable state in PostgreSQL, deterministic migrations from the repository, platform rollback;
7. observability — health/readyz + typed error envelopes + correlation IDs.
