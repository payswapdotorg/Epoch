# Epoch Deployment Documentation (ACR-006)

The deployment program documentation index. The authoritative contracts live in `spec/` (see below); these pages are the operator-facing guides.

## Documents

| Document | Owner | Content |
|---|---|---|
| `spec/deployment-architecture.md` | W051 | Topology, trust boundaries, ports, component responsibilities |
| `spec/production-environment.md` | W051 | The typed environment contract: profiles, variables, fail-safe precedence, bootstrap sequence, secret rules |
| `spec/free-tier-infrastructure.md` | W051 | The verified free-tier cost-control contract (Vercel/Neon/R2/Upstash/Apify) |
| `spec/production-security.md` | W051 | The public-launch security control matrix |
| `spec/production-operations.md` | W051 | Health/readiness contracts, error mapping, degradation states, ops index |
| `spec/production-rollback.md` | W051 | Rollback + recovery procedures, backup posture |
| `docs/deployment/vercel-setup.md` | W052 | The reproducible Vercel deployment runbook (delivered with the real deployment) |
| `docs/deployment/neon-r2-upstash-setup.md` | W053 | Provider provisioning guides (placeholders for secrets) |
| `docs/operations/infrastructure.md` | W053 | Infrastructure failure/recovery runbook |
| `docs/operations/acquisition.md` | W054 | Apify acquisition operations |

## Quick reference (the environment contract)

Copy `apps/web/.env.example` as the template. All values are placeholders; real values live only in the deployment platform's encrypted environment. Production requires `EPOCH_DATABASE_URL` + the `EPOCH_OBJECT_STORE_*` set (boot fails closed otherwise). Readiness: `GET /api/readyz`. Liveness: `GET /api/healthz`.

## The deployment program (W051-W055)

- W051 (this foundation): the environment contract, the RequestGuard port + in-memory reference, the S3/Upstash adapters (real implementations, double-tested), the production binding layer, health/readiness endpoints, the transport-level IP guard + request-size limit at the gateway route, vercel.json, env templates, the six production spec documents, the cost-control contract.
- W052: the real Vercel deployment + public URL + production journeys (P01-P18 web set).
- W053: live Neon/R2/Upstash connections + the nine mandatory negative tests + provisioning guides + production hardening.
- W054: the Apify acquisition adapter (quota-guarded, provenance-preserving) + operational runbooks.
- W055: serialized closure — topology verification, security review, rollback testing, journey consolidation, release identity.

## Honest status (do not trust claims without evidence)

No public URL exists yet. Real provider provisioning requires operator-owned credentials (Vercel/Neon/Cloudflare/Upstash/Apify accounts). Every work order records VERIFIED/NOT-VERIFIED states honestly; deployment URLs and identifiers enter the repository only after they are verified live.
