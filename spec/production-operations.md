# Epoch Production Operations Contract (ACR-006)

Observability, health, degradation and operational procedures for the public deployment.

## Health endpoints

### `GET /api/healthz` — liveness
Typed JSON, always cheap, no dependencies touched:
```json
{ "ok": true, "profile": "production", "version": "<app version>", "uptimeMs": 12345 }
```

### `GET /api/readyz` — readiness
Typed JSON reporting the binding state; NEVER exposes secret values (presence booleans and kinds only):
```json
{
  "ok": true,
  "profile": "production",
  "ready": true,
  "bindings": {
    "persistence": { "kind": "postgres", "configured": true, "degraded": false },
    "objectStore": { "kind": "s3", "configured": true, "degraded": false },
    "rateLimit":   { "kind": "upstash", "configured": true, "degraded": false },
    "acquisition": { "kind": "apify", "configured": false, "degraded": true }
  },
  "migrations": { "applied": true, "planDigest": "sha256:…" },
  "degraded": ["acquisition-disabled"],
  "issues": ["EPOCH_APIFY_TOKEN not configured — external acquisition disabled"]
}
```
`ready=false` when a production-required binding is missing/degraded beyond policy. Unauthenticated (platform health checks need it); safe because it leaks no secrets and no semantic state.

## Error envelopes + provider-failure mapping

Every gateway response uses the frozen typed taxonomy. Provider failures map to:

| Provider failure | Mapped error |
|---|---|
| Rate-limit budget exceeded | `transient` / `gateway-overloaded` (+ `details.rateLimit{limit,remaining,retryAfterMs,guardId}`) |
| Upstash unavailable | guard failure policy (default fail-open + degraded flag) |
| PostgreSQL unavailable | `transient` / `gateway-overloaded` on mutating ops (idempotent retry safe); never a raw pg error |
| R2 unavailable / not-found | `transient` (uploads) / typed `object-not-found` (reads) — never raw provider XML |
| Apify failure | discovery run degrades; typed adapter failure recorded in run history; product healthy |

No raw provider error, stack trace or credential fragment ever crosses the boundary.

## Observability posture

- Correlation IDs on every operation (the W046 correlation ledger, persisted in Neon).
- Structured request logs at the platform level (Vercel observability, free tier).
- Readiness exposes degradation states for monitoring.
- Discovery run history (provenance records) doubles as acquisition observability.
- No third-party APM (free-tier discipline; platform-native observability suffices for the demo scale).

## Degradation states (surfaced)

| State | Meaning | User impact |
|---|---|---|
| `persistence:in-memory` | durable store unbound (non-production only) | sessions do not survive restarts |
| `object-store:in-memory` | bytes are ephemeral (non-production only) | uploaded evidence does not survive restarts |
| `rate-limit:in-memory` | per-instance limiting only | weaker abuse control across instances |
| `acquisition-disabled` | Apify unconfigured/unavailable | external discovery unavailable; fixture reference only |

Production policy: `persistence`/`object-store` degraded = NOT READY (boot failure); `rate-limit`/`acquisition` degraded = READY with flags.

## Operational procedures index

- `docs/operations/infrastructure.md` (W053): Neon/R2/Upstash provisioning verification, failure simulation, recovery, quota monitoring, backup/restore.
- `docs/operations/acquisition.md` (W054): Apify runs, quota guard, provenance, degradation/recovery.
- `spec/production-rollback.md` (W051): rollback/recovery.

## Recovery requirements

- Provider failure → typed degradation → recovery: verified by W053's negative battery and P16.
- Application restart → durable state intact: verified by P14.
- Deployment rollback → documented procedure with data-compatibility expectations: spec/production-rollback.md.
- Retry discipline: only idempotent operations retry; bounded attempts; exponential backoff; no retry storms.

## Alerting

Free-tier posture: no paid alerting. The health endpoints are pollable; the platform (Vercel) emails the account owner on deployment failures. The operator monitors via the readiness payload + provider dashboards (free). Anything beyond this is an explicit operator decision.
